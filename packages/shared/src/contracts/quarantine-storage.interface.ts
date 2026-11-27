export type QuarantineState =
  | 'QUARANTINED'
  | 'SCAN_CLEAN'
  | 'SCAN_INFECTED'
  | 'PROMOTED'
  | 'REJECTED';

export interface QuarantineObjectMetadata {
  readonly objectId: string;
  readonly originalFileName: string;
  readonly mimeType: string;
  readonly fileSizeBytes: number;
  readonly sha256Checksum: string;
  readonly version: number;
  readonly state: QuarantineState;
  readonly quarantinedAt: Date;
  readonly scannedAt?: Date;
  readonly promotedAt?: Date;
}

export interface PromotionVerificationResult {
  readonly success: boolean;
  readonly objectId: string;
  readonly version: number;
  readonly verifiedChecksum: string;
  readonly reason?: string;
}

export interface IQuarantineStorageAdapter {
  /**
   * Uploads object into quarantine isolation bucket.
   * State starts strictly as QUARANTINED.
   */
  putQuarantineObject(
    objectId: string,
    content: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<QuarantineObjectMetadata>;

  /**
   * Retrieves an object from quarantine for scanning or evaluation.
   */
  getQuarantineObject(objectId: string): Promise<{ metadata: QuarantineObjectMetadata; content: Buffer } | null>;

  /**
   * Updates scanning status (SCAN_CLEAN or SCAN_INFECTED).
   */
  updateScanStatus(
    objectId: string,
    status: 'SCAN_CLEAN' | 'SCAN_INFECTED',
    scannedChecksum: string
  ): Promise<QuarantineObjectMetadata>;

  /**
   * Atomic promotion from quarantine bucket to approved bucket.
   * Verification must match expected objectId, expectedVersion, and expectedChecksum.
   */
  promoteObject(
    objectId: string,
    expectedVersion: number,
    expectedChecksum: string
  ): Promise<PromotionVerificationResult>;

  /**
   * Retrieves promoted approved object from approved bucket.
   */
  getApprovedObject(objectId: string): Promise<{ metadata: QuarantineObjectMetadata; content: Buffer } | null>;

  /**
   * Safely deletes an isolated quarantine object upon abandonment or failed upload cleanup.
   */
  deleteQuarantineObject?(objectId: string): Promise<void>;
}
