import { ISessionProvider, BffSession } from './session.interface';

/**
 * TEST-ONLY SESSION PROVIDER
 * For explicit unit test mocking via constructor or setMockSession only.
 * Does NOT inspect or trust incoming request headers (x-test-session-* removed).
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

  public async getSession(_request: Request): Promise<BffSession | null> {
    if (this.activeSession) {
      if (this.activeSession.expiresAt.getTime() <= Date.now()) {
        return null;
      }
      return this.activeSession;
    }

    // Reject and never trust client-supplied mock headers
    return null;
  }
}
