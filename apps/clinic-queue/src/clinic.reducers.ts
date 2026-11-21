import {
  deriveState,
  isValidISODate,
  isValidTimestamp,
  localHour,
  minutesBetween,
  toAsciiDigits,
  todayISO,
} from '@skeleton/core';
import type { SkeletonRecord } from '@skeleton/core';
import { GENDERS } from './clinic.types';
import type {
  ClinicCollections,
  ClinicData,
  ClinicDerived,
  DeviceLetter,
  HourBucket,
  Patient,
  Queue,
  Settings,
  Summary,
  Token,
} from './clinic.types';

type Rec<K extends keyof ClinicCollections> = SkeletonRecord<ClinicCollections[K]>;

export const DEFAULT_CLINIC_NAME = 'My Clinic';
export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Total order on records: oldest first, ties broken by id. */
function byCreatedAt(a: { createdAt: string; id: string }, b: { createdAt: string; id: string }): number {
  return compareText(a.createdAt, b.createdAt) || compareText(a.id, b.id);
}

/** When an event happened: its own `at`, or when it was recorded. Milliseconds. */
function eventMs(r: { createdAt: string; payload: { at?: unknown } }): number {
  if (isValidTimestamp(r.payload.at)) return Date.parse(r.payload.at);
  return isValidTimestamp(r.createdAt) ? Date.parse(r.createdAt) : 0;
}

const iso = (ms: number): string => new Date(ms).toISOString();

export const tokenLabel = (prefix: string, number: number): string => `${prefix}-${number}`;

export function isValidLetter(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]$/.test(value);
}

function isValidIssue(r: Rec<'tokenIssued'>): boolean {
  const p = r.payload;
  return (
    typeof p.patientId === 'string' &&
    isValidLetter(p.prefix) &&
    Number.isSafeInteger(p.number) &&
    p.number > 0 &&
    isValidISODate(p.date)
  );
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

export function derivePatients(records: Rec<'patientRegistered'>[]): Patient[] {
  return [...records]
    .filter((r) => typeof r.payload.name === 'string' && r.payload.name.trim() !== '')
    .sort(byCreatedAt)
    .map((r) => {
      const { name, phone, age, gender } = r.payload;
      return {
        id: r.id,
        name,
        phone: typeof phone === 'string' && phone !== '' ? phone : undefined,
        age: Number.isInteger(age) && (age as number) >= 0 && (age as number) <= 150 ? age : undefined,
        gender: gender && GENDERS.includes(gender) ? gender : undefined,
        registeredAt: r.createdAt,
      };
    });
}

/** Most recent visit date per patient. */
export function lastVisitDates(tokens: Token[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of tokens) {
    const prev = map.get(t.patientId);
    if (!prev || t.date > prev) map.set(t.patientId, t.date);
  }
  return map;
}

/**
 * Case-insensitive search by name or phone (ignoring hyphens/spaces, Urdu
 * digits accepted). Most recent visitor first, then by name.
 */
export function filterPatients(patients: Patient[], tokens: Token[], query: string): Patient[] {
  const q = query.trim().toLowerCase();
  const qDigits = toAsciiDigits(q).replace(/[-\s]/g, '');
  const lastVisit = lastVisitDates(tokens);
  return patients
    .filter((p) => {
      if (q === '') return true;
      if (p.name.toLowerCase().includes(q)) return true;
      return qDigits !== '' && /^\d+$/.test(qDigits) && !!p.phone && toAsciiDigits(p.phone).replace(/[-\s]/g, '').includes(qDigits);
    })
    .sort(
      (a, b) =>
        compareText(lastVisit.get(b.id) ?? '', lastVisit.get(a.id) ?? '') ||
        a.name.localeCompare(b.name) ||
        compareText(a.id, b.id),
    );
}

// ---------------------------------------------------------------------------
// Tokens: the state machine
// ---------------------------------------------------------------------------

type Event =
  | { kind: 'called'; ms: number; createdAt: string; id: string }
  | { kind: 'completed'; ms: number; createdAt: string; id: string; notes?: string }
  | { kind: 'skipped'; ms: number; createdAt: string; id: string }
  | { kind: 'requeued'; ms: number; createdAt: string; id: string };

/**
 * Every token with its current state.
 *
 * Each token's events are sorted by (time, createdAt, id), a total order, and
 * folded through the state machine:
 *   waiting --called--> serving --completed--> completed (final)
 *   waiting|serving --skipped--> skipped --requeued--> waiting
 * Events not allowed in the current state are ignored, so a token can never
 * be completed before it is called and never leaves "completed". Because the
 * order is total, the result is the same whatever order records arrived in.
 */
export function deriveTokens(data: Pick<ClinicData, 'tokenIssued' | 'tokenCalled' | 'tokenCompleted' | 'tokenSkipped' | 'tokenRequeued'>): Token[] {
  const events = new Map<string, Event[]>();
  const push = (tokenId: unknown, event: Event) => {
    if (typeof tokenId !== 'string') return;
    const list = events.get(tokenId) ?? [];
    list.push(event);
    events.set(tokenId, list);
  };
  for (const r of data.tokenCalled) push(r.payload.tokenId, { kind: 'called', ms: eventMs(r), createdAt: r.createdAt, id: r.id });
  for (const r of data.tokenCompleted)
    push(r.payload.tokenId, { kind: 'completed', ms: eventMs(r), createdAt: r.createdAt, id: r.id, notes: r.payload.notes });
  for (const r of data.tokenSkipped) push(r.payload.tokenId, { kind: 'skipped', ms: eventMs(r), createdAt: r.createdAt, id: r.id });
  for (const r of data.tokenRequeued) push(r.payload.tokenId, { kind: 'requeued', ms: eventMs(r), createdAt: r.createdAt, id: r.id });

  const issued = data.tokenIssued.filter(isValidIssue);
  const tokens = issued.map((r): Token => {
    const issuedMs = eventMs(r);
    const token: Token = {
      id: r.id,
      label: tokenLabel(r.payload.prefix, r.payload.number),
      prefix: r.payload.prefix,
      number: r.payload.number,
      patientId: r.payload.patientId,
      deviceId: r.deviceId,
      date: r.payload.date,
      reason: r.payload.reason || undefined,
      status: 'waiting',
      issuedAt: iso(issuedMs),
      queuedAt: iso(issuedMs),
    };

    const list = [...(events.get(r.id) ?? [])].sort(
      (a, b) => a.ms - b.ms || compareText(a.createdAt, b.createdAt) || compareText(a.id, b.id),
    );
    for (const e of list) {
      const at = iso(e.ms);
      switch (e.kind) {
        case 'called':
          if (token.status === 'waiting') {
            token.status = 'serving';
            token.calledAt = at;
            token.firstCalledAt ??= at;
          }
          break;
        case 'completed':
          if (token.status === 'serving') {
            token.status = 'completed';
            token.completedAt = at;
            token.notes = e.notes?.trim() ? e.notes.trim() : undefined;
          }
          break;
        case 'skipped':
          if (token.status === 'waiting' || token.status === 'serving') {
            token.status = 'skipped';
            token.skippedAt = at;
          }
          break;
        case 'requeued':
          if (token.status === 'skipped') {
            token.status = 'waiting';
            token.queuedAt = at;
          }
          break;
      }
    }
    return token;
  });

  return tokens.sort((a, b) => compareText(a.issuedAt, b.issuedAt) || compareText(a.id, b.id));
}

/** The queue for one day. */
export function deriveQueue(tokens: Token[], date: string): Queue {
  const day = tokens.filter((t) => t.date === date);
  const by = (field: 'queuedAt' | 'calledAt' | 'completedAt' | 'skippedAt', desc: boolean) => (a: Token, b: Token) =>
    (desc ? compareText(b[field] ?? '', a[field] ?? '') : compareText(a[field] ?? '', b[field] ?? '')) ||
    a.number - b.number ||
    compareText(a.id, b.id);
  return {
    waiting: day.filter((t) => t.status === 'waiting').sort(by('queuedAt', false)),
    serving: day.filter((t) => t.status === 'serving').sort(by('calledAt', true)),
    completed: day.filter((t) => t.status === 'completed').sort(by('completedAt', true)),
    skipped: day.filter((t) => t.status === 'skipped').sort(by('skippedAt', true)),
  };
}

/** The patient's waiting or serving token on `date`, if any. */
export function activeTokenFor(tokens: Token[], patientId: string, date: string): Token | undefined {
  return tokens.find((t) => t.patientId === patientId && t.date === date && (t.status === 'waiting' || t.status === 'serving'));
}

/** All of a patient's visits, newest first. */
export function patientVisits(tokens: Token[], patientId: string): Token[] {
  return tokens
    .filter((t) => t.patientId === patientId)
    .sort((a, b) => compareText(b.issuedAt, a.issuedAt) || compareText(b.id, a.id));
}

// ---------------------------------------------------------------------------
// Token numbers across devices
// ---------------------------------------------------------------------------

/** Each device's latest letter. */
function latestLetters(records: Rec<'deviceLetterSet'>[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of [...records].sort(byCreatedAt)) {
    if (typeof r.payload.deviceId === 'string' && isValidLetter(r.payload.letter)) map.set(r.payload.deviceId, r.payload.letter);
  }
  return map;
}

/**
 * This device's token letter. If it has not chosen one yet, suggest the first
 * letter no other known device uses (so devices get A, B, C...).
 */
export function deriveDeviceLetter(records: Rec<'deviceLetterSet'>[], deviceId: string): DeviceLetter {
  const latest = latestLetters(records);
  const own = latest.get(deviceId);
  const usedByOthers = [...new Set([...latest].filter(([id]) => id !== deviceId).map(([, letter]) => letter))].sort();
  const letter = own ?? LETTERS.find((l) => !usedByOthers.includes(l)) ?? 'A';
  return { letter, claimed: own !== undefined, conflict: own !== undefined && usedByOthers.includes(own), usedByOthers };
}

/**
 * The next token number for this device on `date`: one more than the highest
 * number already issued that day with the same letter OR by this device.
 * Numbers restart each day. As long as devices have different letters, two
 * offline devices never produce the same label, and changing letter mid-day
 * can never repeat a label.
 */
export function nextTokenNumber(issued: Rec<'tokenIssued'>[], date: string, prefix: string, deviceId: string): number {
  let max = 0;
  for (const r of issued) {
    if (!isValidIssue(r) || r.payload.date !== date) continue;
    if (r.payload.prefix === prefix || r.deviceId === deviceId) max = Math.max(max, r.payload.number);
  }
  return max + 1;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/**
 * Figures for one day. Invariants (property-tested):
 * issued = waiting + serving + completed + skipped; the hourly "arrived" bars add up to
 * issued and the hourly "seen" bars add up to completed.
 */
export function deriveSummary(tokens: Token[], date: string): Summary {
  const day = tokens.filter((t) => t.date === date);
  const count = (status: Token['status']) => day.filter((t) => t.status === status).length;

  const waits = day.filter((t) => t.firstCalledAt).map((t) => minutesBetween(t.issuedAt, t.firstCalledAt as string));
  const avgWaitMinutes = waits.length ? Math.round(waits.reduce((s, m) => s + m, 0) / waits.length) : null;

  const arrivedHours = day.map((t) => localHour(t.issuedAt));
  const seenHours = day.filter((t) => t.status === 'completed' && t.completedAt).map((t) => localHour(t.completedAt as string));
  const all = [...arrivedHours, ...seenHours].filter((h) => h >= 0);
  const hours: HourBucket[] = [];
  if (all.length > 0) {
    for (let h = Math.min(...all); h <= Math.max(...all); h++) hours.push({ hour: h, arrived: 0, seen: 0 });
    const start = hours[0].hour;
    for (const h of arrivedHours) if (h >= 0) hours[h - start].arrived++;
    for (const h of seenHours) if (h >= 0) hours[h - start].seen++;
  }

  return {
    date,
    issued: day.length,
    waiting: count('waiting'),
    serving: count('serving'),
    completed: count('completed'),
    skipped: count('skipped'),
    avgWaitMinutes,
    hours,
  };
}

// ---------------------------------------------------------------------------
// Settings and everything at once
// ---------------------------------------------------------------------------

export function deriveSettings(records: Rec<'settingsUpdated'>[]): Settings {
  const initial: Settings = { clinicName: DEFAULT_CLINIC_NAME, language: 'en', demoDataLoaded: false };
  return deriveState<ClinicCollections['settingsUpdated'], Settings>(
    [...records].sort(byCreatedAt),
    (state, r) => {
      const prev = state ?? initial;
      return {
        clinicName: r.payload.clinicName ?? prev.clinicName,
        language: r.payload.language ?? prev.language,
        demoDataLoaded: prev.demoDataLoaded || r.payload.demoDataLoaded === true,
      };
    },
    initial,
  );
}

export function deriveAll(data: ClinicData, deviceId: string, today: string = todayISO()): ClinicDerived {
  const patients = derivePatients(data.patientRegistered);
  const tokens = deriveTokens(data);
  return {
    patients,
    patientsById: new Map(patients.map((p) => [p.id, p])),
    tokens,
    tokensById: new Map(tokens.map((t) => [t.id, t])),
    queue: deriveQueue(tokens, today),
    settings: deriveSettings(data.settingsUpdated),
    letter: deriveDeviceLetter(data.deviceLetterSet, deviceId),
    today,
    deviceId,
  };
}
