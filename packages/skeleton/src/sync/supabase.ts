import type { Record as SkeletonRecord } from '../storage/types';
import type { SyncAdapter } from './adapter';
import { defaultStorage } from './keyValue';
import type { KeyValueStorage } from './keyValue';
import { readPullCursor, writePullCursor } from './workspace';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Where the app syncs to. Only the public (publishable) key ever reaches the browser. */
export interface SupabaseConfig {
  /** Project API URL, e.g. https://abcdefghijklmnop.supabase.co */
  url: string;
  /** Publishable key (sb_publishable_...) or a legacy anon key. Requests run as the `anon` role. */
  publishableKey: string;
}

export type SupabaseConfigProblem = 'missing' | 'invalidUrl' | 'dashboardUrl' | 'invalidKey';

export type SupabaseConfigResult =
  | { ok: true; config: SupabaseConfig }
  | { ok: false; problem: SupabaseConfigProblem; message: string };

/** True for a legacy JWT key whose role claim is `anon`. Anything else is refused. */
function isLegacyAnonKey(key: string): boolean {
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { role?: unknown }).role === 'anon';
  } catch {
    return false;
  }
}

/**
 * Check the two Vite variables. Apps call this with `import.meta.env`.
 * Only publishable keys (or legacy anon keys) are accepted, so a privileged
 * key pasted by mistake is never used in the browser.
 */
export function checkSupabaseConfig(env: Record<string, unknown>): SupabaseConfigResult {
  const rawUrl = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
  const key = typeof env.VITE_SUPABASE_PUBLISHABLE_KEY === 'string' ? env.VITE_SUPABASE_PUBLISHABLE_KEY.trim() : '';
  if (!rawUrl || !key) {
    return { ok: false, problem: 'missing', message: 'VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is not set.' };
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, problem: 'invalidUrl', message: `VITE_SUPABASE_URL is not a URL: ${rawUrl}` };
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    return { ok: false, problem: 'invalidUrl', message: 'VITE_SUPABASE_URL must use https.' };
  }
  const dashboard = /(^|\.)supabase\.com$/.test(url.hostname) && url.pathname.match(/\/project\/([a-z0-9]+)/);
  if (dashboard) {
    return {
      ok: false,
      problem: 'dashboardUrl',
      message: `VITE_SUPABASE_URL points at the Supabase dashboard. Use the project API URL instead: https://${dashboard[1]}.supabase.co`,
    };
  }

  if (!key.startsWith('sb_publishable_') && !isLegacyAnonKey(key)) {
    return {
      ok: false,
      problem: 'invalidKey',
      message: 'VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable key (sb_publishable_...) or the legacy anon key.',
    };
  }

  return { ok: true, config: { url: `${url.origin}${url.pathname.replace(/\/+$/, '')}`, publishableKey: key } };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** The one call the adapter needs. supabase-js matches it; tests pass a fake. */
export interface SupabaseRpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Create the supabase-js client on first use. The library is loaded with a
 * dynamic import, so it is a separate chunk that never slows down the first
 * screen (and is never loaded at all in local-only mode).
 */
export async function createSupabaseRpcClient(config: SupabaseConfig): Promise<SupabaseRpcClient> {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(config.url, config.publishableKey, {
    // No user login: every request runs as the anon role. Don't store or refresh sessions.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    rpc: (fn, args) => client.rpc(fn, args),
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/** The limits enforced by the SQL functions (supabase/migrations). */
export const SERVER_LIMITS = { maxPushBatch: 500, maxPullPage: 1000 } as const;

export interface SupabaseSyncAdapterOptions {
  /** The client, or a function that creates it on first use. */
  client: SupabaseRpcClient | (() => Promise<SupabaseRpcClient>);
  /** App name: records are kept separate per app ('khata', 'clinic-queue'). */
  app: string;
  /** The workspace this device currently syncs with (read on every call). */
  getWorkspaceId: () => string;
  /** Where the pull cursor is kept (default: localStorage). */
  storage?: KeyValueStorage;
  /** Records per push call (default 200, server max 500). */
  pushBatchSize?: number;
  /** Rows per pull page (default 500, server max 1000). */
  pullPageSize?: number;
  /** Most pages read in one pull; the rest follow on the next sync (default 40). */
  maxPagesPerPull?: number;
  /**
   * How far before the saved cursor each pull starts again (default 2 minutes).
   * A push transaction that started earlier can become visible after a later
   * one was already read; re-reading this window (and skipping ids already
   * known) means such records are never missed.
   */
  overlapMs?: number;
  /** A call that takes longer fails and is retried by the engine (default 20 s). */
  requestTimeoutMs?: number;
}

type PulledRow = {
  id: string;
  collection: string;
  payload: unknown;
  device_id: string;
  created_at: string;
  received_at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLLECTION = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function isPulledRow(value: unknown): value is PulledRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as { [key: string]: unknown };
  return (
    typeof row.id === 'string' &&
    typeof row.collection === 'string' &&
    typeof row.device_id === 'string' &&
    typeof row.created_at === 'string' &&
    typeof row.received_at === 'string' &&
    row.payload !== undefined
  );
}

/** Records the server will accept: a UUID id, a simple collection name and an object payload. */
function isPushable(record: SkeletonRecord<unknown>): boolean {
  return (
    UUID.test(record.id) &&
    COLLECTION.test(record.collection) &&
    typeof record.deviceId === 'string' &&
    record.deviceId.length > 0 &&
    !Number.isNaN(Date.parse(record.createdAt)) &&
    record.payload !== null &&
    typeof record.payload === 'object' &&
    !Array.isArray(record.payload)
  );
}

function laterOf(a: string | null, b: string): string {
  if (a === null) return b;
  return Date.parse(b) >= Date.parse(a) ? b : a;
}

/**
 * Syncs records through two Supabase SQL functions, `push_records` and
 * `pull_records` (see supabase/migrations). The table itself is closed to the
 * browser; the unguessable workspace UUID is what grants access.
 *
 * - push: in batches; returns every id the server now holds, including ones it
 *   already had (so a push whose response was lost is confirmed next time).
 * - pull: incremental by `received_at`, paged by (received_at, id) so rows with
 *   the same timestamp are never skipped; the cursor is saved per workspace and
 *   app only in `commitPull`, after the engine has stored the records.
 * - any error is thrown, and the engine retries with backoff.
 */
export class SupabaseSyncAdapter implements SyncAdapter {
  private readonly options: Required<Omit<SupabaseSyncAdapterOptions, 'client' | 'storage'>>;
  private readonly storage: KeyValueStorage;
  private readonly clientSource: SupabaseSyncAdapterOptions['client'];
  private client: Promise<SupabaseRpcClient> | null = null;
  private pendingCursor: { workspaceId: string; cursor: string } | null = null;

  constructor(options: SupabaseSyncAdapterOptions) {
    this.clientSource = options.client;
    this.storage = options.storage ?? defaultStorage();
    this.options = {
      app: options.app,
      getWorkspaceId: options.getWorkspaceId,
      pushBatchSize: Math.min(Math.max(options.pushBatchSize ?? 200, 1), SERVER_LIMITS.maxPushBatch),
      pullPageSize: Math.min(Math.max(options.pullPageSize ?? 500, 1), SERVER_LIMITS.maxPullPage),
      maxPagesPerPull: Math.max(options.maxPagesPerPull ?? 40, 1),
      overlapMs: Math.max(options.overlapMs ?? 120_000, 0),
      requestTimeoutMs: Math.max(options.requestTimeoutMs ?? 20_000, 1),
    };
  }

  private getClient(): Promise<SupabaseRpcClient> {
    if (!this.client) {
      const source = this.clientSource;
      this.client = typeof source === 'function' ? source() : Promise.resolve(source);
      // A failed load (e.g. offline before the chunk was cached) is retried next time.
      this.client.catch(() => {
        this.client = null;
      });
    }
    return this.client;
  }

  private async call(fn: string, args: Record<string, unknown>): Promise<unknown> {
    const client = await this.getClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${fn} timed out`)), this.options.requestTimeoutMs);
    });
    try {
      const { data, error } = await Promise.race([Promise.resolve(client.rpc(fn, args)), timeout]);
      if (error) throw new Error(`${fn} failed: ${error.message}`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async push(records: SkeletonRecord<unknown>[]): Promise<string[]> {
    const workspaceId = this.options.getWorkspaceId();
    const valid = records.filter(isPushable);
    const stored: string[] = [];
    for (let i = 0; i < valid.length; i += this.options.pushBatchSize) {
      const batch = valid.slice(i, i + this.options.pushBatchSize);
      const data = await this.call('push_records', {
        p_workspace_id: workspaceId,
        p_app: this.options.app,
        p_records: batch.map((r) => ({
          id: r.id,
          collection: r.collection,
          payload: r.payload,
          deviceId: r.deviceId,
          createdAt: r.createdAt,
        })),
      });
      if (!Array.isArray(data)) throw new Error('push_records returned an unexpected response');
      for (const item of data) {
        const id = typeof item === 'string' ? item : (item as { id?: unknown } | null)?.id;
        if (typeof id === 'string') stored.push(id);
      }
    }
    return stored;
  }

  async pull(knownIds: string[]): Promise<SkeletonRecord<unknown>[]> {
    const { app, pullPageSize, maxPagesPerPull, overlapMs } = this.options;
    const workspaceId = this.options.getWorkspaceId();
    const saved = parseCursor(readPullCursor(this.storage, app, workspaceId));

    // After a complete pull: start a little before the cursor (see overlapMs).
    // After a pull that stopped at the page limit: resume exactly where it stopped.
    // No cursor: from the beginning.
    let since: string | null = null;
    let afterId: string | null = null;
    if (saved?.done) since = new Date(Date.parse(saved.at) - overlapMs).toISOString();
    else if (saved) [since, afterId] = [saved.at, saved.id];

    const known = new Set(knownIds);
    const out: SkeletonRecord<unknown>[] = [];
    let tail: { at: string; id: string } | null = null;
    let done = false;

    for (let page = 0; page < maxPagesPerPull; page++) {
      const data = await this.call('pull_records', {
        p_workspace_id: workspaceId,
        p_app: app,
        p_since: since,
        p_after_id: afterId,
        p_limit: pullPageSize,
      });
      if (!Array.isArray(data)) throw new Error('pull_records returned an unexpected response');
      const rows = data.filter(isPulledRow);

      for (const row of rows) {
        if (known.has(row.id)) continue;
        known.add(row.id);
        out.push({
          id: row.id,
          collection: row.collection,
          payload: row.payload,
          deviceId: row.device_id,
          createdAt: row.created_at,
        });
      }

      const last = data[data.length - 1] as unknown;
      if (data.length === 0 || !isPulledRow(last)) {
        done = true;
        break;
      }
      // Next page starts strictly after the last (received_at, id) seen.
      tail = { at: last.received_at, id: last.id };
      since = tail.at;
      afterId = tail.id;
      if (data.length < pullPageSize) {
        done = true;
        break;
      }
    }

    let next: PullCursor | null;
    if (done) {
      // Reached the end: remember the latest received_at seen (overlap applies next time).
      const at = tail ? laterOf(saved?.at ?? null, tail.at) : saved?.at;
      next = at ? { at, id: tail?.id ?? saved?.id ?? NIL_UUID, done: true } : null;
    } else {
      // Stopped at the page limit: resume exactly here next time.
      next = tail ? { ...tail, done: false } : saved;
    }
    this.pendingCursor = next ? { workspaceId, cursor: JSON.stringify(next) } : null;
    return out;
  }

  async commitPull(): Promise<void> {
    const pending = this.pendingCursor;
    this.pendingCursor = null;
    if (pending) writePullCursor(this.storage, this.options.app, pending.workspaceId, pending.cursor);
  }
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** Saved pull position: the last (received_at, id), and whether that pull reached the end. */
type PullCursor = { at: string; id: string; done: boolean };

function parseCursor(raw: string | null): PullCursor | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PullCursor>;
    if (typeof value.at === 'string' && !Number.isNaN(Date.parse(value.at)) && typeof value.id === 'string') {
      return { at: value.at, id: value.id, done: value.done !== false };
    }
  } catch {
    // A plain timestamp (or anything unreadable) is treated below.
  }
  return Number.isNaN(Date.parse(raw)) ? null : { at: raw, id: NIL_UUID, done: true };
}
