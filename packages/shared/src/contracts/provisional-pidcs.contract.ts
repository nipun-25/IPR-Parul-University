export interface ProvisionalPIDCSInventor {
  readonly id: string;
  readonly portalUserId: string | null;
  readonly externalName: string | null;
  readonly externalEmail: string | null;
  readonly externalOrganization: string | null;
  readonly isPrimary: boolean;
  readonly shareBasisPoints: number; // 0..10000 basis points for draft; 1..10000 for submission
}

export interface ProvisionalPIDCSAttachment {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'application/zip';
  readonly fileSizeBytes: number;
  readonly sha256Checksum: string;
}

export interface ProvisionalPIDCSSnapshot {
  readonly title: string;
  readonly abstract: string;
  readonly fieldOfInvention: string;
  readonly detailedDescription: string;
  readonly commercialPotential: string;
  readonly priorArtDetails: string;
  readonly inventors: readonly ProvisionalPIDCSInventor[];
  readonly attachments: readonly ProvisionalPIDCSAttachment[];
}

export type ProvisionalPIDCSDraftSnapshot = ProvisionalPIDCSSnapshot;
export type ProvisionalPIDCSSubmissionSnapshot = ProvisionalPIDCSSnapshot;

export interface IProvisionalPIDCSSerializer {
  serialize(snapshot: ProvisionalPIDCSSnapshot): string;
  digest(snapshot: ProvisionalPIDCSSnapshot): Promise<string>;
}
