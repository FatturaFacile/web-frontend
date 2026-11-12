import { AbstractControl } from '@angular/forms';

/**
 * Translation key of the first error of a control, for the shared rules of date-validators, decimal-validators and
 * iban-validator. Returns an empty string when the control is valid. Keys live in COMMON.VALIDATION.*.
 */
export function validationTipKey(control: AbstractControl | null): string {
  if (!control?.errors) {
    return '';
  }
  const rules: [string, string][] = [
    ['required', 'COMMON.VALIDATION.REQUIRED'],
    ['email', 'COMMON.VALIDATION.INVALID_EMAIL'],
    ['endsBeforeStart', 'COMMON.VALIDATION.END_AFTER_START'],
    ['futureDate', 'COMMON.VALIDATION.DATE_NOT_IN_FUTURE'],
    ['inPast', 'COMMON.VALIDATION.DATE_NOT_IN_PAST'],
    ['pastDate', 'COMMON.VALIDATION.DATE_MUST_BE_FUTURE'],
    ['sameAsOther', 'COMMON.VALIDATION.MUST_DIFFER'],
    ['iban', 'COMMON.VALIDATION.INVALID_IBAN'],
    ['positive', 'COMMON.VALIDATION.MUST_BE_POSITIVE'],
    ['exceedsMax', 'COMMON.VALIDATION.EXCEEDS_LIMIT'],
    ['belowMin', 'COMMON.VALIDATION.BELOW_LIMIT'],
  ];
  const found = rules.find(([error]) => control.hasError(error));
  return found ? found[1] : 'COMMON.VALIDATION.INVALID_VALUE';
}

/** Errors raised by the shared validators (date, IBAN, limits), which have their own message. */
export const SHARED_RULE_ERRORS = ['endsBeforeStart', 'futureDate', 'pastDate', 'inPast', 'sameAsOther', 'iban', 'positive', 'exceedsMax', 'belowMin'];

/** True when the control failed one of the shared validators, so `validationTipKey` names the message to show. */
export function hasSharedRuleError(control: AbstractControl | null): boolean {
  return !!control && SHARED_RULE_ERRORS.some((error) => control.hasError(error));
}
