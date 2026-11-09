import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { addDays, daysBetween, isValidISODate, toISODate, weekRange } from '@skeleton/core';

const arbIso = fc
  .record({ y: fc.integer({ min: 1900, max: 2200 }), m: fc.integer({ min: 0, max: 11 }), d: fc.integer({ min: 1, max: 28 }) })
  .map(({ y, m, d }) => toISODate(new Date(y, m, d, 12)));

describe('addDays / daysBetween (property-based)', () => {
  it('addDays always returns a valid calendar date', () => {
    fc.assert(
      fc.property(arbIso, fc.integer({ min: -40_000, max: 40_000 }), (iso, n) => {
        expect(isValidISODate(addDays(iso, n))).toBe(true);
      }),
    );
  });

  it('daysBetween is the inverse of addDays', () => {
    fc.assert(
      fc.property(arbIso, fc.integer({ min: -40_000, max: 40_000 }), (iso, n) => {
        expect(daysBetween(iso, addDays(iso, n))).toBe(n);
      }),
    );
  });

  it('adding then subtracting returns the original date', () => {
    fc.assert(
      fc.property(arbIso, fc.integer({ min: -5000, max: 5000 }), (iso, n) => {
        expect(addDays(addDays(iso, n), -n)).toBe(iso);
      }),
    );
  });

  it('daysBetween is antisymmetric and zero for the same day', () => {
    fc.assert(
      fc.property(arbIso, arbIso, (a, b) => {
        expect(daysBetween(a, b)).toBe(-daysBetween(b, a));
        expect(daysBetween(a, a)).toBe(0);
      }),
    );
  });

  it('handles month ends, leap years and year changes', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364);
    expect(daysBetween('2024-01-01', '2024-12-31')).toBe(365);
  });

  it('is fast even for ranges of thousands of years (no day-by-day loops)', () => {
    const start = performance.now();
    expect(daysBetween('0001-01-01', '9999-12-31')).toBeGreaterThan(3_000_000);
    expect(performance.now() - start).toBeLessThan(20);
  });
});

describe('weekRange (property-based)', () => {
  const arbDate = arbIso.map((iso) => new Date(`${iso}T12:00:00`));

  it('is exactly 7 days, contains the given day, and starts on Monday', () => {
    fc.assert(
      fc.property(arbDate, (date) => {
        const { from, to } = weekRange(date);
        const today = toISODate(date);
        expect(daysBetween(from, to)).toBe(6);
        expect(from <= today && today <= to).toBe(true);
        expect(new Date(`${from}T12:00:00`).getDay()).toBe(1);
      }),
    );
  });

  it('can start on Sunday instead', () => {
    fc.assert(
      fc.property(arbDate, (date) => {
        const { from } = weekRange(date, 0);
        expect(new Date(`${from}T12:00:00`).getDay()).toBe(0);
      }),
    );
  });

  it('crosses month and year boundaries correctly', () => {
    // Thursday 1 Jan 2026 belongs to the week Mon 29 Dec 2025 .. Sun 4 Jan 2026
    expect(weekRange(new Date(2026, 0, 1, 12))).toEqual({ from: '2025-12-29', to: '2026-01-04' });
    // A Monday is its own week start
    expect(weekRange(new Date(2026, 10, 2, 12))).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    // A Sunday ends the week
    expect(weekRange(new Date(2026, 10, 8, 12))).toEqual({ from: '2026-11-02', to: '2026-11-08' });
  });
});
