import { toAsciiDigits } from '../utils/digits';
import type { KeyValueStorage } from './keyValue';

/**
 * A workspace is one shop or one clinic. Every device that uses the same
 * workspace code shares the same records. The code is a random UUID created
 * on first use: it is unguessable, and it is the only thing a device needs to
 * read and add records, so it must be treated as a shared secret.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NIL = '00000000-0000-0000-0000-000000000000';

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes); // a workspace code must never come from Math.random
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Clean up a typed or pasted code: trims, lowercases, accepts Urdu digits,
 * spaces and missing dashes. Returns the canonical UUID, or null if it is not a valid code.
 */
export function normalizeWorkspaceCode(input: string): string | null {
  const hex = toAsciiDigits(input).toLowerCase().replace(/[\s\-‐-―]/g, '');
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  const code = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return UUID.test(code) && code !== NIL ? code : null;
}

export function isValidWorkspaceCode(input: string): boolean {
  return normalizeWorkspaceCode(input) !== null;
}

const workspaceKey = (app: string) => `ghost-sync.workspace.${app}`;
const cursorKey = (app: string, workspaceId: string) => `ghost-sync.pull-cursor.${app}.${workspaceId}`;

/** This device's workspace code for an app, created (and saved) on first use. */
export function getOrCreateWorkspaceId(storage: KeyValueStorage, app: string): string {
  const saved = normalizeWorkspaceCode(storage.getItem(workspaceKey(app)) ?? '');
  if (saved) return saved;
  const created = randomUuid();
  storage.setItem(workspaceKey(app), created);
  return created;
}

export function setWorkspaceId(storage: KeyValueStorage, app: string, code: string): void {
  const clean = normalizeWorkspaceCode(code);
  if (!clean) throw new Error('Invalid workspace code');
  storage.setItem(workspaceKey(app), clean);
}

/** Start a brand-new workspace on this device (used by "Clear all data"). */
export function resetWorkspaceId(storage: KeyValueStorage, app: string): string {
  const created = randomUuid();
  storage.setItem(workspaceKey(app), created);
  return created;
}

/** The last pull position for a workspace and app (a server `received_at`), or null. */
export function readPullCursor(storage: KeyValueStorage, app: string, workspaceId: string): string | null {
  return storage.getItem(cursorKey(app, workspaceId));
}

export function writePullCursor(storage: KeyValueStorage, app: string, workspaceId: string, cursor: string): void {
  storage.setItem(cursorKey(app, workspaceId), cursor);
}

export function clearPullCursor(storage: KeyValueStorage, app: string, workspaceId: string): void {
  storage.removeItem(cursorKey(app, workspaceId));
}

const JOIN_PREFIX = '#join=';

/** A link that opens the app and offers to join the workspace (encoded in the QR code). */
export function buildJoinUrl(code: string, base?: string): string {
  const root =
    base ?? (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');
  return `${root}${JOIN_PREFIX}${code}`;
}

/** The workspace code in a `#join=<code>` URL hash, or null. */
export function readJoinCode(hash: string): string | null {
  if (!hash.startsWith(JOIN_PREFIX)) return null;
  let raw = hash.slice(JOIN_PREFIX.length);
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return normalizeWorkspaceCode(raw);
}
