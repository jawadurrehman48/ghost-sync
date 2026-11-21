import { i18n, smsLink, whatsAppLink } from '@skeleton/core';
import type { Language } from '@skeleton/core';

export interface NotifyOpts {
  patientName: string;
  /** e.g. "A-12" */
  token: string;
  clinicName: string;
  language: Language;
}

/** "Your token A-12 at City Clinic is next. Please come to the clinic." in the given language. */
export function notifyMessage(opts: NotifyOpts): string {
  return i18n.getFixedT(opts.language)('clinic.notify.message', {
    patientName: opts.patientName,
    token: opts.token,
    clinicName: opts.clinicName,
  });
}

/** WhatsApp link plus SMS fallback, both with the message pre-filled (skeleton share helpers). */
export function notifyLinks(phone: string, opts: NotifyOpts): { whatsapp: string; sms: string } {
  const message = notifyMessage(opts);
  return { whatsapp: whatsAppLink(phone, message), sms: smsLink(phone, message) };
}
