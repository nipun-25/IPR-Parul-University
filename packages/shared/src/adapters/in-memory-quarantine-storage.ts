import crypto from 'node:crypto';
import {
  IQuarantineStorageAdapter,
  QuarantineObjectMetadata,
  PromotionVerificationResult,
  QuarantineState
} from '../contracts/quarantine-storage.interface.js';

interface StoredItem {
  metadata: QuarantineObjectMetadata;
  content: Buffer;
}

/**
 * In-Memory Quarantine Storage Adapter.
 *
 * Implements strict isolation between the Quarantined bucket and Approved bucket.
 * Promotion requires immutable identity, version matching, and checksum verification.
 */
export class InMemoryQuarantineStorage implements IQuarantineStorageAdapter {
  private readonly quarantineBucket = new Map<string, StoredItem>();
  private readonly approvedBucket = new Map<string, StoredItem>();

  public async putQuarantineObject(
    objectId: string,
    content: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<QuarantineObjectMetadata> {
    if (!objectId) throw new Error('objectId is required');
    if (this.quarantineBucket.has(objectId)) {
      throw new Error(`Object with id '${objectId}' already exists in quarantine`);
    }

    const sha256Checksum = crypto.createHash('sha256').update(content).digest('hex');

    const metadata: QuarantineObjectMetadata = {
      objectId,
      originalFileName: fileName,
      mimeType,
      fileSizeBytes: content.length,
      sha256Checksum,
      version: 1,
      state: 'QUARANTINED',
      quarantinedAt: new Date()
    };

    this.quarantineBucket.set(objectId, { metadata, content: Buffer.from(content) });
    return { ...metadata };
  }

  public async getQuarantineObject(
    objectId: string
  ): Promise<{ metadata: QuarantineObjectMetadata; content: Buffer } | null> {
    const item = this.quarantineBucket.get(objectId);
    if (!item) return null;
    return {
      metadata: { ...item.metadata },
      content: Buffer.from(item.content)
    };
  }

  public async updateScanStatus(
    objectId: string,
    status: 'SCAN_CLEAN' | 'SCAN_INFECTED',
    scannedChecksum: string
  ): Promise<QuarantineObjectMetadata> {
    const item = this.quarantineBucket.get(objectId);
    if (!item) {
      throw new Error(`Quarantine object '${objectId}' not found`);
    }

    if (item.metadata.state !== 'QUARANTINED') {
      throw new Error(`Cannot update scan status from current state: '${item.metadata.state}'`);
    }

    if (item.metadata.sha256Checksum !== scannedChecksum.toLowerCase()) {
      throw new Error('Scanned checksum does not match stored quarantine checksum');
    }

    const updatedState: QuarantineState = status === 'SCAN_CLEAN' ? 'SCAN_CLEAN' : 'SCAN_INFECTED';
    item.metadata = {
      ...item.metadata,
      state: updatedState,
      scannedAt: new Date(),
      version: item.metadata.version + 1
    };

    return { ...item.metadata };
  }

  public async promoteObject(
    objectId: string,
    expectedVersion: number,
    expectedChecksum: string
  ): Promise<PromotionVerificationResult> {
    const item = this.quarantineBucket.get(objectId);
    if (!item) {
      return {
        success: false,
        objectId,
        version: expectedVersion,
        verifiedChecksum: expectedChecksum,
        reason: `Object '${objectId}' not found in quarantine`
      };
    }

    // State validation: only SCAN_CLEAN objects can be promoted
    if (item.metadata.state !== 'SCAN_CLEAN') {
      return {
        success: false,
        objectId,
        version: item.metadata.version,
        verifiedChecksum: item.metadata.sha256Checksum,
        reason: `Invalid state for promotion: '${item.metadata.state}'. Expected: 'SCAN_CLEAN'`
      };
    }

    // Version validation: prevents race conditions and out-of-order promotions
    if (item.metadata.version !== expectedVersion) {
      return {
        success: false,
        objectId,
        version: item.metadata.version,
        verifiedChecksum: item.metadata.sha256Checksum,
        reason: `Version mismatch. Expected: ${expectedVersion}, Current: ${item.metadata.version}`
      };
    }

    // Checksum re-verification: verify bytes are intact before promotion
    const contentChecksum = crypto.createHash('sha256').update(item.content).digest('hex');
    if (contentChecksum !== expectedChecksum.toLowerCase() || item.metadata.sha256Checksum !== expectedChecksum.toLowerCase()) {
      return {
        success: false,
        objectId,
        version: item.metadata.version,
        verifiedChecksum: contentChecksum,
        reason: `Checksum verification failed. Expected: '${expectedChecksum}', Actual: '${contentChecksum}'`
      };
    }

    // Execute atomic promotion into approved bucket
    const promotedMetadata: QuarantineObjectMetadata = {
      ...item.metadata,
      state: 'PROMOTED',
      promotedAt: new Date(),
      version: item.metadata.version + 1
    };

    this.approvedBucket.set(objectId, {
      metadata: promotedMetadata,
      content: Buffer.from(item.content)
    });

    // Mark quarantine entry as promoted
    item.metadata = promotedMetadata;

    return {
      success: true,
      objectId,
      version: promotedMetadata.version,
      verifiedChecksum: contentChecksum
    };
  }

  public async getApprovedObject(
    objectId: string
  ): Promise<{ metadata: QuarantineObjectMetadata; content: Buffer } | null> {
    const item = this.approvedBucket.get(objectId);
    if (!item) return null;
    return {
      metadata: { ...item.metadata },
      content: Buffer.from(item.content)
    };
  }

  public clear(): void {
    this.quarantineBucket.clear();
    this.approvedBucket.clear();
  }

  public async deleteQuarantineObject(objectId: string): Promise<void> {
    this.quarantineBucket.delete(objectId);
  }
}
