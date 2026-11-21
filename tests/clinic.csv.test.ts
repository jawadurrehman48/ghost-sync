/**
 * FR-10: CSV backup of every patient and visit.
 */
import { describe, expect, it } from 'vitest';
import { deriveAll } from '../apps/clinic-queue/src/clinic.reducers';
import { buildClinicCsv } from '../apps/clinic-queue/src/utils/csv';
import { DAY, atMin, emptyData, rec } from './clinic.helpers';

function sample() {
  const data = emptyData();
  data.patientRegistered.push(
    rec('patientRegistered', { name: 'Ali, Raza', phone: '03001234567', age: 45, gender: 'male' }, 'ali', 1),
    rec('patientRegistered', { name: '=HYPERLINK("x")' }, 'evil', 2),
    rec('patientRegistered', { name: 'نسرین اختر' }, 'nasreen', 3),
  );
  data.tokenIssued.push(
    rec('tokenIssued', { patientId: 'ali', prefix: 'A', number: 1, date: DAY, at: atMin(0), reason: 'Fever' }, 't1', 10),
    rec('tokenIssued', { patientId: 'nasreen', prefix: 'A', number: 2, date: DAY, at: atMin(5) }, 't2', 11),
  );
  data.tokenCalled.push(rec('tokenCalled', { tokenId: 't1', at: atMin(12) }, 'c1', 12));
  data.tokenCompleted.push(rec('tokenCompleted', { tokenId: 't1', at: atMin(20), notes: 'Rest, "plenty" of water' }, 'd1', 13));
  return deriveAll(data, 'device-1', DAY);
}

describe('clinic CSV export', () => {
  const csv = buildClinicCsv(sample(), 'City Clinic');
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/);

  it('has the clinic name, a patients section and a tokens section', () => {
    expect(lines[0]).toBe('Clinic,City Clinic');
    expect(lines).toContain('Patients');
    expect(lines).toContain('Name,Phone,Age,Gender,Visits,Last visit');
    expect(lines).toContain('Tokens');
    expect(lines).toContain('Date,Token,Patient,Reason,Status,Issued,Called,Completed,Wait (min),Notes');
  });

  it('lists every patient with their visit count and last visit', () => {
    expect(csv).toContain(`"Ali, Raza",03001234567,45,male,1,${DAY}`);
    expect(csv).toContain(`نسرین اختر,,,,1,${DAY}`);
  });

  it('lists every token with status, wait and escaped notes', () => {
    const t1 = lines.find((l) => l.startsWith(`${DAY},A-1,`)) ?? '';
    expect(t1).toContain('"Ali, Raza",Fever,Completed');
    expect(t1).toMatch(/,12,"Rest, ""plenty"" of water"$/);
    const t2 = lines.find((l) => l.startsWith(`${DAY},A-2,`)) ?? '';
    expect(t2).toContain('نسرین اختر,,Waiting');
  });

  it('neutralises spreadsheet formulas in names', () => {
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(csv).toContain('HYPERLINK');
  });
});
