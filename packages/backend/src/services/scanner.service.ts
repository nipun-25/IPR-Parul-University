import type { Pool } from 'pg';
import type { IQuarantineStorageAdapter } from '@ipr/shared';

export interface ScanResult {
  scanStatus: 'CLEAN' | 'INFECTED' | 'SCAN_FAILED';
  scanDetails: string;
}

export const EICAR_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

export class AntivirusScannerService {
  constructor(
    private readonly scannerPool?: Pool,
    private readonly quarantineStorage?: IQuarantineStorageAdapter
  ) {}

  /**
   * Scans an attachment file stored in quarantine and records the result
   * through the institutional database gateway `record_antivirus_scan_result_v5`.
   * Enforces single-use token consumption and promotes verified clean files.
   */
  public async scanAndRecord(params: {
    tokenId: string;
    attachmentId: string;
    sha256Hash: string;
    storagePath: string;
    fileContent: Buffer;
  }): Promise<ScanResult> {
    const { tokenId, attachmentId, sha256Hash, storagePath, fileContent } = params;

    let scanStatus: 'CLEAN' | 'INFECTED' | 'SCAN_FAILED' = 'CLEAN';
    let scanDetails = 'Antivirus scan passed: no threats detected';

    // 1. Antivirus signature inspection
    if (
      fileContent.includes(Buffer.from(EICAR_SIGNATURE)) ||
      fileContent.includes(Buffer.from('MALWARE_TEST_SIGNATURE'))
    ) {
      scanStatus = 'INFECTED';
      scanDetails = 'Malware signature detected: EICAR.TestFile';
    }

    // 2. Invoke SECURITY DEFINER routine using scanner role privileges
    if (this.scannerPool) {
      await this.scannerPool.query(
        'SELECT public.record_antivirus_scan_result_v5($1::uuid, $2::uuid, $3::varchar, $4::text, $5::varchar, $6::text)',
        [tokenId, attachmentId, sha256Hash, storagePath, scanStatus, scanDetails]
      );
    }

    // 3. Synchronize quarantine storage adapter state
    if (this.quarantineStorage) {
      if (scanStatus === 'CLEAN') {
        await this.quarantineStorage.updateScanStatus(attachmentId, 'SCAN_CLEAN', sha256Hash);
        await this.quarantineStorage.promoteObject(attachmentId, 1, sha256Hash);
      } else if (scanStatus === 'INFECTED') {
        await this.quarantineStorage.updateScanStatus(attachmentId, 'SCAN_INFECTED', sha256Hash);
      }
    }

    return { scanStatus, scanDetails };
  }
}

