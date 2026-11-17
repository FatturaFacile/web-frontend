import { inject, Service } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { firstValueFrom, Observable } from 'rxjs';
import { I18nService } from '@core';
import { esmErrorCode, httpStatus } from '../utils/rma-status';

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; status: number | null; code: string | null; error: unknown };

/** Runs a single-shot request and folds its error into a result (status + ESM `code`). */
export async function runRequest<T>(request: Observable<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await firstValueFrom(request) };
  } catch (error) {
    return { ok: false, status: httpStatus(error), code: esmErrorCode(error), error };
  }
}

const KNOWN_ERROR_CODES = [
  'invalid_transition',
  'already_decided',
  'estimate_not_pending',
  'loaner_already_issued',
  'serial_not_found',
  'passport_missing',
];

/** i18n key for an ESM error code. */
export function esmErrorKey(code: string | null, fallback = 'RMA.ERRORS.CONFLICT'): string {
  return code && KNOWN_ERROR_CODES.includes(code) ? `RMA.ERRORS.${code.toUpperCase()}` : fallback;
}

/** Feature toasts with translated messages (409 codes are not toasted by the global interceptor). */
@Service()
export class RmaNotifier {
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  success(key: string, params?: Record<string, string | number>): void {
    this.message.success(this.i18n.translate(key, params));
  }

  conflict(code: string | null): void {
    this.message.warning(this.i18n.translate(esmErrorKey(code)));
  }
}
