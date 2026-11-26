export type NonceConsumptionResult =
  | { readonly status: 'ACCEPTED' }
  | { readonly status: 'REPLAY_DETECTED'; readonly reason: string }
  | { readonly status: 'STORE_FAILURE'; readonly error: string };

export interface INonceStore {
  /**
   * Atomically records and consumes a nonce.
   * If the nonce has already been consumed within the validity window, returns REPLAY_DETECTED.
   * If the store is unavailable or throws, returns STORE_FAILURE so caller fails closed.
   */
  consumeNonce(
    nonce: string,
    timestamp: Date,
    ttlSeconds?: number
  ): Promise<NonceConsumptionResult>;

  /**
   * Cleans up expired nonces.
   */
  pruneExpired(): Promise<number>;
}
