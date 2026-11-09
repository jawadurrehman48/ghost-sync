/**
 * Input limits. They keep names and notes readable on a 360px screen and stop
 * pathological input (a pasted novel, a 30-digit amount) from reaching the store.
 */
export const LIMITS = {
  name: 60,
  phone: 20,
  note: 300,
  reason: 200,
  shopName: 60,
  /** Whole rupees: 9 digits = Rs 999,999,999, so even thousands of entries add up exactly. */
  amountDigits: 9,
} as const;

/** Trim and collapse runs of spaces/newlines to single spaces (names, shop name). */
export function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Lower-case, collapsed form used to compare names ("  ALI   Raza " equals "ali raza"). */
export function nameKey(value: string): string {
  return collapseSpaces(value).toLowerCase();
}
