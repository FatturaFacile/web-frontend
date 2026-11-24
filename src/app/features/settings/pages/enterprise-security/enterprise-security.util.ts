import { HttpErrorResponse } from '@angular/common/http';

/** First validation message of a Laravel 422 (or the detail or message of the response), so the user sees the real reason. */
export function enterpriseErrorText(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const body = error.error as { message?: unknown; detail?: unknown; errors?: Record<string, unknown> } | null;
  const first = Object.values(body?.errors ?? {})[0];
  if (Array.isArray(first) && typeof first[0] === 'string') {
    return first[0];
  }

  if (typeof body?.detail === 'string' && body.detail !== '') {
    return body.detail;
  }

  return typeof body?.message === 'string' && body.message !== '' ? body.message : null;
}

/** An empty text input is sent to the API as null. */
export function blankToNull(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
}

/** `group=role` lines of the role mapping textarea as the object of the API (`null` when empty). */
export function parseRoleMapping(text: string | null | undefined): Record<string, string> | null {
  const mapping: Record<string, string> = {};

  for (const line of (text ?? '').split('\n')) {
    const separator = line.indexOf('=');
    const key = separator > 0 ? line.slice(0, separator).trim() : '';
    const role = separator > 0 ? line.slice(separator + 1).trim() : '';
    if (key !== '' && role !== '') {
      mapping[key] = role;
    }
  }

  return Object.keys(mapping).length > 0 ? mapping : null;
}

/** The role mapping of the API as `group=role` lines for the textarea. */
export function formatRoleMapping(mapping: Record<string, string> | null | undefined): string {
  return Object.entries(mapping ?? {})
    .map(([key, role]) => `${key}=${role}`)
    .join('\n');
}

/** Text of the PEM certificates textarea: blocks separated by a blank line, empty text is no certificate. */
export function parseCertificates(text: string | null | undefined): string[] | null {
  const blocks = (text ?? '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block !== '');

  return blocks.length > 0 ? blocks : null;
}
