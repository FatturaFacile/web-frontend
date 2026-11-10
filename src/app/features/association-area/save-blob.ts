/** Triggers the browser download of a blob returned by the member area. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** Text of a free record field (the API does not describe the shape of receipts, documents and authorizations). */
export function recordText(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return value === null || value === undefined ? '' : String(value);
}
