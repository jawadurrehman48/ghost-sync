/** Trim and collapse runs of spaces or newlines to single spaces (names, shop or clinic names). */
export function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Lower-case, collapsed form used to compare names ("  ALI   Raza " equals "ali raza"). */
export function nameKey(value: string): string {
  return collapseSpaces(value).toLowerCase();
}
