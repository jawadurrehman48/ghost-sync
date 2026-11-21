import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import {
  ChoiceGroup,
  StatCard,
  collapseSpaces,
  createCsvBlob,
  csvDocument,
  csvField,
  csvLine,
  csvSafeText,
  downloadBlob,
  formatTime,
  isValidTimestamp,
  localHour,
  minutesBetween,
  nameKey,
  singleFlight,
  smsLink,
  toInternationalPk,
  useNow,
  useStoreSnapshot,
  whatsAppLink,
} from '@skeleton/core';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Minimal RFC 4180 parser written independently of the code under test. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

describe('csv helpers', () => {
  it('quotes only when needed and doubles inner quotes', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
  });

  it('neutralises spreadsheet formulas in user text', () => {
    for (const bad of ['=SUM(A1)', '+92300', '-5', '@cmd', '\tx']) expect(csvSafeText(bad)).toBe(`'${bad}`);
    expect(csvSafeText('Ali')).toBe('Ali');
  });

  it('csvLine accepts numbers, csvDocument writes blank lines for empty rows', () => {
    expect(csvLine(['A', 12, 'x,y'])).toBe('A,12,"x,y"');
    expect(csvDocument([['a'], [], ['b', 2]])).toBe('a\r\n\r\nb,2');
  });

  it('property: any table survives a round trip through csvDocument and a parser', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(fc.string({ maxLength: 15 }), { minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 8 }),
        (table) => {
          const rows = table.map((r) => (r.length === 1 && r[0] === '' ? ['x'] : r)); // a lone empty field is a blank line
          expect(parseCsv(csvDocument(rows))).toEqual(rows);
        },
      ),
    );
  });

  it('createCsvBlob starts with a UTF-8 BOM and is text/csv', async () => {
    const blob = createCsvBlob('نام,Ali');
    expect(blob.type).toContain('text/csv');
    const bytes = new Uint8Array(
      await new Promise<ArrayBuffer>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.readAsArrayBuffer(blob);
      }),
    );
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('downloadBlob clicks a temporary link and releases the URL, with no network', () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadBlob(new Blob(['a']), 'file.csv');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a[download]')).toBeNull();
    click.mockRestore();
  });
});

describe('share links', () => {
  it('converts Pakistani numbers to international form', () => {
    expect(toInternationalPk('03001234567')).toBe('923001234567');
    expect(toInternationalPk('0300-1234567')).toBe('923001234567');
    expect(toInternationalPk('۰۳۰۰۱۲۳۴۵۶۷')).toBe('923001234567');
    expect(toInternationalPk('923001234567')).toBe('923001234567');
  });

  it('builds wa.me and sms: links with the message encoded', () => {
    expect(whatsAppLink('0300-1234567', 'Token A-1 & go')).toBe('https://wa.me/923001234567?text=Token%20A-1%20%26%20go');
    expect(smsLink('0300 1234567', 'Hi #1')).toBe('sms:03001234567?body=Hi%20%231');
  });

  it('property: the message always decodes back exactly, in any language', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (message) => {
        const wa = new URL(whatsAppLink('03001234567', message));
        expect(wa.searchParams.get('text')).toBe(message);
        expect(decodeURIComponent(smsLink('03001234567', message).split('?body=')[1])).toBe(message);
      }),
    );
  });
});

describe('singleFlight', () => {
  it('overlapping calls share one run; a later call runs again', async () => {
    const key = {};
    let runs = 0;
    const task = () =>
      new Promise<number>((resolve) => {
        runs++;
        setTimeout(() => resolve(runs), 5);
      });
    const [a, b, c] = await Promise.all([singleFlight(key, task), singleFlight(key, task), singleFlight(key, task)]);
    expect(runs).toBe(1);
    expect([a, b, c]).toEqual([1, 1, 1]);
    expect(await singleFlight(key, task)).toBe(2);
  });

  it('different keys run independently, and a failure frees the key', async () => {
    const k1 = {};
    const k2 = {};
    let runs = 0;
    await Promise.all([singleFlight(k1, async () => runs++), singleFlight(k2, async () => runs++)]);
    expect(runs).toBe(2);
    await expect(singleFlight(k1, async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(await singleFlight(k1, async () => 'ok')).toBe('ok');
  });
});

describe('text helpers', () => {
  it('collapse spaces and compare names', () => {
    expect(collapseSpaces('  Muhammad    Ali \n Khan ')).toBe('Muhammad Ali Khan');
    expect(nameKey('  ALI   Raza ')).toBe(nameKey('ali raza'));
  });

  it('property: nameKey is idempotent', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(nameKey(nameKey(s))).toBe(nameKey(s));
      }),
    );
  });
});

describe('time helpers', () => {
  it('formats local clock time as HH:MM', () => {
    expect(formatTime(new Date(2026, 10, 7, 9, 5).toISOString())).toBe('09:05');
    expect(formatTime(new Date(2026, 10, 7, 23, 59).toISOString())).toBe('23:59');
    expect(formatTime('nonsense')).toBe('');
  });

  it('counts whole minutes, never negative, and 0 for bad input', () => {
    const t0 = new Date(2026, 0, 1, 10, 0, 0).toISOString();
    expect(minutesBetween(t0, new Date(2026, 0, 1, 10, 12, 59).toISOString())).toBe(12);
    expect(minutesBetween(t0, new Date(2026, 0, 1, 9, 0).toISOString())).toBe(0);
    expect(minutesBetween('bad', t0)).toBe(0);
  });

  it('localHour and isValidTimestamp', () => {
    expect(localHour(new Date(2026, 0, 1, 14, 30).toISOString())).toBe(14);
    expect(localHour('')).toBe(-1);
    expect(isValidTimestamp(new Date().toISOString())).toBe(true);
    for (const bad of ['', 'x', undefined, 5, null]) expect(isValidTimestamp(bad)).toBe(false);
  });

  it('property: minutesBetween equals the real difference in minutes', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000 }), fc.integer({ min: 0, max: 100_000 }), (start, minutes) => {
        const a = new Date(1_700_000_000_000 + start * 1000).toISOString();
        const b = new Date(Date.parse(a) + minutes * 60_000 + 30_000).toISOString();
        expect(minutesBetween(a, b)).toBe(minutes);
      }),
    );
  });
});

describe('useNow', () => {
  it('ticks on the given interval', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0, 0));
    const { result } = renderHook(() => useNow(1000));
    const first = result.current.getTime();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.getTime() - first).toBe(3000);
  });
});

describe('useStoreSnapshot polling', () => {
  it('reloads every pollMs and stops after unmount', async () => {
    vi.useFakeTimers();
    let value = 0;
    const load = vi.fn(async () => ++value);
    const { unmount } = renderHook(() => useStoreSnapshot(load, { pollMs: 1000 }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(4);
    unmount();
    vi.advanceTimersByTime(5000);
    expect(load).toHaveBeenCalledTimes(4);
  });

  it('does not poll without pollMs', async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => 1);
    renderHook(() => useStoreSnapshot(load));
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('StatCard', () => {
  it('shows the label and value, keeps numbers left-to-right, and colours by tone', () => {
    render(<StatCard label="Waiting" value={7} tone="warning" hint="patients" />);
    expect(screen.getByText('Waiting')).toBeTruthy();
    const value = screen.getByText('7');
    expect(value.getAttribute('dir')).toBe('ltr');
    expect(value.className).toContain('text-amber-700');
    expect(screen.getByText('patients')).toBeTruthy();
  });
});

describe('ChoiceGroup', () => {
  const options = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ];

  it('is a labelled radio group with 48px options', () => {
    render(<ChoiceGroup label="Gender" options={options} value={null} onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Gender' })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByText('Male').className).toContain('min-h-[48px]');
  });

  it('selects an option and marks only it as checked', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ChoiceGroup label="Gender" options={options} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Female'));
    expect(onChange).toHaveBeenCalledWith('female');
    rerender(<ChoiceGroup label="Gender" options={options} value="female" onChange={onChange} />);
    expect((screen.getByLabelText('Female') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Male') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText('Female').className).toContain('bg-brand-600');
  });

  it('can be cleared by tapping the selected option when allowDeselect is set', () => {
    const onChange = vi.fn();
    render(<ChoiceGroup label="Gender" options={options} value="male" onChange={onChange} allowDeselect />);
    fireEvent.click(screen.getByLabelText('Male'));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
