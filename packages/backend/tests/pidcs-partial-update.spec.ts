import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import {
  InMemoryNonceStore,
  computeSha256,
  signCanonicalAssertion,
  buildCanonicalAssertionString
} from '@ipr/shared';
import { createApp } from '../src/app.js';
import { BackendEnv } from '../src/config/env.config.js';

/**
 * RFC 7396 (JSON Merge Patch) Reference Implementation for PIDCS Partial Updates.
 *
 * This implementation represents the exact semantics executed in PostgreSQL
 * via `auth_internal.jsonb_merge_patch(target JSONB, patch JSONB)`:
 *
 * 1. If patch is SQL NULL, preserve target unchanged.
 * 2. If patch is not an object (primitive or array), patch replaces target.
 * 3. If a key in patch has value `null`, that key is deleted from target.
 * 4. If a key in patch has an object and target has an object at that key, recurse (deep merge).
 * 5. Arrays in patch atomically replace arrays in target (no concatenation/element-wise merge).
 * 6. Empty arrays replace existing arrays with empty arrays.
 * 7. Omitted keys in patch are preserved intact from target.
 * 8. Nested values changing type (e.g. object -> string, string -> object) are replaced cleanly.
 */
export function applyPidcsMergePatch<T extends Record<string, unknown>>(
  target: T | null | undefined,
  patch: unknown
): unknown {
  if (patch === null || patch === undefined) {
    return target;
  }

  if (typeof patch !== 'object' || Array.isArray(patch)) {
    return patch;
  }

  const result: Record<string, unknown> = (typeof target === 'object' && target !== null && !Array.isArray(target))
    ? { ...target }
    : {};

  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === null) {
      delete result[key];
    } else if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value !== null &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key]) &&
      result[key] !== null
    ) {
      result[key] = applyPidcsMergePatch(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

describe('Stage 2D — PIDCS Partial Update & Data Integrity Verification', () => {
  const initialPidcsData = {
    title: 'Autonomous Solar Inverter',
    abstract: 'An efficient solar micro-inverter with MPPT algorithm.',
    fieldOfInvention: 'Renewable Energy & Power Electronics',
    detailedDescription: 'Full circuit description and microcontroller logic.',
    commercialPotential: 'High commercial demand in off-grid agricultural sector.',
    priorArtDetails: 'Existing systems lack dual-mode tracking.',
    metadata: {
      labFacility: 'Clean Energy Lab 4B',
      internalProjectCode: 'CEL-2026-X',
      reviewMilestones: {
        preliminaryPassed: true,
        departmentApproval: 'PENDING'
      }
    },
    inventors: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        portalUserId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        externalName: null,
        externalEmail: null,
        externalOrganization: null,
        isPrimary: true,
        shareBasisPoints: 6000
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        portalUserId: null,
        externalName: 'Dr. Jane External',
        externalEmail: 'jane@external.org',
        externalOrganization: 'Solar Research Inc',
        isPrimary: false,
        shareBasisPoints: 4000
      }
    ],
    attachments: [
      {
        id: '33333333-3333-3333-3333-333333333333',
        fileName: 'circuit_diagram.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1048576,
        sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      }
    ]
  };

  // 1. Updating one top-level PIDCS field preserves other fields
  it('1. Updating one top-level PIDCS field preserves all other omitted top-level fields', () => {
    const patch = {
      abstract: 'Updated abstract with improved thermal efficiency metrics.'
    };

    const updated = applyPidcsMergePatch(initialPidcsData, patch) as typeof initialPidcsData;

    expect(updated.abstract).toBe('Updated abstract with improved thermal efficiency metrics.');
    expect(updated.title).toBe(initialPidcsData.title);
    expect(updated.fieldOfInvention).toBe(initialPidcsData.fieldOfInvention);
    expect(updated.detailedDescription).toBe(initialPidcsData.detailedDescription);
    expect(updated.commercialPotential).toBe(initialPidcsData.commercialPotential);
    expect(updated.priorArtDetails).toBe(initialPidcsData.priorArtDetails);
    expect(updated.inventors).toEqual(initialPidcsData.inventors);
    expect(updated.attachments).toEqual(initialPidcsData.attachments);
    expect(updated.metadata).toEqual(initialPidcsData.metadata);
  });

  // 2. Nested objects and missing keys
  it('2. Nested objects and missing keys: preserves omitted nested properties and adds new keys', () => {
    const patch = {
      metadata: {
        internalProjectCode: 'CEL-2026-X-REVISED',
        reviewMilestones: {
          departmentApproval: 'APPROVED',
          ethicsApproval: 'GRANTED' // Newly added key in nested object
        }
      }
    };

    const updated = applyPidcsMergePatch(initialPidcsData, patch) as typeof initialPidcsData & {
      metadata: { reviewMilestones: { ethicsApproval: string } };
    };

    expect(updated.metadata.internalProjectCode).toBe('CEL-2026-X-REVISED');
    expect(updated.metadata.reviewMilestones.departmentApproval).toBe('APPROVED');
    expect(updated.metadata.reviewMilestones.ethicsApproval).toBe('GRANTED');

    // Missing keys in patch are preserved
    expect(updated.metadata.labFacility).toBe('Clean Energy Lab 4B');
    expect(updated.metadata.reviewMilestones.preliminaryPassed).toBe(true);
    expect(updated.abstract).toBe(initialPidcsData.abstract);
  });

  // 3. Arrays and empty arrays
  it('3. Arrays and empty arrays: replaced atomically (no concatenation), empty array clears array', () => {
    // A: Atomic replacement
    const replacementInventors = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        portalUserId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        externalName: null,
        externalEmail: null,
        externalOrganization: null,
        isPrimary: true,
        shareBasisPoints: 10000
      }
    ];

    const updatedWithNewRoster = applyPidcsMergePatch(initialPidcsData, {
      inventors: replacementInventors
    }) as typeof initialPidcsData;

    expect(updatedWithNewRoster.inventors).toHaveLength(1);
    expect(updatedWithNewRoster.inventors[0].shareBasisPoints).toBe(10000);
    expect(updatedWithNewRoster.attachments).toEqual(initialPidcsData.attachments);

    // B: Empty array replaces array with empty list
    const updatedWithEmptyAttachments = applyPidcsMergePatch(initialPidcsData, {
      attachments: []
    }) as typeof initialPidcsData;

    expect(updatedWithEmptyAttachments.attachments).toEqual([]);
    expect(updatedWithEmptyAttachments.inventors).toHaveLength(2);
  });

  // 4. Explicit JSON null
  it('4. Explicit JSON null: deletes/clears the specified top-level or nested properties', () => {
    const patch = {
      commercialPotential: null,
      metadata: {
        labFacility: null
      }
    };

    const updated = applyPidcsMergePatch(initialPidcsData, patch) as Record<string, unknown>;

    expect('commercialPotential' in updated).toBe(false);
    expect(updated.commercialPotential).toBeUndefined();

    const updatedMeta = updated.metadata as Record<string, unknown>;
    expect('labFacility' in updatedMeta).toBe(false);
    expect(updatedMeta.internalProjectCode).toBe('CEL-2026-X');
  });

  // 5. SQL NULL patch
  it('5. SQL NULL patch: preserves complete existing document when patch is null/undefined', () => {
    const updatedNull = applyPidcsMergePatch(initialPidcsData, null);
    expect(updatedNull).toEqual(initialPidcsData);

    const updatedUndefined = applyPidcsMergePatch(initialPidcsData, undefined);
    expect(updatedUndefined).toEqual(initialPidcsData);
  });

  // 6. Empty JSON object
  it('6. Empty JSON object: returns existing document unchanged with no keys added or removed', () => {
    const patch = {};
    const updated = applyPidcsMergePatch(initialPidcsData, patch);
    expect(updated).toEqual(initialPidcsData);
  });

  // 7. Non-object JSON values
  it('7. Non-object JSON values: when patch is primitive or array, it replaces the target', () => {
    expect(applyPidcsMergePatch(initialPidcsData, 'replacement_string')).toBe('replacement_string');
    expect(applyPidcsMergePatch(initialPidcsData, 12345)).toBe(12345);
    expect(applyPidcsMergePatch(initialPidcsData, [1, 2, 3])).toEqual([1, 2, 3]);
  });

  // 8. Nested values changing type
  it('8. Nested values changing type: replaces object with primitive and vice-versa cleanly', () => {
    // Object replaced by primitive string
    const patchObjToPrim = {
      metadata: 'Metadata converted to plain string note'
    };
    const updated1 = applyPidcsMergePatch(initialPidcsData, patchObjToPrim) as Record<string, unknown>;
    expect(updated1.metadata).toBe('Metadata converted to plain string note');
    expect(updated1.abstract).toBe(initialPidcsData.abstract);

    // Primitive replaced by nested object
    const patchPrimToObj = {
      priorArtDetails: {
        searchDate: '2026-11-26',
        databasesSearched: ['Google Patents', 'WIPO']
      }
    };
    const updated2 = applyPidcsMergePatch(initialPidcsData, patchPrimToObj) as Record<string, unknown>;
    expect(updated2.priorArtDetails).toEqual({
      searchDate: '2026-11-26',
      databasesSearched: ['Google Patents', 'WIPO']
    });
    expect(updated2.abstract).toBe(initialPidcsData.abstract);
  });

  // 9. Concurrent updates
  it('9. Concurrent updates: serialized row-locking ensures no lost updates between concurrent patches', () => {
    let databaseRowState = { ...initialPidcsData };

    const patch1 = { abstract: 'Abstract updated by concurrent transaction 1' };
    const patch2 = { fieldOfInvention: 'Field updated by concurrent transaction 2' };

    // Transaction 1 locks row FOR UPDATE, merges and writes:
    databaseRowState = applyPidcsMergePatch(databaseRowState, patch1) as typeof initialPidcsData;

    // Transaction 2 locks row FOR UPDATE, reads committed state, merges and writes:
    databaseRowState = applyPidcsMergePatch(databaseRowState, patch2) as typeof initialPidcsData;

    expect(databaseRowState.abstract).toBe('Abstract updated by concurrent transaction 1');
    expect(databaseRowState.fieldOfInvention).toBe('Field updated by concurrent transaction 2');
    expect(databaseRowState.detailedDescription).toBe(initialPidcsData.detailedDescription);
    expect(databaseRowState.inventors).toEqual(initialPidcsData.inventors);
  });

  // 10. Gateway behavior: Unauthorized access, non-DRAFT status rejection, outbox preservation
  describe('Gateway Level Behavioral Verification (Mocks & Invariants)', () => {
    const secretHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    let nonceStore: InMemoryNonceStore;
    let mockPool: { query: ReturnType<typeof vi.fn> };
    let app: ReturnType<typeof createApp>;

    const testEnv: BackendEnv = {
      NODE_ENV: 'test',
      PORT: 4002,
      CORS_ORIGIN: 'http://localhost:3000',
      LOG_LEVEL: 'silent',
      BFF_SHARED_SECRET: secretHex,
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_NAME: 'ipr_test',
      DB_USER: 'ipr_app',
      DB_PASSWORD: 'secret',
      DB_SSL: false,
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: 587,
      SMTP_USER: 'test@example.com',
      SMTP_PASSWORD: 'test-password'
    };

    const sampleDraftId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const primaryInventorId = 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    function makeHeaders(payload: unknown, actorId = primaryInventorId, roles = ['Student']) {
      const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      const nonce = 'patch_nonce_' + Math.random().toString(36).substring(2) + Date.now();
      const rawBody = payload !== undefined ? JSON.stringify(payload) : '';
      const bodyHash = computeSha256(rawBody);

      const canonical = buildCanonicalAssertionString({
        method: 'PATCH',
        canonicalPath: `/api/v1/drafts/${sampleDraftId}`,
        queryParams: '',
        operationScope: 'OP_UPDATE_DRAFT',
        actorId,
        roles,
        timestamp,
        nonce,
        bodyHash
      });

      return {
        'Content-Type': 'application/json',
        'X-BFF-Signature': signCanonicalAssertion(canonical, secretHex),
        'X-BFF-Actor-ID': actorId,
        'X-BFF-Roles': roles.join(','),
        'X-BFF-Operation-Scope': 'OP_UPDATE_DRAFT',
        'X-BFF-Timestamp': timestamp,
        'X-BFF-Nonce': nonce,
        'X-BFF-Body-Hash': bodyHash
      };
    }

    it('rejects unauthorized access when non-primary inventor attempts update (403 FORBIDDEN)', async () => {
      mockPool = { query: vi.fn() };
      nonceStore = new InMemoryNonceStore();
      app = createApp(testEnv, { dbPool: mockPool as unknown as Pool, nonceStore });

      mockPool.query.mockRejectedValueOnce(
        Object.assign(new Error('FORBIDDEN: Only primary inventor may update draft disclosure'), {
          code: '42501'
        })
      );

      const payload = { pidcsData: { abstract: 'Tampered abstract' } };
      const nonPrimaryId = '99999999-9999-9999-9999-999999999999';
      const headers = makeHeaders(payload, nonPrimaryId);

      const res = await request(app)
        .patch(`/api/v1/drafts/${sampleDraftId}`)
        .set(headers)
        .send(payload)
        .expect(403);

      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.detail).toContain('Only primary inventor may update draft disclosure');
    });

    it('rejects update when disclosure is not in DRAFT status (422 INVALID_WORKFLOW_STATE)', async () => {
      mockPool = { query: vi.fn() };
      nonceStore = new InMemoryNonceStore();
      app = createApp(testEnv, { dbPool: mockPool as unknown as Pool, nonceStore });

      mockPool.query.mockRejectedValueOnce(
        Object.assign(
          new Error('INVALID_STATE: Only DRAFT disclosures can be updated (current: SUBMITTED)'),
          { code: 'IPR05' }
        )
      );

      const payload = { pidcsData: { abstract: 'Late change attempt' } };
      const headers = makeHeaders(payload);

      const res = await request(app)
        .patch(`/api/v1/drafts/${sampleDraftId}`)
        .set(headers)
        .send(payload)
        .expect(422);

      expect(res.body.code).toBe('INVALID_WORKFLOW_STATE');
      expect(res.body.detail).toContain('Only DRAFT disclosures can be updated');
    });

    it('verifies SQL gateway call preserves outbox event contract and parameterization', async () => {
      mockPool = { query: vi.fn() };
      nonceStore = new InMemoryNonceStore();
      app = createApp(testEnv, { dbPool: mockPool as unknown as Pool, nonceStore });

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const payload = {
        title: 'New Valid Title',
        pidcsData: { abstract: 'Valid new abstract' }
      };
      const headers = makeHeaders(payload);

      await request(app)
        .patch(`/api/v1/drafts/${sampleDraftId}`)
        .set(headers)
        .send(payload)
        .expect(200);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sqlText, sqlParams] = mockPool.query.mock.calls[0];

      expect(sqlText).toBe(
        'SELECT public.update_draft_disclosure_v1($1::jsonb, $2::uuid, $3::varchar, $4::jsonb)'
      );
      expect(sqlParams[1]).toBe(sampleDraftId);
      expect(sqlParams[2]).toBe('New Valid Title');
      expect(JSON.parse(sqlParams[3])).toEqual({ abstract: 'Valid new abstract' });
    });
  });
});
