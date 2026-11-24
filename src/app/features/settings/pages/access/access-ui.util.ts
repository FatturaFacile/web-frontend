import { HttpErrorResponse } from '@angular/common/http';
import { I18nService } from '@core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { reportHttpError } from '../../../hr/shared/hr-http.util';

/** Turns a code such as `fiscal_retail` into `Fiscal retail` when it has no translation. */
export function humanize(code: string): string {
  const text = code.replace(/[_.-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The translation, or the humanized code when the key has none (the service then returns the key itself). */
export function translatedOr(i18n: I18nService, key: string, code: string): string {
  const text = i18n.translate(key);
  return text === key ? humanize(code) : text;
}

export function moduleLabel(i18n: I18nService, module: string): string {
  return translatedOr(i18n, `memberAccess.module.${module}`, module);
}

export function systemRoleLabel(i18n: I18nService, role: string): string {
  return translatedOr(i18n, `adminAccess.roles.${role}`, role);
}

/**
 * Message of a failed call. A 409 carries the reason in plain words (plan limit reached, already a member, role in
 * use): title and detail of the problem are shown together so the person knows what to do next.
 */
export function accessErrorMessage(err: unknown, i18n: I18nService): string | null {
  if (!(err instanceof HttpErrorResponse) || err.status !== 409) {
    return null;
  }
  const body = err.error as { title?: string; detail?: string } | null;
  const parts = [body?.title, body?.detail].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(': ') : i18n.translate('access.errors.conflict');
}

export function reportAccessError(err: unknown, message: NzMessageService, i18n: I18nService): void {
  const text = accessErrorMessage(err, i18n);
  if (text !== null) {
    message.error(text);
    return;
  }
  reportHttpError(err, message, i18n);
}

/** Problem detail of a failed call, when the server gave one. */
export function problemDetail(err: unknown): string | null {
  if (!(err instanceof HttpErrorResponse)) {
    return null;
  }
  const body = err.error as { detail?: string; message?: string } | null;
  return body?.detail ?? body?.message ?? null;
}

const CUSTOM_PREFIX = 'custom:';

/** Value of a role select that lists system roles and custom roles: the role key, or `custom:<id>`. */
export function roleSelection(role: string, customRoleId?: string | null): string {
  return customRoleId ? `${CUSTOM_PREFIX}${customRoleId}` : role;
}

/** The part of an API payload that a role selection stands for (`custom_role_id` wins over `role` on the API). */
export function selectionPayload(selection: string): { role?: string; custom_role_id?: string } {
  return selection.startsWith(CUSTOM_PREFIX)
    ? { custom_role_id: selection.slice(CUSTOM_PREFIX.length) }
    : { role: selection };
}
