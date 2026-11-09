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
 * Show a phone number the way people write it: 0300-1234567.
 * Numbers are STORED unformatted. Anything that is not a valid Pakistani
 * mobile number is returned as typed, so odd data is never hidden.
 */
export function formatPhone(phone: string): string {
  const digits = normalizePhone(phone);
  return PK_MOBILE_RE.test(digits) ? `${digits.slice(0, 4)}-${digits.slice(4)}` : phone;
}

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
