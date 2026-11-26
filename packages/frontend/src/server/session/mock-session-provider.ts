import { ISessionProvider, BffSession } from './session.interface';
import { PortalRole } from '@ipr/shared';

/**
 * TEST/MOCK SESSION PROVIDER
 *
 * IMPORTANT SECURITY NOTICE:
 * This provider is for Gate A2 testing, local scaffolding, and automated unit testing only.
 * It is NOT approved for production use. Production will integrate with institutional
 * identity providers (SSO/OAuth2/SAML) and secure HttpOnly cookie session stores.
 */
export class MockTestSessionProvider implements ISessionProvider {
  private activeSession: BffSession | null = null;

  constructor(defaultSession?: BffSession) {
    if (defaultSession) {
      this.activeSession = defaultSession;
    }
  }

  public setMockSession(session: BffSession | null): void {
    this.activeSession = session;
  }

  public async getSession(request: Request): Promise<BffSession | null> {
    // If an explicit session was configured in test fixture, use it
    if (this.activeSession) {
      if (this.activeSession.expiresAt.getTime() <= Date.now()) {
        return null;
      }
      return this.activeSession;
    }

    // Allow mock test header for simulated browser client requests in testing
    const testSessionHeader = request.headers.get('x-test-session-user');
    if (testSessionHeader) {
      return {
        actorId: testSessionHeader,
        roles: (request.headers.get('x-test-session-roles')?.split(',') as PortalRole[]) || ['Faculty'],
        sessionId: request.headers.get('x-test-session-id') || 'mock_session_id_123',
        expiresAt: new Date(Date.now() + 3600 * 1000)
      };
    }

    return null;
  }
}
