import { AbstractControl, ValidationErrors } from '@angular/forms';

export const STRENGTH_KEYS = [
  'AUTH.PASSWORD_STRENGTH_WEAK',
  'AUTH.PASSWORD_STRENGTH_WEAK',
  'AUTH.PASSWORD_STRENGTH_FAIR',
  'AUTH.PASSWORD_STRENGTH_GOOD',
  'AUTH.PASSWORD_STRENGTH_STRONG',
] as const;

export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const confirmation = group.get('password_confirmation');
  const mismatch = group.get('password')?.value !== confirmation?.value;
  const errors = { ...confirmation?.errors };

  if (mismatch && confirmation?.value) {
    errors['mismatch'] = true;
  } else {
    delete errors['mismatch'];
  }
  confirmation?.setErrors(Object.keys(errors).length ? errors : null);
  return null;
}

/** Indicative only: the backend applies the configured policy. 0 (empty) to 4 (strong). */
export function passwordStrength(password: string): number {
  if (!password) {
    return 0;
  }
  const checks = [
    password.length >= 10,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  return Math.max(1, checks.filter(Boolean).length);
}
