import { formatPaisa, i18n, smsLink, whatsAppLink } from '@skeleton/core';

export interface ReminderOpts {
  phone: string; // normalized Pakistani number: 03XXXXXXXXX
  shopName: string;
  customerName: string;
  balancePaisa: number;
  language: 'en' | 'ur';
}

function message(key: string, opts: ReminderOpts): string {
  return i18n.getFixedT(opts.language)(key, {
    customerName: opts.customerName,
    shopName: opts.shopName,
    amount: formatPaisa(opts.balancePaisa),
  });
}

/**
 * WhatsApp link with a polite payment reminder in the given language
 * (shop name, customer name and amount). Uses the skeleton's whatsAppLink,
 * which converts 03xx to the international 923xx form.
 */
export function buildWhatsAppUrl(opts: ReminderOpts): string {
  return whatsAppLink(opts.phone, message('khata.reminder.whatsappMessage', opts));
}

/** SMS link with the message pre-filled: the fallback when WhatsApp is not available. */
export function buildSmsUrl(opts: { phone: string; message: string }): string {
  return smsLink(opts.phone, opts.message);
}

/** The SMS reminder text in the given language. */
export function buildSmsMessage(opts: ReminderOpts): string {
  return message('khata.reminder.smsMessage', opts);
}
