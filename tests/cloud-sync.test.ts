import { afterEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import {
  InMemorySyncAdapter,
  buildJoinUrl,
  checkSupabaseConfig,
  createCloudSync,
  createDatabase,
  createMemoryStorage,
  createStore,
  getOrCreateWorkspaceId,
  normalizeWorkspaceCode,
  readJoinCode,
  readPullCursor,
  syncSetupFromEnv,
  writePullCursor,
} from '@skeleton/core';
import type { KeyValueStorage, Store, TypedDexie } from '@skeleton/core';
import { FakeSupabase } from './sync.helpers';

type C = { items: { name: string } };
const CONFIG = { url: 'https://abcdefghijklmnop.supabase.co', publishableKey: 'sb_publishable_test' };

const opened: TypedDexie<C>[] = [];
function freshStore(deviceId: string): Store<C> {
  const db = createDatabase<C>({ dbName: `cloud-${Date.now()}-${Math.random()}`, collections: { items: undefined } });
  opened.push(db);
  return createStore(db, deviceId);
}
afterEach(async () => {
  while (opened.length) {
    const db = opened.pop() as TypedDexie<C>;
    db.close();
    await Dexie.delete(db.name);
  }
});

/** One device: its own database and local storage, talking to the shared fake server. */
function device(server: FakeSupabase, name: string, storage: KeyValueStorage = createMemoryStorage()) {
  const store = freshStore(name);
  const sync = createCloudSync({ app: 'khata', store, supabase: CONFIG, storage, createClient: async () => server, retry: { maxRetries: 0 } });
  return { store, sync, storage };
}

// ---------------------------------------------------------------------------
// Configuration and local-only mode
// ---------------------------------------------------------------------------

describe('Supabase configuration', () => {
  it('is "missing" when either variable is absent or empty', () => {
    expect(checkSupabaseConfig({})).toMatchObject({ ok: false, problem: 'missing' });
    expect(checkSupabaseConfig({ VITE_SUPABASE_URL: CONFIG.url })).toMatchObject({ ok: false, problem: 'missing' });
    expect(checkSupabaseConfig({ VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: '' })).toMatchObject({ problem: 'missing' });
  });

  it('accepts a project URL with a publishable key', () => {
    expect(checkSupabaseConfig({ VITE_SUPABASE_URL: `${CONFIG.url}/`, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' })).toEqual({
      ok: true,
      config: { url: CONFIG.url, publishableKey: 'sb_publishable_abc' },
    });
  });

  it('accepts a legacy anon key, and local http only for localhost', () => {
    const payload = btoa(JSON.stringify({ role: 'anon' })).replace(/=+$/, '');
    expect(checkSupabaseConfig({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: `h.${payload}.s` }).ok).toBe(true);
    expect(checkSupabaseConfig({ VITE_SUPABASE_URL: 'http://example.com', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })).toMatchObject({ problem: 'invalidUrl' });
  });

  it('refuses any key that is not publishable (or a legacy anon key)', () => {
    const privileged = btoa(JSON.stringify({ role: 'elevated' })).replace(/=+$/, '');
    for (const key of ['some-random-key', `h.${privileged}.s`]) {
      expect(checkSupabaseConfig({ VITE_SUPABASE_URL: CONFIG.url, VITE_SUPABASE_PUBLISHABLE_KEY: key })).toMatchObject({ ok: false, problem: 'invalidKey' });
    }
  });

  it('explains a dashboard URL and suggests the API URL', () => {
    const result = checkSupabaseConfig({
      VITE_SUPABASE_URL: 'https://supabase.com/dashboard/project/ovklsqhofavtygczhoft/settings/api-keys',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
    });
    expect(result).toMatchObject({ ok: false, problem: 'dashboardUrl' });
    expect(!result.ok && result.message).toContain('https://ovklsqhofavtygczhoft.supabase.co');
  });

  it('syncSetupFromEnv: missing variables → local only (or in-memory under tests); a bad value warns', () => {
    expect(syncSetupFromEnv({ MODE: 'production' })).toEqual({ supabase: null, fallback: null, problem: 'missing' });
    expect(syncSetupFromEnv({ MODE: 'test' }).fallback).toBeInstanceOf(InMemorySyncAdapter);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(syncSetupFromEnv({ MODE: 'production', VITE_SUPABASE_URL: 'nope', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })).toMatchObject({ supabase: null, problem: 'invalidUrl' });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    expect(syncSetupFromEnv({ VITE_SUPABASE_URL: CONFIG.url, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }).supabase).toEqual({ url: CONFIG.url, publishableKey: 'sb_publishable_x' });
  });
});

describe('local-only mode (no Supabase variables)', () => {
  it('keeps working fully offline: writes stay local, status is "local", nothing is loaded or sent', async () => {
    const store = freshStore('d1');
    const createClient = vi.fn();
    const sync = createCloudSync({ app: 'khata', store, ...syncSetupFromEnv({ MODE: 'production' }), createClient, storage: createMemoryStorage() });
    expect(sync.mode).toBe('local');
    expect(sync.engine.getStatus()).toEqual({ state: 'local' });

    await store.add('items', { name: 'Offline entry' });
    sync.engine.start();
    await sync.engine.syncNow();
    expect(sync.engine.getStatus()).toEqual({ state: 'local' });
    expect((await store.query('items')).map((r) => r.payload.name)).toEqual(['Offline entry']);
    expect(await store.getPending()).toHaveLength(1); // kept for a future cloud setup
    expect(createClient).not.toHaveBeenCalled();
    sync.engine.stop();
  });

  it('still has a workspace code, but refuses to join one', async () => {
    const sync = createCloudSync({ app: 'khata', store: freshStore('d1'), storage: createMemoryStorage() });
    expect(normalizeWorkspaceCode(sync.getWorkspaceId())).toBe(sync.getWorkspaceId());
    await expect(sync.joinWorkspace('33333333-3333-4333-8333-333333333333')).rejects.toThrow(/not configured/);
  });
});

// ---------------------------------------------------------------------------
// Workspace codes
// ---------------------------------------------------------------------------

describe('workspace codes', () => {
  it('creates a random code once and keeps it per app', () => {
    const storage = createMemoryStorage();
    const a = getOrCreateWorkspaceId(storage, 'khata');
    expect(getOrCreateWorkspaceId(storage, 'khata')).toBe(a);
    expect(getOrCreateWorkspaceId(storage, 'clinic-queue')).not.toBe(a);
    expect(normalizeWorkspaceCode(a)).toBe(a);
  });

  it('accepts codes typed with capitals, spaces, missing dashes or Urdu digits', () => {
    const code = '0b5c1a7e-2f3d-4c8b-9a6e-1d2f3a4b5c6d';
    expect(normalizeWorkspaceCode(' 0B5C1A7E-2F3D-4C8B-9A6E-1D2F3A4B5C6D ')).toBe(code);
    expect(normalizeWorkspaceCode('0b5c1a7e2f3d4c8b9a6e1d2f3a4b5c6d')).toBe(code);
    expect(normalizeWorkspaceCode('0b5c 1a7e 2f3d 4c8b 9a6e 1d2f 3a4b 5c6d')).toBe(code);
    expect(normalizeWorkspaceCode('۰b5c1a7e-2f3d-4c8b-9a6e-1d2f3a4b5c6d')).toBe(code);
  });

  it('rejects anything that is not a full code', () => {
    for (const bad of ['', 'abc', '0b5c1a7e-2f3d-4c8b-9a6e', '0b5c1a7e-2f3d-4c8b-9a6e-1d2f3a4b5c6z', '00000000-0000-0000-0000-000000000000']) {
      expect(normalizeWorkspaceCode(bad)).toBeNull();
    }
  });

  it('builds and reads #join= links', () => {
    const code = '0b5c1a7e-2f3d-4c8b-9a6e-1d2f3a4b5c6d';
    const url = buildJoinUrl(code, 'https://khata.example/');
    expect(url).toBe(`https://khata.example/#join=${code}`);
    expect(readJoinCode(new URL(url).hash)).toBe(code);
    expect(readJoinCode('#display')).toBeNull();
    expect(readJoinCode('#join=nonsense')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Joining a workspace
// ---------------------------------------------------------------------------

describe('joining a workspace', () => {
  it('receives all of that workspace’s data, and shares what this device already had', async () => {
    const server = new FakeSupabase();
    const shop = device(server, 'shop-phone');
    await shop.store.add('items', { name: 'From the shop phone' });
    await shop.store.add('items', { name: 'Second entry' });
    await shop.sync.engine.syncNow();

    const helper = device(server, 'helper-phone');
    await helper.store.add('items', { name: 'Made on the helper phone before joining' });
    await helper.sync.engine.syncNow(); // synced to its own (old) workspace
    const oldCode = helper.sync.getWorkspaceId();

    expect(await helper.sync.joinWorkspace(shop.sync.getWorkspaceId())).toBe('joined');
    expect(helper.sync.getWorkspaceId()).toBe(shop.sync.getWorkspaceId());
    expect(helper.sync.getWorkspaceId()).not.toBe(oldCode);
    expect((await helper.store.query('items')).map((r) => r.payload.name).sort()).toEqual(
      ['From the shop phone', 'Made on the helper phone before joining', 'Second entry'].sort(),
    );
    expect(await helper.store.getPending()).toEqual([]);

    await shop.sync.engine.syncNow();
    expect((await shop.store.query('items')).map((r) => r.payload.name)).toContain('Made on the helper phone before joining');
    // The old workspace keeps only what was pushed there.
    expect(server.idsFor(oldCode, 'khata')).toHaveLength(1);
  });

  it('pulls the joined workspace from the start, even if this device had an old cursor for it', async () => {
    const server = new FakeSupabase();
    const shop = device(server, 'shop');
    await shop.store.add('items', { name: 'Early' });
    await shop.sync.engine.syncNow();
    const helper = device(server, 'helper');
    writePullCursor(helper.storage, 'khata', shop.sync.getWorkspaceId(), '2099-01-01T00:00:00.000Z');
    await helper.sync.joinWorkspace(shop.sync.getWorkspaceId());
    expect((await helper.store.query('items')).map((r) => r.payload.name)).toEqual(['Early']);
  });

  it('accepts a code typed in capitals without dashes', async () => {
    const server = new FakeSupabase();
    const shop = device(server, 'shop');
    const helper = device(server, 'helper');
    const typed = shop.sync.getWorkspaceId().toUpperCase().replace(/-/g, '');
    expect(await helper.sync.joinWorkspace(typed)).toBe('joined');
    expect(helper.sync.getWorkspaceId()).toBe(shop.sync.getWorkspaceId());
  });

  it('says "same" for its own code and throws for an invalid one, changing nothing', async () => {
    const server = new FakeSupabase();
    const phone = device(server, 'phone');
    const code = phone.sync.getWorkspaceId();
    expect(await phone.sync.joinWorkspace(code)).toBe('same');
    await expect(phone.sync.joinWorkspace('not a code')).rejects.toThrow(/Invalid/);
    expect(phone.sync.getWorkspaceId()).toBe(code);
  });

  it('works offline: switches now and syncs when the connection returns', async () => {
    const server = new FakeSupabase();
    const shop = device(server, 'shop');
    await shop.store.add('items', { name: 'Shop entry' });
    await shop.sync.engine.syncNow();
    const helper = device(server, 'helper');
    await helper.store.add('items', { name: 'Helper entry' });

    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const callsBefore = server.calls.length;
    expect(await helper.sync.joinWorkspace(shop.sync.getWorkspaceId())).toBe('joined');
    expect(server.calls.length).toBe(callsBefore); // nothing sent while offline
    expect(helper.sync.engine.getStatus().state).toBe('offline');
    onLine.mockRestore();

    await helper.sync.engine.syncNow();
    expect((await helper.store.query('items')).map((r) => r.payload.name).sort()).toEqual(['Helper entry', 'Shop entry']);
  });

  it('a device that only watches (e.g. the waiting-room display) receives new records by itself', async () => {
    const server = new FakeSupabase();
    const reception = device(server, 'reception');
    const storage = createMemoryStorage();
    const display = freshStore('display');
    const displaySync = createCloudSync({
      app: 'khata',
      store: display,
      supabase: CONFIG,
      storage,
      createClient: async () => server,
      pollIntervalMs: 20,
      retry: { maxRetries: 0 },
    });
    await displaySync.joinWorkspace(reception.sync.getWorkspaceId());
    displaySync.engine.start();
    try {
      await reception.store.add('items', { name: 'Token A-7 called' });
      await reception.sync.engine.syncNow();
      await vi.waitFor(async () => expect((await display.query('items')).map((r) => r.payload.name)).toEqual(['Token A-7 called']), {
        timeout: 2000,
        interval: 20,
      });
    } finally {
      displaySync.engine.stop();
    }
  });

  it('leaving (Clear all data) starts a new workspace and forgets the old cursor', async () => {
    const server = new FakeSupabase();
    const phone = device(server, 'phone');
    await phone.store.add('items', { name: 'x' });
    await phone.sync.engine.syncNow(); // pushes
    await phone.sync.engine.syncNow(); // pulls it back and saves a cursor
    const old = phone.sync.getWorkspaceId();
    expect(readPullCursor(phone.storage, 'khata', old)).not.toBeNull();
    phone.sync.leaveWorkspace();
    expect(phone.sync.getWorkspaceId()).not.toBe(old);
    expect(readPullCursor(phone.storage, 'khata', old)).toBeNull();
  });

  it('in-memory mode (tests) also resets the stand-in cloud when leaving', async () => {
    const fallback = new InMemorySyncAdapter();
    const store = freshStore('d');
    const sync = createCloudSync({ app: 'khata', store, fallback, storage: createMemoryStorage() });
    expect(sync.mode).toBe('memory');
    await store.add('items', { name: 'a' });
    await sync.engine.syncNow();
    expect(fallback.size()).toBe(1);
    sync.leaveWorkspace();
    expect(fallback.size()).toBe(0);
  });
});
