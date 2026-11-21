import { HttpErrorResponse } from '@angular/common/http';
import { ConsultantFormat } from '@core';

/**
 * Message of an error whose body was requested as a Blob (the file downloads): the server still answers an RFC 7807
 * JSON problem, which the browser hands over as a Blob, so it has to be read before it can be shown.
 */
export async function blobErrorMessage(err: unknown): Promise<string | null> {
  if (!(err instanceof HttpErrorResponse) || !(err.error instanceof Blob)) {
    return null;
  }

  try {
    const body = JSON.parse(await err.error.text()) as { detail?: string; message?: string } | null;

    return body?.detail ?? body?.message ?? null;
  } catch {
    return null;
  }
}

const EXTENSIONS: Record<ConsultantFormat, string> = {
  zucchetti: 'txt',
  teamsystem: 'txt',
  inaz: 'dat',
  gis: 'xml',
  generic_csv: 'csv',
};

/** The file name of the attendance export, like the one the API proposes (ZUCCHETTI_ACME_202703.txt). */
export function exportFilename(
  format: ConsultantFormat,
  companyCode: string,
  year: number,
  month: number,
): string {
  const prefix = format === 'generic_csv' ? 'LUL' : format.toUpperCase();

  return `${prefix}_${companyCode.toUpperCase()}_${year}${String(month).padStart(2, '0')}.${EXTENSIONS[format]}`;
}

/** YYYY-MM-DD of a date in the local calendar (toISOString would give the UTC day, a day off after midnight). */
export function localIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The default execution date of the salary file: tomorrow, as the API accepts today or later. */
export function defaultExecutionDate(now: Date = new Date()): string {
  return localIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
}

/** Spaces removed and upper case; an IBAN has a country, two check digits and 11 to 30 more characters. */
export function looksLikeIban(value: string): boolean {
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value.replace(/\s+/g, '').toUpperCase());
}
