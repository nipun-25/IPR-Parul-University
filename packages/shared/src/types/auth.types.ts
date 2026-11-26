import { PortalRole, SystemPrincipal } from '../constants/roles.constants.js';

export interface AuthenticatedActorContext {
  actorId: string;
  puUid: string;
  roles: (PortalRole | SystemPrincipal)[];
  authVersion: number;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  puUid: string;
  roles: PortalRole[];
  csrfSecret: string;
  authVersion: number;
  createdAt: number;
  lastActivityAt: number;
}
