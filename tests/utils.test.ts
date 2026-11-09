import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  formatPaisa,
  parseWholeRupees,
  paisaFromRupees,
  toAsciiDigits,
  normalizePhone,
  validatePakistaniPhone,
  toISODate,
  todayISO,
  isValidISODate,
  formatDateDMY,
  monthRange,
} from '@skeleton/core';

const URDU_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

describe('formatPaisa (property-based)', () => {
  it('round-trips: stripping "Rs " and commas gives back the exact rupees and paisa', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000_000_000 }), (paisa) => {
        const text = formatPaisa(paisa);
        expect(text.startsWith('Rs ')).toBe(true);
        const [rsPart, paisaPart] = text.slice(3).replace(/,/g, '').split('.');
        const rebuilt = Number(rsPart) * 100 + (paisaPart ? Number(paisaPart) : 0);
        expect(rebuilt).toBe(paisa);
      }),
    );
  });

  it('uses comma thousand separators in groups of three', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000_000_000 }), (paisa) => {
        const rsPart = formatPaisa(paisa).slice(3).split('.')[0];
        expect(rsPart).toMatch(/^\d{1,3}(,\d{3})*$/);
      }),
    );
  });

  it('shows a leading minus for negative amounts and matches the positive form', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000_000_000 }), (paisa) => {
        expect(formatPaisa(-paisa)).toBe(`-${formatPaisa(paisa)}`);
      }),
    );
  });

  it('shows paisa only when the amount has a sub-rupee remainder', () => {
    expect(formatPaisa(245000)).toBe('Rs 2,450');
    expect(formatPaisa(245050)).toBe('Rs 2,450.50');
    expect(formatPaisa(5)).toBe('Rs 0.05');
    expect(formatPaisa(0)).toBe('Rs 0');
    expect(formatPaisa(123456700)).toBe('Rs 1,234,567');
  });
});

describe('parseWholeRupees (property-based)', () => {
  it('parses any whole-rupee amount typed in ASCII digits', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999_999_999 }), (n) => {
        expect(parseWholeRupees(String(n))).toBe(n);
      }),
    );
  });

  it('parses Urdu and Arabic-Indic digits identically', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999_999_999 }), (n) => {
        const urdu = String(n).replace(/\d/g, (d) => URDU_DIGITS[Number(d)]);
        const arabic = String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
        expect(parseWholeRupees(urdu)).toBe(n);
        expect(parseWholeRupees(arabic)).toBe(n);
      }),
    );
  });

  it('ignores commas and spaces', () => {
    expect(parseWholeRupees('1,200')).toBe(1200);
    expect(parseWholeRupees(' 2 500 ')).toBe(2500);
  });

  it('rejects empty, zero, decimals, negatives, letters and over-long input', () => {
    for (const bad of ['', '   ', '0', '000', '12.5', '-5', 'abc', '12a', '1234567890']) {
      expect(parseWholeRupees(bad)).toBeNull();
    }
  });

  it('paisaFromRupees(parse(x)) is always an exact integer multiple of 100', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999_999_999 }), (n) => {
        const paisa = paisaFromRupees(parseWholeRupees(String(n)) as number);
        expect(Number.isSafeInteger(paisa)).toBe(true);
        expect(paisa % 100).toBe(0);
        expect(paisa / 100).toBe(n);
      }),
    );
  });
});

describe('toAsciiDigits', () => {
  it('maps every Urdu and Arabic-Indic digit and leaves other text alone', () => {
    expect(toAsciiDigits(URDU_DIGITS)).toBe('0123456789');
    expect(toAsciiDigits(ARABIC_DIGITS)).toBe('0123456789');
    expect(toAsciiDigits('abc-۱۲')).toBe('abc-12');
  });
});

describe('phone helpers (property-based)', () => {
  const arbValidDigits = fc
    .array(fc.integer({ min: 0, max: 9 }), { minLength: 9, maxLength: 9 })
    .map((d) => `03${d.join('')}`);

  it('accepts any 03 + 9 digits, with or without hyphen or space', () => {
    fc.assert(
      fc.property(arbValidDigits, (phone) => {
        expect(validatePakistaniPhone(phone)).toBe(true);
        expect(validatePakistaniPhone(`${phone.slice(0, 4)}-${phone.slice(4)}`)).toBe(true);
        expect(validatePakistaniPhone(`${phone.slice(0, 4)} ${phone.slice(4)}`)).toBe(true);
      }),
    );
  });

  it('normalizePhone is idempotent and yields the bare 11 digits', () => {
    fc.assert(
      fc.property(arbValidDigits, (phone) => {
        const spaced = `${phone.slice(0, 4)}-${phone.slice(4)}`;
        expect(normalizePhone(spaced)).toBe(phone);
        expect(normalizePhone(normalizePhone(spaced))).toBe(phone);
      }),
    );
  });

  it('rejects numbers with the wrong length', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 0, maxLength: 20 }).filter((d) => d.length !== 9),
        (digits) => {
          expect(validatePakistaniPhone(`03${digits.join('')}`)).toBe(false);
        },
      ),
    );
  });

  it('accepts Urdu digits', () => {
    expect(validatePakistaniPhone('۰۳۰۰۱۲۳۴۵۶۷')).toBe(true);
  });
});

describe('date helpers (property-based)', () => {
  const arbDate = fc
    .record({
      y: fc.integer({ min: 1990, max: 2100 }),
      m: fc.integer({ min: 0, max: 11 }),
      d: fc.integer({ min: 1, max: 28 }),
    })
    .map(({ y, m, d }) => new Date(y, m, d, 12, 0, 0));

  it('toISODate produces a valid YYYY-MM-DD that matches the local calendar day', () => {
    fc.assert(
      fc.property(arbDate, (date) => {
        const iso = toISODate(date);
        expect(isValidISODate(iso)).toBe(true);
        expect(iso).toBe(
          `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        );
        expect(todayISO(date)).toBe(iso);
      }),
    );
  });

  it('formatDateDMY round-trips back to the ISO date', () => {
    fc.assert(
      fc.property(arbDate, (date) => {
        const iso = toISODate(date);
        const [dd, mm, yyyy] = formatDateDMY(iso).split('/');
        expect(`${yyyy}-${mm}-${dd}`).toBe(iso);
      }),
    );
  });

  it('monthRange covers exactly the whole month of the given date', () => {
    fc.assert(
      fc.property(arbDate, (date) => {
        const { from, to } = monthRange(date);
        const iso = toISODate(date);
        expect(isValidISODate(from)).toBe(true);
        expect(isValidISODate(to)).toBe(true);
        expect(from <= iso && iso <= to).toBe(true);
        expect(from.slice(0, 7)).toBe(to.slice(0, 7));
        expect(from.endsWith('-01')).toBe(true);
        // the day after `to` is the first day of the next month
        const [y, m, d] = to.split('-').map(Number);
        const next = new Date(y, m - 1, d + 1);
        expect(next.getDate()).toBe(1);
      }),
    );
  });

  it('isValidISODate rejects impossible dates and bad formats', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '2026-00-10', '2026-1-1', '26-01-01', 'abc', '', '2026/01/01']) {
      expect(isValidISODate(bad)).toBe(false);
    }
    expect(isValidISODate('2024-02-29')).toBe(true);
    expect(isValidISODate('2026-02-29')).toBe(false);
  });

  it('formatDateDMY returns the input unchanged when it is not a valid date', () => {
    expect(formatDateDMY('nonsense')).toBe('nonsense');
    expect(formatDateDMY('2026-10-15')).toBe('15/10/2026');
  });
});
