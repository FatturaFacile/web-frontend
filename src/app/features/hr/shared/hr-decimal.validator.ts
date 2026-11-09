import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Decimal string (up to 4 fraction digits): amounts travel as strings, never as numbers. */
export function decimalStringValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  return value === '' || /^\d+(\.\d{1,4})?$/.test(value) ? null : { decimal: true };
}
