import { HttpErrorResponse } from '@angular/common/http';
import { I18nService } from '@core';
import { NzMessageService } from 'ng-zorro-antd/message';

/** Saves a downloaded blob through a temporary anchor. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Server message of an RFC 7807 / Laravel error, if any. */
export function serverMessage(err: unknown): string | null {
  if (!(err instanceof HttpErrorResponse)) {
    return null;
  }
  const body = err.error as { detail?: string; message?: string } | null;
  return body?.detail ?? body?.message ?? null;
}

/**
 * Shows a toast for 403/409/422/other errors. Never logs the payload:
 * HR and payroll data are sensitive.
 */
export function reportHttpError(err: unknown, message: NzMessageService, i18n: I18nService): void {
  const status = err instanceof HttpErrorResponse ? err.status : 0;
  if (status === 403) {
    message.error(i18n.translate('hrmCommon.forbidden'));
  } else if (status === 409) {
    message.error(serverMessage(err) ?? i18n.translate('hrmCommon.conflict'));
  } else if (status === 422) {
    message.error(serverMessage(err) ?? i18n.translate('hrmCommon.loadFailed'));
  } else {
    message.error(i18n.translate('hrmCommon.loadFailed'));
  }
}
