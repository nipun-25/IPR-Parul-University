import { describe, it, expect } from 'vitest';
import {
  ProvisionalPIDCSDraftSnapshotSchema,
  ProvisionalPIDCSSubmissionSnapshotSchema,
  ProvisionalPIDCSSnapshotSchema
} from '../src/contracts/provisional-pidcs.schema.js';

describe('Provisional PIDCS Schemas (Gate A1 Validation)', () => {
  const baseValidSnapshot = {
    title: 'Self-Stabilizing UAV Gimbal Mechanism',
    abstract: 'A mechanical gimbal mechanism with dual-axis dampening.',
    fieldOfInvention: 'Mechanical Robotics and Aerospace Control',
    detailedDescription: 'Full description of the components and kinematic linkages.',
    commercialPotential: 'Commercial drone cinematography and surveillance.',
    priorArtDetails: 'US Patent 9,123,456 discloses single-axis dampening.',
    inventors: [
      {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        portalUserId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        externalName: null,
        externalEmail: null,
        externalOrganization: null,
        isPrimary: true,
        shareBasisPoints: 6000
      },
      {
        id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        portalUserId: null,
        externalName: 'Dr. John Doe',
        externalEmail: 'jdoe@external-partner.org',
        externalOrganization: 'Robotics Labs Inc.',
        isPrimary: false,
        shareBasisPoints: 4000
      }
    ],
    attachments: [
      {
        id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        fileName: 'schematic_diagram.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1048576,
        sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      }
    ]
  };

  describe('Draft vs. Submission Share Separation', () => {
    it('draft schema accepts incomplete share allocations (< 10,000 basis points)', () => {
      const incompleteDraft = {
        ...baseValidSnapshot,
        inventors: [
          { ...baseValidSnapshot.inventors[0], shareBasisPoints: 3000 },
          { ...baseValidSnapshot.inventors[1], shareBasisPoints: 2000 }
        ] // Total = 5000 bps (< 10,000)
      };

      const draftResult = ProvisionalPIDCSDraftSnapshotSchema.safeParse(incompleteDraft);
      expect(draftResult.success).toBe(true);

      const submissionResult = ProvisionalPIDCSSubmissionSnapshotSchema.safeParse(incompleteDraft);
      expect(submissionResult.success).toBe(false);
      if (!submissionResult.success) {
        expect(submissionResult.error.issues[0].message).toContain('10,000 basis points');
      }
    });

    it('draft schema accepts unallocated inventor shares (0 basis points)', () => {
      const unallocatedDraft = {
        ...baseValidSnapshot,
        inventors: [
          { ...baseValidSnapshot.inventors[0], shareBasisPoints: 5000 },
          { ...baseValidSnapshot.inventors[1], shareBasisPoints: 0 }
        ]
      };

      const draftResult = ProvisionalPIDCSDraftSnapshotSchema.safeParse(unallocatedDraft);
      expect(draftResult.success).toBe(true);

      const submissionResult = ProvisionalPIDCSSubmissionSnapshotSchema.safeParse(unallocatedDraft);
      expect(submissionResult.success).toBe(false);
    });

    it('draft schema rejects over-allocated shares (> 10,000 basis points)', () => {
      const overAllocatedDraft = {
        ...baseValidSnapshot,
        inventors: [
          { ...baseValidSnapshot.inventors[0], shareBasisPoints: 7000 },
          { ...baseValidSnapshot.inventors[1], shareBasisPoints: 4000 }
        ] // Total = 11,000 bps
      };

      const draftResult = ProvisionalPIDCSDraftSnapshotSchema.safeParse(overAllocatedDraft);
      expect(draftResult.success).toBe(false);
      if (!draftResult.success) {
        expect(draftResult.error.issues[0].message).toContain('cannot exceed 10,000 basis points');
      }
    });

    it('submission schema accepts exactly 10,000 basis points', () => {
      const validSubmission = baseValidSnapshot; // 6000 + 4000 = 10,000 bps
      const result = ProvisionalPIDCSSubmissionSnapshotSchema.safeParse(validSubmission);
      expect(result.success).toBe(true);

      // Verify backward-compatible alias behavior
      const aliasResult = ProvisionalPIDCSSnapshotSchema.safeParse(validSubmission);
      expect(aliasResult.success).toBe(true);
    });

    it('submission schema rejects incomplete shares (< 10,000 basis points)', () => {
      const invalidSubmission = {
        ...baseValidSnapshot,
        inventors: [
          { ...baseValidSnapshot.inventors[0], shareBasisPoints: 5000 },
          { ...baseValidSnapshot.inventors[1], shareBasisPoints: 4999 }
        ] // Total = 9999 bps
      };

      const result = ProvisionalPIDCSSubmissionSnapshotSchema.safeParse(invalidSubmission);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('10,000 basis points');
      }
    });

    it('submission schema rejects an inventor with 0 basis points even if total is 10,000', () => {
      const zeroShareSubmission = {
        ...baseValidSnapshot,
        inventors: [
          { ...baseValidSnapshot.inventors[0], shareBasisPoints: 10000 },
          { ...baseValidSnapshot.inventors[1], shareBasisPoints: 0 }
        ]
      };

      const result = ProvisionalPIDCSSubmissionSnapshotSchema.safeParse(zeroShareSubmission);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 1 share basis point');
      }
    });
  });

  describe('Common Invariants (Both Draft and Submission)', () => {
    it('rejects an external inventor designated as primary inventor', () => {
      const externalPrimary = {
        ...baseValidSnapshot,
        inventors: [
          { ...baseValidSnapshot.inventors[0], isPrimary: false },
          { ...baseValidSnapshot.inventors[1], isPrimary: true }
        ]
      };

      expect(ProvisionalPIDCSDraftSnapshotSchema.safeParse(externalPrimary).success).toBe(false);
      expect(ProvisionalPIDCSSubmissionSnapshotSchema.safeParse(externalPrimary).success).toBe(false);
    });

    it('rejects duplicate internal inventors in roster', () => {
      const duplicateInternal = {
        ...baseValidSnapshot,
        inventors: [
          { ...baseValidSnapshot.inventors[0], shareBasisPoints: 5000 },
          {
            id: 'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
            portalUserId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', // duplicate portalUserId
            externalName: null,
            externalEmail: null,
            externalOrganization: null,
            isPrimary: false,
            shareBasisPoints: 5000
          }
        ]
      };

      expect(ProvisionalPIDCSDraftSnapshotSchema.safeParse(duplicateInternal).success).toBe(false);
      expect(ProvisionalPIDCSSubmissionSnapshotSchema.safeParse(duplicateInternal).success).toBe(false);
    });

    it('rejects duplicate external inventors by email (case-insensitive)', () => {
      const duplicateExternal = {
        ...baseValidSnapshot,
        inventors: [
          baseValidSnapshot.inventors[0],
          baseValidSnapshot.inventors[1],
          {
            id: 'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
            portalUserId: null,
            externalName: 'John Doe Jr.',
            externalEmail: 'JDOE@external-partner.org', // Case-insensitive duplicate
            externalOrganization: 'Other Lab',
            isPrimary: false,
            shareBasisPoints: 1000
          }
        ]
      };

      expect(ProvisionalPIDCSDraftSnapshotSchema.safeParse(duplicateExternal).success).toBe(false);
      expect(ProvisionalPIDCSSubmissionSnapshotSchema.safeParse(duplicateExternal).success).toBe(false);
    });

    it('rejects an inventor with hybrid identity violating mutual exclusivity', () => {
      const hybridInventor = {
        ...baseValidSnapshot,
        inventors: [
          {
            id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            portalUserId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
            externalName: 'Invalid Hybrid',
            externalEmail: 'test@invalid.com',
            externalOrganization: 'Invalid Org',
            isPrimary: true,
            shareBasisPoints: 10000
          }
        ]
      };

      expect(ProvisionalPIDCSDraftSnapshotSchema.safeParse(hybridInventor).success).toBe(false);
      expect(ProvisionalPIDCSSubmissionSnapshotSchema.safeParse(hybridInventor).success).toBe(false);
    });

    it('rejects when there are multiple primary inventors or zero primary inventors', () => {
      const multiplePrimary = {
        ...baseValidSnapshot,
        inventors: [
          { ...baseValidSnapshot.inventors[0], isPrimary: true },
          {
            id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
            portalUserId: 'f1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6e',
            externalName: null,
            externalEmail: null,
            externalOrganization: null,
            isPrimary: true, // Second primary inventor
            shareBasisPoints: 4000
          }
        ]
      };
      expect(ProvisionalPIDCSDraftSnapshotSchema.safeParse(multiplePrimary).success).toBe(false);
      expect(ProvisionalPIDCSSubmissionSnapshotSchema.safeParse(multiplePrimary).success).toBe(false);

      const zeroPrimary = {
        ...baseValidSnapshot,
        inventors: [
          { ...baseValidSnapshot.inventors[0], isPrimary: false },
          { ...baseValidSnapshot.inventors[1], isPrimary: false }
        ]
      };
      expect(ProvisionalPIDCSDraftSnapshotSchema.safeParse(zeroPrimary).success).toBe(false);
      expect(ProvisionalPIDCSSubmissionSnapshotSchema.safeParse(zeroPrimary).success).toBe(false);
    });
  });
});
