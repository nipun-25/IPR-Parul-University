import {
  IResourceAuthorizationProvider,
  ResourceAuthorizationContext,
  ResourceAuthorizationOutcome
} from '../contracts/resource-authorization.interface.js';

export interface SimulatedResourceRecord {
  readonly resourceId: string;
  readonly ownerId: string;
  readonly coInventorIds: readonly string[];
  readonly assignedReviewerIds: readonly string[];
  readonly workflowStage: string;
  readonly isConflictedReviewerIds?: readonly string[];
}

/**
 * Test-Only Resource Authorization Provider.
 *
 * NOTE: For Gate A2 integration testing and verification only.
 * Production implementation using PostgreSQL institutional schemas is DEFERRED to Gate B.
 */
export class TestResourceAuthorizationProvider implements IResourceAuthorizationProvider {
  private readonly resources = new Map<string, SimulatedResourceRecord>();
  private simulateFailure = false;

  constructor(initialRecords: SimulatedResourceRecord[] = []) {
    for (const record of initialRecords) {
      this.resources.set(record.resourceId, record);
    }
  }

  public registerResource(record: SimulatedResourceRecord): void {
    this.resources.set(record.resourceId, record);
  }

  public setSimulateFailure(fail: boolean): void {
    this.simulateFailure = fail;
  }

  public async authorizeResourceAccess(
    context: ResourceAuthorizationContext
  ): Promise<ResourceAuthorizationOutcome> {
    if (this.simulateFailure) {
      return {
        status: 'PROVIDER_UNAVAILABLE',
        error: 'Simulated failure: Authorization repository is currently offline'
      };
    }

    const { actorId, roles, resourceId } = context;

    // Use metadata if provided directly, otherwise lookup from registry
    const record = this.resources.get(resourceId) ?? {
      resourceId,
      ownerId: context.metadata?.ownerId as string || '',
      coInventorIds: (context.metadata?.coInventorIds as string[]) || [],
      assignedReviewerIds: (context.metadata?.assignedReviewerIds as string[]) || [],
      workflowStage: (context.metadata?.workflowStage as string) || 'SUBMITTED',
      isConflictedReviewerIds: context.metadata?.isConflicted ? [actorId] : []
    };

    // 1. Administrator: Institutional policy permits administrative auditing and oversight
    if (roles.includes('Administrator')) {
      return {
        status: 'AUTHORIZED',
        policyApplied: 'ADMINISTRATIVE_OVERSIGHT_POLICY'
      };
    }

    // 2. Legal: Permitted only once the disclosure has reached legal clearance workflow stage
    if (roles.includes('Legal')) {
      const legalPermittedStages = ['REVIEW_PASSED', 'LEGAL_CLEARANCE', 'PATENT_FILING'];
      if (!legalPermittedStages.includes(record.workflowStage)) {
        return {
          status: 'UNAUTHORIZED',
          code: 'WORKFLOW_STAGE_RESTRICTION',
          reason: `Disclosure '${resourceId}' is in stage '${record.workflowStage}', which is outside the permitted workflow stage for Legal access.`
        };
      }
      return {
        status: 'AUTHORIZED',
        policyApplied: 'LEGAL_WORKFLOW_CLEARANCE_POLICY'
      };
    }

    // 3. Reviewer: Permitted only if formally assigned and free from conflict of interest
    if (roles.includes('Reviewer')) {
      const isAssigned = record.assignedReviewerIds.includes(actorId);
      if (!isAssigned) {
        return {
          status: 'UNAUTHORIZED',
          code: 'REVIEWER_NOT_ASSIGNED',
          reason: `Reviewer '${actorId}' is not formally assigned to evaluate disclosure '${resourceId}'.`
        };
      }

      const isConflicted = record.isConflictedReviewerIds?.includes(actorId) ||
        record.ownerId === actorId ||
        record.coInventorIds.includes(actorId);

      if (isConflicted) {
        return {
          status: 'UNAUTHORIZED',
          code: 'REVIEWER_CONFLICT_OF_INTEREST',
          reason: `Reviewer '${actorId}' has a documented conflict of interest on disclosure '${resourceId}'.`
        };
      }

      return {
        status: 'AUTHORIZED',
        policyApplied: 'ASSIGNED_REVIEWER_POLICY'
      };
    }

    // 4. Faculty: Permitted only if primary owner or co-inventor
    if (roles.includes('Faculty')) {
      const isAssociated = record.ownerId === actorId || record.coInventorIds.includes(actorId);
      if (!isAssociated) {
        return {
          status: 'UNAUTHORIZED',
          code: 'FACULTY_UNAUTHORIZED_DISCLOSURE',
          reason: `Faculty actor '${actorId}' is not the primary inventor or a named co-inventor on disclosure '${resourceId}'.`
        };
      }
      return {
        status: 'AUTHORIZED',
        policyApplied: 'INVENTOR_ASSOCIATION_POLICY'
      };
    }

    // 5. Student: Permitted only if own student submission or named student co-inventor
    if (roles.includes('Student')) {
      const isAssociated = record.ownerId === actorId || record.coInventorIds.includes(actorId);
      if (!isAssociated) {
        return {
          status: 'UNAUTHORIZED',
          code: 'STUDENT_ACCESS_DENIED',
          reason: `Student actor '${actorId}' cannot access another student's disclosure '${resourceId}'.`
        };
      }
      return {
        status: 'AUTHORIZED',
        policyApplied: 'STUDENT_OWNERSHIP_POLICY'
      };
    }

    return {
      status: 'UNAUTHORIZED',
      code: 'NO_MATCHING_AUTHORIZATION_POLICY',
      reason: 'No applicable resource authorization policy permitted access.'
    };
  }
}
