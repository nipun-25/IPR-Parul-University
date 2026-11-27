import { z } from 'zod';
import { ConsentStatus, AvScanStatus } from '../constants/stages.constants.js';
import { BasePIDCSObjectSchema } from '../contracts/provisional-pidcs.schema.js';

export interface CreateDraftDisclosureDto {
  title: string;
  pidcsData?: Record<string, unknown>;
}

export interface CreateDraftDisclosureResponseDto {
  success: boolean;
  draftId: string;
  message: string;
}

export interface UpdateDraftDisclosureDto {
  title?: string;
  pidcsData?: Record<string, unknown>;
}

export interface UpdateDraftDisclosureResponseDto {
  success: boolean;
  message: string;
  draftId: string;
}

export const UpdateDraftDisclosureSchema = z
  .object({
    title: z
      .string()
      .transform((val) => val.trim())
      .refine((val) => val.length > 0, { message: 'Title cannot be empty' })
      .optional(),
    pidcsData: z.record(z.unknown()).optional()
  })
  .strict()
  .refine((data) => data.title !== undefined || data.pidcsData !== undefined, {
    message: 'At least one field (title or pidcsData) must be provided for update'
  })
  .superRefine((data, ctx) => {
    if (data.pidcsData && Object.keys(data.pidcsData).length > 0) {
      const partialResult = BasePIDCSObjectSchema.partial().safeParse(data.pidcsData);
      if (!partialResult.success) {
        for (const issue of partialResult.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ['pidcsData', ...issue.path]
          });
        }
      }
    }
  });

export interface DisclosureDetailDto {
  id: string;
  trackingNumber: string | null;
  title: string;
  status: string;
  primaryInventorId: string;
  assignedReviewerId: string | null;
  reviewStatus: string;
  legalClearanceStatus: string;
  pidcsData: Record<string, unknown>;
  submissionTimestamp: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ViewDisclosureResponseDto {
  success: boolean;
  disclosure: DisclosureDetailDto;
}

export const CreateDraftDisclosureSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, { message: 'Title cannot be empty' }),
  pidcsData: z.record(z.unknown()).optional().default({})
}).superRefine((data, ctx) => {
  if (data.pidcsData && Object.keys(data.pidcsData).length > 0) {
    const partialResult = BasePIDCSObjectSchema.partial().safeParse(data.pidcsData);
    if (!partialResult.success) {
      for (const issue of partialResult.error.issues) {
        ctx.addIssue({
          ...issue,
          path: ['pidcsData', ...issue.path]
        });
      }
    }
  }
});

export interface DraftInventorDto {
  id: string;
  portalUserId: string | null;
  externalName: string | null;
  externalEmail: string | null;
  externalOrganization: string | null;
  isPrimary: boolean;
  shareBasisPoints: number;
  consentStatus?: ConsentStatus;
}

export interface DraftAttachmentDto {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Checksum: string;
  avScanStatus: AvScanStatus;
}

export interface DraftDisclosureDetailDto {
  id: string;
  primaryInventorId: string;
  title: string;
  abstract: string;
  fieldOfInvention: string;
  detailedDescription: string;
  commercialPotential: string;
  priorArtDetails: string;
  inventors: DraftInventorDto[];
  attachments: DraftAttachmentDto[];
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for draft disclosure submission.
 * Note: clientChecksum is accepted for wire and test compatibility and is bound
 * into the signed HTTP request body hash, but is NOT compared against persisted
 * disclosure state or PIDCS data by the backend or database gateway.
 */
export interface SubmitDisclosureDto {
  clientChecksum?: string;
}

export const SubmitDisclosureSchema = z.object({
  clientChecksum: z.string().min(1).optional()
}).strict();

export interface SubmitDisclosureResponseDto {
  success: boolean;
  message: string;
  trackingNumber: string;
  draftId: string;
  submittedAt?: string;
}

export const AbandonAttachmentSchema = z.object({
  attachmentId: z.string().uuid()
}).strict();

export type AbandonAttachmentDto = z.infer<typeof AbandonAttachmentSchema>;

export interface SubmissionResultDto {
  trackingNumber: string;
  submittedAt?: string;
}

export const CreateAttachmentSchema = z.object({
  disclosureId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileSizeBytes: z.number().int().positive(),
  mimeType: z.string().min(1).max(128),
  sha256Hash: z.string().regex(/^[0-9a-f]{64}$/i, 'Must be a 64-character hexadecimal SHA-256 hash'),
  storagePath: z.string().min(1)
}).strict();

export type CreateAttachmentDto = z.infer<typeof CreateAttachmentSchema>;

export const CreateConsentRequestSchema = z.object({
  disclosureId: z.string().uuid(),
  shareBasisPoints: z.number().int().min(1).max(10000),
  userId: z.string().uuid().optional(),
  isExternal: z.boolean().default(false),
  externalName: z.string().min(1).max(255).optional(),
  externalEmail: z.string().email().optional(),
  externalOrganization: z.string().min(1).max(255).optional()
}).strict().refine((data) => {
  if (data.isExternal) {
    return !!data.externalName && !!data.externalEmail;
  }
  return !!data.userId;
}, {
  message: 'Internal inventors require userId; external inventors require externalName and externalEmail'
});

export type CreateConsentRequestDto = z.infer<typeof CreateConsentRequestSchema>;

export const RevokeConsentSchema = z.object({
  consentId: z.string().uuid()
}).strict();

export type RevokeConsentDto = z.infer<typeof RevokeConsentSchema>;

export const CancelConsentInvitationSchema = z.object({
  consentId: z.string().uuid()
}).strict();

export type CancelConsentInvitationDto = z.infer<typeof CancelConsentInvitationSchema>;

export interface DisclosureListItemDto {
  id: string;
  trackingNumber: string | null;
  title: string;
  status: string;
  primaryInventorId: string;
  reviewStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventorConsentItemDto {
  id: string;
  disclosureId: string;
  userId: string | null;
  isExternal: boolean;
  externalName: string | null;
  externalEmail: string | null;
  externalOrganization: string | null;
  shareBasisPoints: number;
  status: string;
  signatureEvidenceId: string | null;
  verifiedAt: string | null;
}

export interface AttachmentItemDto {
  id: string;
  disclosureId: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  sha256Hash: string;
  scanStatus: string;
  createdAt: string;
}
