export interface ReportingSummaryDto {
  totalDisclosures: number;
  byStatus: Record<string, number>;
  byReviewStatus: Record<string, number>;
  byLegalClearanceStatus: Record<string, number>;
  recentActivity: Array<{
    id: string;
    trackingNumber: string | null;
    title: string;
    status: string;
    reviewStatus: string;
    legalClearanceStatus: string;
    createdAt: string;
    updatedAt: string;
  }>;
}
