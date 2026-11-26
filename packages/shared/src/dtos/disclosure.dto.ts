import { ConsentStatus, AvScanStatus } from '../constants/stages.constants.js';

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

export interface SubmitDisclosureDto {
  clientChecksum: string;
}

export interface SubmissionResultDto {
  trackingNumber: string;
  submittedAt: string;
}
