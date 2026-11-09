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
