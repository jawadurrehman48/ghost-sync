/**
 * FR-6: "Your token is next" message on WhatsApp with an SMS fallback, in the chosen language.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { i18n, registerAppTranslations, setLanguage } from '@skeleton/core';
import { notifyLinks, notifyMessage } from '../apps/clinic-queue/src/utils/notify';
import en from '../apps/clinic-queue/src/i18n/en.json';
import ur from '../apps/clinic-queue/src/i18n/ur.json';

const base = { patientName: 'Ayesha Siddiqui', token: 'A-12', clinicName: 'Shifa Family Clinic' };

function textOf(url: string): string {
  return new URL(url).searchParams.get('text') ?? '';
}

function bodyOf(url: string): string {
  return decodeURIComponent(url.slice(url.indexOf('?body=') + '?body='.length));
}

describe('notify message (FR-6)', () => {
  beforeAll(() => {
    registerAppTranslations({ en, ur });
  });

  it('writes the English message with the token, patient and clinic name', () => {
    expect(notifyMessage({ ...base, language: 'en' })).toBe(
      'Hello Ayesha Siddiqui! Your token A-12 at Shifa Family Clinic is next. Please come to the clinic.',
    );
  });

  it('writes the Urdu message with the token, patient and clinic name', () => {
    const message = notifyMessage({ ...base, language: 'ur' });
    expect(message).toContain('السلام علیکم');
    expect(message).toContain('Ayesha Siddiqui');
    expect(message).toContain('A-12');
    expect(message).toContain('Shifa Family Clinic');
    expect(message).toContain('کلینک تشریف لائیں');
    expect(message).not.toContain('{{');
  });

  it('uses the language asked for, not the current UI language', async () => {
    await setLanguage('ur');
    expect(notifyMessage({ ...base, language: 'en' })).toMatch(/^Hello /);
    await setLanguage('en');
    expect(notifyMessage({ ...base, language: 'ur' })).toContain('السلام علیکم');
    expect(i18n.language).toBe('en');
  });

  it('never leaves a placeholder or key in either language', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !s.includes('{{')),
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !s.includes('{{')),
        fc.constantFrom<'en' | 'ur'>('en', 'ur'),
        (patientName, clinicName, language) => {
          const message = notifyMessage({ patientName, clinicName, token: 'B-3', language });
          expect(message).toContain('B-3');
          expect(message).not.toContain('clinic.notify');
          expect(message).not.toContain('{{');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('does not HTML-escape names (the message is plain text)', () => {
    const message = notifyMessage({ ...base, patientName: "D'Souza & Sons", language: 'en' });
    expect(message).toContain("D'Souza & Sons");
  });
});

describe('notify links (FR-6)', () => {
  beforeAll(() => {
    registerAppTranslations({ en, ur });
  });

  it('opens wa.me with the number in international format (03xx → 923xx)', () => {
    const { whatsapp } = notifyLinks('0300-1234567', { ...base, language: 'en' });
    expect(whatsapp.startsWith('https://wa.me/923001234567?text=')).toBe(true);
    expect(textOf(whatsapp)).toBe(notifyMessage({ ...base, language: 'en' }));
  });

  it('accepts Urdu digits and +92 numbers', () => {
    expect(notifyLinks('۰۳۰۰۱۲۳۴۵۶۷', { ...base, language: 'ur' }).whatsapp).toMatch(/^https:\/\/wa\.me\/923001234567\?/);
    expect(notifyLinks('+92 300 1234567', { ...base, language: 'en' }).whatsapp).toMatch(/^https:\/\/wa\.me\/923001234567\?/);
  });

  it('carries the Urdu message intact through the WhatsApp link', () => {
    const { whatsapp } = notifyLinks('03001234567', { ...base, language: 'ur' });
    expect(textOf(whatsapp)).toBe(notifyMessage({ ...base, language: 'ur' }));
  });

  it('offers an SMS fallback with the same message', () => {
    for (const language of ['en', 'ur'] as const) {
      const { sms } = notifyLinks('0300-1234567', { ...base, language });
      expect(sms.startsWith('sms:03001234567?body=')).toBe(true);
      expect(bodyOf(sms)).toBe(notifyMessage({ ...base, language }));
    }
  });
});
