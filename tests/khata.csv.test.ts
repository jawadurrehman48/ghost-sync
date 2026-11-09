import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildCsvBlob, buildCsvString, collectExportRows } from '../apps/khata/src/utils/csv';
import type { CustomerCsvRow, TransactionCsvRow } from '../apps/khata/src/utils/csv';
import { deriveAll } from '../apps/khata/src/khata.reducers';
import { buildLedger, toData } from './khata.helpers';

/** Minimal RFC 4180 parser, written independently of the code under test. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
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

const customers: CustomerCsvRow[] = [
  { name: 'Ahmed Ali', phone: '03001234567', balancePaisa: 800000 },
  { name: 'Fatima Noor', balancePaisa: -200000 },
  { name: 'Sara, "Begum"', phone: '03331234567', balancePaisa: 0 },
];
const transactions: TransactionCsvRow[] = [
  { customerName: 'Ahmed Ali', date: '2026-10-15', type: 'credit', amountPaisa: 200000, note: 'Ration', reversed: false },
  { customerName: 'Ahmed Ali', date: '2026-10-10', type: 'payment', amountPaisa: 100050, reversed: false },
  { customerName: 'Fatima Noor', date: '2026-10-05', type: 'credit', amountPaisa: 50000, note: 'Wrong amount', reversed: true },
];

describe('CSV export (TR-8)', () => {
  const rows = parseCsv(buildCsvString(customers, transactions, 'Ahmed General Store'));

  it('writes the shop name first', () => {
    expect(rows[0]).toEqual(['Shop', 'Ahmed General Store']);
  });

  it('has the customer and transaction headers', () => {
    expect(rows).toContainEqual(['Name', 'Phone', 'Balance (Rs)']);
    expect(rows).toContainEqual(['Customer', 'Date', 'Type', 'Amount (Rs)', 'Note', 'Status']);
  });

  it('lists every customer with the balance in whole rupees (negative = advance)', () => {
    expect(rows).toContainEqual(['Ahmed Ali', '03001234567', '8000']);
    expect(rows).toContainEqual(['Fatima Noor', '', '-2000']);
    expect(rows).toContainEqual(['Sara, "Begum"', '03331234567', '0']);
  });

  it('lists every transaction with type, amount in rupees, note and status', () => {
    expect(rows).toContainEqual(['Ahmed Ali', '2026-10-15', 'Credit', '2000', 'Ration', 'Active']);
    expect(rows).toContainEqual(['Ahmed Ali', '2026-10-10', 'Payment', '1000', '', 'Active']);
  });

  it('labels reversed entries "Reversed"', () => {
    expect(rows).toContainEqual(['Fatima Noor', '2026-10-05', 'Credit', '500', 'Wrong amount', 'Reversed']);
  });

  it('omits the shop line when no shop name is given', () => {
    expect(buildCsvString(customers, transactions).startsWith('Customers')).toBe(true);
  });

  it('the file starts with a UTF-8 BOM so Excel shows Urdu text correctly', async () => {
    const blob = buildCsvBlob([{ name: 'فاطمہ نور', balancePaisa: 100 }], [], 'میری دکان');
    expect(blob.type).toContain('text/csv');
    const bytes = new Uint8Array(
      await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
      }),
    );
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('keeps Urdu text intact', () => {
    const parsed = parseCsv(buildCsvString([{ name: 'فاطمہ نور', balancePaisa: 0 }], []));
    expect(parsed).toContainEqual(['فاطمہ نور', '', '0']);
  });

  it('neutralises spreadsheet formulas in user text', () => {
    const parsed = parseCsv(
      buildCsvString([{ name: '=HYPERLINK("http://evil")', phone: '+923001234567', balancePaisa: 0 }], [
        { customerName: '@SUM(A1)', date: '2026-01-01', type: 'credit', amountPaisa: 100, note: '-cmd', reversed: false },
      ]),
    );
    expect(parsed).toContainEqual(['\'=HYPERLINK("http://evil")', "'+923001234567", '0']);
    expect(parsed).toContainEqual(["'@SUM(A1)", '2026-01-01', 'Credit', '1', "'-cmd", 'Active']);
  });

  it('property: any customer text survives quoting and parsing (commas, quotes, line breaks)', () => {
    const sanitize = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ maxLength: 20 }),
            note: fc.string({ maxLength: 20 }),
            amountPaisa: fc.integer({ min: 0, max: 1_000_000_000 }),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        (items) => {
          const parsed = parseCsv(
            buildCsvString(
              items.map((i) => ({ name: i.name, balancePaisa: i.amountPaisa })),
              items.map((i) => ({
                customerName: i.name,
                date: '2026-01-01',
                type: 'payment' as const,
                amountPaisa: i.amountPaisa,
                note: i.note,
                reversed: false,
              })),
            ),
          );
          const txStart = parsed.findIndex((r) => r[0] === 'Transactions') + 2;
          items.forEach((item, index) => {
            const row = parsed[txStart + index];
            expect(row[0]).toBe(sanitize(item.name));
            expect(row[4]).toBe(sanitize(item.note));
            expect(row[3]).toBe(String(Math.trunc(item.amountPaisa / 100)));
          });
        },
      ),
    );
  });

  it('collectExportRows lists every customer and every transaction from the store data', () => {
    const ledger = buildLedger(
      [
        { customer: 0, type: 'credit', amountPaisa: 150000, reversed: false, day: 1 },
        { customer: 1, type: 'payment', amountPaisa: 50000, reversed: true, day: 2 },
        { customer: 0, type: 'payment', amountPaisa: 25000, reversed: false, day: 3 },
      ],
      2,
    );
    const data = toData(ledger);
    const exported = collectExportRows(data, deriveAll(data, '2026-03-02'));

    expect(exported.customers).toEqual([
      { name: 'Customer 0', phone: undefined, balancePaisa: 125000 },
      { name: 'Customer 1', phone: undefined, balancePaisa: 0 },
    ]);
    expect(exported.transactions).toHaveLength(3);
    expect(exported.transactions.map((t) => t.date)).toEqual(['2026-03-02', '2026-03-03', '2026-03-04']);
    expect(exported.transactions.filter((t) => t.reversed)).toHaveLength(1);
  });
});
