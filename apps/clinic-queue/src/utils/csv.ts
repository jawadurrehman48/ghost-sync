import { createCsvBlob, csvDocument, csvSafeText, downloadBlob, formatTime, minutesBetween } from '@skeleton/core';
import { lastVisitDates } from '../clinic.reducers';
import type { ClinicDerived, TokenStatus } from '../clinic.types';

const STATUS: Record<TokenStatus, string> = {
  waiting: 'Waiting',
  serving: 'Being seen',
  completed: 'Completed',
  skipped: 'Skipped',
};

/**
 * Backup of every patient and visit, using the skeleton's CSV helpers
 * (escaping, formula protection, UTF-8 BOM for Urdu in Excel).
 */
export function buildClinicCsv(derived: ClinicDerived, clinicName: string): string {
  const lastVisit = lastVisitDates(derived.tokens);
  const visits = new Map<string, number>();
  for (const t of derived.tokens) visits.set(t.patientId, (visits.get(t.patientId) ?? 0) + 1);

  const rows: Array<Array<string | number>> = [['Clinic', csvSafeText(clinicName)], []];

  rows.push(['Patients'], ['Name', 'Phone', 'Age', 'Gender', 'Visits', 'Last visit']);
  for (const p of derived.patients) {
    rows.push([
      csvSafeText(p.name),
      csvSafeText(p.phone ?? ''),
      p.age ?? '',
      p.gender ?? '',
      visits.get(p.id) ?? 0,
      lastVisit.get(p.id) ?? '',
    ]);
  }

  rows.push([], ['Tokens'], ['Date', 'Token', 'Patient', 'Reason', 'Status', 'Issued', 'Called', 'Completed', 'Wait (min)', 'Notes']);
  for (const t of derived.tokens) {
    rows.push([
      t.date,
      t.label,
      csvSafeText(derived.patientsById.get(t.patientId)?.name ?? t.patientId),
      csvSafeText(t.reason ?? ''),
      STATUS[t.status],
      formatTime(t.issuedAt),
      t.firstCalledAt ? formatTime(t.firstCalledAt) : '',
      t.completedAt ? formatTime(t.completedAt) : '',
      t.firstCalledAt ? minutesBetween(t.issuedAt, t.firstCalledAt) : '',
      csvSafeText(t.notes ?? ''),
    ]);
  }
  return csvDocument(rows);
}

/** Download the backup file. Works offline. */
export function downloadClinicCsv(derived: ClinicDerived, clinicName: string): void {
  downloadBlob(createCsvBlob(buildClinicCsv(derived, clinicName)), `clinic-queue-${derived.today}.csv`);
}
