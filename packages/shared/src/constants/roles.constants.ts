export const PORTAL_ROLES = [
  'Student',
  'Faculty',
  'Reviewer',
  'Legal',
  'Administrator'
] as const;

export type PortalRole = (typeof PORTAL_ROLES)[number];

export const SYSTEM_PRINCIPALS = [
  'SystemScanner'
] as const;

export type SystemPrincipal = (typeof SYSTEM_PRINCIPALS)[number];

export const ALL_ROLES = [...PORTAL_ROLES, ...SYSTEM_PRINCIPALS] as const;
export type AllRole = (typeof ALL_ROLES)[number];

export function isPortalRole(role: string): role is PortalRole {
  return (PORTAL_ROLES as readonly string[]).includes(role);
}

export function isSystemPrincipal(principal: string): principal is SystemPrincipal {
  return (SYSTEM_PRINCIPALS as readonly string[]).includes(principal);
}

export function isAllRole(role: string): role is AllRole {
  return (ALL_ROLES as readonly string[]).includes(role);
}
