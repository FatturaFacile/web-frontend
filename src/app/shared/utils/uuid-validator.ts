import { AbstractControl, ValidationErrors } from '@angular/forms';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mirrors the Laravel `uuid` rule: a filled value must be a UUID. Empty values pass (add Validators.required if mandatory). */
export function uuidFormat(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return UUID_PATTERN.test(String(value)) ? null : { uuid: true };
}
