import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { i18n, registerAppTranslations } from '@skeleton/core';
import { buildSmsMessage, buildSmsUrl, buildWhatsAppUrl } from '../apps/khata/src/utils/reminder';
import en from '../apps/khata/src/i18n/en.json';
import ur from '../apps/khata/src/i18n/ur.json';

const base = {
  phone: '03001234567',
  shopName: 'Ahmed General Store',
  customerName: 'Bilal Khan',
  balancePaisa: 245000,
};

function messageOf(url: string): string {
  return new URL(url).searchParams.get('text') ?? '';
}

describe('WhatsApp reminder (TR-6)', () => {
  beforeAll(() => {
    registerAppTranslations({ en, ur });
  });

  it('opens wa.me with the phone in international format (03xx → 923xx)', () => {
    const url = buildWhatsAppUrl({ ...base, language: 'en' });
    expect(url.startsWith('https://wa.me/923001234567?text=')).toBe(true);
  });

  it('writes a polite English message with shop name, customer name and amount', () => {
    const message = messageOf(buildWhatsAppUrl({ ...base, language: 'en' }));
    expect(message).toBe(
      'Hello Bilal Khan! Reminder from Ahmed General Store: your outstanding balance is Rs 2,450. Please make a payment at your earliest convenience. Thank you.',
    );
  });

  it('writes the message in Urdu with shop name, customer name and amount', () => {
    const message = messageOf(buildWhatsAppUrl({ ...base, language: 'ur' }));
    expect(message).toContain('السلام علیکم');
    expect(message).toContain('Bilal Khan');
    expect(message).toContain('Ahmed General Store');
    expect(message).toContain('Rs 2,450');
    expect(message).toContain('بقایا');
    expect(message).not.toContain('Hello');
  });

  it('uses the language it is given, not the one currently shown on screen', async () => {
    await i18n.changeLanguage('ur');
    expect(messageOf(buildWhatsAppUrl({ ...base, language: 'en' }))).toContain('Hello');
    await i18n.changeLanguage('en');
    expect(messageOf(buildWhatsAppUrl({ ...base, language: 'ur' }))).toContain('السلام علیکم');
  });

  it('formats the amount with thousand separators', () => {
    const message = messageOf(buildWhatsAppUrl({ ...base, balancePaisa: 123456700, language: 'en' }));
    expect(message).toContain('Rs 1,234,567');
  });

  it('property: any shop or customer name survives URL encoding intact', () => {
    const safeText = fc
      .string({ minLength: 1, maxLength: 30 })
      .filter((s) => !s.includes('$t(') && !s.includes('{{') && !s.includes('}}'));
    fc.assert(
      fc.property(safeText, safeText, fc.constantFrom('en' as const, 'ur' as const), (shopName, customerName, language) => {
        const message = messageOf(buildWhatsAppUrl({ ...base, shopName, customerName, language }));
        expect(message).toContain(shopName);
        expect(message).toContain(customerName);
      }),
    );
  });

  it('property: the URL is always a valid wa.me link for any valid phone', () => {
    const phone = fc
      .array(fc.integer({ min: 0, max: 9 }), { minLength: 9, maxLength: 9 })
      .map((d) => `03${d.join('')}`);
    fc.assert(
      fc.property(phone, (p) => {
        const url = new URL(buildWhatsAppUrl({ ...base, phone: p, language: 'en' }));
        expect(url.host).toBe('wa.me');
        expect(url.pathname).toBe(`/92${p.slice(1)}`);
      }),
    );
  });
});

describe('SMS fallback (TR-6)', () => {
  beforeAll(() => {
    registerAppTranslations({ en, ur });
  });

  it('builds an sms: link with the encoded message as the body', () => {
    const url = buildSmsUrl({ phone: '03001234567', message: 'Hello & welcome #1' });
    expect(url).toBe('sms:03001234567?body=Hello%20%26%20welcome%20%231');
  });

  it('builds the SMS text from the translations in both languages', () => {
    const english = buildSmsMessage({ ...base, language: 'en' });
    expect(english).toContain('Bilal Khan');
    expect(english).toContain('Ahmed General Store');
    expect(english).toContain('Rs 2,450');

    const urdu = buildSmsMessage({ ...base, language: 'ur' });
    expect(urdu).toContain('السلام علیکم');
    expect(urdu).toContain('Rs 2,450');
  });

  it('round-trips: decoding the sms body gives back the message', () => {
    const message = buildSmsMessage({ ...base, language: 'ur' });
    const url = buildSmsUrl({ phone: base.phone, message });
    expect(decodeURIComponent(url.split('?body=')[1])).toBe(message);
  });
});
