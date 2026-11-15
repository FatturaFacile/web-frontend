import { NzMessageService } from 'ng-zorro-antd/message';
import { TranslateService } from '@core';
import { apiErrorText } from '../fleet/fleet.util';

export { apiErrorText, blankToNull, decimalOrNull, todayIso } from '../fleet/fleet.util';

/** Colours of the status and level tags. */
export const TALENT_TAG_COLORS: Readonly<Record<string, string>> = {
  low: 'green',
  medium: 'gold',
  high: 'orange',
  critical: 'red',
  draft: 'default',
  open: 'blue',
  closed: 'default',
  active: 'green',
  submitted: 'blue',
  approved: 'green',
  rejected: 'red',
  published: 'green',
  archived: 'default',
  enrolled: 'blue',
  in_progress: 'gold',
  completed: 'green',
  cancelled: 'default',
  compliant: 'green',
  overdue: 'red',
  expired: 'red',
  missing: 'orange',
  covered: 'green',
  at_risk: 'orange',
  uncovered: 'red',
  ready_now: 'green',
  ready_1_2_years: 'gold',
  ready_3_plus_years: 'orange',
};

/** Colour of a tag for a status value, with a neutral fallback. */
export function tagColor(value: string): string {
  return TALENT_TAG_COLORS[value] ?? 'default';
}

/** Upper-cases a value to build a translation key suffix, for example `ready_now` becomes `READY_NOW`. */
export function keyOf(value: string): string {
  return value.toUpperCase();
}

/**
 * Observer shared by the mutations of the screens: success message and follow-up on success,
 * the first API validation message (or a generic one) on failure.
 */
export function mutationObserver(message: NzMessageService, translate: TranslateService, onSuccess: () => void): { next: () => void; error: (error: unknown) => void } {
  return {
    next: () => {
      message.success(translate.instant('TALENT_LEARNING.SAVED'));
      onSuccess();
    },
    error: (error: unknown) => {
      message.error(apiErrorText(error) ?? translate.instant('TALENT_LEARNING.ACTION_ERROR'));
    },
  };
}
