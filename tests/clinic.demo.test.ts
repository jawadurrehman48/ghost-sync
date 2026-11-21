/**
 * FR-8: sample data loads at most once and gives a realistic clinic day.
 */
import { afterEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { createDatabase, createStore, todayISO } from '@skeleton/core';
import type { Store, TypedDexie } from '@skeleton/core';
import { loadClinicData } from '../apps/clinic-queue/src/clinic.actions';
import { deriveAll, deriveSummary } from '../apps/clinic-queue/src/clinic.reducers';
import type { ClinicCollections } from '../apps/clinic-queue/src/clinic.types';
import { DEMO_CLINIC_NAME, DEMO_PATIENTS, loadDemoData } from '../apps/clinic-queue/src/utils/demo';

const COLLECTIONS = {
  patientRegistered: undefined,
  tokenIssued: undefined,
  tokenCalled: undefined,
  tokenCompleted: undefined,
  tokenSkipped: undefined,
  tokenRequeued: undefined,
  deviceLetterSet: undefined,
  settingsUpdated: undefined,
};
const opened: TypedDexie<ClinicCollections>[] = [];
function freshStore(deviceId = 'device-1'): Store<ClinicCollections> {
  const db = createDatabase<ClinicCollections>({ dbName: `clinic-demo-${Date.now()}-${Math.random()}`, collections: COLLECTIONS });
  opened.push(db);
  return createStore(db, deviceId);
}
afterEach(async () => {
  while (opened.length) {
    const db = opened.pop() as TypedDexie<ClinicCollections>;
    db.close();
    await Dexie.delete(db.name);
  }
});

const NOW = new Date(2026, 2, 10, 12, 30, 0); // 12:30 local time
const TODAY = todayISO(NOW);

async function derived(store: Store<ClinicCollections>) {
  return deriveAll(await loadClinicData(store), 'device-1', TODAY);
}

describe('demo data (FR-8)', () => {
  it('loads 10 patients with Pakistani names and the demo clinic name', async () => {
    const store = freshStore();
    expect(await loadDemoData(store, 'device-1', NOW)).toBe('loaded');
    const d = await derived(store);
    expect(d.patients).toHaveLength(10);
    expect(d.patients.map((p) => p.name).sort()).toEqual(DEMO_PATIENTS.map((p) => p.name).sort());
    expect(d.settings).toMatchObject({ clinicName: DEMO_CLINIC_NAME, demoDataLoaded: true });
    expect(d.letter.claimed).toBe(true);
  });

  it("builds today's queue: 3 seen, 1 being served, 3 waiting, 1 skipped", async () => {
    const store = freshStore();
    await loadDemoData(store, 'device-1', NOW);
    const d = await derived(store);
    expect(d.queue.completed).toHaveLength(3);
    expect(d.queue.serving).toHaveLength(1);
    expect(d.queue.waiting).toHaveLength(3);
    expect(d.queue.skipped).toHaveLength(1);
    // Today's events all happen today and before "now".
    for (const t of d.tokens.filter((t) => t.date === TODAY)) {
      expect(Date.parse(t.issuedAt)).toBeLessThanOrEqual(NOW.getTime());
      if (t.completedAt) expect(Date.parse(t.completedAt)).toBeLessThanOrEqual(NOW.getTime());
    }
    const summary = deriveSummary(d.tokens, TODAY);
    expect(summary.issued).toBe(8);
    expect(summary.avgWaitMinutes).not.toBeNull();
    expect(summary.hours.length).toBeGreaterThan(0);
  });

  it('adds completed past visits with doctor notes on earlier days', async () => {
    const store = freshStore();
    await loadDemoData(store, 'device-1', NOW);
    const past = (await derived(store)).tokens.filter((t) => t.date < TODAY);
    expect(past).toHaveLength(10);
    for (const t of past) {
      expect(t.status).toBe('completed');
      expect(t.notes).toBeTruthy();
    }
  });

  it('gives every token a unique label per day', async () => {
    const store = freshStore();
    await loadDemoData(store, 'device-1', NOW);
    const labels = (await derived(store)).tokens.map((t) => `${t.date}:${t.label}`);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('loads only once when pressed twice', async () => {
    const store = freshStore();
    expect(await loadDemoData(store, 'device-1', NOW)).toBe('loaded');
    expect(await loadDemoData(store, 'device-1', NOW)).toBe('alreadyLoaded');
    expect(await store.query('patientRegistered')).toHaveLength(10);
  });

  it('loads only once when pressed twice at the same moment', async () => {
    const store = freshStore();
    const results = await Promise.all([loadDemoData(store, 'device-1', NOW), loadDemoData(store, 'device-1', NOW)]);
    // Both taps share the one load in progress (singleFlight), so nothing is added twice.
    expect(results).toEqual(['loaded', 'loaded']);
    expect(await store.query('settingsUpdated')).toHaveLength(1);
    expect(await store.query('patientRegistered')).toHaveLength(10);
    expect(await store.query('tokenIssued')).toHaveLength(18);
  });

  it('adds nothing if another device already loaded it (synced marker)', async () => {
    const store = freshStore();
    await store.add('settingsUpdated', { demoDataLoaded: true });
    expect(await loadDemoData(store, 'device-1', NOW)).toBe('alreadyLoaded');
    expect(await store.query('patientRegistered')).toHaveLength(0);
  });

  it("keeps the clinic's own name", async () => {
    const store = freshStore();
    await store.add('settingsUpdated', { clinicName: 'Al-Noor Clinic' });
    await loadDemoData(store, 'device-1', NOW);
    expect((await derived(store)).settings.clinicName).toBe('Al-Noor Clinic');
  });

  it("continues today's numbering after tokens already issued", async () => {
    const store = freshStore();
    const p = await store.add('patientRegistered', { name: 'Real Patient' });
    await store.add('deviceLetterSet', { deviceId: 'device-1', letter: 'A' });
    await store.add('tokenIssued', { patientId: p.id, prefix: 'A', number: 1, date: TODAY, at: NOW.toISOString() });
    await loadDemoData(store, 'device-1', NOW);
    const labels = (await derived(store)).tokens.filter((t) => t.date === TODAY).map((t) => t.label);
    expect(new Set(labels).size).toBe(9);
    expect(labels).toContain('A-9');
  });

  it('keeps every today event on today even just after midnight', async () => {
    const store = freshStore();
    const early = new Date(2026, 2, 10, 0, 20, 0);
    await loadDemoData(store, 'device-1', early);
    const today = (await loadClinicData(store)).tokenIssued.filter((r) => r.payload.date === todayISO(early));
    expect(today).toHaveLength(8);
    for (const r of today) expect(todayISO(new Date(r.payload.at))).toBe(todayISO(early));
  });
});
