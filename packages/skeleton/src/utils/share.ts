import { normalizePhone } from './phone';

/**
 * A Pakistani mobile number in international form without "+":
 * "0300-1234567" → "923001234567". Numbers already starting with 92 are kept.
 */
export function toInternationalPk(phone: string): string {
  const digits = normalizePhone(phone).replace(/^\+/, '');
  if (digits.startsWith('92')) return digits;
  return digits.startsWith('0') ? `92${digits.slice(1)}` : digits;
}

/**
 * A WhatsApp deep link (wa.me) that opens a chat with the message typed in.
 * No API key and no server: the user's own WhatsApp sends it.
 */
export function whatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${toInternationalPk(phone)}?text=${encodeURIComponent(message)}`;
}

/** An SMS link with the message pre-filled: the fallback when WhatsApp is not installed. */
export function smsLink(phone: string, message: string): string {
  return `sms:${normalizePhone(phone)}?body=${encodeURIComponent(message)}`;
}
