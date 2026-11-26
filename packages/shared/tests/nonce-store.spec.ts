import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryNonceStore } from '../src/security/in-memory-nonce-store.js';

describe('Nonce Replay Protection & Store Abstraction (Gate A2)', () => {
  let nonceStore: InMemoryNonceStore;

  beforeEach(() => {
    nonceStore = new InMemoryNonceStore(300); // 300 seconds TTL
  });

  it('accepts a first-time valid nonce', async () => {
    const nonce = 'unique_nonce_1234567890abcdef';
    const timestamp = new Date();

    const result = await nonceStore.consumeNonce(nonce, timestamp);
    expect(result.status).toBe('ACCEPTED');
  });

  it('rejects a repeated nonce as a replay attack', async () => {
    const nonce = 'replayed_nonce_1234567890abcdef';
    const timestamp = new Date();

    // First consumption
    const firstResult = await nonceStore.consumeNonce(nonce, timestamp);
    expect(firstResult.status).toBe('ACCEPTED');

    // Second consumption attempt (replay)
    const secondResult = await nonceStore.consumeNonce(nonce, timestamp);
    expect(secondResult.status).toBe('REPLAY_DETECTED');
    if (secondResult.status === 'REPLAY_DETECTED') {
      expect(secondResult.reason).toContain('already been consumed');
    }
  });

  it('rejects a nonce that is already expired relative to current clock', async () => {
    const nonce = 'stale_nonce_1234567890abcdef';
    // Timestamp from 10 minutes ago with a 5 minute TTL
    const staleTimestamp = new Date(Date.now() - 600 * 1000);

    const result = await nonceStore.consumeNonce(nonce, staleTimestamp, 300);
    expect(result.status).toBe('REPLAY_DETECTED');
    if (result.status === 'REPLAY_DETECTED') {
      expect(result.reason).toContain('outside the active validity window');
    }
  });

  it('fails closed when store encounters backend failure', async () => {
    const nonce = 'fail_closed_nonce_123';
    const timestamp = new Date();

    // Trigger failure simulation
    nonceStore.setSimulateFailure(true);

    const result = await nonceStore.consumeNonce(nonce, timestamp);
    expect(result.status).toBe('STORE_FAILURE');
    if (result.status === 'STORE_FAILURE') {
      expect(result.error).toContain('Simulated connection failure');
    }
  });

  it('prunes expired nonces from storage', async () => {
    const pastTimestamp = new Date(Date.now() - 50); // 50ms ago
    await nonceStore.consumeNonce('short_lived_nonce_1', pastTimestamp, 0.1); // 100ms TTL

    // Wait 120ms to allow expiration
    await new Promise((resolve) => setTimeout(resolve, 120));

    const prunedCount = await nonceStore.pruneExpired();
    expect(prunedCount).toBe(1);
    expect(nonceStore.size()).toBe(0);
  });
});
