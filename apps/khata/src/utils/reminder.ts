import { i18n, formatPaisa } from '@skeleton/core';

export interface ReminderOpts {
  phone: string;          // normalized Pakistani number: 03XXXXXXXXX
  shopName: string;
  customerName: string;
  balancePaisa: number;
  language: 'en' | 'ur';
}

/**
 * Build a WhatsApp deep link (wa.me) with a pre-filled reminder message.
 *
 * Converts the Pakistani number to international format (03xx → 923xx).
 * The message is built from i18n keys (khata.reminder.whatsappMessage)
 * so it uses the correct language and includes the shop name, customer
 * name, and formatted amount.
 */
export function buildWhatsAppUrl(opts: ReminderOpts): string {
  const t = i18n.getFixedT(opts.language);
  const amount = formatPaisa(opts.balancePaisa);
  const message = t('khata.reminder.whatsappMessage', {
    customerName: opts.customerName,
    shopName: opts.shopName,
    amount,
  });
  // 03XX-XXXXXXX → 92 3XX-XXXXXXX
  const intlPhone = `92${opts.phone.slice(1)}`;
  return `https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Build an SMS deep link with a pre-filled message body.
 * Used as a fallback when WhatsApp is not available.
 */
export function buildSmsUrl(opts: { phone: string; message: string }): string {
  return `sms:${opts.phone}?body=${encodeURIComponent(opts.message)}`;
}

/**
 * Build the SMS message text from i18n keys.
 * Useful for the SMS fallback when the caller needs the message text separately.
 */
export function buildSmsMessage(opts: ReminderOpts): string {
  const t = i18n.getFixedT(opts.language);
  const amount = formatPaisa(opts.balancePaisa);
  return t('khata.reminder.smsMessage', {
    customerName: opts.customerName,
    shopName: opts.shopName,
    amount,
  });
}
