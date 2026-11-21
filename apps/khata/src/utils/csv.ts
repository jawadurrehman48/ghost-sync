import { createCsvBlob, csvDocument, csvSafeText, downloadBlob } from '@skeleton/core';
import type { KhataData, KhataDerived } from '../khata.types';

export interface CustomerCsvRow {
  name: string;
  phone?: string;
  balancePaisa: number;
}

export interface TransactionCsvRow {
  customerName: string;
  date: string;
  type: 'credit' | 'payment';
  amountPaisa: number;
  note?: string;
  reversed: boolean;
}

/** Whole rupees from paisa (integer division). */
function paisaToRs(paisa: number): number {
  return Math.trunc(paisa / 100);
}

/**
 * The CSV as text. Two sections: Customers (Name, Phone, Balance) and
 * Transactions (Customer, Date, Type, Amount, Note, Status). Amounts are plain
 * rupee numbers so they work in spreadsheet formulas. If `shopName` is given
 * it is written on the first line. Escaping and formula protection come from
 * the skeleton's CSV helpers.
 */
export function buildCsvString(
  customers: CustomerCsvRow[],
  transactions: TransactionCsvRow[],
  shopName?: string,
): string {
  const rows: Array<Array<string | number>> = [];

  if (shopName !== undefined) rows.push(['Shop', csvSafeText(shopName)], []);

  rows.push(['Customers'], ['Name', 'Phone', 'Balance (Rs)']);
  for (const c of customers) {
    rows.push([csvSafeText(c.name), csvSafeText(c.phone ?? ''), String(paisaToRs(c.balancePaisa))]);
  }

  rows.push([], ['Transactions'], ['Customer', 'Date', 'Type', 'Amount (Rs)', 'Note', 'Status']);
  for (const t of transactions) {
    rows.push([
      csvSafeText(t.customerName),
      t.date,
      t.type === 'credit' ? 'Credit' : 'Payment',
      String(paisaToRs(t.amountPaisa)),
      csvSafeText(t.note ?? ''),
      t.reversed ? 'Reversed' : 'Active',
    ]);
  }

  return csvDocument(rows);
}

/** The CSV as a Blob, starting with a UTF-8 BOM so Excel shows Urdu text correctly. */
export function buildCsvBlob(
  customers: CustomerCsvRow[],
  transactions: TransactionCsvRow[],
  shopName?: string,
): Blob {
  return createCsvBlob(buildCsvString(customers, transactions, shopName));
}

/** Rows for the export, built from a snapshot of the store. */
export function collectExportRows(
  data: KhataData,
  derived: KhataDerived,
): { customers: CustomerCsvRow[]; transactions: TransactionCsvRow[] } {
  const names = new Map(derived.customers.map((c) => [c.id, c.name]));
  const reversed = new Set(data.entryReversed.map((r) => r.payload.entryId));

  const customers = derived.customers.map((c) => ({
    name: c.name,
    phone: c.phone,
    balancePaisa: derived.balances.get(c.id) ?? 0,
  }));

  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const all = [
    ...data.creditGiven.map((r) => ({ r, type: 'credit' as const })),
    ...data.paymentReceived.map((r) => ({ r, type: 'payment' as const })),
  ].sort(
    (a, b) =>
      compare(a.r.payload.date, b.r.payload.date) || compare(a.r.createdAt, b.r.createdAt) || compare(a.r.id, b.r.id),
  );

  const transactions = all.map(({ r, type }) => ({
    customerName: names.get(r.payload.customerId) ?? r.payload.customerId,
    date: r.payload.date,
    type,
    amountPaisa: r.payload.amountPaisa,
    note: r.payload.note,
    reversed: reversed.has(r.id),
  }));

  return { customers, transactions };
}

/** Download the CSV file. Works offline. */
export function downloadCsvBlob(blob: Blob, filename: string = 'khata-export.csv'): void {
  downloadBlob(blob, filename);
}
