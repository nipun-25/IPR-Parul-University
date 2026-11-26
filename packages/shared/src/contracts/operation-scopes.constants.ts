import { AllRole } from '../constants/roles.constants.js';

export const OPERATION_SCOPES = [
  'OP_SUBMIT_DISCLOSURE',
  'OP_VIEW_DISCLOSURE',
  'OP_CREATE_DRAFT',
  'OP_UPDATE_DRAFT',
  'OP_UPLOAD_ATTACHMENT',
  'OP_CREATE_CONSENT',
  'OP_VERIFY_CONSENT',
  'OP_REVOKE_CONSENT',
  'OP_ASSIGN_REVIEWER',
  'OP_REVIEW_EVALUATION',
  'OP_LEGAL_CLEARANCE',
  'OP_CREATE_PATENT_APPLICATION',
  'OP_ASSIGN_LEGAL_OFFICER',
  'OP_TRANSITION_PATENT_STAGE'
] as const;

export type OperationScope = (typeof OPERATION_SCOPES)[number];

export interface ScopeDefinition {
  readonly scope: OperationScope;
  readonly permittedMethods: readonly ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[];
  readonly permittedRoles: readonly AllRole[];
  readonly description: string;
}

export const OPERATION_SCOPE_REGISTRY: Record<OperationScope, ScopeDefinition> = {
  OP_SUBMIT_DISCLOSURE: {
    scope: 'OP_SUBMIT_DISCLOSURE',
    permittedMethods: ['POST'],
    permittedRoles: ['Faculty', 'Student'],
    description: 'Final submission of invention disclosure snapshot by primary inventor'
  },
  OP_VIEW_DISCLOSURE: {
    scope: 'OP_VIEW_DISCLOSURE',
    permittedMethods: ['GET'],
    permittedRoles: ['Administrator', 'Reviewer', 'Legal', 'Faculty', 'Student'],
    description: 'Query disclosure details, evaluations, patent applications, and attachment metadata'
  },
  OP_CREATE_DRAFT: {
    scope: 'OP_CREATE_DRAFT',
    permittedMethods: ['POST'],
    permittedRoles: ['Faculty', 'Student'],
    description: 'Initialize a new invention disclosure draft by primary inventor'
  },
  OP_UPDATE_DRAFT: {
    scope: 'OP_UPDATE_DRAFT',
    permittedMethods: ['PUT', 'PATCH'],
    permittedRoles: ['Faculty', 'Student'],
    description: 'Update metadata or inventor roster in an existing draft by primary inventor'
  },
  OP_UPLOAD_ATTACHMENT: {
    scope: 'OP_UPLOAD_ATTACHMENT',
    permittedMethods: ['POST'],
    permittedRoles: ['Faculty', 'Student'],
    description: 'Initiate attachment upload to quarantine storage by primary inventor'
  },
  OP_CREATE_CONSENT: {
    scope: 'OP_CREATE_CONSENT',
    permittedMethods: ['POST'],
    permittedRoles: ['Faculty', 'Student'],
    description: 'Create consent token requests for co-inventors by primary inventor'
  },
  OP_VERIFY_CONSENT: {
    scope: 'OP_VERIFY_CONSENT',
    permittedMethods: ['POST'],
    permittedRoles: ['Administrator'],
    description: 'Administrative verification of submitted inventor signature evidence'
  },
  OP_REVOKE_CONSENT: {
    scope: 'OP_REVOKE_CONSENT',
    permittedMethods: ['POST'],
    permittedRoles: ['Faculty', 'Student'],
    description: 'Revoke previously granted inventor consent by consenting inventor'
  },
  OP_ASSIGN_REVIEWER: {
    scope: 'OP_ASSIGN_REVIEWER',
    permittedMethods: ['POST'],
    permittedRoles: ['Administrator'],
    description: 'Institutional administrative assignment of peer reviewer to submitted disclosure'
  },
  OP_REVIEW_EVALUATION: {
    scope: 'OP_REVIEW_EVALUATION',
    permittedMethods: ['POST'],
    permittedRoles: ['Reviewer'],
    description: 'Submit peer or institutional review evaluation by assigned reviewer'
  },
  OP_LEGAL_CLEARANCE: {
    scope: 'OP_LEGAL_CLEARANCE',
    permittedMethods: ['POST'],
    permittedRoles: ['Legal'],
    description: 'Submit legal search clearance and patentability assessment by legal officer'
  },
  OP_CREATE_PATENT_APPLICATION: {
    scope: 'OP_CREATE_PATENT_APPLICATION',
    permittedMethods: ['POST'],
    permittedRoles: ['Legal', 'Administrator'],
    description: 'Create formal patent application docket from cleared disclosure'
  },
  OP_ASSIGN_LEGAL_OFFICER: {
    scope: 'OP_ASSIGN_LEGAL_OFFICER',
    permittedMethods: ['POST'],
    permittedRoles: ['Administrator'],
    description: 'Institutional administrative assignment of legal officer to patent application'
  },
  OP_TRANSITION_PATENT_STAGE: {
    scope: 'OP_TRANSITION_PATENT_STAGE',
    permittedMethods: ['POST'],
    permittedRoles: ['Legal', 'Administrator'],
    description: 'Transition patent application through formal prosecution lifecycle stages by assigned legal officer or institutional administrator'
  }
};

export function isOperationScope(scope: string): scope is OperationScope {
  return (OPERATION_SCOPES as readonly string[]).includes(scope);
}

export function validateScopeAuthorization(
  scope: string,
  method: string,
  actorRoles: readonly string[]
): { valid: boolean; reason?: string; definition?: ScopeDefinition } {
  if (!isOperationScope(scope)) {
    return { valid: false, reason: `Unknown operation scope: '${scope}'` };
  }

  const def = OPERATION_SCOPE_REGISTRY[scope];
  const normalizedMethod = method.toUpperCase();

  if (!def.permittedMethods.includes(normalizedMethod as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')) {
    return {
      valid: false,
      reason: `Method '${normalizedMethod}' is not permitted for scope '${scope}'. Permitted: [${def.permittedMethods.join(', ')}]`,
      definition: def
    };
  }

  const hasAuthorizedRole = actorRoles.some((r) => def.permittedRoles.includes(r as AllRole));
  if (!hasAuthorizedRole) {
    return {
      valid: false,
      reason: `None of actor roles [${actorRoles.join(', ')}] are authorized for scope '${scope}'. Permitted: [${def.permittedRoles.join(', ')}]`,
      definition: def
    };
  }

  return { valid: true, definition: def };
}
