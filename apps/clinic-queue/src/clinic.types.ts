import type { SkeletonRecord } from '@skeleton/core';

export type Gender = 'male' | 'female' | 'other';
export const GENDERS: Gender[] = ['male', 'female', 'other'];

// ---------------------------------------------------------------------------
// Stored records (append-only)
// ---------------------------------------------------------------------------

export type ClinicCollections = {
  patientRegistered: { name: string; phone?: string; age?: number; gender?: Gender };
  /** `at` is when it happened (ISO); `date` is the local day the token belongs to. */
  tokenIssued: { patientId: string; prefix: string; number: number; date: string; reason?: string; at: string };
  tokenCalled: { tokenId: string; at: string };
  tokenCompleted: { tokenId: string; notes?: string; at: string };
  tokenSkipped: { tokenId: string; at: string };
  /** Puts a skipped token back at the end of the queue. */
  tokenRequeued: { tokenId: string; at: string };
  /** The token letter a device uses. The latest record per device wins. */
  deviceLetterSet: { deviceId: string; letter: string };
  settingsUpdated: { clinicName?: string; language?: 'en' | 'ur'; demoDataLoaded?: boolean };
};

type Rec<K extends keyof ClinicCollections> = SkeletonRecord<ClinicCollections[K]>;

/** Every record in the local store, grouped by collection. */
export type ClinicData = { [K in keyof ClinicCollections]: Rec<K>[] };

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

export type Patient = {
  id: string;
  name: string;
  phone?: string;
  age?: number;
  gender?: Gender;
  registeredAt: string;
};

export type TokenStatus = 'waiting' | 'serving' | 'completed' | 'skipped';

export type Token = {
  id: string;
  /** e.g. "A-12" */
  label: string;
  prefix: string;
  number: number;
  patientId: string;
  /** Issuing device */
  deviceId: string;
  date: string;
  reason?: string;
  status: TokenStatus;
  issuedAt: string;
  /** When it (last) joined the waiting line: issue time or latest re-queue. */
  queuedAt: string;
  firstCalledAt?: string;
  calledAt?: string;
  completedAt?: string;
  skippedAt?: string;
  notes?: string;
};

export type Queue = {
  /** In call order: first is next */
  waiting: Token[];
  /** Most recently called first */
  serving: Token[];
  /** Most recently completed first */
  completed: Token[];
  /** Most recently skipped first */
  skipped: Token[];
};

export type HourBucket = { hour: number; arrived: number; seen: number };

export type Summary = {
  date: string;
  issued: number;
  waiting: number;
  serving: number;
  completed: number;
  skipped: number;
  /** Mean minutes from issue to first call, over tokens that were called; null if none. */
  avgWaitMinutes: number | null;
  /** One bucket per local hour, from the first to the last activity of the day. */
  hours: HourBucket[];
};

export type DeviceLetter = {
  letter: string;
  /** True once this device has recorded its letter (it does so on its first token). */
  claimed: boolean;
  /** True if another known device uses the same letter. */
  conflict: boolean;
  usedByOthers: string[];
};

export type Settings = { clinicName: string; language: 'en' | 'ur'; demoDataLoaded: boolean };

export type ClinicDerived = {
  patients: Patient[];
  patientsById: Map<string, Patient>;
  /** Every token ever, oldest first */
  tokens: Token[];
  tokensById: Map<string, Token>;
  /** Today's queue */
  queue: Queue;
  settings: Settings;
  letter: DeviceLetter;
  today: string;
  deviceId: string;
};

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export type IssueOrigin = 'queue' | 'patients' | 'patientDetail';

export type Screen =
  | { name: 'queue' }
  | { name: 'issueToken'; from: IssueOrigin; patientId?: string }
  | { name: 'token'; tokenId: string }
  | { name: 'patients' }
  | { name: 'addPatient' }
  | { name: 'patientDetail'; patientId: string }
  | { name: 'summary' }
  | { name: 'settings' };
