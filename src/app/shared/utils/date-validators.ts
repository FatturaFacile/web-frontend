import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';

/** What a date control may hold: ISO string (date or date-time), Date (nz-date-picker) or empty. */
export type DateLike = string | Date | number | null | undefined;

/** Timestamp of a date-like value, or null when it is empty or not a valid date. */
export function toTimestamp(value: DateLike): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Calendar day (YYYY-MM-DD) of a date-like value: a Date by its local day, a string by its first 10 characters, so a
 * date-only field compares by day whatever the time of day the picker kept. Null when empty or invalid.
 */
export function toDayKey(value: DateLike): string | null {
  if (toTimestamp(value) === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  const date = new Date(value as Date | number);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Start of today (local time) as a timestamp. */
function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Mirrors `after_or_equal:<start>` (or `after:<start>` with `strict`): the control must not be before the control
 * `startKey` of the same group. Empty values pass. With `dateOnly` the calendar days are compared (use it for date-only
 * fields, e.g. an nz-date-picker without time). The error is `{ endsBeforeStart: true }`; show it with the key
 * COMMON.VALIDATION.END_AFTER_START. Pair it with `revalidateOnStartChange`, so a later change of the start updates it.
 */
export function endsNotBefore(startKey: string, options: { strict?: boolean; dateOnly?: boolean } = {}): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (options.dateOnly) {
      // date-only fields: compare the calendar days, ignoring the time of day a picker may keep
      const startDay = toDayKey(control.parent?.get(startKey)?.value as DateLike);
      const endDay = toDayKey(control.value as DateLike);
      if (startDay === null || endDay === null) {
        return null;
      }
      const validDay = options.strict ? endDay > startDay : endDay >= startDay;
      return validDay ? null : { endsBeforeStart: true };
    }
    const start = toTimestamp(control.parent?.get(startKey)?.value as DateLike);
    const end = toTimestamp(control.value as DateLike);
    if (start === null || end === null) {
      return null;
    }
    const valid = options.strict ? end > start : end >= start;
    return valid ? null : { endsBeforeStart: true };
  };
}

/** Mirrors `before_or_equal:today`: the date cannot be in the future. */
export const notInFuture: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const time = toTimestamp(control.value as DateLike);
  const tomorrow = startOfToday() + 24 * 3600 * 1000;
  return time === null || time < tomorrow ? null : { futureDate: true };
};

/** Mirrors `before:today`: the date must be strictly before today (for example a birth date). */
export const beforeToday: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const time = toTimestamp(control.value as DateLike);
  return time === null || time < startOfToday() ? null : { futureDate: true };
};

/** Mirrors `after_or_equal:today`: the date cannot be in the past (today is accepted). Error: { inPast: true }. */
export const notInPast: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const time = toTimestamp(control.value as DateLike);
  return time === null || time >= startOfToday() ? null : { inPast: true };
};

/** Mirrors `after:today` / `after:now` when the value has a time: the date must be after the present moment. */
export const inFuture: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const raw = control.value as DateLike;
  const time = toTimestamp(raw);
  if (time === null) {
    return null;
  }
  const hasTime = typeof raw === 'string' ? raw.length > 10 : true;
  return time > (hasTime ? Date.now() : startOfToday() + 24 * 3600 * 1000 - 1) ? null : { pastDate: true };
};

/** Mirrors `different:<other>`: the control must not equal the control `otherKey` of the same group. */
export function differentFrom(otherKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const other = control.parent?.get(otherKey)?.value;
    const value = control.value;
    if (value === null || value === undefined || value === '' || other === null || other === undefined || other === '') {
      return null;
    }
    return value === other ? { sameAsOther: true } : null;
  };
}

/**
 * Re-runs the validators of `endKey` every time `startKey` changes (call it in an injection context, after the group
 * is built), so `endsNotBefore` stays correct when the user edits the start after the end.
 */
export function revalidateOnStartChange(group: FormGroup, startKey: string, endKey: string, destroyRef: DestroyRef): void {
  group
    .get(startKey)
    ?.valueChanges.pipe(takeUntilDestroyed(destroyRef))
    .subscribe(() => group.get(endKey)?.updateValueAndValidity({ emitEvent: false }));
}
