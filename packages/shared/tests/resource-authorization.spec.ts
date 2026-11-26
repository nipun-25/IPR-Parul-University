import { describe, it, expect, beforeEach } from 'vitest';
import { TestResourceAuthorizationProvider } from '../src/adapters/test-resource-authorization-provider.js';

describe('Resource-Level Authorization Boundary (Gate A2 P0 Closure)', () => {
  let provider: TestResourceAuthorizationProvider;

  const student1Id = 'student-uuid-1111';
  const student2Id = 'student-uuid-2222';
  const faculty1Id = 'faculty-uuid-3333';
  const faculty2Id = 'faculty-uuid-4444';
  const reviewerAssignedId = 'reviewer-uuid-5555';
  const reviewerUnassignedId = 'reviewer-uuid-6666';
  const reviewerConflictedId = 'reviewer-uuid-7777';
  const legalActorId = 'legal-uuid-8888';
  const adminActorId = 'admin-uuid-9999';

  beforeEach(() => {
    provider = new TestResourceAuthorizationProvider([
      {
        resourceId: 'disc-student-1',
        ownerId: student1Id,
        coInventorIds: [],
        assignedReviewerIds: [reviewerAssignedId],
        workflowStage: 'UNDER_REVIEW'
      },
      {
        resourceId: 'disc-faculty-1',
        ownerId: faculty1Id,
        coInventorIds: [reviewerConflictedId], // Reviewer 7777 is a co-inventor (conflict of interest)
        assignedReviewerIds: [reviewerAssignedId, reviewerConflictedId],
        workflowStage: 'SUBMITTED'
      },
      {
        resourceId: 'disc-mature-1',
        ownerId: faculty1Id,
        coInventorIds: [],
        assignedReviewerIds: [reviewerAssignedId],
        workflowStage: 'REVIEW_PASSED'
      }
    ]);
  });

  it("proves a student cannot access another student's disclosure", async () => {
    const outcome = await provider.authorizeResourceAccess({
      actorId: student2Id, // Student 2 attempting to access Student 1's disclosure
      roles: ['Student'],
      operationScope: 'OP_VIEW_DISCLOSURE',
      resourceType: 'DISCLOSURE',
      resourceId: 'disc-student-1'
    });

    expect(outcome.status).toBe('UNAUTHORIZED');
    if (outcome.status === 'UNAUTHORIZED') {
      expect(outcome.code).toBe('STUDENT_ACCESS_DENIED');
      expect(outcome.reason).toContain("cannot access another student's disclosure");
    }
  });

  it('allows a student to access their own disclosure', async () => {
    const outcome = await provider.authorizeResourceAccess({
      actorId: student1Id,
      roles: ['Student'],
      operationScope: 'OP_VIEW_DISCLOSURE',
      resourceType: 'DISCLOSURE',
      resourceId: 'disc-student-1'
    });

    expect(outcome.status).toBe('AUTHORIZED');
  });

  it('proves a faculty actor cannot access an unauthorized disclosure', async () => {
    const outcome = await provider.authorizeResourceAccess({
      actorId: faculty2Id, // Faculty 2 not associated with Faculty 1's disclosure
      roles: ['Faculty'],
      operationScope: 'OP_VIEW_DISCLOSURE',
      resourceType: 'DISCLOSURE',
      resourceId: 'disc-faculty-1'
    });

    expect(outcome.status).toBe('UNAUTHORIZED');
    if (outcome.status === 'UNAUTHORIZED') {
      expect(outcome.code).toBe('FACULTY_UNAUTHORIZED_DISCLOSURE');
      expect(outcome.reason).toContain('is not the primary inventor or a named co-inventor');
    }
  });

  it('proves an unassigned reviewer cannot access a disclosure', async () => {
    const outcome = await provider.authorizeResourceAccess({
      actorId: reviewerUnassignedId, // Reviewer 6666 not assigned
      roles: ['Reviewer'],
      operationScope: 'OP_VIEW_DISCLOSURE',
      resourceType: 'DISCLOSURE',
      resourceId: 'disc-student-1'
    });

    expect(outcome.status).toBe('UNAUTHORIZED');
    if (outcome.status === 'UNAUTHORIZED') {
      expect(outcome.code).toBe('REVIEWER_NOT_ASSIGNED');
      expect(outcome.reason).toContain('is not formally assigned to evaluate disclosure');
    }
  });

  it('proves an assigned reviewer with conflict of interest is rejected', async () => {
    const outcome = await provider.authorizeResourceAccess({
      actorId: reviewerConflictedId, // Assigned but is a co-inventor
      roles: ['Reviewer'],
      operationScope: 'OP_VIEW_DISCLOSURE',
      resourceType: 'DISCLOSURE',
      resourceId: 'disc-faculty-1'
    });

    expect(outcome.status).toBe('UNAUTHORIZED');
    if (outcome.status === 'UNAUTHORIZED') {
      expect(outcome.code).toBe('REVIEWER_CONFLICT_OF_INTEREST');
      expect(outcome.reason).toContain('documented conflict of interest');
    }
  });

  it('allows an assigned, non-conflicted reviewer to access a disclosure', async () => {
    const outcome = await provider.authorizeResourceAccess({
      actorId: reviewerAssignedId,
      roles: ['Reviewer'],
      operationScope: 'OP_VIEW_DISCLOSURE',
      resourceType: 'DISCLOSURE',
      resourceId: 'disc-student-1'
    });

    expect(outcome.status).toBe('AUTHORIZED');
  });

  it('proves legal actor cannot access a disclosure before it reaches permitted workflow stage', async () => {
    const outcome = await provider.authorizeResourceAccess({
      actorId: legalActorId,
      roles: ['Legal'],
      operationScope: 'OP_VIEW_DISCLOSURE',
      resourceType: 'DISCLOSURE',
      resourceId: 'disc-student-1' // Stage is 'UNDER_REVIEW', not 'REVIEW_PASSED'
    });

    expect(outcome.status).toBe('UNAUTHORIZED');
    if (outcome.status === 'UNAUTHORIZED') {
      expect(outcome.code).toBe('WORKFLOW_STAGE_RESTRICTION');
      expect(outcome.reason).toContain('outside the permitted workflow stage for Legal access');
    }
  });

  it('allows legal actor to access disclosure that has reached REVIEW_PASSED stage', async () => {
    const outcome = await provider.authorizeResourceAccess({
      actorId: legalActorId,
      roles: ['Legal'],
      operationScope: 'OP_VIEW_DISCLOSURE',
      resourceType: 'DISCLOSURE',
      resourceId: 'disc-mature-1' // Stage is 'REVIEW_PASSED'
    });

    expect(outcome.status).toBe('AUTHORIZED');
  });

  it('allows administrator access under approved administrative oversight policy', async () => {
    const outcome = await provider.authorizeResourceAccess({
      actorId: adminActorId,
      roles: ['Administrator'],
      operationScope: 'OP_VIEW_DISCLOSURE',
      resourceType: 'DISCLOSURE',
      resourceId: 'disc-student-1'
    });

    expect(outcome.status).toBe('AUTHORIZED');
  });

  it('fails closed when the authorization provider experiences an outage', async () => {
    provider.setSimulateFailure(true);

    const outcome = await provider.authorizeResourceAccess({
      actorId: student1Id,
      roles: ['Student'],
      operationScope: 'OP_VIEW_DISCLOSURE',
      resourceType: 'DISCLOSURE',
      resourceId: 'disc-student-1'
    });

    expect(outcome.status).toBe('PROVIDER_UNAVAILABLE');
    if (outcome.status === 'PROVIDER_UNAVAILABLE') {
      expect(outcome.error).toContain('Authorization repository is currently offline');
    }
  });
});
