import { OperationScope } from './operation-scopes.constants.js';
import { AllRole } from '../constants/roles.constants.js';

export type ResourceType =
  | 'DISCLOSURE'
  | 'DRAFT'
  | 'CONSENT'
  | 'ATTACHMENT'
  | 'EVALUATION';

export interface ResourceAuthorizationContext {
  readonly actorId: string;
  readonly roles: readonly AllRole[];
  readonly operationScope: OperationScope;
  readonly resourceType: ResourceType;
  readonly resourceId: string;
  readonly metadata?: {
    readonly ownerId?: string;
    readonly coInventorIds?: readonly string[];
    readonly assignedReviewerIds?: readonly string[];
    readonly workflowStage?: string;
    readonly isConflicted?: boolean;
    readonly [key: string]: unknown;
  };
}

export type ResourceAuthorizationOutcome =
  | { readonly status: 'AUTHORIZED'; readonly policyApplied?: string }
  | { readonly status: 'UNAUTHORIZED'; readonly reason: string; readonly code: string }
  | { readonly status: 'PROVIDER_UNAVAILABLE'; readonly error: string };

/**
 * Typed Resource-Level Authorization Provider Interface
 *
 * Implements the mandatory four-tier security separation:
 * 1. Authentication: Who is the actor? (Established by session provider)
 * 2. Request authenticity: Signed by trusted BFF? (Verified by HMAC-SHA256 assertion)
 * 3. Operation authorization: Category permitted by role? (Verified by Operation Scope Registry)
 * 4. Resource authorization: Specific resource instance access permitted? (Evaluated by this interface)
 *
 * IMPORTANT EXECUTION BOUNDARY NOTICE:
 * Production database-backed resource authorization (querying PostgreSQL ownership,
 * co-inventor lists, formal reviewer assignments, and workflow gates) is strictly
 * DEFERRED to Gate B.
 */
export interface IResourceAuthorizationProvider {
  authorizeResourceAccess(
    context: ResourceAuthorizationContext
  ): Promise<ResourceAuthorizationOutcome>;
}
