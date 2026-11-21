/** True if the value is a string that parses to a real point in time. */
export function isValidTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && Number.isFinite(Date.parse(value));
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local clock time "HH:MM" (24-hour, the same on every device). Empty for an invalid time. */
export function formatTime(iso: string): string {
  if (!isValidTimestamp(iso)) return '';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Whole minutes from `fromIso` to `toIso` (never negative; 0 for invalid input). */
export function minutesBetween(fromIso: string, toIso: string): number {
  if (!isValidTimestamp(fromIso) || !isValidTimestamp(toIso)) return 0;
  return Math.max(0, Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / 60_000));
}

/** Local hour of the day (0–23) for a timestamp, or -1 if it is invalid. */
export function localHour(iso: string): number {
  return isValidTimestamp(iso) ? new Date(iso).getHours() : -1;
}
