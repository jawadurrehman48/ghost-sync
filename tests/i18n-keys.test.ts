import { describe, it, expect } from 'vitest';
import skeletonEn from '../packages/skeleton/src/i18n/locales/en.json';
import skeletonUr from '../packages/skeleton/src/i18n/locales/ur.json';
import khataEn from '../apps/khata/src/i18n/en.json';
import khataUr from '../apps/khata/src/i18n/ur.json';
import clinicEn from '../apps/clinic-queue/src/i18n/en.json';
import clinicUr from '../apps/clinic-queue/src/i18n/ur.json';

/** Flatten nested translation objects to { "a.b.c": "text" }. */
function flatten(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'string') out[path] = value;
      else Object.assign(out, flatten(value, path));
    }
  }
  return out;
}

/** {{placeholder}} names used in a string. */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
}

describe.each([
  ['skeleton', skeletonEn, skeletonUr],
  ['khata', khataEn, khataUr],
  ['clinic-queue', clinicEn, clinicUr],
])('%s translations', (_name, en, ur) => {
  const flatEn = flatten(en);
  const flatUr = flatten(ur);

  it('en.json and ur.json have exactly the same keys', () => {
    expect(Object.keys(flatUr).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it('has no empty translations', () => {
    for (const [key, text] of [...Object.entries(flatEn), ...Object.entries(flatUr)]) {
      expect(text.trim(), `empty value for ${key}`).not.toBe('');
    }
  });

  it('uses the same {{placeholders}} in both languages', () => {
    for (const key of Object.keys(flatEn)) {
      expect(placeholders(flatUr[key] ?? ''), `placeholders differ for ${key}`).toEqual(placeholders(flatEn[key]));
    }
  });
});

describe.each([
  ['khata', khataEn],
  ['clinic', clinicEn],
])('%s keys do not collide with skeleton keys', (prefix, en) => {
  it(`every key is under the ${prefix}. prefix`, () => {
    for (const key of Object.keys(flatten(en))) {
      expect(key.startsWith(`${prefix}.`), key).toBe(true);
    }
  });
});

describe('Urdu translations are really Urdu', () => {
  it.each([
    ['khata', khataUr],
    ['clinic-queue', clinicUr],
  ])('%s: almost every Urdu value contains Urdu script', (_name, ur) => {
    const values = Object.entries(flatten(ur));
    const latinOnly = values.filter(([, text]) => !/[\u0600-\u06FF]/.test(text)).map(([key]) => key);
    // A few values may legitimately be symbols or numbers only (e.g. "#{{position}}").
    expect(latinOnly.length).toBeLessThanOrEqual(Math.ceil(values.length * 0.03));
  });
});
