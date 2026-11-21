import type { SkeletonRecord, SupabaseRpcClient, SyncableStore, SyncedRow } from '@skeleton/core';

/** A deterministic, valid v4-style UUID from a number (so failures replay). */
export function uuidOf(n: number, prefix = 0): string {
  const hex = n.toString(16).padStart(12, '0');
  const p = prefix.toString(16).padStart(8, '0');
  return `${p}-0000-4000-8000-${hex}`;
}

export const WORKSPACE_A = '11111111-1111-4111-8111-111111111111';
export const WORKSPACE_B = '22222222-2222-4222-8222-222222222222';

type ServerRow = {
  id: string;
  workspace_id: string;
  app: string;
  collection: string;
  payload: unknown;
  device_id: string;
  created_at: string;
  receivedMs: number;
};

export type Fault = 'none' | 'failBefore' | 'failAfter';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An in-memory stand-in for the two SQL functions in
 * supabase/migrations/*_records_sync.sql, with the same rules:
 *  - push_records: max 500 per batch, ON CONFLICT (id) DO NOTHING, returns the
 *    batch ids stored in that workspace and app
 *  - pull_records: (received_at, id) > (p_since, p_after_id or nil), ordered, max 1000
 * Plus test controls: a clock that can stand still (equal received_at values),
 * "late commits" (a row's received_at is earlier than rows already visible),
 * and faults (fail before applying, or apply and lose the response).
 */
export class FakeSupabase implements SupabaseRpcClient {
  rows: ServerRow[] = [];
  clockMs = Date.UTC(2026, 10, 7, 10, 0, 0);
  calls: string[] = [];
  /** Decides the fault for each call (default: none). */
  nextFault: (fn: string) => Fault = () => 'none';
  /** How many ms earlier than the clock a push's rows are stamped (late commit). */
  nextLagMs: () => number = () => 0;

  advance(ms: number): void {
    this.clockMs += ms;
  }

  async rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> {
    this.calls.push(fn);
    const fault = this.nextFault(fn);
    if (fault === 'failBefore') return { data: null, error: { message: 'TypeError: Failed to fetch' } };
    let result: unknown;
    try {
      result = fn === 'push_records' ? this.push(args) : fn === 'pull_records' ? this.pull(args) : null;
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
    }
    if (fault === 'failAfter') return { data: null, error: { message: 'connection reset (response lost)' } };
    return { data: result, error: null };
  }

  private push(args: Record<string, unknown>) {
    const workspace = String(args.p_workspace_id);
    const app = String(args.p_app);
    const records = args.p_records as Array<{ [k: string]: unknown }>;
    if (!UUID.test(workspace)) throw new Error('invalid workspace');
    if (!Array.isArray(records)) throw new Error('p_records must be a JSON array');
    if (records.length > 500) throw new Error('too many records in one batch (max 500)');
    for (const r of records) {
      if (typeof r.id !== 'string' || !UUID.test(r.id)) throw new Error('invalid record in batch');
      if (!r.payload || typeof r.payload !== 'object' || Array.isArray(r.payload)) throw new Error('invalid record in batch');
    }
    const receivedMs = this.clockMs - this.nextLagMs();
    // Primary key (workspace_id, id): ON CONFLICT DO NOTHING within the workspace.
    const key = (ws: string, id: string) => `${ws}/${id}`;
    const byId = new Map(this.rows.map((row) => [key(row.workspace_id, row.id), row]));
    for (const r of records) {
      if (byId.has(key(workspace, r.id as string))) continue;
      const row: ServerRow = {
        id: r.id as string,
        workspace_id: workspace,
        app,
        collection: String(r.collection),
        payload: structuredClone(r.payload),
        device_id: String(r.deviceId),
        created_at: String(r.createdAt),
        receivedMs,
      };
      this.rows.push(row);
      byId.set(key(workspace, row.id), row);
    }
    const ids = new Set(records.map((r) => r.id as string));
    return this.rows.filter((row) => row.workspace_id === workspace && row.app === app && ids.has(row.id)).map((row) => ({ id: row.id }));
  }

  private pull(args: Record<string, unknown>) {
    const workspace = String(args.p_workspace_id);
    const app = String(args.p_app);
    const sinceMs = args.p_since == null ? null : Date.parse(String(args.p_since));
    const afterId = args.p_after_id == null ? '00000000-0000-0000-0000-000000000000' : String(args.p_after_id);
    const limit = Math.min(Math.max(Number(args.p_limit ?? 500), 1), 1000);
    return this.rows
      .filter((row) => row.workspace_id === workspace && row.app === app)
      .filter((row) => sinceMs === null || row.receivedMs > sinceMs || (row.receivedMs === sinceMs && row.id > afterId))
      .sort((a, b) => a.receivedMs - b.receivedMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        collection: row.collection,
        payload: structuredClone(row.payload),
        device_id: row.device_id,
        created_at: row.created_at,
        received_at: new Date(row.receivedMs).toISOString(),
      }));
  }

  /** Ids held for a workspace and app. */
  idsFor(workspace: string, app: string): string[] {
    return this.rows.filter((r) => r.workspace_id === workspace && r.app === app).map((r) => r.id);
  }
}

/** A fast in-memory SyncableStore (same contract as the Dexie store) with optional faults. */
export class MemoryStore implements SyncableStore {
  rows = new Map<string, SyncedRow<unknown>>();
  /** Return true to make the next ingestPulled throw (e.g. the tab was closed). */
  failIngest: () => boolean = () => false;
  private seq = 0;

  constructor(
    readonly deviceId: string,
    private readonly idPrefix: number,
  ) {}

  add(collection: string, payload: unknown): SkeletonRecord<unknown> {
    const id = uuidOf(++this.seq, this.idPrefix);
    const record = { id, createdAt: new Date(Date.UTC(2026, 10, 7) + this.seq).toISOString(), deviceId: this.deviceId, collection, payload };
    this.rows.set(id, { ...record, _syncStatus: 'pending' });
    return record;
  }

  async getAllIds(): Promise<string[]> {
    return [...this.rows.keys()];
  }

  async getPending(): Promise<SyncedRow<unknown>[]> {
    return [...this.rows.values()].filter((r) => r._syncStatus === 'pending');
  }

  async markSynced(ids: string[]): Promise<void> {
    for (const id of ids) {
      const row = this.rows.get(id);
      if (row) row._syncStatus = 'synced';
    }
  }

  async markAllPending(): Promise<void> {
    for (const row of this.rows.values()) row._syncStatus = 'pending';
  }

  async ingestPulled(record: SkeletonRecord<unknown>): Promise<void> {
    if (this.failIngest()) throw new Error('storage interrupted');
    if (this.rows.has(record.id)) return;
    this.rows.set(record.id, { ...record, _syncStatus: 'synced' });
  }

  /** Records without the internal status, sorted by id (for comparing devices). */
  snapshot(): SkeletonRecord<unknown>[] {
    return [...this.rows.values()]
      .map(({ _syncStatus: _, ...clean }) => clean)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
  }
}
