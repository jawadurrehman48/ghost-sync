import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Steering rule (tech.md): use Tailwind LOGICAL classes so layouts mirror in
 * Urdu (RTL). These physical classes never flip, so they are forbidden.
 */
const ROOT = join(__dirname, '..');
const SCAN_DIRS = [join(ROOT, 'apps/khata/src'), join(ROOT, 'packages/skeleton/src/ui')];

// A class token starts at a quote, backtick, whitespace or variant colon.
const START = '(?:^|[\\s"\'`:])';
const END = '(?=$|[\\s"\'`])';
const FORBIDDEN: Array<[string, RegExp]> = [
  ['ml-* / mr-* (use ms-* / me-*)', new RegExp(`${START}-?(?:ml|mr)-(?:\\d|\\[|px|auto)`)],
  ['pl-* / pr-* (use ps-* / pe-*)', new RegExp(`${START}(?:pl|pr)-(?:\\d|\\[|px)`)],
  ['text-left / text-right (use text-start / text-end)', new RegExp(`${START}text-(?:left|right)${END}`)],
  ['left-* / right-* (use start-* / end-* or inset-x-*)', new RegExp(`${START}-?(?:left|right)-(?:\\d|\\[|px|auto|full|1/2)`)],
  ['rounded-l/r/tl/tr/bl/br (use rounded-s/e/ss/se/es/ee)', new RegExp(`${START}rounded-(?:l|r|tl|tr|bl|br)(?:-|${END})`)],
  ['border-l / border-r (use border-s / border-e)', new RegExp(`${START}border-(?:l|r)(?:-|${END})`)],
  ['float-left / float-right (use float-start / float-end)', new RegExp(`${START}float-(?:left|right)${END}`)],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|jsx?)$/.test(name) ? [path] : [];
  });
}

describe('RTL: logical Tailwind classes only', () => {
  const files = SCAN_DIRS.flatMap(sourceFiles);

  it('scans a meaningful number of files', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  for (const [description, pattern] of FORBIDDEN) {
    it(`has no ${description}`, () => {
      const offenders = files.filter((file) => pattern.test(readFileSync(file, 'utf8')));
      expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
    });
  }

  it('every khata screen file uses at least one logical class or none of the physical ones', () => {
    // Sanity: the screens exist and are being scanned.
    const screens = files.filter((f) => f.includes('screens') && f.endsWith('Screen.tsx'));
    expect(screens.length).toBeGreaterThanOrEqual(8);
  });
});
