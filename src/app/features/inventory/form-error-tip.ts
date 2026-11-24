import { AbstractControl, FormGroup } from '@angular/forms';
import { TranslateService } from '@core';
import { hasSharedRuleError, validationTipKey } from '@shared/utils/validation-tip';

/** Value rules (length, range, pattern, custom) share the generic "invalid value" message. */
const VALUE_ERRORS = ['maxlength', 'minlength', 'min', 'max', 'pattern', 'exactLength', 'notZero', 'sameBin', 'dateOrder'];

/**
 * Text of the first error of a control: required, email, any value rule, or the 422 message of the API.
 * Always built from translation keys that exist in every language.
 */
export function formErrorTip(form: FormGroup, path: string, translate: TranslateService): string {
  const control: AbstractControl | null = form.get(path);
  if (!control?.errors) {
    return '';
  }
  if (control.hasError('required')) {
    return translate.instant('COMMON.VALIDATION.REQUIRED');
  }
  if (control.hasError('email')) {
    return translate.instant('COMMON.VALIDATION.INVALID_EMAIL');
  }
  if (hasSharedRuleError(control)) {
    return translate.instant(validationTipKey(control));
  }
  if (VALUE_ERRORS.some((key) => control.hasError(key))) {
    return translate.instant('COMMON.VALIDATION.INVALID_VALUE');
  }
  const server = control.errors['serverError'];
  return typeof server === 'string' ? server : '';
}
