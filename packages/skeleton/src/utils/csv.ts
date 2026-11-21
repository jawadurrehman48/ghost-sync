/**
 * CSV export helpers shared by every app. Works fully offline: the file is
 * built in memory and downloaded through a temporary object URL.
 */

/** Quote a field if it contains a comma, quote or line break; double inner quotes. */
export function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * For free text typed by a user (names, notes, phone numbers). If it starts
 * with =, +, -, @, tab or CR, Excel or Sheets would run it as a formula, so a
 * leading apostrophe turns it back into plain text. Never use it on numbers.
 */
export function csvSafeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** One CSV line from fields (each one escaped). */
export function csvLine(fields: Array<string | number>): string {
  return fields.map((f) => csvField(String(f))).join(',');
}

/** A whole CSV document: one line per row, CRLF line endings. An empty row gives a blank line. */
export function csvDocument(rows: Array<Array<string | number>>): string {
  return rows.map(csvLine).join('\r\n');
}

/** CSV text as a Blob, starting with a UTF-8 BOM so Excel shows Urdu text correctly. */
export function createCsvBlob(text: string): Blob {
  return new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' });
}

/** Download a Blob as a file: temporary link, click, release the URL. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
