import { PortalRole } from '@ipr/shared';

export interface BffSession {
  readonly actorId: string;
  readonly roles: readonly PortalRole[];
  readonly sessionId: string;
  readonly expiresAt: Date;
}

export interface ISessionProvider {
  /**
   * Retrieves and verifies authenticated session from incoming HTTP request.
   * Returns null if unauthenticated or session expired.
   */
  getSession(request: Request): Promise<BffSession | null>;
}
