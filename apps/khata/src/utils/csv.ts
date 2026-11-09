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

/** Quote a field if it contains a comma, quote or line break; double inner quotes. */
function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Free text typed by a user (names, notes, phone). If it starts with =, +, -,
 * @, tab or CR, Excel/Sheets would run it as a formula, so a leading
 * apostrophe turns it back into plain text. Numbers are never passed through here.
 */
function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Whole rupees from paisa (integer division). */
function paisaToRs(paisa: number): number {
  return Math.trunc(paisa / 100);
}

/**
 * The CSV as text. Two sections: Customers (Name, Phone, Balance) and
 * Transactions (Customer, Date, Type, Amount, Note, Status). Amounts are plain
 * rupee numbers so they work in spreadsheet formulas. If `shopName` is given
 * it is written on the first line.
 */
export function buildCsvString(
  customers: CustomerCsvRow[],
  transactions: TransactionCsvRow[],
  shopName?: string,
): string {
  const line = (fields: string[]) => fields.map(csvEscape).join(',');
  const lines: string[] = [];

  if (shopName !== undefined) {
    lines.push(line(['Shop', safeText(shopName)]));
    lines.push('');
  }

  lines.push('Customers');
  lines.push(line(['Name', 'Phone', 'Balance (Rs)']));
  for (const c of customers) {
    lines.push(line([safeText(c.name), safeText(c.phone ?? ''), String(paisaToRs(c.balancePaisa))]));
  }

  lines.push('');

  lines.push('Transactions');
  lines.push(line(['Customer', 'Date', 'Type', 'Amount (Rs)', 'Note', 'Status']));
  for (const t of transactions) {
    lines.push(
      line([
        safeText(t.customerName),
        t.date,
        t.type === 'credit' ? 'Credit' : 'Payment',
        String(paisaToRs(t.amountPaisa)),
        safeText(t.note ?? ''),
        t.reversed ? 'Reversed' : 'Active',
      ]),
    );
  }

  return lines.join('\r\n');
}

/**
 * The CSV as a Blob, starting with a UTF-8 BOM so Excel shows Urdu text correctly.
 */
export function buildCsvBlob(
  customers: CustomerCsvRow[],
  transactions: TransactionCsvRow[],
  shopName?: string,
): Blob {
  return new Blob(['\uFEFF' + buildCsvString(customers, transactions, shopName)], {
    type: 'text/csv;charset=utf-8;',
  });
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

  const all = [
    ...data.creditGiven.map((r) => ({ r, type: 'credit' as const })),
    ...data.paymentReceived.map((r) => ({ r, type: 'payment' as const })),
  ].sort((a, b) =>
    a.r.payload.date !== b.r.payload.date
      ? a.r.payload.date < b.r.payload.date
        ? -1
        : 1
      : a.r.createdAt !== b.r.createdAt
        ? a.r.createdAt < b.r.createdAt
          ? -1
          : 1
        : a.r.id < b.r.id
          ? -1
          : 1,
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

/** Download a Blob as a file: temporary link, click, release the URL. Works offline. */
export function downloadCsvBlob(blob: Blob, filename: string = 'khata-export.csv'): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
