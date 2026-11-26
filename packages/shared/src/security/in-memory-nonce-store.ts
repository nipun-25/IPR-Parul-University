import { INonceStore, NonceConsumptionResult } from './nonce-store.interface.js';

interface NonceRecord {
  readonly nonce: string;
  readonly expiresAt: number;
}

/**
 * In-Memory Nonce Store implementation for automated testing.
 *
 * NOTE: As required by Gate A2 specification, an in-memory store is NOT a production
 * replay-protection mechanism across multiple processes or server restarts.
 * It provides an atomic abstraction for single-process testing and test doubles.
 */
export class InMemoryNonceStore implements INonceStore {
  private readonly store = new Map<string, NonceRecord>();
  private readonly defaultTtlMs: number;
  private simulateFailure = false;

  constructor(defaultTtlSeconds = 300) {
    this.defaultTtlMs = defaultTtlSeconds * 1000;
  }

  /**
   * Test-only toggle to verify fail-closed behavior when storage fails.
   */
  public setSimulateFailure(fail: boolean): void {
    this.simulateFailure = fail;
  }

  public async consumeNonce(
    nonce: string,
    timestamp: Date,
    ttlSeconds?: number
  ): Promise<NonceConsumptionResult> {
    if (this.simulateFailure) {
      return {
        status: 'STORE_FAILURE',
        error: 'Simulated connection failure to nonce store backend'
      };
    }

    if (!nonce || typeof nonce !== 'string' || nonce.trim() === '') {
      return {
        status: 'STORE_FAILURE',
        error: 'Nonce must be a non-empty string'
      };
    }

    const now = Date.now();
    const ttlMs = (ttlSeconds ?? (this.defaultTtlMs / 1000)) * 1000;
    const expiresAt = timestamp.getTime() + ttlMs;

    // Reject nonces that are already expired relative to current clock
    if (expiresAt <= now) {
      return {
        status: 'REPLAY_DETECTED',
        reason: 'Nonce timestamp is outside the active validity window'
      };
    }

    const existing = this.store.get(nonce);
    if (existing) {
      if (existing.expiresAt > now) {
        return {
          status: 'REPLAY_DETECTED',
          reason: `Nonce '${nonce}' has already been consumed and remains active until ${new Date(existing.expiresAt).toISOString()}`
        };
      }
      // Previously expired entry can be replaced safely
      this.store.delete(nonce);
    }

    this.store.set(nonce, { nonce, expiresAt });
    return { status: 'ACCEPTED' };
  }

  public async pruneExpired(): Promise<number> {
    const now = Date.now();
    let pruned = 0;
    for (const [key, record] of this.store.entries()) {
      if (record.expiresAt <= now) {
        this.store.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  public clear(): void {
    this.store.clear();
  }

  public size(): number {
    return this.store.size;
  }
}
