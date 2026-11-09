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

/**
 * Escape a CSV field value. Wraps in double quotes if the value contains
 * commas, double quotes, or newlines. Escapes internal double quotes as "".
 */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Convert paisa to rupees as a plain number (integer division). */
function paisaToRs(paisa: number): number {
  return Math.floor(paisa / 100);
}

/**
 * Build a CSV Blob containing all customers and transactions for backup/export.
 *
 * The Blob starts with a UTF-8 BOM (\uFEFF) so Excel correctly renders Urdu text.
 * Two sections: Customers (Name, Phone, Balance) and Transactions (Customer,
 * Date, Type, Amount, Note, Status).
 *
 * Amounts are in rupees as plain numbers (not "Rs X,XXX") so they work
 * in Excel formulas.
 */
export function buildCsvBlob(
  customers: CustomerCsvRow[],
  transactions: TransactionCsvRow[],
): Blob {
  const lines: string[] = [];

  // --- Customers section ---
  lines.push('Customers');
  lines.push(['Name', 'Phone', 'Balance (Rs)'].map(csvEscape).join(','));
  for (const c of customers) {
    lines.push(
      [c.name, c.phone ?? '', String(paisaToRs(c.balancePaisa))]
        .map(csvEscape)
        .join(','),
    );
  }

  // Blank line between sections
  lines.push('');

  // --- Transactions section ---
  lines.push('Transactions');
  lines.push(
    ['Customer', 'Date', 'Type', 'Amount (Rs)', 'Note', 'Status']
      .map(csvEscape)
      .join(','),
  );
  for (const t of transactions) {
    lines.push(
      [
        t.customerName,
        t.date,
        t.type === 'credit' ? 'Credit' : 'Payment',
        String(paisaToRs(t.amountPaisa)),
        t.note ?? '',
        t.reversed ? 'Reversed' : 'Active',
      ]
        .map(csvEscape)
        .join(','),
    );
  }

  // Prepend UTF-8 BOM for Excel Urdu text compatibility
  const csv = '\uFEFF' + lines.join('\r\n');

  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Trigger a download of the CSV blob in the browser.
 * Creates a temporary <a> element, clicks it, and revokes the URL.
 */
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
