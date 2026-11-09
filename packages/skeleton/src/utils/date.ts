/**
 * Date helpers. Dates are stored as ISO calendar dates ("YYYY-MM-DD") in the
 * device's LOCAL time zone, so "today" matches what the user sees on screen
 * (toISOString() would give the UTC date, which is wrong for UTC+5 late at night).
 */

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** Format a Date as local "YYYY-MM-DD". */
export function toISODate(d: Date): string {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's local date as "YYYY-MM-DD". */
export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** True if the string is a real calendar date in "YYYY-MM-DD" form. */
export function isValidISODate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(0);
  dt.setUTCFullYear(y, mo - 1, d);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** "2026-10-15" → "15/10/2026". Returns the input unchanged if it is not a valid date. */
export function formatDateDMY(iso: string): string {
  if (!isValidISODate(iso)) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const MS_PER_DAY = 86_400_000;

/** Whole days since 1970-01-01 for a VALID "YYYY-MM-DD" (calendar maths in UTC, so no DST surprises). */
function toDayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(0);
  dt.setUTCFullYear(y, m - 1, d);
  return Math.round(dt.getTime() / MS_PER_DAY);
}

function fromDayNumber(n: number): string {
  const dt = new Date(n * MS_PER_DAY);
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Number of days from `from` to `to` (negative if `to` is earlier). Both must be valid ISO dates. */
export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** The ISO date `days` after `iso` (negative goes back). Must be given a valid ISO date. */
export function addDays(iso: string, days: number): string {
  return fromDayNumber(toDayNumber(iso) + days);
}

/**
 * The 7-day week containing `now`, as ISO dates. Weeks start on Monday by
 * default (Pakistan's working week); pass 0 for Sunday.
 */
export function weekRange(now: Date = new Date(), weekStartsOn: 0 | 1 = 1): { from: string; to: string } {
  const offset = (now.getDay() - weekStartsOn + 7) % 7;
  const from = addDays(toISODate(now), -offset);
  return { from, to: addDays(from, 6) };
}

/** First and last day of the month containing `now`, as "YYYY-MM-DD". */
export function monthRange(now: Date = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return {
    from: `${pad(y, 4)}-${pad(m + 1)}-01`,
    to: `${pad(y, 4)}-${pad(m + 1)}-${pad(lastDay)}`,
  };
}
