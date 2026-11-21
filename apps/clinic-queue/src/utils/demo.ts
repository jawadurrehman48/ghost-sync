import { addDays, singleFlight, todayISO, toISODate } from '@skeleton/core';
import { loadClinicData } from '../clinic.actions';
import type { ClinicStore } from '../clinic.actions';
import { DEFAULT_CLINIC_NAME, deriveDeviceLetter, deriveSettings, nextTokenNumber } from '../clinic.reducers';
import type { ClinicCollections } from '../clinic.types';

export type DemoResult = 'loaded' | 'alreadyLoaded';

export const DEMO_CLINIC_NAME = 'Shifa Family Clinic';

export const DEMO_PATIENTS: ClinicCollections['patientRegistered'][] = [
  { name: 'Muhammad Asif', phone: '03001112233', age: 45, gender: 'male' },
  { name: 'Shazia Parveen', phone: '03214455667', age: 32, gender: 'female' },
  { name: 'Abdul Rehman', phone: '03335556677', age: 8, gender: 'male' },
  { name: 'Nasreen Akhtar', age: 61, gender: 'female' },
  { name: 'Bilal Ahmed', phone: '03451234987', age: 27, gender: 'male' },
  { name: 'Sadia Noor', phone: '03007778899', age: 24, gender: 'female' },
  { name: 'Ghulam Rasool', age: 70, gender: 'male' },
  { name: 'Hina Tariq', phone: '03129876543', age: 35, gender: 'female' },
  { name: 'Usman Ali', phone: '03019988776', age: 40, gender: 'male' },
  { name: 'Zainab Bibi', phone: '03334443322', age: 55, gender: 'female' },
];

/** Past visits: [patient index, days ago, start minute after 10:00, reason, notes]. */
const PAST: Array<[number, number, number, string, string]> = [
  [0, 6, 0, 'Fever', 'Viral fever. Paracetamol 3 times a day, plenty of water.'],
  [3, 6, 25, 'Blood pressure check', 'BP 150/95. Continue medicine, reduce salt.'],
  [6, 5, 10, 'Knee pain', 'Arthritis. Pain relief gel, gentle exercise.'],
  [1, 5, 40, 'Cough', 'Throat infection. Antibiotic for 5 days.'],
  [2, 4, 5, 'Vaccination', 'Routine vaccine given. Next dose in 1 month.'],
  [8, 4, 30, 'Sugar check', 'Fasting sugar 135. Diet advice, test again in 2 weeks.'],
  [9, 3, 15, 'Headache', 'Tension headache. Rest and pain relief.'],
  [4, 2, 0, 'Stomach ache', 'Gastritis. Antacid after meals, avoid spicy food.'],
  [3, 2, 35, 'Blood pressure check', 'BP 138/88, improving. Same medicine.'],
  [7, 1, 20, 'Follow-up', 'Recovered well. No more medicine needed.'],
];

/**
 * Today's queue, as fractions of the time between the start of the demo
 * morning and now. Index = patient. Every patient's events are in order, and
 * the doctor sees one patient at a time.
 */
const TODAY: Array<{ patient: number; reason?: string; issue: number; call?: number; done?: number; skip?: number; notes?: string }> = [
  { patient: 0, reason: 'Follow-up', issue: 0.0, call: 0.15, done: 0.25, notes: 'Fever gone. Finish the medicine.' },
  { patient: 5, reason: 'Allergy', issue: 0.06, call: 0.3, done: 0.42, notes: 'Skin allergy. Antihistamine at night.' },
  { patient: 9, reason: 'Joint pain', issue: 0.12, call: 0.48, done: 0.6, notes: 'Calcium and vitamin D. X-ray if no better.' },
  { patient: 4, reason: 'Fever', issue: 0.2, call: 0.62, skip: 0.66 },
  { patient: 1, reason: 'Check-up', issue: 0.26, call: 0.7 },
  { patient: 2, reason: 'Cough', issue: 0.34 },
  { patient: 7, issue: 0.44 },
  { patient: 8, reason: 'Sugar check', issue: 0.55 },
];

async function insertDemo(store: ClinicStore, deviceId: string, now: Date): Promise<DemoResult> {
  const data = await loadClinicData(store);
  const settings = deriveSettings(data.settingsUpdated);
  if (settings.demoDataLoaded) return 'alreadyLoaded';

  // The marker goes first, so a failure half way can never cause a second load.
  await store.add('settingsUpdated', {
    demoDataLoaded: true,
    ...(settings.clinicName === DEFAULT_CLINIC_NAME ? { clinicName: DEMO_CLINIC_NAME } : {}),
  });

  const letter = deriveDeviceLetter(data.deviceLetterSet, deviceId);
  if (!letter.claimed) await store.add('deviceLetterSet', { deviceId, letter: letter.letter });
  const prefix = letter.letter;

  const ids: string[] = [];
  for (const p of DEMO_PATIENTS) ids.push((await store.add('patientRegistered', p)).id);

  const issued = [...data.tokenIssued];
  const nextNumber = (date: string) => nextTokenNumber(issued, date, prefix, deviceId);
  const issue = async (patient: number, date: string, at: Date, reason?: string) => {
    const record = await store.add('tokenIssued', {
      patientId: ids[patient],
      prefix,
      number: nextNumber(date),
      date,
      at: at.toISOString(),
      ...(reason ? { reason } : {}),
    });
    issued.push(record);
    return record.id;
  };
  const minutes = (base: Date, m: number) => new Date(base.getTime() + m * 60_000);

  // Past days, oldest first: issued, called after 10 minutes, done after 20.
  const today = todayISO(now);
  const past = [...PAST].sort((a, b) => b[1] - a[1] || a[2] - b[2]);
  for (const [patient, daysAgo, startMinute, reason, notes] of past) {
    const date = addDays(today, -daysAgo);
    const [y, m, d] = date.split('-').map(Number);
    const at = minutes(new Date(y, m - 1, d, 10, 0, 0), startMinute);
    const tokenId = await issue(patient, date, at, reason);
    await store.add('tokenCalled', { tokenId, at: minutes(at, 10).toISOString() });
    await store.add('tokenCompleted', { tokenId, notes, at: minutes(at, 20).toISOString() });
  }

  // Today: spread over the last two and a half hours, never before midnight.
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 1, 0);
  const start = Math.max(midnight.getTime(), now.getTime() - 150 * 60_000);
  const span = Math.max(now.getTime() - 60_000 - start, 60_000);
  const at = (fraction: number) => new Date(start + span * fraction);
  for (const entry of TODAY) {
    const date = toISODate(at(entry.issue));
    const tokenId = await issue(entry.patient, date, at(entry.issue), entry.reason);
    if (entry.call !== undefined) await store.add('tokenCalled', { tokenId, at: at(entry.call).toISOString() });
    if (entry.done !== undefined)
      await store.add('tokenCompleted', { tokenId, at: at(entry.done).toISOString(), ...(entry.notes ? { notes: entry.notes } : {}) });
    if (entry.skip !== undefined) await store.add('tokenSkipped', { tokenId, at: at(entry.skip).toISOString() });
  }
  return 'loaded';
}

/**
 * Add realistic sample patients, a week of past visits and a live queue for
 * today, at most once (a marker record plus the skeleton's singleFlight, so a
 * double tap or a second device cannot duplicate it).
 */
export function loadDemoData(store: ClinicStore, deviceId: string, now: Date = new Date()): Promise<DemoResult> {
  return singleFlight(store, () => insertDemo(store, deviceId, now));
}
