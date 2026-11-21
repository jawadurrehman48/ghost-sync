import { todayISO } from '@skeleton/core';
import type { Store } from '@skeleton/core';
import {
  activeTokenFor,
  deriveDeviceLetter,
  deriveQueue,
  deriveTokens,
  isValidLetter,
  nextTokenNumber,
  tokenLabel,
} from './clinic.reducers';
import type { ClinicCollections, ClinicData, Token } from './clinic.types';

export type ClinicStore = Store<ClinicCollections>;

/** Read every record (local, offline). */
export async function loadClinicData(store: ClinicStore): Promise<ClinicData> {
  const [patientRegistered, tokenIssued, tokenCalled, tokenCompleted, tokenSkipped, tokenRequeued, deviceLetterSet, settingsUpdated] =
    await Promise.all([
      store.query('patientRegistered'),
      store.query('tokenIssued'),
      store.query('tokenCalled'),
      store.query('tokenCompleted'),
      store.query('tokenSkipped'),
      store.query('tokenRequeued'),
      store.query('deviceLetterSet'),
      store.query('settingsUpdated'),
    ]);
  return { patientRegistered, tokenIssued, tokenCalled, tokenCompleted, tokenSkipped, tokenRequeued, deviceLetterSet, settingsUpdated };
}

/** Options shared by every action; `now` is injectable for tests and demo data. */
export type ActionOptions = { now?: Date };
const stamp = (opts?: ActionOptions) => (opts?.now ?? new Date()).toISOString();

async function freshTokens(store: ClinicStore): Promise<{ data: ClinicData; tokens: Token[] }> {
  const data = await loadClinicData(store);
  return { data, tokens: deriveTokens(data) };
}

export type IssueResult =
  | { status: 'issued'; tokenId: string; label: string; ahead: number }
  | { status: 'alreadyActive'; tokenId: string; label: string };

/**
 * Give a patient today's next token from this device. Claims the device's
 * letter the first time. Refuses a second token for a patient who is already
 * waiting or being served today (returns that token instead).
 */
export async function issueToken(
  store: ClinicStore,
  deviceId: string,
  patientId: string,
  reason?: string,
  opts?: ActionOptions,
): Promise<IssueResult> {
  const at = stamp(opts);
  const date = opts?.now ? todayISO(opts.now) : todayISO();
  const { data, tokens } = await freshTokens(store);

  const existing = activeTokenFor(tokens, patientId, date);
  if (existing) return { status: 'alreadyActive', tokenId: existing.id, label: existing.label };

  const letter = deriveDeviceLetter(data.deviceLetterSet, deviceId);
  if (!letter.claimed) await store.add('deviceLetterSet', { deviceId, letter: letter.letter });

  const number = nextTokenNumber(data.tokenIssued, date, letter.letter, deviceId);
  const cleanReason = reason?.trim();
  const record = await store.add('tokenIssued', {
    patientId,
    prefix: letter.letter,
    number,
    date,
    at,
    ...(cleanReason ? { reason: cleanReason } : {}),
  });
  const ahead = deriveQueue(tokens, date).waiting.length;
  return { status: 'issued', tokenId: record.id, label: tokenLabel(letter.letter, number), ahead };
}

/** Change this device's token letter. */
export async function setDeviceLetter(store: ClinicStore, deviceId: string, letter: string): Promise<void> {
  if (!isValidLetter(letter)) throw new Error('Invalid letter');
  await store.add('deviceLetterSet', { deviceId, letter });
}

export type CallNextResult = { completedId?: string; calledId?: string };

/**
 * The big button. Completes the patient being served (if any) and calls the
 * first waiting patient (if any). Does nothing when there is nothing to do.
 */
export async function callNext(store: ClinicStore, opts?: ActionOptions): Promise<CallNextResult> {
  const at = stamp(opts);
  const date = opts?.now ? todayISO(opts.now) : todayISO();
  const { tokens } = await freshTokens(store);
  const queue = deriveQueue(tokens, date);
  const result: CallNextResult = {};
  const current = queue.serving[0];
  if (current) {
    await store.add('tokenCompleted', { tokenId: current.id, at });
    result.completedId = current.id;
  }
  const next = queue.waiting[0];
  if (next) {
    await store.add('tokenCalled', { tokenId: next.id, at });
    result.calledId = next.id;
  }
  return result;
}

async function tokenNow(store: ClinicStore, tokenId: string): Promise<Token | undefined> {
  const { tokens } = await freshTokens(store);
  return tokens.find((t) => t.id === tokenId);
}

/** Call a specific waiting patient. Returns false if the token is not waiting. */
export async function callToken(store: ClinicStore, tokenId: string, opts?: ActionOptions): Promise<boolean> {
  const token = await tokenNow(store, tokenId);
  if (token?.status !== 'waiting') return false;
  await store.add('tokenCalled', { tokenId, at: stamp(opts) });
  return true;
}

/** Finish a visit (only a token being served can be completed). */
export async function completeToken(store: ClinicStore, tokenId: string, notes?: string, opts?: ActionOptions): Promise<boolean> {
  const token = await tokenNow(store, tokenId);
  if (token?.status !== 'serving') return false;
  const clean = notes?.trim();
  await store.add('tokenCompleted', { tokenId, at: stamp(opts), ...(clean ? { notes: clean } : {}) });
  return true;
}

/** Skip a patient who is not present (waiting or being served). */
export async function skipToken(store: ClinicStore, tokenId: string, opts?: ActionOptions): Promise<boolean> {
  const token = await tokenNow(store, tokenId);
  if (token?.status !== 'waiting' && token?.status !== 'serving') return false;
  await store.add('tokenSkipped', { tokenId, at: stamp(opts) });
  return true;
}

/** Put a skipped patient back at the end of the queue. */
export async function requeueToken(store: ClinicStore, tokenId: string, opts?: ActionOptions): Promise<boolean> {
  const token = await tokenNow(store, tokenId);
  if (token?.status !== 'skipped') return false;
  await store.add('tokenRequeued', { tokenId, at: stamp(opts) });
  return true;
}
