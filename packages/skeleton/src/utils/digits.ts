/**
 * Convert Urdu (Extended Arabic-Indic, U+06F0–U+06F9) and Arabic-Indic
 * (U+0660–U+0669) digits to ASCII digits. Shopkeepers using an Urdu
 * keyboard type these digits, so numeric inputs must accept them.
 * All other characters are left untouched.
 */
export function toAsciiDigits(input: string): string {
  return input.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (ch) => {
    const code = ch.charCodeAt(0);
    const digit = code >= 0x06f0 ? code - 0x06f0 : code - 0x0660;
    return String(digit);
  });
}
