import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { addDays, i18n, registerAppTranslations, todayISO } from '@skeleton/core';
import type { Language } from '@skeleton/core';
import { loadClinicData } from '../apps/clinic-queue/src/clinic.actions';
import type { ClinicStore } from '../apps/clinic-queue/src/clinic.actions';
import { deriveAll } from '../apps/clinic-queue/src/clinic.reducers';
import type { ClinicCollections, ClinicData } from '../apps/clinic-queue/src/clinic.types';
import type { ScreenProps } from '../apps/clinic-queue/src/screens/types';
import { AddPatientScreen } from '../apps/clinic-queue/src/screens/AddPatientScreen';
import { DisplayScreen } from '../apps/clinic-queue/src/screens/DisplayScreen';
import { IssueTokenScreen } from '../apps/clinic-queue/src/screens/IssueTokenScreen';
import { PatientDetailScreen } from '../apps/clinic-queue/src/screens/PatientDetailScreen';
import { PatientsScreen } from '../apps/clinic-queue/src/screens/PatientsScreen';
import { QueueScreen } from '../apps/clinic-queue/src/screens/QueueScreen';
import { SettingsScreen } from '../apps/clinic-queue/src/screens/SettingsScreen';
import { SummaryScreen } from '../apps/clinic-queue/src/screens/SummaryScreen';
import { TokenScreen } from '../apps/clinic-queue/src/screens/TokenScreen';
import en from '../apps/clinic-queue/src/i18n/en.json';
import ur from '../apps/clinic-queue/src/i18n/ur.json';
import { emptyData, rec } from './clinic.helpers';

const NOW = Date.now();
const TODAY = todayISO();
const PAST_DAY = addDays(TODAY, -3);
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

/**
 * Today (device-1, letter A):
 *   A-1 Ali Raza       completed (waited 10 min, notes)
 *   A-2 Sara Khan      being seen (waited 35 min)
 *   A-3 Nasir Mehmood  waiting (first in line)
 *   A-4 Zara Bibi      waiting (no phone)
 *   A-5 Bilal Ahmed    skipped
 * Ali also had a completed visit three days ago.
 */
function fixture(): ClinicData {
  const data = emptyData();
  data.patientRegistered.push(
    rec('patientRegistered', { name: 'Ali Raza', phone: '03001234567', age: 45, gender: 'male' }, 'ali', 1),
    rec('patientRegistered', { name: 'Sara Khan', phone: '03211234567', age: 30, gender: 'female' }, 'sara', 2),
    rec('patientRegistered', { name: 'Nasir Mehmood', phone: '03331234567' }, 'nasir', 3),
    rec('patientRegistered', { name: 'Zara Bibi' }, 'zara', 4),
    rec('patientRegistered', { name: 'Bilal Ahmed', phone: '03451234567' }, 'bilal', 5),
  );
  data.deviceLetterSet.push(rec('deviceLetterSet', { deviceId: 'device-1', letter: 'A' }, 'letter', 6));
  data.settingsUpdated.push(rec('settingsUpdated', { clinicName: 'City Clinic' }, 'settings', 7));
  const issue = (id: string, patientId: string, number: number, at: string, date = TODAY, reason?: string) =>
    data.tokenIssued.push(
      rec('tokenIssued', { patientId, prefix: 'A', number, date, at, ...(reason ? { reason } : {}) }, id, 10 + number, 'device-1'),
    );
  issue('old', 'ali', 1, new Date(NOW - 3 * 86_400_000).toISOString(), PAST_DAY, 'Cough');
  issue('t1', 'ali', 1, ago(60), TODAY, 'Fever');
  issue('t2', 'sara', 2, ago(45), TODAY, 'Check-up');
  issue('t3', 'nasir', 3, ago(30));
  issue('t4', 'zara', 4, ago(20));
  issue('t5', 'bilal', 5, ago(25));
  data.tokenCalled.push(
    rec('tokenCalled', { tokenId: 'old', at: new Date(NOW - 3 * 86_400_000 + 600_000).toISOString() }, 'c0', 20),
    rec('tokenCalled', { tokenId: 't1', at: ago(50) }, 'c1', 21),
    rec('tokenCalled', { tokenId: 't2', at: ago(10) }, 'c2', 22),
  );
  data.tokenCompleted.push(
    rec('tokenCompleted', { tokenId: 'old', notes: 'Old visit notes', at: new Date(NOW - 3 * 86_400_000 + 1_200_000).toISOString() }, 'd0', 23),
    rec('tokenCompleted', { tokenId: 't1', notes: 'Paracetamol twice a day', at: ago(40) }, 'd1', 24),
  );
  data.tokenSkipped.push(rec('tokenSkipped', { tokenId: 't5', at: ago(5) }, 's5', 25));
  return data;
}

/** An in-memory append-only store with the two methods the screens use. */
function memoryStore(seed: ClinicData) {
  const records: ClinicData = structuredClone(seed);
  let n = 0;
  const add = vi.fn(async <K extends keyof ClinicCollections>(collection: K, payload: ClinicCollections[K]) => {
    const record = { id: `new-${++n}`, createdAt: new Date().toISOString(), deviceId: 'device-1', collection, payload };
    (records[collection] as unknown[]).push(record);
    return record;
  });
  const query = vi.fn(async (collection: keyof ClinicCollections) => [...records[collection]]);
  return { add, records, store: { add, query } as unknown as ClinicStore };
}

type View = (props: ScreenProps) => ReactElement;

/** Renders a screen the way App does: after each write, data is reloaded from the store. */
function setup(view: View, opts: { seed?: ClinicData; language?: Language } = {}) {
  const seed = opts.seed ?? fixture();
  const { store, add, records } = memoryStore(seed);
  const navigate = vi.fn();
  const changeLanguage = vi.fn(async () => {});
  const onClearAll = vi.fn(async () => {});
  const openDisplay = vi.fn();
  function Harness() {
    const [data, setData] = useState(seed);
    const props: ScreenProps = {
      data,
      derived: deriveAll(data, 'device-1', TODAY),
      store,
      navigate,
      onChanged: async () => setData(await loadClinicData(store)),
      language: opts.language ?? 'en',
      changeLanguage,
      onClearAll,
      openDisplay,
      devices: {
        mode: 'memory',
        workspaceCode: '0b5c1a7e-2f3d-4c8b-9a6e-1d2f3a4b5c6d',
        joinUrl: 'https://clinic.example/#join=0b5c1a7e-2f3d-4c8b-9a6e-1d2f3a4b5c6d',
        join: async () => 'joined' as const,
      },
    };
    return view(props);
  }
  const utils = render(<Harness />);
  return { ...utils, add, records, navigate, changeLanguage, onClearAll, openDisplay };
}

const KEY_LEAK = /clinic\.[a-zA-Z]+\.[a-zA-Z]+/;

beforeAll(() => {
  registerAppTranslations({ en, ur });
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
});

// ---------------------------------------------------------------------------
// Every screen, both languages
// ---------------------------------------------------------------------------

describe.each(['en', 'ur'] as const)('every screen renders in %s', (language) => {
  const empty = emptyData();
  const screens: Array<[string, View, ClinicData?]> = [
    ['Queue', (p) => <QueueScreen {...p} />],
    ['Queue (empty)', (p) => <QueueScreen {...p} />, empty],
    ['IssueToken', (p) => <IssueTokenScreen {...p} from="queue" />],
    ['IssueToken (no patients)', (p) => <IssueTokenScreen {...p} from="queue" />, empty],
    ['IssueToken (chosen patient)', (p) => <IssueTokenScreen {...p} from="patientDetail" patientId="ali" />],
    ['Token waiting', (p) => <TokenScreen {...p} tokenId="t3" />],
    ['Token serving', (p) => <TokenScreen {...p} tokenId="t2" />],
    ['Token completed', (p) => <TokenScreen {...p} tokenId="t1" />],
    ['Token skipped', (p) => <TokenScreen {...p} tokenId="t5" />],
    ['Token (unknown)', (p) => <TokenScreen {...p} tokenId="nope" />],
    ['Patients', (p) => <PatientsScreen {...p} />],
    ['Patients (empty)', (p) => <PatientsScreen {...p} />, empty],
    ['AddPatient', (p) => <AddPatientScreen {...p} />],
    ['PatientDetail', (p) => <PatientDetailScreen {...p} patientId="ali" />],
    ['PatientDetail (in queue)', (p) => <PatientDetailScreen {...p} patientId="nasir" />],
    ['PatientDetail (unknown)', (p) => <PatientDetailScreen {...p} patientId="ghost" />],
    ['Summary', (p) => <SummaryScreen {...p} />],
    ['Summary (empty)', (p) => <SummaryScreen {...p} />, empty],
    ['Settings', (p) => <SettingsScreen {...p} />],
    ['Display', (p) => <DisplayScreen derived={p.derived} onExit={() => {}} />],
    ['Display (empty)', (p) => <DisplayScreen derived={p.derived} onExit={() => {}} />, empty],
  ];

  it.each(screens)('%s shows no raw translation keys and uses the right direction', async (_name, view, seed) => {
    await i18n.changeLanguage(language);
    const { container } = setup(view, { seed, language });
    expect(container.textContent ?? '').not.toMatch(KEY_LEAK);
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
    expect(document.documentElement.dir).toBe(language === 'ur' ? 'rtl' : 'ltr');
    expect(document.documentElement.lang).toBe(language);
  });
});

describe('Urdu on screen', () => {
  it('the queue uses Urdu words and keeps token numbers left-to-right', async () => {
    await i18n.changeLanguage('ur');
    setup((p) => <QueueScreen {...p} />, { language: 'ur' });
    expect(screen.getByRole('button', { name: ur.clinic.queue.completeAndCallNext })).toBeTruthy();
    expect(screen.getByText(ur.clinic.queue.nowServing)).toBeTruthy();
    const label = screen.getAllByText('A-2')[0];
    expect(label.closest('[dir="ltr"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Today's Queue
// ---------------------------------------------------------------------------

describe("Today's Queue", () => {
  it('shows the counts, who is being seen, who is next and the waiting list in order', () => {
    setup((p) => <QueueScreen {...p} />);
    expect(screen.getByRole('heading', { name: 'City Clinic' })).toBeTruthy();
    const counts = (label: string) => screen.getByText(label, { selector: 'p,span,dt,div' }).parentElement?.textContent ?? '';
    expect(counts('Waiting')).toContain('2');
    expect(counts('Done')).toContain('1');
    expect(screen.getAllByText('Sara Khan').length).toBeGreaterThan(0);
    const list = screen.getByRole('heading', { name: 'Waiting list' }).parentElement as HTMLElement;
    const names = within(list).getAllByText(/Nasir Mehmood|Zara Bibi/).map((n) => n.textContent);
    expect(names).toEqual(['Nasir Mehmood', 'Zara Bibi']);
    expect(within(list).getByText('30 min')).toBeTruthy();
  });

  it('the big button completes the current patient and calls the next one', async () => {
    const { records } = setup((p) => <QueueScreen {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete & call next' }));
    await waitFor(() => expect(records.tokenCalled.some((r) => r.payload.tokenId === 't3')).toBe(true));
    expect(records.tokenCompleted.some((r) => r.payload.tokenId === 't2')).toBe(true);
    // Now Nasir is being seen and Zara is next.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Complete & call next' })).toBeTruthy());
    const upNext = screen.getByRole('heading', { name: 'Up next' }).parentElement as HTMLElement;
    expect(within(upNext).getByText('Zara Bibi')).toBeTruthy();
  });

  it('labels the big button for each situation', () => {
    const base = fixture();
    const servingOnly: ClinicData = { ...base, tokenIssued: base.tokenIssued.filter((r) => ['old', 't1', 't2'].includes(r.id)) };
    let view = setup((p) => <QueueScreen {...p} />, { seed: servingOnly });
    expect(screen.getByRole('button', { name: 'Complete current patient' })).toBeTruthy();
    view.unmount();

    const waitingOnly: ClinicData = { ...base, tokenCalled: base.tokenCalled.filter((r) => r.payload.tokenId !== 't2') };
    view = setup((p) => <QueueScreen {...p} />, { seed: waitingOnly });
    expect(screen.getByRole('button', { name: 'Call next' })).toBeTruthy();
    expect(screen.getByText('No one is being seen right now')).toBeTruthy();
    view.unmount();

    const doneOnly: ClinicData = { ...base, tokenIssued: base.tokenIssued.filter((r) => ['old', 't1'].includes(r.id)) };
    setup((p) => <QueueScreen {...p} />, { seed: doneOnly });
    expect((screen.getByRole('button', { name: 'No one waiting' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('notifies the next patient on WhatsApp with the token and clinic name', () => {
    setup((p) => <QueueScreen {...p} />);
    const link = screen.getByRole('link', { name: 'Notify on WhatsApp' });
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith('https://wa.me/923331234567?text=')).toBe(true);
    const text = new URL(href).searchParams.get('text') ?? '';
    expect(text).toContain('A-3');
    expect(text).toContain('Nasir Mehmood');
    expect(text).toContain('City Clinic');
    expect(screen.getByRole('link', { name: 'Send SMS' }).getAttribute('href')).toMatch(/^sms:03331234567\?body=/);
  });

  it('skips the current patient and re-queues a skipped one', async () => {
    const { records } = setup((p) => <QueueScreen {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Re-queue' }));
    await waitFor(() => expect(records.tokenRequeued.map((r) => r.payload.tokenId)).toEqual(['t5']));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Re-queue' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(records.tokenSkipped.map((r) => r.payload.tokenId)).toContain('t2'));
  });

  it('opens the waiting-room display and the token page', () => {
    const { openDisplay, navigate } = setup((p) => <QueueScreen {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Waiting-room display' }));
    expect(openDisplay).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Notes / complete' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'token', tokenId: 't2' });
  });

  it('invites the first token (and demo data) when the day is empty', () => {
    const { navigate } = setup((p) => <QueueScreen {...p} />, { seed: emptyData() });
    expect(screen.getByText('No patients yet today')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Issue token' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'issueToken', from: 'queue' });
    fireEvent.click(screen.getByRole('button', { name: 'Try with demo data' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'settings' });
  });
});

// ---------------------------------------------------------------------------
// Issue Token
// ---------------------------------------------------------------------------

describe('Issue Token', () => {
  it('searches, picks a patient, adds a reason and shows the new token very large', async () => {
    const { records } = setup((p) => <IssueTokenScreen {...p} from="queue" />);
    fireEvent.change(screen.getByLabelText('Search patient by name or phone'), { target: { value: 'ali' } });
    expect(screen.queryByText('Zara Bibi')).toBeNull();
    fireEvent.click(screen.getByText('Ali Raza'));
    fireEvent.change(screen.getByLabelText('Reason for visit (optional)'), { target: { value: '  Sore throat ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue token' }));
    await waitFor(() => expect(screen.getByText('Token issued')).toBeTruthy());
    expect(screen.getByText('A-6')).toBeTruthy();
    expect(screen.getByText('Token for Ali Raza')).toBeTruthy();
    expect(screen.getByText('2 patients ahead')).toBeTruthy();
    const issued = records.tokenIssued[records.tokenIssued.length - 1].payload;
    expect(issued).toMatchObject({ patientId: 'ali', prefix: 'A', number: 6, date: TODAY, reason: 'Sore throat' });
    expect(screen.getByRole('link', { name: 'Notify on WhatsApp' })).toBeTruthy();
  });

  it('finds a patient by phone number', () => {
    setup((p) => <IssueTokenScreen {...p} from="queue" />);
    fireEvent.change(screen.getByLabelText('Search patient by name or phone'), { target: { value: '0345' } });
    expect(screen.getByText('Bilal Ahmed')).toBeTruthy();
    expect(screen.queryByText('Ali Raza')).toBeNull();
  });

  it('does not give a second token to a patient already in the queue', () => {
    const { add, navigate } = setup((p) => <IssueTokenScreen {...p} from="queue" />);
    fireEvent.click(screen.getByText('Nasir Mehmood'));
    expect(screen.getByText("Nasir Mehmood is already in today's queue with token A-3.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Issue token' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open token' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'token', tokenId: 't3' });
    expect(add).not.toHaveBeenCalled();
  });

  it('quickly registers a new patient and issues the token in one step', async () => {
    const { records } = setup((p) => <IssueTokenScreen {...p} from="queue" />);
    fireEvent.change(screen.getByLabelText('Search patient by name or phone'), { target: { value: 'Imran' } });
    expect(screen.getByText('No patient found')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'New patient' })[0]);
    const name = screen.getByLabelText('Name') as HTMLInputElement;
    expect(name.value).toBe('Imran');
    fireEvent.change(name, { target: { value: 'Imran  Khan' } });
    fireEvent.change(screen.getByLabelText('Age (optional)'), { target: { value: '۳۵' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and issue token' }));
    await waitFor(() => expect(screen.getByText('Token for Imran Khan')).toBeTruthy());
    expect(screen.getByText('A-6')).toBeTruthy();
    expect(records.patientRegistered[records.patientRegistered.length - 1].payload).toEqual({ name: 'Imran Khan', age: 35 });
  });

  it('issues another token from the result screen', async () => {
    setup((p) => <IssueTokenScreen {...p} from="queue" />);
    fireEvent.click(screen.getByText('Ali Raza'));
    fireEvent.click(screen.getByRole('button', { name: 'Issue token' }));
    await waitFor(() => expect(screen.getByText('Token issued')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Issue another token' }));
    expect(screen.getByLabelText('Search patient by name or phone')).toBeTruthy();
  });

  it('warns when another device uses the same letter', () => {
    const seed = fixture();
    seed.deviceLetterSet.push(rec('deviceLetterSet', { deviceId: 'device-2', letter: 'A' }, 'other', 30));
    setup((p) => <IssueTokenScreen {...p} from="queue" />, { seed });
    expect(screen.getByText(/Another device also uses letter A/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Token page (doctor actions)
// ---------------------------------------------------------------------------

describe('Token page', () => {
  it('calls a waiting patient', async () => {
    const { records } = setup((p) => <TokenScreen {...p} tokenId="t3" />);
    expect(screen.getByText('Waiting')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Call this patient' }));
    await waitFor(() => expect(screen.getByText('Being seen')).toBeTruthy());
    expect(records.tokenCalled.map((r) => r.payload.tokenId)).toContain('t3');
  });

  it('completes a visit with the doctor’s notes and returns to the queue', async () => {
    const { records, navigate } = setup((p) => <TokenScreen {...p} tokenId="t2" />);
    fireEvent.change(screen.getByLabelText("Doctor's notes (optional)"), { target: { value: ' BP normal ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete visit' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'queue' }));
    expect(records.tokenCompleted[records.tokenCompleted.length - 1].payload).toMatchObject({ tokenId: 't2', notes: 'BP normal' });
  });

  it('skips a patient who is not here', async () => {
    const { records, navigate } = setup((p) => <TokenScreen {...p} tokenId="t3" />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip (not here)' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'queue' }));
    expect(records.tokenSkipped.map((r) => r.payload.tokenId)).toContain('t3');
  });

  it('puts a skipped patient back in the queue', async () => {
    const { records } = setup((p) => <TokenScreen {...p} tokenId="t5" />);
    fireEvent.click(screen.getByRole('button', { name: 'Put back in queue' }));
    await waitFor(() => expect(screen.getByText('Waiting')).toBeTruthy());
    expect(records.tokenRequeued.map((r) => r.payload.tokenId)).toEqual(['t5']);
  });

  it('shows a finished visit read-only with its notes', () => {
    setup((p) => <TokenScreen {...p} tokenId="t1" />);
    expect(screen.getByText('This visit is finished.')).toBeTruthy();
    expect(screen.getByText('Paracetamol twice a day')).toBeTruthy();
    expect(screen.getByText('Fever')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Complete visit' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Notify on WhatsApp' })).toBeNull();
  });

  it('says when a patient has no phone to notify', () => {
    setup((p) => <TokenScreen {...p} tokenId="t4" />);
    expect(screen.getByText('No phone number for this patient')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Now Serving display
// ---------------------------------------------------------------------------

describe('Now Serving display', () => {
  it('shows the current token and the next ones, but no patient names', () => {
    const onExit = vi.fn();
    const { container } = setup((p) => <DisplayScreen derived={p.derived} onExit={onExit} />);
    expect(screen.getByText('City Clinic')).toBeTruthy();
    expect(screen.getByText('A-2')).toBeTruthy();
    const next = screen.getByRole('heading', { name: 'Next' }).parentElement as HTMLElement;
    expect(within(next).getAllByText(/^A-\d+$/).map((n) => n.textContent)).toEqual(['A-3', 'A-4']);
    for (const name of ['Ali Raza', 'Sara Khan', 'Nasir Mehmood', 'Zara Bibi', 'Bilal Ahmed']) {
      expect(container.textContent).not.toContain(name);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Exit display' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('shows at most three upcoming tokens', () => {
    const seed = fixture();
    seed.tokenRequeued.push(rec('tokenRequeued', { tokenId: 't5', at: ago(2) }, 'q5', 40));
    seed.tokenIssued.push(
      rec('tokenIssued', { patientId: 'p-x', prefix: 'A', number: 6, date: TODAY, at: ago(1) }, 't6', 41),
    );
    setup((p) => <DisplayScreen derived={p.derived} onExit={() => {}} />, { seed });
    const next = screen.getByRole('heading', { name: 'Next' }).parentElement as HTMLElement;
    expect(within(next).getAllByText(/^A-\d+$/).map((n) => n.textContent)).toEqual(['A-3', 'A-4', 'A-5']);
  });

  it('asks people to wait when nobody is being seen', () => {
    setup((p) => <DisplayScreen derived={p.derived} onExit={() => {}} />, { seed: emptyData() });
    expect(screen.getByText('Please wait, the doctor will call you soon')).toBeTruthy();
    expect(screen.getByText('No one waiting')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

describe('Patients', () => {
  it('lists patients with phone, age and gender, and searches by name or phone', () => {
    const { navigate } = setup((p) => <PatientsScreen {...p} />);
    expect(screen.getByText('45 yrs · Male')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search name or phone'), { target: { value: '0333' } });
    expect(screen.getByText('Nasir Mehmood')).toBeTruthy();
    expect(screen.queryByText('Ali Raza')).toBeNull();
    fireEvent.click(screen.getByText('Nasir Mehmood'));
    expect(navigate).toHaveBeenCalledWith({ name: 'patientDetail', patientId: 'nasir' });
    fireEvent.change(screen.getByLabelText('Search name or phone'), { target: { value: 'nobody here' } });
    expect(screen.getByText('No patient found')).toBeTruthy();
  });

  it('shows a patient’s visits with the doctor’s notes, newest first', () => {
    const { navigate } = setup((p) => <PatientDetailScreen {...p} patientId="ali" />);
    const visits = screen.getByRole('heading', { name: 'Visits' }).parentElement as HTMLElement;
    const text = visits.textContent ?? '';
    expect(text).toContain('Paracetamol twice a day');
    expect(text).toContain('Old visit notes');
    expect(text.indexOf('Paracetamol')).toBeLessThan(text.indexOf('Old visit notes'));
    fireEvent.click(screen.getByRole('button', { name: 'Issue token' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'issueToken', from: 'patientDetail', patientId: 'ali' });
  });

  it("points to today's token for a patient already in the queue", () => {
    const { navigate } = setup((p) => <PatientDetailScreen {...p} patientId="nasir" />);
    expect(screen.getByText("In today's queue: token A-3")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open token' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'token', tokenId: 't3' });
  });
});

describe('Add patient', () => {
  it('requires a name and checks the phone and age', () => {
    const { add } = setup((p) => <AddPatientScreen {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save patient' }));
    expect(screen.getByText('Name is required')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Kamran' } });
    fireEvent.change(screen.getByLabelText('Phone (optional)'), { target: { value: '12345' } });
    fireEvent.change(screen.getByLabelText('Age (optional)'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save patient' }));
    expect(screen.getByText('Enter a valid Pakistani mobile number (e.g. 0300-1234567)')).toBeTruthy();
    expect(screen.getByText('Enter an age from 0 to 120')).toBeTruthy();
    expect(add).not.toHaveBeenCalled();
  });

  it('refuses the same name and phone twice', () => {
    const { add } = setup((p) => <AddPatientScreen {...p} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'ali  RAZA' } });
    fireEvent.change(screen.getByLabelText('Phone (optional)'), { target: { value: '0300-1234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save patient' }));
    expect(screen.getByText('A patient with this name and phone number already exists')).toBeTruthy();
    expect(add).not.toHaveBeenCalled();
  });

  it('saves a patient with gender and opens their page', async () => {
    const { records, navigate } = setup((p) => <AddPatientScreen {...p} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ali Raza' } });
    fireEvent.change(screen.getByLabelText('Phone (optional)'), { target: { value: '0312 7654321' } });
    fireEvent.click(screen.getByLabelText('Female'));
    fireEvent.click(screen.getByRole('button', { name: 'Save patient' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'patientDetail', patientId: 'new-1' }));
    expect(records.patientRegistered[records.patientRegistered.length - 1].payload).toEqual({
      name: 'Ali Raza',
      phone: '03127654321',
      gender: 'female',
    });
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

describe("Today's Summary", () => {
  it('shows patients seen, average wait, tokens issued and the hourly chart', () => {
    setup((p) => <SummaryScreen {...p} />);
    const stat = (label: string) => screen.getByText(label).parentElement?.textContent ?? '';
    expect(stat('Patients seen')).toContain('1');
    expect(stat('Average wait')).toContain('23 min'); // (10 + 35) / 2, rounded
    expect(stat('Tokens issued')).toContain('5');
    expect(stat('Still waiting')).toContain('3');
    const chart = screen.getByRole('img', { name: 'Bar chart of patients arriving and seen per hour' });
    expect(chart.tagName.toLowerCase()).toBe('svg');
    expect(screen.getByText('5 patients arrived and 1 were seen.')).toBeTruthy();
  });

  it('switches to another day and says when it was empty', () => {
    setup((p) => <SummaryScreen {...p} />);
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2020-01-01' } });
    expect(screen.getByText('No patients on this day')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: PAST_DAY } });
    expect(screen.getByText('Patients seen').parentElement?.textContent).toContain('1');
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

describe('Settings', () => {
  it('saves the clinic name and refuses an empty one', async () => {
    const { records } = setup((p) => <SettingsScreen {...p} />);
    const field = screen.getByLabelText('Clinic name') as HTMLInputElement;
    expect(field.value).toBe('City Clinic');
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Clinic name cannot be empty')).toBeTruthy();
    fireEvent.change(field, { target: { value: ' Al-Shifa  Clinic ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved'));
    expect(records.settingsUpdated[records.settingsUpdated.length - 1].payload).toEqual({ clinicName: 'Al-Shifa Clinic' });
  });

  it('shows the next token example, warns about a letter another device uses, and saves a new letter', async () => {
    const seed = fixture();
    seed.deviceLetterSet.push(rec('deviceLetterSet', { deviceId: 'device-2', letter: 'B' }, 'other', 30));
    const { records } = setup((p) => <SettingsScreen {...p} />, { seed });
    expect(screen.getByText(/look like A-6/)).toBeTruthy();
    expect(screen.getByText('Letters used by other devices: B')).toBeTruthy();
    const field = screen.getByLabelText('Letter (A to Z)');
    fireEvent.change(field, { target: { value: 'b' } });
    expect(screen.getByText('Another device also uses letter B. Choose a different letter.')).toBeTruthy();
    fireEvent.change(field, { target: { value: 'c' } });
    // Numbering carries on from this device's tokens today, so a letter change never repeats a label.
    expect(screen.getByText(/look like C-6/)).toBeTruthy();
    fireEvent.change(field, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save letter' }));
    expect(screen.getByText('Enter one letter from A to Z')).toBeTruthy();
    fireEvent.change(field, { target: { value: 'c' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save letter' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved'));
    expect(records.deviceLetterSet[records.deviceLetterSet.length - 1].payload).toEqual({ deviceId: 'device-1', letter: 'C' });
  });

  it('switches the language', () => {
    const { changeLanguage } = setup((p) => <SettingsScreen {...p} />);
    fireEvent.click(screen.getByLabelText('اردو'));
    expect(changeLanguage).toHaveBeenCalledWith('ur');
  });

  it('loads demo data after confirming, once', async () => {
    const { records } = setup((p) => <SettingsScreen {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo data' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('sample patients');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, add sample data' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Sample data added'));
    expect(records.patientRegistered).toHaveLength(15);
    // City Clinic keeps its own name.
    expect(records.settingsUpdated.some((r) => r.payload.clinicName === 'Shifa Family Clinic')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo data' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Sample data is already loaded');
    expect(records.patientRegistered).toHaveLength(15);
  });

  it('clears all data only after confirming', async () => {
    const { onClearAll } = setup((p) => <SettingsScreen {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }));
    let dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('cannot be undone');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onClearAll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }));
    dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, delete everything' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('All data was deleted'));
    expect(onClearAll).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText('Clinic name') as HTMLInputElement).value).toBe('My Clinic');
  });
});
