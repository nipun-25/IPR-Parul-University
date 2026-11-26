import { IRedisClient } from '../contracts/redis-client.interface.js';

interface RedisEntry {
  value: string;
  expiresAt: number;
}

/**
 * In-Memory Redis client adapter for testing and integration abstractions.
 * Note: Does not claim distributed consistency across multi-node environments.
 */
export class InMemoryRedisClient implements IRedisClient {
  private readonly store = new Map<string, RedisEntry>();
  private simulateFailure = false;

  public setSimulateFailure(fail: boolean): void {
    this.simulateFailure = fail;
  }

  public async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (this.simulateFailure) {
      throw new Error('Redis connection error: ECONNREFUSED');
    }

    const now = Date.now();
    const existing = this.store.get(key);

    if (existing && existing.expiresAt > now) {
      return false; // Key exists and is active
    }

    const expiresAt = now + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
    return true;
  }

  public async get(key: string): Promise<string | null> {
    if (this.simulateFailure) {
      throw new Error('Redis connection error: ECONNREFUSED');
    }

    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  public async del(key: string): Promise<boolean> {
    if (this.simulateFailure) {
      throw new Error('Redis connection error: ECONNREFUSED');
    }
    return this.store.delete(key);
  }

  public async disconnect(): Promise<void> {
    this.store.clear();
  }
}
