import { ISessionProvider, BffSession } from './session.interface';
import { parseCookies, PortalRole } from '@ipr/shared';

interface RequestWithCookies extends Request {
  cookies?: {
    get(name: string): { value: string } | undefined;
  };
}

export class CookieSessionProvider implements ISessionProvider {
  constructor(
    private readonly backendOrigin: string,
    private readonly sessionValidator?: (rawSessionToken: string) => Promise<BffSession | null>
  ) {}

  public async getSession(request: Request): Promise<BffSession | null> {
    // 1. Strict cookie-based session extraction: reject and ignore mock headers
    // Do NOT read or trust 'x-test-session-user', 'x-test-session-roles', etc.
    let sessionToken: string | undefined;

    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const cookies = parseCookies(cookieHeader);
      sessionToken = cookies['ipr_session'];
    } else if ('cookies' in request) {
      const reqWithCookies = request as RequestWithCookies;
      if (typeof reqWithCookies.cookies?.get === 'function') {
        sessionToken = reqWithCookies.cookies.get('ipr_session')?.value;
      }
    }

    if (!sessionToken || sessionToken.length !== 64 || !/^[a-f0-9]{64}$/i.test(sessionToken)) {
      return null;
    }

    // 2. If a local session validator is injected (e.g. for unit testing), use it
    if (this.sessionValidator) {
      return this.sessionValidator(sessionToken);
    }

    // 3. Query Express backend to validate session in PostgreSQL
    try {
      const res = await fetch(`${this.backendOrigin}/api/v1/auth/session`, {
        method: 'GET',
        headers: {
          'Cookie': `ipr_session=${sessionToken}`
        }
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      if (!data.authenticated || !data.user || !data.sessionId) {
        return null;
      }

      return {
        actorId: data.user.id,
        roles: (data.user.activeRoles || []) as readonly PortalRole[],
        sessionId: data.sessionId,
        expiresAt: new Date(data.expiresAt)
      };
    } catch {
      return null;
    }
  }
}
