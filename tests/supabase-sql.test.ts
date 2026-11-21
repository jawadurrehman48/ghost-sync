// @vitest-environment node
/**
 * Runs the real migration (supabase/migrations) in PGlite, an in-process
 * Postgres, as the `anon` role the browser uses. Checks the security setup,
 * the validation and limits of push_records, paging of pull_records, and the
 * SupabaseSyncAdapter end to end against real SQL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { SupabaseSyncAdapter, createMemoryStorage, createSyncEngine } from '@skeleton/core';
import type { SupabaseRpcClient } from '@skeleton/core';
import { MemoryStore, WORKSPACE_A, WORKSPACE_B, uuidOf } from './sync.helpers';

const MIGRATIONS = join(__dirname, '..', 'supabase', 'migrations');
const migrationSql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
  .join('\n');

let db: PGlite;

/** Calls the functions the way PostgREST does: as `anon`, results serialised with to_jsonb. */
function rpcClient(role = 'anon'): SupabaseRpcClient {
  return {
    async rpc(fn, args) {
      try {
        await db.exec(`set role ${role}`);
        if (fn === 'push_records') {
          const res = await db.query<{ data: unknown }>(
            `select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as data from public.push_records($1::uuid, $2, $3::jsonb) t`,
            [args.p_workspace_id, args.p_app, JSON.stringify(args.p_records)],
          );
          return { data: res.rows[0].data, error: null };
        }
        const res = await db.query<{ data: unknown }>(
          `select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as data
             from public.pull_records($1::uuid, $2, $3::timestamptz, $4::uuid, $5::int) t`,
          [args.p_workspace_id, args.p_app, args.p_since ?? null, args.p_after_id ?? null, args.p_limit ?? null],
        );
        return { data: res.rows[0].data, error: null };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
      } finally {
        await db.exec('reset role');
      }
    },
  };
}

const anon = () => rpcClient('anon');

function rec(n: number, overrides: Record<string, unknown> = {}) {
  return { id: uuidOf(n, 9), collection: 'items', payload: { n }, deviceId: 'device-1', createdAt: '2026-11-07T10:00:00.123Z', ...overrides };
}

async function push(records: unknown, workspace = WORKSPACE_A, app = 'khata') {
  return anon().rpc('push_records', { p_workspace_id: workspace, p_app: app, p_records: records });
}

async function pull(args: { since?: string | null; after?: string | null; limit?: number; workspace?: string; app?: string } = {}) {
  return anon().rpc('pull_records', {
    p_workspace_id: args.workspace ?? WORKSPACE_A,
    p_app: args.app ?? 'khata',
    p_since: args.since ?? null,
    p_after_id: args.after ?? null,
    p_limit: args.limit ?? 500,
  });
}

async function count(): Promise<number> {
  const res = await db.query<{ n: number }>('select count(*)::int as n from public.records');
  return res.rows[0].n;
}

beforeAll(async () => {
  db = new PGlite();
  // The roles Supabase provides.
  await db.exec('create role anon nologin; create role authenticated nologin;');
  await db.exec(migrationSql);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('migration and security', () => {
  it('can be run again safely', async () => {
    await db.exec(migrationSql);
  });

  it('has the records table with the required columns and index', async () => {
    const cols = await db.query<{ column_name: string; is_nullable: string }>(
      `select column_name, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'records' order by ordinal_position`,
    );
    expect(cols.rows.map((c) => c.column_name)).toEqual([
      'id', 'workspace_id', 'app', 'collection', 'payload', 'device_id', 'created_at', 'received_at',
    ]);
    expect(cols.rows.every((c) => c.is_nullable === 'NO')).toBe(true);
    const idx = await db.query<{ indexdef: string }>(`select indexdef from pg_indexes where tablename = 'records'`);
    expect(idx.rows.some((i) => /\(workspace_id, app, received_at/.test(i.indexdef))).toBe(true);
    expect(idx.rows.some((i) => /UNIQUE INDEX records_pkey .*\(workspace_id, id\)/.test(i.indexdef))).toBe(true);
  });

  it('enables row level security with no policies', async () => {
    const rls = await db.query<{ relrowsecurity: boolean }>(`select relrowsecurity from pg_class where oid = 'public.records'::regclass`);
    expect(rls.rows[0].relrowsecurity).toBe(true);
    const policies = await db.query<{ n: number }>(`select count(*)::int as n from pg_policy where polrelid = 'public.records'::regclass`);
    expect(policies.rows[0].n).toBe(0);
  });

  it.each([
    ['select', 'select * from public.records'],
    ['insert', `insert into public.records (id, workspace_id, app, collection, payload, device_id, created_at) values ('${uuidOf(1, 7)}', '${WORKSPACE_A}', 'khata', 'items', '{}', 'd', now())`],
    ['update', `update public.records set payload = '{}'`],
    ['delete', 'delete from public.records'],
  ])('denies anon a direct %s on the table', async (_name, sql) => {
    await db.exec('set role anon');
    try {
      await expect(db.query(sql)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
  });

  it('defines both functions as SECURITY DEFINER with a fixed, empty search_path', async () => {
    const res = await db.query<{ proname: string; prosecdef: boolean; proconfig: string[] | null }>(
      `select proname, prosecdef, proconfig from pg_proc where proname in ('push_records', 'pull_records') order by proname`,
    );
    expect(res.rows.map((r) => r.proname)).toEqual(['pull_records', 'push_records']);
    for (const row of res.rows) {
      expect(row.prosecdef).toBe(true);
      expect(row.proconfig).toContainEqual(expect.stringMatching(/^search_path=("")?$/));
    }
  });

  it('lets anon execute the functions, but not authenticated', async () => {
    expect((await push([rec(1)])).error).toBeNull();
    const asAuthenticated = await rpcClient('authenticated').rpc('pull_records', { p_workspace_id: WORKSPACE_A, p_app: 'khata' });
    expect(asAuthenticated.error?.message).toMatch(/permission denied/);
  });
});

describe('push_records', () => {
  it('ignores duplicate ids, within a batch and across calls, and returns the stored ids', async () => {
    const before = await count();
    const a = rec(100);
    const b = rec(101);
    // A single-column result comes back as plain ids (the adapter accepts plain ids or { id }).
    const ids = (data: unknown) => (data as Array<string | { id: string }>).map((r) => (typeof r === 'string' ? r : r.id)).sort();
    const first = await push([a, a, b]);
    expect(first.error).toBeNull();
    expect(ids(first.data)).toEqual([a.id, b.id].sort());
    const again = await push([a, b]);
    expect(ids(again.data)).toEqual([a.id, b.id].sort());
    expect(await count()).toBe(before + 2);
  });

  it('keeps a record id per workspace: another workspace can never overwrite or block it', async () => {
    const original = rec(110, { payload: { owner: 'A' } });
    await push([original], WORKSPACE_A);
    // The same id pushed to B (a device that joined B after syncing in A) is stored in B separately.
    const res = await push([{ ...original, payload: { owner: 'B' } }], WORKSPACE_B);
    expect(res.error).toBeNull();
    const inA = (await pull({ workspace: WORKSPACE_A })).data as Array<{ id: string; payload: unknown }>;
    const inB = (await pull({ workspace: WORKSPACE_B })).data as Array<{ id: string; payload: unknown }>;
    expect(inA.find((r) => r.id === original.id)?.payload).toEqual({ owner: 'A' });
    expect(inB.find((r) => r.id === original.id)?.payload).toEqual({ owner: 'B' });
  });

  it.each([
    ['records that are not an array', { not: 'an array' }],
    ['a non-UUID id', [rec(200, { id: 'abc' })]],
    ['a bad collection name', [rec(201, { collection: 'drop table;' })]],
    ['a payload that is not an object', [rec(202, { payload: [1, 2] })]],
    ['a missing device id', [rec(203, { deviceId: '' })]],
    ['a malformed createdAt', [rec(204, { createdAt: 'yesterday' })]],
    ['a payload over 16 KB', [rec(205, { payload: { big: 'x'.repeat(17_000) } })]],
  ])('rejects %s and stores nothing', async (_name, records) => {
    const before = await count();
    const res = await push(records);
    expect(res.error).not.toBeNull();
    expect(await count()).toBe(before);
  });

  it('rejects a batch of more than 500 records', async () => {
    const before = await count();
    const big = Array.from({ length: 501 }, (_, i) => rec(1000 + i));
    expect((await push(big)).error?.message).toMatch(/max 500/);
    expect(await count()).toBe(before);
  });

  it('rejects a missing workspace and an invalid app name', async () => {
    expect((await anon().rpc('push_records', { p_workspace_id: null, p_app: 'khata', p_records: [] })).error).not.toBeNull();
    expect((await push([rec(300)], WORKSPACE_A, 'Khata App')).error?.message).toMatch(/invalid p_app/);
  });
});

describe('pull_records', () => {
  const W = '33333333-3333-4333-8333-333333333333';

  beforeAll(async () => {
    // 500 rows in one statement share one received_at; then 3 more later.
    expect((await push(Array.from({ length: 500 }, (_, i) => rec(5000 + i)), W)).error).toBeNull();
    for (const n of [6000, 6001, 6002]) expect((await push([rec(n)], W)).error).toBeNull();
    await push([rec(7000)], W, 'clinic-queue');
  });

  it('pages through rows that share a received_at without gaps or repeats', async () => {
    const seen: string[] = [];
    let since: string | null = null;
    let after: string | null = null;
    for (let i = 0; i < 200; i++) {
      const page = (await pull({ workspace: W, since, after, limit: 37 })).data as Array<{ id: string; received_at: string }>;
      seen.push(...page.map((r) => r.id));
      if (page.length < 37) break;
      since = page[page.length - 1].received_at;
      after = page[page.length - 1].id;
    }
    expect(seen).toHaveLength(503);
    expect(new Set(seen).size).toBe(503);
  });

  it('caps a page at 1000 rows whatever limit is asked for', async () => {
    const BIG = '66666666-6666-4666-8666-666666666666';
    for (let batch = 0; batch < 3; batch++) {
      const size = batch < 2 ? 500 : 100;
      expect((await push(Array.from({ length: size }, (_, i) => rec(20_000 + batch * 500 + i)), BIG)).error).toBeNull();
    }
    expect(((await pull({ workspace: BIG, limit: 5000 })).data as unknown[]).length).toBe(1000);
    expect(((await pull({ workspace: BIG, limit: 0 })).data as unknown[]).length).toBe(1);
  });

  it('returns rows in (received_at, id) order', async () => {
    const all = (await pull({ workspace: W, limit: 1000 })).data as Array<{ id: string; received_at: string }>;
    expect(all.length).toBe(503);
    for (let i = 1; i < all.length; i++) {
      const a = all[i - 1];
      const b = all[i];
      const order = Date.parse(a.received_at) - Date.parse(b.received_at) || (a.id < b.id ? -1 : 1);
      expect(order).toBeLessThan(0);
    }
  });

  it('keeps apps and workspaces apart', async () => {
    const clinic = (await pull({ workspace: W, app: 'clinic-queue' })).data as Array<{ id: string }>;
    expect(clinic.map((r) => r.id)).toEqual([uuidOf(7000, 9)]);
    const other = (await pull({ workspace: '44444444-4444-4444-8444-444444444444' })).data;
    expect(other).toEqual([]);
  });

  it('returns created_at exactly as JavaScript wrote it', async () => {
    const all = (await pull({ workspace: W, limit: 1 })).data as Array<{ created_at: string }>;
    expect(all[0].created_at).toBe('2026-11-07T10:00:00.123Z');
  });
});

describe('SupabaseSyncAdapter against the real SQL', () => {
  it('two devices in one workspace converge, and repeated syncs never duplicate', async () => {
    const W = '55555555-5555-4555-8555-555555555555';
    const make = (i: number) => {
      const store = new MemoryStore(`device-${i}`, 20 + i);
      const adapter = new SupabaseSyncAdapter({ client: anon(), app: 'khata', getWorkspaceId: () => W, storage: createMemoryStorage(), pullPageSize: 3 });
      return { store, engine: createSyncEngine({ adapter, store, maxRetries: 0 }) };
    };
    const [a, b] = [make(1), make(2)];
    for (let i = 0; i < 5; i++) a.store.add('items', { by: 'a', i });
    for (let i = 0; i < 4; i++) b.store.add('items', { by: 'b', i });
    for (let round = 0; round < 3; round++) {
      await a.engine.syncNow();
      await b.engine.syncNow();
    }
    expect(a.engine.getStatus().state).toBe('synced');
    expect(a.store.snapshot()).toEqual(b.store.snapshot());
    expect(a.store.snapshot()).toHaveLength(9);
    const n = await db.query<{ n: number }>(`select count(*)::int as n from public.records where workspace_id = '${W}'`);
    expect(n.rows[0].n).toBe(9);
  });
});
