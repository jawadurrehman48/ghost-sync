/**
 * Validate a Pakistani mobile phone number.
 *
 * Accepted formats (after stripping hyphens and spaces):
 *   03001234567   (11 digits, starts with 03)
 *   0300-1234567  (hyphens stripped)
 *   0300 1234567  (spaces stripped)
 *
 * All other formats are rejected, including:
 *   +92..., 923..., 01234567890, empty string, letters.
 */
const PK_PHONE_RE = /^03\d{9}$/;

export function validatePakistaniPhone(phone: string): boolean {
  const stripped = phone.replace(/[-\s]/g, '');
  return PK_PHONE_RE.test(stripped);
}

/**
 * Normalize a phone number by stripping hyphens and spaces.
 * Returns the raw 11-digit string (e.g. "03001234567").
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[-\s]/g, '');
}
