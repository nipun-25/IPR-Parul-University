import React from 'react';

export type BadgeVariant =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PATENT_PENDING'
  | 'FILED'
  | 'EXAMINATION'
  | 'HEARING'
  | 'GRANTED'
  | 'ABANDONED'
  | 'CLEAN'
  | 'QUARANTINED'
  | 'SCANNED_INFECTED'
  | 'PENDING'
  | 'VERIFIED'
  | 'REVOKED'
  | 'ACTIVE'
  | 'DISABLED'
  | 'PENDING_RESPONSE'
  | 'RESOLVED';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps) {
  const norm = status.toUpperCase();

  let styles = 'bg-gray-100 text-gray-800 border-gray-200';
  let dotColor = 'bg-gray-400';

  if (norm === 'DRAFT') {
    styles = 'bg-slate-100 text-slate-700 border-slate-300';
    dotColor = 'bg-slate-400';
  } else if (norm === 'SUBMITTED') {
    styles = 'bg-blue-50 text-blue-700 border-blue-200';
    dotColor = 'bg-blue-500';
  } else if (norm === 'UNDER_REVIEW' || norm === 'EXAMINATION') {
    styles = 'bg-amber-50 text-amber-800 border-amber-300';
    dotColor = 'bg-amber-500 animate-pulse';
  } else if (norm === 'APPROVED' || norm === 'GRANTED' || norm === 'CLEAN' || norm === 'VERIFIED' || norm === 'ACTIVE' || norm === 'RESOLVED') {
    styles = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    dotColor = 'bg-emerald-500';
  } else if (norm === 'REJECTED' || norm === 'SCANNED_INFECTED' || norm === 'REVOKED' || norm === 'DISABLED' || norm === 'ABANDONED') {
    styles = 'bg-rose-50 text-rose-800 border-rose-300';
    dotColor = 'bg-rose-500';
  } else if (norm === 'PATENT_PENDING' || norm === 'FILED') {
    styles = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    dotColor = 'bg-indigo-500';
  } else if (norm === 'HEARING' || norm === 'QUARANTINED' || norm === 'PENDING' || norm === 'PENDING_RESPONSE') {
    styles = 'bg-orange-50 text-orange-800 border-orange-300';
    dotColor = 'bg-orange-500';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border shadow-sm font-medium ${sizeClasses} ${styles} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {formatStatusLabel(status)}
    </span>
  );
}

function formatStatusLabel(status: string): string {
  return status.toUpperCase().replace(/_/g, ' ');
}
