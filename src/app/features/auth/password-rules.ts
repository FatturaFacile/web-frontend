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

/** Mirrors the backend defaults (`auth.registration.password`): 10+ characters, upper and lower case, a number and a symbol. */
export const PASSWORD_MIN_LENGTH = 10;

export function passwordPolicy(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (typeof value !== 'string' || value === '') {
    return null;
  }
  const failed = {
    minlength: value.length < PASSWORD_MIN_LENGTH,
    mixedCase: !(/\p{Ll}/u.test(value) && /\p{Lu}/u.test(value)),
    number: !/\p{N}/u.test(value),
    symbol: !/[^\p{L}\p{N}\s]/u.test(value),
  };
  const errors = Object.fromEntries(Object.entries(failed).filter(([, bad]) => bad));
  return Object.keys(errors).length ? { passwordPolicy: errors } : null;
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
