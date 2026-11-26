'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import type {
  DisclosureDetailDto,
  InventorConsentItemDto,
  AttachmentItemDto
} from '@ipr/shared';

interface UserSession {
  id: string;
  email: string;
  fullName: string;
  activeRoles: string[];
}

interface PIDCSFormState {
  title: string;
  fieldOfInvention: string;
  abstract: string;
  detailedDescription: string;
  commercialPotential: string;
  priorArtDetails: string;
}

export default function DisclosureWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const disclosureId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const [user, setUser] = useState<UserSession | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'details' | 'inventors' | 'attachments' | 'submit'>('details');

  // Disclosure data
  const [disclosure, setDisclosure] = useState<DisclosureDetailDto | null>(null);
  const [consents, setConsents] = useState<InventorConsentItemDto[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItemDto[]>([]);

  // Form State for Invention / PIDCS
  const [formData, setFormData] = useState<PIDCSFormState>({
    title: '',
    fieldOfInvention: '',
    abstract: '',
    detailedDescription: '',
    commercialPotential: '',
    priorArtDetails: ''
  });
  const [savingDetails, setSavingDetails] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string>('');
  const [saveError, setSaveError] = useState<string>('');

  // Add Co-Inventor State
  const [isExternal, setIsExternal] = useState<boolean>(false);
  const [userIdInput, setUserIdInput] = useState<string>('');
  const [externalName, setExternalName] = useState<string>('');
  const [externalEmail, setExternalEmail] = useState<string>('');
  const [externalOrg, setExternalOrg] = useState<string>('');
  const [shareBasisPoints, setShareBasisPoints] = useState<number>(1000); // 10.00%
  const [addingInventor, setAddingInventor] = useState<boolean>(false);
  const [inventorError, setInventorError] = useState<string>('');
  const [inventorSuccess, setInventorSuccess] = useState<string>('');

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadSuccess, setUploadSuccess] = useState<string>('');

  // Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [submittedTrackingNumber, setSubmittedTrackingNumber] = useState<string>('');

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  const fetchWorkspaceData = useCallback(async () => {
    if (!disclosureId) return;
    try {
      // 1. Fetch disclosure
      const dRes = await fetch(`/api/bff/disclosures/${disclosureId}`, { credentials: 'include' });
      if (!dRes.ok) {
        throw new Error('Failed to load disclosure details');
      }
      const dData = await dRes.json();
      const disc: DisclosureDetailDto = dData.disclosure;
      setDisclosure(disc);

      const pidcs = (disc.pidcsData || {}) as Record<string, string>;
      setFormData({
        title: disc.title || '',
        fieldOfInvention: pidcs.fieldOfInvention || '',
        abstract: pidcs.abstract || '',
        detailedDescription: pidcs.detailedDescription || '',
        commercialPotential: pidcs.commercialPotential || '',
        priorArtDetails: pidcs.priorArtDetails || ''
      });

      if (disc.trackingNumber) {
        setSubmittedTrackingNumber(disc.trackingNumber);
      }

      // 2. Fetch consents
      const cRes = await fetch(`/api/bff/disclosures/${disclosureId}/consents`, { credentials: 'include' });
      if (cRes.ok) {
        const cData = await cRes.json();
        setConsents(cData.consents || []);
      }

      // 3. Fetch attachments
      const aRes = await fetch(`/api/bff/disclosures/${disclosureId}/attachments`, { credentials: 'include' });
      if (aRes.ok) {
        const aData = await aRes.json();
        setAttachments(aData.attachments || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading disclosure data';
      setError(msg);
    }
  }, [disclosureId]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError('');
      try {
        const sessRes = await fetch(`${backendUrl}/api/v1/auth/session`, { credentials: 'include' });
        if (!sessRes.ok) {
          router.push('/login');
          return;
        }
        const sessData = await sessRes.json();
        if (!sessData.authenticated || !sessData.user) {
          router.push('/login');
          return;
        }
        setUser(sessData.user);
        setCsrfToken(sessData.csrfToken || '');

        await fetchWorkspaceData();
      } catch {
        setError('Network error while initializing disclosure workspace.');
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [backendUrl, fetchWorkspaceData, router]);

  // Handle saving details
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disclosure?.status !== 'DRAFT') return;

    setSavingDetails(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const res = await fetch(`/api/bff/drafts/${disclosureId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title.trim(),
          pidcsData: {
            fieldOfInvention: formData.fieldOfInvention.trim(),
            abstract: formData.abstract.trim(),
            detailedDescription: formData.detailedDescription.trim(),
            commercialPotential: formData.commercialPotential.trim(),
            priorArtDetails: formData.priorArtDetails.trim()
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to update disclosure details.');
      }

      setSaveSuccess('Invention details and PIDCS data updated successfully.');
      await fetchWorkspaceData();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSavingDetails(false);
    }
  };

  // Handle Add Co-Inventor
  const handleAddInventor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disclosure?.status !== 'DRAFT') return;

    setAddingInventor(true);
    setInventorError('');
    setInventorSuccess('');

    try {
      const payload = isExternal
        ? {
            disclosureId,
            shareBasisPoints: Number(shareBasisPoints),
            isExternal: true,
            externalName: externalName.trim(),
            externalEmail: externalEmail.trim(),
            externalOrganization: externalOrg.trim()
          }
        : {
            disclosureId,
            shareBasisPoints: Number(shareBasisPoints),
            isExternal: false,
            userId: userIdInput.trim()
          };

      const res = await fetch('/api/bff/consent/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to add co-inventor.');
      }

      setInventorSuccess('Co-inventor consent request created successfully.');
      setUserIdInput('');
      setExternalName('');
      setExternalEmail('');
      setExternalOrg('');
      setShareBasisPoints(1000);
      await fetchWorkspaceData();
    } catch (err: unknown) {
      setInventorError(err instanceof Error ? err.message : 'Error adding co-inventor.');
    } finally {
      setAddingInventor(false);
    }
  };

  // Handle Revoke Consent
  const handleRevokeConsent = async (consentId: string) => {
    if (disclosure?.status !== 'DRAFT') return;
    if (!confirm('Are you sure you want to revoke this consent request?')) return;

    try {
      const res = await fetch('/api/bff/consent/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ consentId })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || data.message || 'Failed to revoke consent.');
        return;
      }

      await fetchWorkspaceData();
    } catch {
      alert('Network failure while revoking consent.');
    }
  };

  // Helper to compute SHA-256 hash in browser
  const computeFileSha256 = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  // Handle Attachment Upload
  const handleUploadAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || disclosure?.status !== 'DRAFT') return;

    setUploadingFile(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      if (selectedFile.size > 26214400) {
        throw new Error('File exceeds the maximum permitted limit of 25 MB.');
      }

      const sha256Hash = await computeFileSha256(selectedFile);
      const safePath = `disclosures/${disclosureId}/${Date.now()}-${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      const res = await fetch('/api/bff/attachments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          disclosureId,
          fileName: selectedFile.name,
          fileSizeBytes: selectedFile.size,
          mimeType: selectedFile.type || 'application/octet-stream',
          sha256Hash,
          storagePath: safePath
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to register attachment.');
      }

      // Step 2: Stream raw file bytes to quarantine upload endpoint
      const arrayBuffer = await selectedFile.arrayBuffer();
      const uploadRes = await fetch(`/api/bff/attachments/${data.attachmentId}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': selectedFile.type || 'application/octet-stream',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: arrayBuffer
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.detail || uploadData.message || 'Failed to upload attachment content to quarantine.');
      }

      if (uploadData.scanStatus === 'CLEAN') {
        setUploadSuccess('File uploaded to quarantine and verified CLEAN by antivirus scanner.');
      } else if (uploadData.scanStatus === 'INFECTED') {
        setUploadError('Warning: File uploaded but flagged as INFECTED by antivirus scanner.');
      } else if (uploadData.scanStatus === 'SCAN_FAILED') {
        setUploadError('Antivirus scan failed to evaluate this file.');
      } else {
        setUploadSuccess('File uploaded to quarantine successfully.');
      }

      setSelectedFile(null);
      await fetchWorkspaceData();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload attachment.');
    } finally {
      setUploadingFile(false);
    }
  };

  // Handle Final Submission
  const handleSubmitDisclosure = async () => {
    if (disclosure?.status !== 'DRAFT') return;
    if (!confirm('Are you sure you want to officially submit this invention disclosure? Once submitted, the draft cannot be modified.')) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch(`/api/bff/drafts/${disclosureId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({})
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Submission failed. Ensure all checklist requirements are met.');
      }

      setSubmittedTrackingNumber(data.trackingNumber);
      await fetchWorkspaceData();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Disclosure submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Computed Checklist Metrics
  const totalBasisPoints = consents
    .filter((c) => c.status === 'PENDING' || c.status === 'VERIFIED')
    .reduce((sum, c) => sum + Number(c.shareBasisPoints), 0);

  const isShares100Percent = totalBasisPoints === 10000;
  const allConsentsVerified = consents.length > 0 && consents.every((c) => c.status === 'VERIFIED');
  const hasSpecAttachment = attachments.length > 0;
  const allAttachmentsClean = attachments.length > 0 && attachments.every((a) => a.scanStatus === 'CLEAN');

  const canSubmit =
    disclosure?.status === 'DRAFT' &&
    isShares100Percent &&
    allConsentsVerified &&
    hasSpecAttachment &&
    allAttachmentsClean;

  const isSubmitted = disclosure?.status === 'SUBMITTED';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800">Loading Disclosure Workspace...</h2>
          <p className="text-sm text-slate-500 mt-1">Verifying actor credentials and fetching records.</p>
        </div>
      </div>
    );
  }

  if (error || !disclosure) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Disclosure Not Available</h2>
          <p className="text-sm text-slate-600 mb-6">{error || 'Could not find the requested disclosure record.'}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
            <span className="text-slate-300">|</span>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                Workspace
              </span>
              <span className="text-sm font-bold text-slate-800 truncate max-w-xs sm:max-w-md">
                {disclosure.title}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {user && (
              <span className="text-xs text-slate-500 hidden sm:inline">
                Inventor: <strong className="text-slate-700">{user.fullName}</strong>
              </span>
            )}
            {isSubmitted ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <svg className="w-3.5 h-3.5 mr-1 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                SUBMITTED
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-amber-500" />
                DRAFT (UNSUBMITTED)
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Hero Workspace Banner */}
      <div className="bg-white border-b border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight truncate">
                  {disclosure.title}
                </h1>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-500">
                <div>
                  <span className="font-medium text-slate-700">Disclosure ID:</span>{' '}
                  <span className="font-mono text-slate-600">{disclosure.id}</span>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Created:</span>{' '}
                  {new Date(disclosure.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
                <div>
                  <span className="font-medium text-slate-700">Last Modified:</span>{' '}
                  {new Date(disclosure.updatedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                {submittedTrackingNumber && (
                  <div>
                    <span className="font-medium text-slate-700">Tracking Number:</span>{' '}
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {submittedTrackingNumber}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {isSubmitted && (
              <div className="mt-4 md:mt-0 flex-shrink-0">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-right">
                  <div className="text-xs uppercase tracking-wider font-semibold text-emerald-800">
                    Official Reference Number
                  </div>
                  <div className="text-xl font-mono font-extrabold text-emerald-900 mt-0.5">
                    {submittedTrackingNumber}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Locked Notice if submitted */}
          {isSubmitted && (
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center space-x-3 text-xs text-slate-600">
              <svg className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>
                <strong>Disclosure Locked:</strong> This invention disclosure has been officially submitted and is locked for edits. All fields, consents, and attachments are strictly read-only.
              </span>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="mt-6 border-b border-slate-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('details')}
                className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition ${
                  activeTab === 'details'
                    ? 'border-indigo-600 text-indigo-600 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                1. Invention & PIDCS Details
              </button>

              <button
                onClick={() => setActiveTab('inventors')}
                className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition flex items-center ${
                  activeTab === 'inventors'
                    ? 'border-indigo-600 text-indigo-600 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                2. Inventors & Consents
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                  isShares100Percent ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {consents.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('attachments')}
                className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition flex items-center ${
                  activeTab === 'attachments'
                    ? 'border-indigo-600 text-indigo-600 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                3. Attachments & AV Scans
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
                  {attachments.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('submit')}
                className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition flex items-center ${
                  activeTab === 'submit'
                    ? 'border-indigo-600 text-indigo-600 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                4. Submission & Tracking
                {canSubmit && !isSubmitted && (
                  <span className="ml-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ========================================================================= */}
        {/* TAB 1: INVENTION & PIDCS DETAILS */}
        {/* ========================================================================= */}
        {activeTab === 'details' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Invention Specification & PIDCS Information</h2>
              <p className="text-xs text-slate-500 mt-1">
                Provide comprehensive technological disclosures to establish provisional patent priority.
              </p>
            </div>

            <form onSubmit={handleSaveDetails} className="p-6 space-y-6">
              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center space-x-2">
                  <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{saveSuccess}</span>
                </div>
              )}

              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center space-x-2">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{saveError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Invention Title *
                </label>
                <input
                  type="text"
                  disabled={isSubmitted}
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder="e.g., Autonomous IoT Irrigation Optimization System Using Edge AI"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Field of Invention *
                  </label>
                  <input
                    type="text"
                    disabled={isSubmitted}
                    value={formData.fieldOfInvention}
                    onChange={(e) => setFormData({ ...formData, fieldOfInvention: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                    placeholder="e.g., Agricultural Technology, Embedded Edge Computing"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Commercial Potential *
                  </label>
                  <input
                    type="text"
                    disabled={isSubmitted}
                    value={formData.commercialPotential}
                    onChange={(e) => setFormData({ ...formData, commercialPotential: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                    placeholder="e.g., Target market: precision farming suppliers and greenhouse managers"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Invention Abstract *
                </label>
                <textarea
                  rows={3}
                  disabled={isSubmitted}
                  value={formData.abstract}
                  onChange={(e) => setFormData({ ...formData, abstract: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder="Concise summary (max 250 words) describing the technological breakthrough and utility..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Detailed Technological Description *
                </label>
                <textarea
                  rows={6}
                  disabled={isSubmitted}
                  value={formData.detailedDescription}
                  onChange={(e) => setFormData({ ...formData, detailedDescription: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder="Detailed architecture, system schematics, algorithmic workflows, experimental results, and step-by-step embodiment..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Prior Art & Known Alternative Solutions
                </label>
                <textarea
                  rows={3}
                  disabled={isSubmitted}
                  value={formData.priorArtDetails}
                  onChange={(e) => setFormData({ ...formData, priorArtDetails: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder="List existing patents, academic publications, or commercial products and explain why your invention is distinct and non-obvious..."
                />
              </div>

              {!isSubmitted && (
                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={savingDetails}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {savingDetails ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Saving Changes...
                      </>
                    ) : (
                      'Save Draft Details'
                    )}
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: INVENTORS & CONSENTS */}
        {/* ========================================================================= */}
        {activeTab === 'inventors' && (
          <div className="space-y-8">
            {/* Share Distribution Header */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Inventor Consortium & Share Distribution</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Every inventor must hold a defined share. Total share must equal exactly 10,000 basis points (100.00%).
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-mono font-bold text-slate-900">
                    {(totalBasisPoints / 100).toFixed(2)}%
                  </div>
                  <div className={`text-xs font-semibold ${isShares100Percent ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {totalBasisPoints} / 10,000 basis points
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 rounded-full h-3 mt-4 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isShares100Percent
                      ? 'bg-emerald-500'
                      : totalBasisPoints > 10000
                      ? 'bg-red-500'
                      : 'bg-indigo-500'
                  }`}
                  style={{ width: `${Math.min(100, totalBasisPoints / 100)}%` }}
                />
              </div>

              {/* Institutional Policy Callout */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start space-x-2">
                <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <strong className="font-semibold">Parul University Institutional Policy:</strong> Only an Administrator can verify uploaded inventor signatures and confirm consent. All consents must reach the <code className="bg-blue-100 px-1 rounded">VERIFIED</code> state prior to final submission.
                </div>
              </div>
            </div>

            {/* Inventors Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Registered Co-Inventors ({consents.length})
                </h3>
              </div>

              {consents.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No co-inventors added yet. The primary inventor holds the primary submission rights.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3">Inventor Type</th>
                        <th className="px-6 py-3">Identity / Organization</th>
                        <th className="px-6 py-3">Share</th>
                        <th className="px-6 py-3">Consent Status</th>
                        {!isSubmitted && <th className="px-6 py-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {consents.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            {c.isExternal ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                External Inventor
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                University User
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {c.isExternal ? (
                              <div>
                                <div className="font-semibold text-slate-900">{c.externalName}</div>
                                <div className="text-xs text-slate-500">{c.externalEmail}</div>
                                <div className="text-xs text-slate-400 font-medium">{c.externalOrganization}</div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-mono text-xs text-slate-900">{c.userId}</div>
                                <div className="text-xs text-slate-500">Parul University Institutional Account</div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono font-semibold text-slate-800">
                            {(c.shareBasisPoints / 100).toFixed(2)}% ({c.shareBasisPoints} bps)
                          </td>
                          <td className="px-6 py-4">
                            {c.status === 'VERIFIED' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                                VERIFIED
                              </span>
                            ) : c.status === 'PENDING' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                                PENDING VERIFICATION
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
                                REVOKED
                              </span>
                            )}
                          </td>
                          {!isSubmitted && (
                            <td className="px-6 py-4 text-right">
                              {c.status !== 'REVOKED' && (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeConsent(c.id)}
                                  className="text-xs font-semibold text-red-600 hover:text-red-800 hover:underline"
                                >
                                  Revoke
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Add Co-Inventor Form (Only when draft) */}
            {!isSubmitted && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">
                  Add Co-Inventor
                </h3>

                {inventorSuccess && (
                  <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
                    {inventorSuccess}
                  </div>
                )}
                {inventorError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                    {inventorError}
                  </div>
                )}

                <form onSubmit={handleAddInventor} className="space-y-4">
                  <div className="flex items-center space-x-6 text-sm">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        checked={!isExternal}
                        onChange={() => setIsExternal(false)}
                        className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <span className="ml-2 font-medium text-slate-700">Internal University User</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        checked={isExternal}
                        onChange={() => setIsExternal(true)}
                        className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <span className="ml-2 font-medium text-slate-700">External Co-Inventor</span>
                    </label>
                  </div>

                  {!isExternal ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Portal User ID (UUID) *
                      </label>
                      <input
                        type="text"
                        required
                        value={userIdInput}
                        onChange={(e) => setUserIdInput(e.target.value)}
                        placeholder="e.g. 11111111-2222-3333-4444-555555555555"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={externalName}
                          onChange={(e) => setExternalName(e.target.value)}
                          placeholder="Dr. Co-Inventor Name"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={externalEmail}
                          onChange={(e) => setExternalEmail(e.target.value)}
                          placeholder="collaborator@external.org"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Organization / Affiliation *
                        </label>
                        <input
                          type="text"
                          required
                          value={externalOrg}
                          onChange={(e) => setExternalOrg(e.target.value)}
                          placeholder="Partner Research Lab"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="max-w-xs">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Share Basis Points (1 to 10,000) *
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        required
                        value={shareBasisPoints}
                        onChange={(e) => setShareBasisPoints(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-500 whitespace-nowrap">
                        = {(shareBasisPoints / 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={addingInventor}
                      className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      {addingInventor ? 'Registering Co-Inventor...' : 'Send Consent Request'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ATTACHMENTS & ANTIVIRUS SCANS */}
        {/* ========================================================================= */}
        {activeTab === 'attachments' && (
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Supporting Specification Documents ({attachments.length})
                </h3>
              </div>

              {attachments.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No attachments uploaded yet. At least one specification document (PDF, PNG, JPEG, ZIP) is required.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3">File Name</th>
                        <th className="px-6 py-3">Size</th>
                        <th className="px-6 py-3">MIME Type</th>
                        <th className="px-6 py-3">SHA-256 Checksum</th>
                        <th className="px-6 py-3">Antivirus Scan Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {attachments.map((att) => (
                        <tr key={att.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-semibold text-slate-900">
                            {att.fileName}
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-600">
                            {(att.fileSizeBytes / 1024).toFixed(1)} KB
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">
                            {att.mimeType}
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-500">
                            <span title={att.sha256Hash}>
                              {att.sha256Hash.substring(0, 12)}...{att.sha256Hash.substring(52)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {att.scanStatus === 'CLEAN' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                                <svg className="w-3 h-3 mr-1 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                CLEAN
                              </span>
                            ) : att.scanStatus === 'PENDING_SCAN' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                                <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-amber-500 animate-pulse" />
                                PENDING SCAN
                              </span>
                            ) : att.scanStatus === 'SCAN_FAILED' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">
                                SCAN FAILED
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
                                INFECTED
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Upload Attachment Form (Only when draft) */}
            {!isSubmitted && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Upload Specification Attachment
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Permitted formats: PDF, PNG, JPEG, ZIP (Max 25 MB). Files are cryptographically fingerprinted in your browser prior to transmission.
                </p>

                {uploadSuccess && (
                  <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
                    {uploadSuccess}
                  </div>
                )}
                {uploadError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                    {uploadError}
                  </div>
                )}

                <form onSubmit={handleUploadAttachment} className="space-y-4">
                  <div>
                    <input
                      type="file"
                      required
                      accept=".pdf,.png,.jpg,.jpeg,.zip"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedFile(file);
                      }}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={!selectedFile || uploadingFile}
                      className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      {uploadingFile ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Calculating SHA-256 & Uploading...
                        </>
                      ) : (
                        'Upload & Register Attachment'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: SUBMISSION & TRACKING */}
        {/* ========================================================================= */}
        {activeTab === 'submit' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {isSubmitted ? (
              <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <h2 className="text-2xl font-extrabold text-slate-900">
                  Invention Disclosure Successfully Submitted
                </h2>
                <p className="text-sm text-slate-600 max-w-lg mx-auto">
                  Your invention disclosure has entered the formal IPR review lifecycle. Please retain your institutional tracking number for all inquiries.
                </p>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg inline-block">
                  <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                    Official IPR Tracking Number
                  </div>
                  <div className="text-2xl font-mono font-black text-indigo-700 mt-1">
                    {submittedTrackingNumber}
                  </div>
                </div>

                <div className="text-xs text-slate-500 pt-4">
                  Status: <strong>SUBMITTED</strong> &bull; Review Status: <strong>{disclosure.reviewStatus}</strong> &bull; Legal Clearance: <strong>{disclosure.legalClearanceStatus}</strong>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Final Pre-Submission Checklist</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    The institutional gateway enforces four strict business rules before generating an official tracking number.
                  </p>
                </div>

                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center space-x-2">
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Live Checklist Items */}
                <div className="space-y-3">
                  {/* Rule 1: 10,000 Basis Points */}
                  <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isShares100Percent ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {isShares100Percent ? '✓' : '1'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          Inventor Share Equals Exactly 100% (10,000 Basis Points)
                        </div>
                        <div className="text-xs text-slate-500">
                          Current allocated: {(totalBasisPoints / 100).toFixed(2)}% ({totalBasisPoints} bps)
                        </div>
                      </div>
                    </div>
                    <div>
                      {isShares100Percent ? (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Satisfied</span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">Pending Allocation</span>
                      )}
                    </div>
                  </div>

                  {/* Rule 2: Consents Verified */}
                  <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        allConsentsVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {allConsentsVerified ? '✓' : '2'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          All Inventor Consents Institutional VERIFIED
                        </div>
                        <div className="text-xs text-slate-500">
                          Requires Administrator verification of inventor evidence
                        </div>
                      </div>
                    </div>
                    <div>
                      {allConsentsVerified ? (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Satisfied</span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">Awaiting Admin Verification</span>
                      )}
                    </div>
                  </div>

                  {/* Rule 3: At least one specification attachment */}
                  <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        hasSpecAttachment ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {hasSpecAttachment ? '✓' : '3'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          At Least One Specification Document Uploaded
                        </div>
                        <div className="text-xs text-slate-500">
                          Uploaded attachments: {attachments.length}
                        </div>
                      </div>
                    </div>
                    <div>
                      {hasSpecAttachment ? (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Satisfied</span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">Missing Document</span>
                      )}
                    </div>
                  </div>

                  {/* Rule 4: All attachments CLEAN */}
                  <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        allAttachmentsClean ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {allAttachmentsClean ? '✓' : '4'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          All Documents Verified CLEAN by Antivirus Scanner
                        </div>
                        <div className="text-xs text-slate-500">
                          No pending, unscanned, or infected files permitted
                        </div>
                      </div>
                    </div>
                    <div>
                      {allAttachmentsClean ? (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Satisfied</span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">Pending Scan</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={!canSubmit || submitting}
                    onClick={handleSubmitDisclosure}
                    className="w-full py-3 px-4 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Generating Institutional Tracking Number...
                      </>
                    ) : (
                      'Submit Invention Disclosure'
                    )}
                  </button>
                  {!canSubmit && (
                    <p className="text-xs text-center text-slate-500 mt-2">
                      Submission button will unlock once all checklist conditions above are verified.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
