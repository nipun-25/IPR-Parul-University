import { z } from 'zod';

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/zip'
] as const;

export const ProvisionalPIDCSInventorSchema = z.object({
  id: z.string().uuid(),
  portalUserId: z.string().uuid().nullable(),
  externalName: z.string().min(1).max(255).nullable(),
  externalEmail: z.string().email().nullable(),
  externalOrganization: z.string().min(1).max(255).nullable(),
  isPrimary: z.boolean(),
  // Drafts permit 0 for unallocated inventors; final submission enforces >= 1
  shareBasisPoints: z.number().int().min(0).max(10000)
}).refine((inv) => {
  // Exactly-one identity mode: internal or external
  const isInternal = inv.portalUserId !== null && inv.externalName === null && inv.externalEmail === null && inv.externalOrganization === null;
  const isExternal = inv.portalUserId === null && inv.externalName !== null && inv.externalEmail !== null && inv.externalOrganization !== null;
  return isInternal || isExternal;
}, {
  message: 'Inventor must be strictly internal (portalUserId only) or strictly external (all external fields populated).'
});

export const ProvisionalPIDCSAttachmentSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_ATTACHMENT_MIME_TYPES),
  fileSizeBytes: z.number().int().positive().max(26214400), // 25 MB max
  sha256Checksum: z.string().regex(/^[0-9a-f]{64}$/, 'sha256Checksum must be 64-character lowercase hexadecimal')
});

const basePIDCSSchemaShape = {
  title: z.string().min(1).max(512),
  abstract: z.string().min(1),
  fieldOfInvention: z.string().min(1),
  detailedDescription: z.string().min(1),
  commercialPotential: z.string().min(1),
  priorArtDetails: z.string().min(1),
  inventors: z.array(ProvisionalPIDCSInventorSchema).min(1).max(50),
  attachments: z.array(ProvisionalPIDCSAttachmentSchema).max(20)
};

/**
 * Common validation rule: prevents duplicate internal user IDs or duplicate external emails.
 */
function validateNoDuplicateInventors(data: { inventors: Array<z.infer<typeof ProvisionalPIDCSInventorSchema>> }) {
  const internalIds = data.inventors.map((i) => i.portalUserId).filter(Boolean) as string[];
  const externalEmails = data.inventors.map((i) => i.externalEmail?.toLowerCase()).filter(Boolean) as string[];
  return new Set(internalIds).size === internalIds.length && new Set(externalEmails).size === externalEmails.length;
}

/**
 * Common validation rule: requires exactly one primary inventor, who must be an internal portal user.
 */
function validateSingleInternalPrimary(data: { inventors: Array<z.infer<typeof ProvisionalPIDCSInventorSchema>> }) {
  const primaryInventors = data.inventors.filter((i) => i.isPrimary);
  return primaryInventors.length === 1 && primaryInventors[0].portalUserId !== null;
}

/**
 * Draft Save Snapshot Schema:
 * Permits intermediate/incomplete share allocations (< 10,000 basis points),
 * but forbids over-allocation (> 10,000 basis points).
 * Strictly enforces mutual exclusivity, duplicate prevention, and internal primary inventor.
 */
export const ProvisionalPIDCSDraftSnapshotSchema = z.object(basePIDCSSchemaShape)
  .refine((data) => {
    const totalShares = data.inventors.reduce((sum, inv) => sum + inv.shareBasisPoints, 0);
    return totalShares <= 10000;
  }, {
    message: 'Total inventor shares in a draft cannot exceed 10,000 basis points',
    path: ['inventors']
  })
  .refine(validateNoDuplicateInventors, {
    message: 'Duplicate inventors detected in disclosure roster',
    path: ['inventors']
  })
  .refine(validateSingleInternalPrimary, {
    message: 'Disclosure must have exactly one primary inventor, who must be an internal portal user',
    path: ['inventors']
  });

/**
 * Final Submission Snapshot Schema:
 * Strictly enforces that every inventor has at least 1 basis point (min >= 1),
 * and the sum of all shares equals exactly 10,000 basis points (100.00%).
 * Strictly enforces mutual exclusivity, duplicate prevention, and internal primary inventor.
 */
export const ProvisionalPIDCSSubmissionSnapshotSchema = z.object(basePIDCSSchemaShape)
  .refine((data) => {
    // Every inventor must have at least 1 basis point upon submission
    return data.inventors.every((inv) => inv.shareBasisPoints >= 1);
  }, {
    message: 'Every inventor must have at least 1 share basis point upon final submission',
    path: ['inventors']
  })
  .refine((data) => {
    const totalShares = data.inventors.reduce((sum, inv) => sum + inv.shareBasisPoints, 0);
    return totalShares === 10000;
  }, {
    message: 'Inventor shares must total exactly 10,000 basis points (100.00%) upon final submission',
    path: ['inventors']
  })
  .refine(validateNoDuplicateInventors, {
    message: 'Duplicate inventors detected in disclosure roster',
    path: ['inventors']
  })
  .refine(validateSingleInternalPrimary, {
    message: 'Disclosure must have exactly one primary inventor, who must be an internal portal user',
    path: ['inventors']
  });

// Backward-compatible alias for final submission snapshot
export const ProvisionalPIDCSSnapshotSchema = ProvisionalPIDCSSubmissionSnapshotSchema;

export type ProvisionalPIDCSDraftSnapshotInput = z.infer<typeof ProvisionalPIDCSDraftSnapshotSchema>;
export type ProvisionalPIDCSSubmissionSnapshotInput = z.infer<typeof ProvisionalPIDCSSubmissionSnapshotSchema>;
export type ProvisionalPIDCSSnapshotInput = ProvisionalPIDCSSubmissionSnapshotInput;
