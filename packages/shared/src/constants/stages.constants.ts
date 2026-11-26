export const PATENT_STAGES = [
  'DRAFTING',
  'FILED',
  'EXAMINATION',
  'HEARING',
  'GRANTED',
  'REJECTED',
  'ABANDONED'
] as const;

export type PatentStage = (typeof PATENT_STAGES)[number];

export const TERMINAL_PATENT_STAGES: readonly PatentStage[] = [
  'GRANTED',
  'REJECTED',
  'ABANDONED'
] as const;

export const ALLOWED_STAGE_TRANSITIONS: Record<PatentStage, readonly PatentStage[]> = {
  DRAFTING: ['FILED', 'ABANDONED'],
  FILED: ['EXAMINATION', 'ABANDONED'],
  EXAMINATION: ['HEARING', 'ABANDONED'],
  HEARING: ['GRANTED', 'REJECTED'],
  GRANTED: [],
  REJECTED: [],
  ABANDONED: []
};

export const DISCLOSURE_WORKFLOW_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'PATENT_PENDING'
] as const;

export type DisclosureWorkflowStatus = (typeof DISCLOSURE_WORKFLOW_STATUSES)[number];

export const CONSENT_STATUSES = [
  'PENDING',
  'VERIFIED',
  'REVOKED'
] as const;

export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const AV_SCAN_STATUSES = [
  'QUARANTINED',
  'SCANNED_INFECTED',
  'SCANNED_REJECTED',
  'PROMOTION_PENDING',
  'CLEAN'
] as const;

export type AvScanStatus = (typeof AV_SCAN_STATUSES)[number];
