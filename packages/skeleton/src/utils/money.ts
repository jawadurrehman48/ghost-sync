import { toAsciiDigits } from './digits';

/** Insert thousand separators into a non-negative integer. */
function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format paisa (integer) as a display string: "Rs X,XXX".
 *
 * Integer arithmetic only: no toFixed, no floating-point division, and no
 * locale-dependent formatting (output is identical on every device).
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

  const body =
    remainder > 0
      ? `Rs ${groupThousands(rs)}.${String(remainder).padStart(2, '0')}`
      : `Rs ${groupThousands(rs)}`;

  return negative ? `-${body}` : body;
}

/**
 * Convert whole rupees entered in a form to paisa for storage.
 */
export function paisaFromRupees(rs: number): number {
  return Math.round(rs) * 100;
}

/**
 * Parse a whole-rupee amount typed by a user.
 *
 * Accepts ASCII, Urdu and Arabic-Indic digits, and ignores commas and
 * whitespace. Returns the amount as an integer number of rupees, or null if
 * the input is empty, not a whole number, below Rs 1, or has more than
 * `maxDigits` digits (guards against absurd amounts).
 */
export function parseWholeRupees(input: string, maxDigits = 9): number | null {
  const cleaned = toAsciiDigits(input).replace(/[,\s]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const digits = cleaned.replace(/^0+/, '');
  if (digits.length === 0 || digits.length > maxDigits) return null;
  return Number(digits);
}
