/** Default date helpers (ISO `YYYY-MM-DD`) for the ledger report filters. */
export function currentYearStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function currentYearEnd(): string {
  return `${new Date().getFullYear()}-12-31`;
}

/** Triggers the browser download of a blob returned by an export endpoint. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** Mirrors `after_or_equal:from` of the report requests: true when both ISO dates are set and `to` is before `from`. */
export function rangeEndsBeforeStart(from: string, to: string): boolean {
  return !!from && !!to && to < from;
}
