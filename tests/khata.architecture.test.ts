import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Architecture rules (steering tech.md + structure.md, spec NFR-7):
 *  - apps only use @skeleton/core for storage, sync, i18n and UI
 *  - no direct IndexedDB or network calls inside apps
 *  - apps never import from each other
 *  - no `any` in app code
 */
const ROOT = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' || name === 'dist' ? [] : sourceFiles(path);
    return /\.(tsx?|jsx?)$/.test(name) ? [path] : [];
  });
}

const khataFiles = sourceFiles(join(ROOT, 'apps/khata/src'));
const read = (file: string) => readFileSync(file, 'utf8');
const offenders = (pattern: RegExp) => khataFiles.filter((f) => pattern.test(read(f))).map((f) => relative(ROOT, f));

describe('khata uses only @skeleton/core', () => {
  it('scans the app sources', () => {
    expect(khataFiles.length).toBeGreaterThan(20);
  });

  it.each([
    ['Dexie', /from\s+['"]dexie['"]/],
    ['i18next', /from\s+['"]i18next['"]/],
    ['react-i18next', /from\s+['"]react-i18next['"]/],
    ['direct IndexedDB', /\bindexedDB\b|\bIDBDatabase\b/],
    ['fetch()', /\bfetch\s*\(/],
    ['XMLHttpRequest', /\bXMLHttpRequest\b/],
    ['WebSocket', /\bWebSocket\b/],
    ['sendBeacon', /\bsendBeacon\b/],
    ['EventSource', /\bEventSource\b/],
  ])('does not use %s directly', (_name, pattern) => {
    expect(offenders(pattern)).toEqual([]);
  });

  it('never imports from another app', () => {
    expect(offenders(/clinic-queue/)).toEqual([]);
  });

  it('only reaches the skeleton through the @skeleton/core entry point', () => {
    expect(offenders(/from\s+['"][^'"]*packages\/skeleton/)).toEqual([]);
    expect(offenders(/from\s+['"]@skeleton\/core\/[^'"]+['"]/)).toEqual([]);
  });

  it('has no `any` types', () => {
    expect(offenders(/:\s*any\b|<any>|\bas\s+any\b|\bany\[\]/)).toEqual([]);
  });

  describe('no hard-coded English strings in screens: user-facing text comes from t(...)', () => {
    // Plain text between JSX tags. `(?<![=-])>` skips arrow functions (=>) so
    // TypeScript like `() => Promise<void>` is not mistaken for markup.
    const jsxText = /(?<![=-])>\s*([A-Za-z][A-Za-z ,.'!?]{2,}?)\s*</;

    it('the rule itself catches hard-coded text and ignores code', () => {
      expect(jsxText.test('<p>Hello there</p>')).toBe(true);
      expect(jsxText.test('<button type="button">Save</button>')).toBe(true);
      expect(jsxText.test('<p>{t("khata.common.save")}</p>')).toBe(false);
      expect(jsxText.test('async function run(action: () => Promise<void>) {}')).toBe(false);
      expect(jsxText.test('const [x, setX] = useState<Notice>(null);')).toBe(false);
    });

    it('finds none in the screens', () => {
      const screens = khataFiles.filter((f) => f.includes('screens') && f.endsWith('Screen.tsx'));
      const found = screens.filter((f) => jsxText.test(read(f))).map((f) => relative(ROOT, f));
      expect(found).toEqual([]);
    });
  });
});
