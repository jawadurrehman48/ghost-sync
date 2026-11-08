/**
 * Format paisa (integer) as a display string: "Rs X,XXX".
 *
 * Uses integer arithmetic only — no toFixed, no floating-point division.
 * The rupee portion is Math.floor(abs(paisa) / 100).
 * The sub-rupee remainder (paisa % 100) is shown only if non-zero.
 * Negative amounts get a leading minus sign.
 *
 * @example
 * formatPaisa(245000) → "Rs 2,450"
 * formatPaisa(245050) → "Rs 2,450.50"
 * formatPaisa(-50000) → "-Rs 500"
 */
export function formatPaisa(paisa: number): string {
  const negative = paisa < 0;
  const absPaisa = Math.abs(paisa);

  const rs = Math.floor(absPaisa / 100);
  const remainder = absPaisa % 100;

  // Format rupees with thousand separators using en-PK locale
  const formattedRs = rs.toLocaleString('en-PK');

  let result: string;
  if (remainder > 0) {
    const remainderStr = remainder.toString().padStart(2, '0');
    result = `Rs ${formattedRs}.${remainderStr}`;
  } else {
    result = `Rs ${formattedRs}`;
  }

  return negative ? `-${result}` : result;
}

/**
 * Convert rupees entered in a form to paisa for storage.
 * The input is always a whole number (from a numeric input field),
 * so we just multiply by 100.
 */
export function paisaFromRupees(rs: number): number {
  return Math.round(rs) * 100;
}
