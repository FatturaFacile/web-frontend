import { HttpErrorResponse } from '@angular/common/http';
import { inject, Pipe, PipeTransform } from '@angular/core';
import { I18nService } from '@core';

type Params = Record<string, string | number>;

function interpolate(text: string, params?: Params): string {
  if (!params) {
    return text;
  }
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    text,
  );
}

/**
 * Translates `key`; when the backend dictionary does not know it yet
 * (I18nService echoes the key back) the readable `fallback` is used instead.
 */
export function translateOr(i18n: I18nService, key: string, fallback: string, params?: Params): string {
  const text = i18n.translate(key, params);
  return text === key ? interpolate(fallback, params) : text;
}

@Pipe({ name: 'translateOr', pure: false })
export class TranslateOrPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string, fallback: string, params?: Params): string {
    return translateOr(this.i18n, key, fallback, params);
  }
}

/** Turns `snake_case` enum values into a readable fallback label ("site_visit" -> "Site visit"). */
export function humanize(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const text = value.replace(/[_-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function httpStatus(err: unknown): number | null {
  return err instanceof HttpErrorResponse ? err.status : null;
}

export function apiErrorMessage(err: unknown): string | null {
  if (err instanceof HttpErrorResponse) {
    const body: unknown = err.error;
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const msg = (body as { message: unknown }).message;
      return typeof msg === 'string' && msg ? msg : null;
    }
  }
  return null;
}
