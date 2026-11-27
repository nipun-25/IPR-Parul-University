export type PatentStage =
  | 'DRAFTING'
  | 'FILED'
  | 'EXAMINATION'
  | 'HEARING'
  | 'GRANTED'
  | 'REJECTED'
  | 'ABANDONED';

export type DisclosureWorkflowStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PATENT_PENDING';

export type ConsentStatus = 'PENDING' | 'VERIFIED' | 'REVOKED';

export type AvScanStatus =
  | 'QUARANTINED'
  | 'SCANNED_INFECTED'
  | 'SCANNED_REJECTED'
  | 'PROMOTION_PENDING'
  | 'CLEAN';

export const PORTAL_ROLES = [
  'Student',
  'Faculty',
  'Reviewer',
  'Legal',
  'Administrator'
] as const;
export type PortalRole = (typeof PORTAL_ROLES)[number];

export const PATENT_STAGES: readonly PatentStage[] = [
  'DRAFTING',
  'FILED',
  'EXAMINATION',
  'HEARING',
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

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: 'Student' | 'Faculty' | 'Reviewer' | 'Legal' | 'Administrator';
  department: string;
  avatar: string;
  status: 'ACTIVE' | 'PENDING' | 'DISABLED';
  joinedDate: string;
}

export interface MockInventor {
  id: string;
  name: string;
  email: string;
  affiliation: 'Parul University (Internal)' | 'External Institution / Partner';
  role: 'Primary Inventor' | 'Co-Inventor';
  department?: string;
  consentStatus: ConsentStatus;
  consentDate?: string;
  signatureEvidence?: string;
}

export interface MockAttachment {
  id: string;
  filename: string;
  sizeBytes: number;
  uploadedAt: string;
  category: 'Full Specification' | 'Drawings / Diagrams' | 'Test Data & Lab Notes' | 'Prior Art Search';
  scanStatus: AvScanStatus;
  sha256: string;
}

export interface MockClarification {
  id: string;
  disclosureId: string;
  requestedBy: string;
  requestedAt: string;
  query: string;
  response?: string;
  respondedAt?: string;
  status: 'PENDING_RESPONSE' | 'RESOLVED';
}

export interface MockReviewEvaluation {
  id: string;
  disclosureId: string;
  reviewerId: string;
  reviewerName: string;
  submittedAt: string;
  noveltyScore: number; // 1-10
  inventiveStepScore: number; // 1-10
  industrialApplicabilityScore: number; // 1-10
  commercialViabilityScore: number; // 1-10
  recommendation: 'APPROVE_FOR_PATENT_FILING' | 'REVISE_AND_RESUBMIT' | 'REJECT';
  detailedRemarks: string;
  confidentialNotes?: string;
}

export interface MockPatentApplication {
  id: string;
  disclosureId: string;
  applicationNumber: string; // Indian Patent Office e.g. 202621004821
  title: string;
  leadInventor: string;
  department: string;
  filingDate: string;
  currentStage: PatentStage;
  jurisdiction: 'Indian Patent Office (Mumbai)' | 'PCT / International';
  attorneyAssigned: string;
  nextDeadline?: string;
  cbrNumber: string; // Cash Receipt Number
  stagesHistory: Array<{
    stage: PatentStage;
    changedAt: string;
    changedBy: string;
    remarks: string;
  }>;
}

export interface MockDisclosure {
  id: string;
  title: string;
  trackingNumber: string; // e.g. PU-IPR-2026-0042
  leadInventor: MockUser;
  department: string;
  status: DisclosureWorkflowStatus | 'DRAFT';
  createdAt: string;
  submittedAt?: string;
  updatedAt: string;
  fieldOfInvention: string;
  abstract: string;
  detailedDescription: string;
  commercialPotential: string;
  priorArtDetails: string;
  inventors: MockInventor[];
  attachments: MockAttachment[];
  assignedReviewer?: MockUser;
  evaluation?: MockReviewEvaluation;
  clarifications: MockClarification[];
  patentApplicationId?: string;
}

export interface MockNotification {
  id: string;
  title: string;
  message: string;
  targetRole: string;
  createdAt: string;
  read: boolean;
  actionUrl?: string;
  type: 'info' | 'success' | 'warning' | 'alert';
}

export interface MockAuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetResource: string;
  ipAddress: string;
  status: 'SUCCESS' | 'DENIED' | 'FAILED';
}

export const MOCK_USERS: MockUser[] = [
  {
    id: '5cee5176-2eeb-4da5-aca8-bf9feb104e7f',
    name: 'Nipun Kulshrestha',
    email: '2303051050480@paruluniversity.ac.in',
    role: 'Student',
    department: 'Computer Science & Engineering, PIT',
    avatar: 'NK',
    status: 'ACTIVE',
    joinedDate: '2024-08-01'
  },
  {
    id: 'fac-9021-4821-b112',
    name: 'Dr. Ramesh Patel',
    email: 'ramesh.patel@paruluniversity.ac.in',
    role: 'Faculty',
    department: 'Department of Renewable Energy, PIT',
    avatar: 'RP',
    status: 'ACTIVE',
    joinedDate: '2021-06-15'
  },
  {
    id: 'fac-8812-3341-c449',
    name: 'Dr. Ananya Sharma',
    email: 'ananya.sharma@paruluniversity.ac.in',
    role: 'Faculty',
    department: 'Parul Institute of Pharmacy',
    avatar: 'AS',
    status: 'ACTIVE',
    joinedDate: '2020-01-10'
  },
  {
    id: 'rev-3102-9981-d772',
    name: 'Prof. Vikramaditya Joshi',
    email: 'vikram.joshi@paruluniversity.ac.in',
    role: 'Reviewer',
    department: 'Electrical & Electronics Engineering Panel',
    avatar: 'VJ',
    status: 'ACTIVE',
    joinedDate: '2019-11-20'
  },
  {
    id: 'leg-4412-1092-e331',
    name: 'Adv. Meera Desai',
    email: 'meera.desai@paruluniversity.ac.in',
    role: 'Legal',
    department: 'Institutional IPR & Patent Cell',
    avatar: 'MD',
    status: 'ACTIVE',
    joinedDate: '2022-03-01'
  },
  {
    id: 'adm-0001-0001-a001',
    name: 'Dr. Ketan Kotecha',
    email: 'dean.rnd@paruluniversity.ac.in',
    role: 'Administrator',
    department: 'Research & Development Directorate',
    avatar: 'KK',
    status: 'ACTIVE',
    joinedDate: '2018-01-01'
  }
];

export const MOCK_DISCLOSURES: MockDisclosure[] = [
  {
    id: '6c435149-f522-4ec7-b4cc-c5f46180be4c',
    title: 'Smart Solar Thermal Energy Harvester with Integrated Phase Change Materials',
    trackingNumber: 'PU-IPR-2026-0042',
    leadInventor: MOCK_USERS[0],
    department: 'Computer Science & Engineering, PIT',
    status: 'SUBMITTED',
    createdAt: '2026-11-20T10:15:00Z',
    submittedAt: '2026-11-24T14:30:00Z',
    updatedAt: '2026-11-25T09:00:00Z',
    fieldOfInvention: 'Solar Thermal Engineering & Materials Science',
    abstract: 'A rooftop hybrid solar thermal collector utilizing organic paraffin phase change materials (PCMs) encapsulated in aluminum honeycomb micro-channels for continuous nighttime thermal release.',
    detailedDescription: 'The invention provides a dual-axis solar absorber integrated with latent heat thermal energy storage (LHTES). Encapsulated PCM achieves an energy conversion efficiency of 74.2% while stabilizing outlet water temperatures above 65°C throughout nocturnal operation.',
    commercialPotential: 'Commercial dairy processing plants, hospital hot-water utilities, and decentralized food drying units.',
    priorArtDetails: 'Existing systems rely on external insulated water tanks which suffer 35% convective heat loss overnight. No prior art integrates honeycomb aluminum encapsulated LHTES directly in the absorber manifold.',
    inventors: [
      {
        id: 'inv-01',
        name: 'Nipun Kulshrestha',
        email: '2303051050480@paruluniversity.ac.in',
        affiliation: 'Parul University (Internal)',
        role: 'Primary Inventor',
        department: 'PIT - CSE',
        consentStatus: 'VERIFIED',
        consentDate: '2026-11-24T14:25:00Z',
        signatureEvidence: 'DIGITAL_AUTH_ASSERTION_V1'
      },
      {
        id: 'inv-02',
        name: 'Dr. Ramesh Patel',
        email: 'ramesh.patel@paruluniversity.ac.in',
        affiliation: 'Parul University (Internal)',
        role: 'Co-Inventor',
        department: 'PIT - Renewable Energy',
        consentStatus: 'VERIFIED',
        consentDate: '2026-11-24T16:10:00Z',
        signatureEvidence: 'DIGITAL_AUTH_ASSERTION_V1'
      },
      {
        id: 'inv-03',
        name: 'Kavita Sundaram',
        email: 'kavita.s@iitb.ac.in',
        affiliation: 'External Institution / Partner',
        role: 'Co-Inventor',
        department: 'Energy Systems Engineering',
        consentStatus: 'VERIFIED',
        consentDate: '2026-11-25T08:45:00Z',
        signatureEvidence: 'EMAIL_VERIFIED_TOKEN_V2'
      }
    ],
    attachments: [
      {
        id: 'att-01',
        filename: 'Specification_Solar_Harvester_v2.pdf',
        sizeBytes: 2458190,
        uploadedAt: '2026-11-24T11:20:00Z',
        category: 'Full Specification',
        scanStatus: 'CLEAN',
        sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
      },
      {
        id: 'att-02',
        filename: 'Thermal_Simulation_CAD_Drawings.pdf',
        sizeBytes: 8192300,
        uploadedAt: '2026-11-24T11:45:00Z',
        category: 'Drawings / Diagrams',
        scanStatus: 'CLEAN',
        sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8'
      }
    ],
    assignedReviewer: MOCK_USERS[3],
    clarifications: []
  },
  {
    id: '88a109b2-3214-41aa-9002-c7f8a112009e',
    title: 'Biodegradable Nano-encapsulated Curcumin Formulation for Targeted Wound Healing',
    trackingNumber: 'PU-IPR-2026-0038',
    leadInventor: MOCK_USERS[2],
    department: 'Parul Institute of Pharmacy',
    status: 'UNDER_REVIEW',
    createdAt: '2026-11-10T09:00:00Z',
    submittedAt: '2026-11-14T11:20:00Z',
    updatedAt: '2026-11-26T15:00:00Z',
    fieldOfInvention: 'Pharmaceutical Nanotechnology & Wound Therapeutics',
    abstract: 'Novel sustained-release electrospun chitosan-gelatin nanofiber patches loaded with surface-functionalized curcumin nanoparticles showing 3x accelerated tissue regeneration in diabetic dermal ulcers.',
    detailedDescription: 'The invention consists of a polymeric matrix embedded with lecithin-chitosan nanoparticles holding 92% curcumin payload. In vitro release profiles demonstrate sustained antimicrobial efficacy against MRSA for over 96 hours without cytotoxicity.',
    commercialPotential: 'Global advanced wound dressings market, diabetic foot ulcer therapeutics.',
    priorArtDetails: 'Existing topical curcumin ointments suffer poor bioavailability and rapid oxidative degradation within 4 hours of exposure.',
    inventors: [
      {
        id: 'inv-04',
        name: 'Dr. Ananya Sharma',
        email: 'ananya.sharma@paruluniversity.ac.in',
        affiliation: 'Parul University (Internal)',
        role: 'Primary Inventor',
        department: 'Parul Institute of Pharmacy',
        consentStatus: 'VERIFIED',
        consentDate: '2026-11-14T10:00:00Z',
        signatureEvidence: 'DIGITAL_AUTH_ASSERTION_V1'
      },
      {
        id: 'inv-05',
        name: 'Rahul Mehta',
        email: 'rahul.mehta.mpharm@paruluniversity.ac.in',
        affiliation: 'Parul University (Internal)',
        role: 'Co-Inventor',
        department: 'Parul Institute of Pharmacy',
        consentStatus: 'VERIFIED',
        consentDate: '2026-11-14T10:30:00Z',
        signatureEvidence: 'DIGITAL_AUTH_ASSERTION_V1'
      }
    ],
    attachments: [
      {
        id: 'att-03',
        filename: 'Patent_Draft_Curcumin_Formulation.pdf',
        sizeBytes: 3120000,
        uploadedAt: '2026-11-14T09:30:00Z',
        category: 'Full Specification',
        scanStatus: 'CLEAN',
        sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a'
      }
    ],
    assignedReviewer: MOCK_USERS[3],
    evaluation: {
      id: 'eval-01',
      disclosureId: '88a109b2-3214-41aa-9002-c7f8a112009e',
      reviewerId: MOCK_USERS[3].id,
      reviewerName: MOCK_USERS[3].name,
      submittedAt: '2026-11-22T17:00:00Z',
      noveltyScore: 9,
      inventiveStepScore: 8,
      industrialApplicabilityScore: 9,
      commercialViabilityScore: 9,
      recommendation: 'APPROVE_FOR_PATENT_FILING',
      detailedRemarks: 'Highly innovative synthesis route. High commercial potential in medical wound dressings. Prior art does not cite this specific molar ratio of chitosan-gelatin core-shell polymer.',
      confidentialNotes: 'Recommend expedited patent filing before academic paper submission.'
    },
    clarifications: [
      {
        id: 'clar-01',
        disclosureId: '88a109b2-3214-41aa-9002-c7f8a112009e',
        requestedBy: 'Prof. Vikramaditya Joshi',
        requestedAt: '2026-11-18T10:00:00Z',
        query: 'Please clarify stability testing data under Indian accelerated humidity (40°C / 75% RH).',
        response: 'Added 6-month accelerated real-time stability HPLC chromatograms in Appendix D.',
        respondedAt: '2026-11-20T14:30:00Z',
        status: 'RESOLVED'
      }
    ]
  },
  {
    id: '33e990b1-4190-48e2-b889-110022334455',
    title: 'Autonomous Drone-Assisted Precision Irrigation with Multi-Spectral Soil Moisture Sensing',
    trackingNumber: 'PU-IPR-2026-0029',
    leadInventor: MOCK_USERS[1],
    department: 'Department of Renewable Energy, PIT',
    status: 'PATENT_PENDING',
    createdAt: '2026-10-02T11:00:00Z',
    submittedAt: '2026-10-05T14:00:00Z',
    updatedAt: '2026-11-15T12:00:00Z',
    fieldOfInvention: 'Agricultural Robotics & Remote Sensing',
    abstract: 'Edge-AI powered quadcopter payload with custom NIR multi-spectral sensors and variable-rate micro-droplet nozzle deployment for localized crop irrigation.',
    detailedDescription: 'System integrates sensor fusion of thermal and NIR imagery with soil dielectric permittivity estimations to compute root-zone water deficits with sub-meter spatial precision.',
    commercialPotential: 'Agritech companies, drip irrigation manufacturers, state agriculture departments.',
    priorArtDetails: 'Existing drone systems capture imagery for post-flight cloud processing. Present invention computes NDVI index onboard in real-time to actuate micro-nozzles instantaneously.',
    inventors: [
      {
        id: 'inv-06',
        name: 'Dr. Ramesh Patel',
        email: 'ramesh.patel@paruluniversity.ac.in',
        affiliation: 'Parul University (Internal)',
        role: 'Primary Inventor',
        department: 'PIT',
        consentStatus: 'VERIFIED',
        consentDate: '2026-10-05T11:00:00Z',
        signatureEvidence: 'DIGITAL_AUTH_ASSERTION_V1'
      }
    ],
    attachments: [
      {
        id: 'att-04',
        filename: 'Drone_Irrigation_Patent_Complete.pdf',
        sizeBytes: 5200000,
        uploadedAt: '2026-10-05T10:00:00Z',
        category: 'Full Specification',
        scanStatus: 'CLEAN',
        sha256: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d'
      }
    ],
    patentApplicationId: 'pat-2026-001',
    clarifications: []
  },
  {
    id: '12d88190-3321-4d11-aa90-b19900224411',
    title: 'Self-Healing Geopolymer Concrete Utilizing Industrial Blast Furnace Slag and Microbial Calcite',
    trackingNumber: 'PU-IPR-2026-0045',
    leadInventor: MOCK_USERS[0],
    department: 'Computer Science & Engineering, PIT',
    status: 'DRAFT',
    createdAt: '2026-11-26T08:30:00Z',
    updatedAt: '2026-11-27T06:00:00Z',
    fieldOfInvention: 'Sustainable Civil Engineering Materials',
    abstract: 'Zero-clinker geopolymer cement utilizing high-volume alkali-activated GGBS combined with micro-encapsulated Bacillus pasteurii bacterial spores.',
    detailedDescription: 'Upon micro-crack formation and water ingress, dormant spores activate within 48 hours to precipitate calcium carbonate (CaCO3), autonomously sealing cracks up to 0.8 mm width.',
    commercialPotential: 'Infrastructure projects, marine structures, highway pavements, bridge piers.',
    priorArtDetails: 'Conventional bacterial self-healing concrete requires alkaline-tolerant Portland cement matrix which has poor spore survival beyond 6 months.',
    inventors: [
      {
        id: 'inv-07',
        name: 'Nipun Kulshrestha',
        email: '2303051050480@paruluniversity.ac.in',
        affiliation: 'Parul University (Internal)',
        role: 'Primary Inventor',
        department: 'PIT',
        consentStatus: 'VERIFIED',
        consentDate: '2026-11-26T09:00:00Z',
        signatureEvidence: 'DIGITAL_AUTH_ASSERTION_V1'
      },
      {
        id: 'inv-08',
        name: 'Suresh Verma',
        email: 'suresh.verma@paruluniversity.ac.in',
        affiliation: 'Parul University (Internal)',
        role: 'Co-Inventor',
        department: 'Civil Engineering, PIT',
        consentStatus: 'PENDING'
      }
    ],
    attachments: [
      {
        id: 'att-05',
        filename: 'Geopolymer_Formulation_LabData.pdf',
        sizeBytes: 1980000,
        uploadedAt: '2026-11-26T10:00:00Z',
        category: 'Test Data & Lab Notes',
        scanStatus: 'CLEAN',
        sha256: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'
      }
    ],
    clarifications: []
  }
];

export const MOCK_PATENT_APPLICATIONS: MockPatentApplication[] = [
  {
    id: 'pat-2026-001',
    disclosureId: '33e990b1-4190-48e2-b889-110022334455',
    applicationNumber: '202621004821',
    title: 'Autonomous Drone-Assisted Precision Irrigation with Multi-Spectral Soil Moisture Sensing',
    leadInventor: 'Dr. Ramesh Patel',
    department: 'Renewable Energy, PIT',
    filingDate: '2026-10-18',
    currentStage: 'FILED',
    jurisdiction: 'Indian Patent Office (Mumbai)',
    attorneyAssigned: 'Adv. Meera Desai',
    cbrNumber: 'CBR-2026-MUM-89124',
    nextDeadline: '2027-04-18 (Publication in IPO Journal)',
    stagesHistory: [
      {
        stage: 'DRAFTING',
        changedAt: '2026-10-06T10:00:00Z',
        changedBy: 'Adv. Meera Desai',
        remarks: 'Form 1, Form 2 and Complete Specifications finalized with inventor.'
      },
      {
        stage: 'FILED',
        changedAt: '2026-10-18T15:30:00Z',
        changedBy: 'Adv. Meera Desai',
        remarks: 'Successfully e-filed at IPO Mumbai. Official CBR received.'
      }
    ]
  },
  {
    id: 'pat-2025-018',
    disclosureId: 'disc-legacy-001',
    applicationNumber: '202521098412',
    title: 'Photovoltaic Electrolyzer Catalyst with Low Overpotential for Green Hydrogen Generation',
    leadInventor: 'Dr. Ramesh Patel',
    department: 'Renewable Energy, PIT',
    filingDate: '2025-05-12',
    currentStage: 'EXAMINATION',
    jurisdiction: 'Indian Patent Office (Mumbai)',
    attorneyAssigned: 'Adv. Meera Desai',
    cbrNumber: 'CBR-2025-MUM-33120',
    nextDeadline: '2027-01-15 (FER Response Submission)',
    stagesHistory: [
      {
        stage: 'DRAFTING',
        changedAt: '2025-04-10T09:00:00Z',
        changedBy: 'Adv. Meera Desai',
        remarks: 'Provisional specification drafted.'
      },
      {
        stage: 'FILED',
        changedAt: '2025-05-12T14:00:00Z',
        changedBy: 'Adv. Meera Desai',
        remarks: 'E-filed under Section 7.'
      },
      {
        stage: 'EXAMINATION',
        changedAt: '2026-07-15T11:00:00Z',
        changedBy: 'Controller of Patents, IPO',
        remarks: 'First Examination Report (FER) issued. Objections under Section 3(d).'
      }
    ]
  },
  {
    id: 'pat-2024-004',
    disclosureId: 'disc-legacy-002',
    applicationNumber: '202421045100',
    title: 'Dual-Fluid Microchannel Heat Exchanger for High-Density Server Racks',
    leadInventor: 'Dr. Ketan Kotecha',
    department: 'PIT',
    filingDate: '2024-03-22',
    currentStage: 'HEARING',
    jurisdiction: 'Indian Patent Office (Mumbai)',
    attorneyAssigned: 'Adv. Meera Desai',
    cbrNumber: 'CBR-2024-MUM-11029',
    nextDeadline: '2026-12-10 (Oral Hearing Hearing Notice)',
    stagesHistory: [
      {
        stage: 'DRAFTING',
        changedAt: '2024-02-15T10:00:00Z',
        changedBy: 'Adv. Meera Desai',
        remarks: 'Complete specification.'
      },
      {
        stage: 'FILED',
        changedAt: '2024-03-22T12:00:00Z',
        changedBy: 'Adv. Meera Desai',
        remarks: 'Application submitted.'
      },
      {
        stage: 'EXAMINATION',
        changedAt: '2025-02-10T14:00:00Z',
        changedBy: 'IPO Mumbai',
        remarks: 'FER issued and replied.'
      },
      {
        stage: 'HEARING',
        changedAt: '2026-10-01T16:00:00Z',
        changedBy: 'Assistant Controller of Patents',
        remarks: 'Hearing scheduled for final claims clarification.'
      }
    ]
  },
  {
    id: 'pat-2023-009',
    disclosureId: 'disc-legacy-003',
    applicationNumber: '202321011900',
    title: 'Herbal Composition for Anti-Hyperglycemic Treatment Derived from Momordica Charantia Extracts',
    leadInventor: 'Dr. Ananya Sharma',
    department: 'Parul Institute of Pharmacy',
    filingDate: '2023-01-14',
    currentStage: 'GRANTED',
    jurisdiction: 'Indian Patent Office (Mumbai)',
    attorneyAssigned: 'Adv. Meera Desai',
    cbrNumber: 'CBR-2023-MUM-09182',
    stagesHistory: [
      {
        stage: 'DRAFTING',
        changedAt: '2022-12-01T10:00:00Z',
        changedBy: 'Adv. Meera Desai',
        remarks: 'Drafted.'
      },
      {
        stage: 'FILED',
        changedAt: '2023-01-14T11:00:00Z',
        changedBy: 'Adv. Meera Desai',
        remarks: 'Filed.'
      },
      {
        stage: 'EXAMINATION',
        changedAt: '2024-06-20T11:00:00Z',
        changedBy: 'IPO',
        remarks: 'FER replied successfully.'
      },
      {
        stage: 'HEARING',
        changedAt: '2025-03-12T10:00:00Z',
        changedBy: 'IPO',
        remarks: 'Hearing passed.'
      },
      {
        stage: 'GRANTED',
        changedAt: '2025-11-05T15:00:00Z',
        changedBy: 'Controller General of Patents, Designs and Trademarks',
        remarks: 'Patent Granted. Patent Certificate No. IN-498129.'
      }
    ]
  }
];

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: 'notif-01',
    title: 'Disclosure Submitted Successfully',
    message: 'Your disclosure PU-IPR-2026-0042 has been submitted for institutional evaluation.',
    targetRole: 'Student',
    createdAt: '2026-11-24T14:30:00Z',
    read: false,
    actionUrl: '/student/disclosures/6c435149-f522-4ec7-b4cc-c5f46180be4c',
    type: 'success'
  },
  {
    id: 'notif-02',
    title: 'Co-Inventor Consent Verified',
    message: 'Dr. Ramesh Patel has digitally signed and verified consent for PU-IPR-2026-0042.',
    targetRole: 'Student',
    createdAt: '2026-11-24T16:10:00Z',
    read: true,
    actionUrl: '/student/consent',
    type: 'info'
  },
  {
    id: 'notif-03',
    title: 'New Disclosure Assigned for Review',
    message: 'PU-IPR-2026-0042 ("Smart Solar Thermal Energy Harvester") assigned to your review queue.',
    targetRole: 'Reviewer',
    createdAt: '2026-11-25T10:00:00Z',
    read: false,
    actionUrl: '/reviewer/pending',
    type: 'alert'
  },
  {
    id: 'notif-04',
    title: 'Patent Stage Advanced to FILED',
    message: 'Patent App 202621004821 has been successfully submitted to IPO Mumbai by Legal.',
    targetRole: 'Faculty',
    createdAt: '2026-10-18T15:35:00Z',
    read: true,
    actionUrl: '/faculty/history',
    type: 'success'
  },
  {
    id: 'notif-05',
    title: 'FER Compliance Deadline Approaching',
    message: 'Patent App 202521098412 response to First Examination Report is due in 45 days.',
    targetRole: 'Legal',
    createdAt: '2026-11-26T09:00:00Z',
    read: false,
    actionUrl: '/legal/patents/pat-2025-018',
    type: 'warning'
  },
  {
    id: 'notif-06',
    title: 'New User Registration Pending Approval',
    message: 'Faculty account request from Dr. Sunita Rao (Parul Institute of Engineering).',
    targetRole: 'Administrator',
    createdAt: '2026-11-27T08:00:00Z',
    read: false,
    actionUrl: '/admin/users',
    type: 'info'
  }
];

export const MOCK_AUDIT_LOGS: MockAuditLog[] = [
  {
    id: 'aud-1092',
    timestamp: '2026-11-27T08:12:45Z',
    actorName: 'Dr. Ketan Kotecha',
    actorRole: 'Administrator',
    action: 'USER_ROLE_ASSIGNED',
    targetResource: 'User: dr.sunita.rao@paruluniversity.ac.in (Role: Faculty)',
    ipAddress: '192.168.10.42',
    status: 'SUCCESS'
  },
  {
    id: 'aud-1091',
    timestamp: '2026-11-27T06:15:20Z',
    actorName: 'Nipun Kulshrestha',
    actorRole: 'Student',
    action: 'DISCLOSURE_DRAFT_UPDATED',
    targetResource: 'Draft: 12d88190-3321-4d11-aa90-b19900224411',
    ipAddress: '10.20.14.88',
    status: 'SUCCESS'
  },
  {
    id: 'aud-1090',
    timestamp: '2026-11-26T15:02:11Z',
    actorName: 'Adv. Meera Desai',
    actorRole: 'Legal',
    action: 'PATENT_STAGE_TRANSITION',
    targetResource: 'PatentApp: 202621004821 (DRAFTING -> FILED)',
    ipAddress: '192.168.10.15',
    status: 'SUCCESS'
  },
  {
    id: 'aud-1089',
    timestamp: '2026-11-25T11:45:00Z',
    actorName: 'SystemScanner',
    actorRole: 'SystemScanner',
    action: 'ANTIVIRUS_SCAN_CLEAN',
    targetResource: 'Attachment: Thermal_Simulation_CAD_Drawings.pdf',
    ipAddress: '127.0.0.1',
    status: 'SUCCESS'
  },
  {
    id: 'aud-1088',
    timestamp: '2026-11-24T14:30:00Z',
    actorName: 'Nipun Kulshrestha',
    actorRole: 'Student',
    action: 'DISCLOSURE_FINAL_SUBMISSION',
    targetResource: 'Disclosure: PU-IPR-2026-0042',
    ipAddress: '10.20.14.88',
    status: 'SUCCESS'
  },
  {
    id: 'aud-1087',
    timestamp: '2026-11-24T14:28:15Z',
    actorName: 'Nipun Kulshrestha',
    actorRole: 'Student',
    action: 'INVENTOR_CONSENT_SELF_VERIFIED',
    targetResource: 'Consent: inv-01 (Nipun Kulshrestha)',
    ipAddress: '10.20.14.88',
    status: 'SUCCESS'
  }
];
