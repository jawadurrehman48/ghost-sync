import { toAsciiDigits } from './digits';

/**
 * Normalize a phone number: converts Urdu digits to ASCII and strips
 * hyphens and spaces. Returns e.g. "03001234567".
 */
export function normalizePhone(phone: string): string {
  return toAsciiDigits(phone).replace(/[-\s]/g, '');
}

const PK_MOBILE_RE = /^03\d{9}$/;

/**
 * Validate a Pakistani mobile number.
 *
 * Accepted (after normalizing): 11 digits starting with 03, e.g.
 *   03001234567, 0300-1234567, 0300 1234567
 * Rejected: +92..., 92..., 01234567890, empty string, letters.
 */
export function validatePakistaniPhone(phone: string): boolean {
  return PK_MOBILE_RE.test(normalizePhone(phone));
}
