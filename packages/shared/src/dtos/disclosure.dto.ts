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

export interface SubmissionResultDto {
  trackingNumber: string;
  submittedAt?: string;
}
