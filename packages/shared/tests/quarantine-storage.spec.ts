import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { InMemoryQuarantineStorage } from '../src/adapters/in-memory-quarantine-storage.js';

describe('Quarantine Storage Abstraction (Gate A2)', () => {
  let storage: InMemoryQuarantineStorage;
  const sampleContent = Buffer.from('PDF File Content for Invention Disclosure');
  const sampleChecksum = crypto.createHash('sha256').update(sampleContent).digest('hex');

  beforeEach(() => {
    storage = new InMemoryQuarantineStorage();
  });

  it('puts new upload strictly into QUARANTINED state', async () => {
    const metadata = await storage.putQuarantineObject(
      'obj-uuid-001',
      sampleContent,
      'schematic.pdf',
      'application/pdf'
    );

    expect(metadata.state).toBe('QUARANTINED');
    expect(metadata.version).toBe(1);
    expect(metadata.sha256Checksum).toBe(sampleChecksum);

    // Verify it is in quarantine bucket and NOT in approved bucket
    const quarantined = await storage.getQuarantineObject('obj-uuid-001');
    expect(quarantined).not.toBeNull();
    expect(quarantined?.metadata.state).toBe('QUARANTINED');

    const approved = await storage.getApprovedObject('obj-uuid-001');
    expect(approved).toBeNull();
  });

  it('transitions state to SCAN_CLEAN upon clean scan verification', async () => {
    await storage.putQuarantineObject('obj-uuid-002', sampleContent, 'doc.pdf', 'application/pdf');

    const updated = await storage.updateScanStatus('obj-uuid-002', 'SCAN_CLEAN', sampleChecksum);
    expect(updated.state).toBe('SCAN_CLEAN');
    expect(updated.version).toBe(2);
    expect(updated.scannedAt).toBeInstanceOf(Date);
  });

  it('rejects scan update when scanned checksum does not match stored bytes', async () => {
    await storage.putQuarantineObject('obj-uuid-003', sampleContent, 'doc.pdf', 'application/pdf');

    await expect(
      storage.updateScanStatus('obj-uuid-003', 'SCAN_CLEAN', '0000000000000000000000000000000000000000000000000000000000000000')
    ).rejects.toThrow('Scanned checksum does not match');
  });

  it('promotes clean object to approved bucket when identity, version, and checksum match', async () => {
    await storage.putQuarantineObject('obj-uuid-004', sampleContent, 'doc.pdf', 'application/pdf');
    const scanned = await storage.updateScanStatus('obj-uuid-004', 'SCAN_CLEAN', sampleChecksum);

    const promotion = await storage.promoteObject('obj-uuid-004', scanned.version, sampleChecksum);
    expect(promotion.success).toBe(true);
    expect(promotion.version).toBe(3);

    // Verify approved object is now retrievable from approved bucket
    const approved = await storage.getApprovedObject('obj-uuid-004');
    expect(approved).not.toBeNull();
    expect(approved?.metadata.state).toBe('PROMOTED');
    expect(approved?.content.toString()).toBe(sampleContent.toString());
  });

  it('prevents promotion if object is not in SCAN_CLEAN state (e.g. still QUARANTINED)', async () => {
    await storage.putQuarantineObject('obj-uuid-005', sampleContent, 'doc.pdf', 'application/pdf');

    // Attempt direct promotion without clean scan
    const promotion = await storage.promoteObject('obj-uuid-005', 1, sampleChecksum);
    expect(promotion.success).toBe(false);
    expect(promotion.reason).toContain("Invalid state for promotion: 'QUARANTINED'");

    const approved = await storage.getApprovedObject('obj-uuid-005');
    expect(approved).toBeNull();
  });

  it('prevents promotion if object is marked SCAN_INFECTED', async () => {
    await storage.putQuarantineObject('obj-uuid-006', sampleContent, 'virus.pdf', 'application/pdf');
    const infected = await storage.updateScanStatus('obj-uuid-006', 'SCAN_INFECTED', sampleChecksum);

    const promotion = await storage.promoteObject('obj-uuid-006', infected.version, sampleChecksum);
    expect(promotion.success).toBe(false);
    expect(promotion.reason).toContain("Invalid state for promotion: 'SCAN_INFECTED'");
  });

  it('prevents promotion on version mismatch (race condition protection)', async () => {
    await storage.putQuarantineObject('obj-uuid-007', sampleContent, 'doc.pdf', 'application/pdf');
    await storage.updateScanStatus('obj-uuid-007', 'SCAN_CLEAN', sampleChecksum); // Version becomes 2

    // Caller provides stale version 1
    const promotion = await storage.promoteObject('obj-uuid-007', 1, sampleChecksum);
    expect(promotion.success).toBe(false);
    expect(promotion.reason).toContain('Version mismatch');
  });

  it('prevents promotion on checksum mismatch', async () => {
    await storage.putQuarantineObject('obj-uuid-008', sampleContent, 'doc.pdf', 'application/pdf');
    const scanned = await storage.updateScanStatus('obj-uuid-008', 'SCAN_CLEAN', sampleChecksum);

    const promotion = await storage.promoteObject(
      'obj-uuid-008',
      scanned.version,
      '1111111111111111111111111111111111111111111111111111111111111111'
    );
    expect(promotion.success).toBe(false);
    expect(promotion.reason).toContain('Checksum verification failed');
  });
});
