export interface IRedisClient {
  /**
   * Atomic set-if-absent with time-to-live in seconds.
   * Returns true if key was set (was absent), false if key already existed.
   */
  setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Retrieves string value for key, or null if key does not exist or expired.
   */
  get(key: string): Promise<string | null>;

  /**
   * Deletes key. Returns true if deleted, false if not found.
   */
  del(key: string): Promise<boolean>;

  /**
   * Closes connection cleanly.
   */
  disconnect(): Promise<void>;
}
