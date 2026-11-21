import type { SyncableStore } from '../storage/store';
import { InMemorySyncAdapter } from './adapter';
import type { SyncAdapter } from './adapter';
import { createSyncEngine } from './engine';
import { defaultStorage } from './keyValue';
import type { KeyValueStorage } from './keyValue';
import { checkSupabaseConfig, createSupabaseRpcClient, SupabaseSyncAdapter } from './supabase';
import type { SupabaseConfig, SupabaseConfigProblem, SupabaseRpcClient } from './supabase';
import type { SyncEngine, SyncEngineConfig } from './types';
import {
  buildJoinUrl,
  clearPullCursor,
  getOrCreateWorkspaceId,
  normalizeWorkspaceCode,
  resetWorkspaceId,
  setWorkspaceId,
} from './workspace';

/**
 * - `cloud`: syncing through Supabase.
 * - `memory`: an in-memory stand-in for the cloud (tests).
 * - `local`: nothing configured; data stays on this device and the badge says "Local only".
 */
export type SyncMode = 'cloud' | 'memory' | 'local';

export interface CloudSyncOptions {
  /** App name used to keep records apart in the cloud ('khata', 'clinic-queue'). */
  app: string;
  store: SyncableStore;
  /** From `checkSupabaseConfig(import.meta.env)`; null or undefined when not configured. */
  supabase?: SupabaseConfig | null;
  /** Used only when Supabase is not configured. Tests pass an InMemorySyncAdapter. */
  fallback?: InMemorySyncAdapter | null;
  /** Where the workspace code and pull cursors live (default: localStorage). */
  storage?: KeyValueStorage;
  /** Replace the supabase-js client (tests). */
  createClient?: (config: SupabaseConfig) => Promise<SupabaseRpcClient>;
  /** Retry settings passed to the engine. */
  retry?: Pick<SyncEngineConfig, 'maxRetries' | 'baseDelayMs' | 'maxDelayMs'>;
  /** Background sync interval in cloud mode (default 15 s; 0 turns it off). */
  pollIntervalMs?: number;
}

export type JoinResult = 'joined' | 'same';

export interface CloudSync {
  readonly mode: SyncMode;
  readonly engine: SyncEngine;
  /** This device's workspace code (created on first use). */
  getWorkspaceId(): string;
  /** A link that opens the app and offers to join this workspace (shown as a QR code). */
  getJoinUrl(base?: string): string;
  /**
   * Switch this device to another workspace: the records already on this device
   * are shared with it, and all of that workspace's records are pulled.
   * Throws for an invalid code or in local-only mode.
   */
  joinWorkspace(code: string): Promise<JoinResult>;
  /** Start a fresh workspace on this device ("Clear all data"). */
  leaveWorkspace(): void;
}

export interface SyncSetup {
  supabase: SupabaseConfig | null;
  fallback: InMemorySyncAdapter | null;
  /** Why Supabase is not used, when it isn't. */
  problem: SupabaseConfigProblem | null;
}

/**
 * Decide how an app syncs from its Vite environment (`import.meta.env`):
 *  - both Supabase variables set and valid  -> cloud
 *  - running under Vitest (MODE "test")     -> in-memory stand-in
 *  - otherwise                              -> local only (fully offline, badge "Local only")
 * A misconfigured value is reported in the console and never breaks the app.
 */
export function syncSetupFromEnv(env: Record<string, unknown>): SyncSetup {
  const checked = checkSupabaseConfig(env);
  if (checked.ok) return { supabase: checked.config, fallback: null, problem: null };
  if (checked.problem !== 'missing' && typeof console !== 'undefined') {
    console.warn(`[ghost-sync] Cloud sync is off: ${checked.message}`);
  }
  const fallback = env.MODE === 'test' ? new InMemorySyncAdapter() : null;
  return { supabase: null, fallback, problem: checked.problem };
}

/** Wire storage, the right adapter and the engine together for one app. */
export function createCloudSync(options: CloudSyncOptions): CloudSync {
  const { app, store } = options;
  const storage = options.storage ?? defaultStorage();
  const getWorkspaceId = () => getOrCreateWorkspaceId(storage, app);

  let mode: SyncMode;
  let adapter: SyncAdapter | null;
  if (options.supabase) {
    const config = options.supabase;
    const factory = options.createClient ?? createSupabaseRpcClient;
    mode = 'cloud';
    adapter = new SupabaseSyncAdapter({ client: () => factory(config), app, getWorkspaceId, storage });
  } else if (options.fallback) {
    mode = 'memory';
    adapter = options.fallback;
  } else {
    mode = 'local';
    adapter = null;
  }

  // In cloud mode, pull every 15 s while visible so watching devices stay current.
  const engine = createSyncEngine({
    adapter,
    store,
    pollIntervalMs: mode === 'cloud' ? (options.pollIntervalMs ?? 15_000) : 0,
    ...options.retry,
  });

  return {
    mode,
    engine,
    getWorkspaceId,
    getJoinUrl: (base) => buildJoinUrl(getWorkspaceId(), base),

    async joinWorkspace(code: string): Promise<JoinResult> {
      const next = normalizeWorkspaceCode(code);
      if (!next) throw new Error('Invalid workspace code');
      if (mode === 'local') throw new Error('Sync is not configured');
      if (next === getWorkspaceId()) return 'same';

      // Let a sync that is already running finish against the old workspace.
      await engine.syncNow();

      setWorkspaceId(storage, app, next);
      clearPullCursor(storage, app, next); // pull the joined workspace from the start
      await store.markAllPending(); // share what this device already has
      await engine.syncNow(); // offline: it runs when the connection returns
      return 'joined';
    },

    leaveWorkspace(): void {
      clearPullCursor(storage, app, getWorkspaceId());
      resetWorkspaceId(storage, app);
      options.fallback?.reset();
    },
  };
}
