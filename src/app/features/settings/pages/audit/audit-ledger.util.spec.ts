import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  actionKey,
  diffRows,
  failureOf,
  failureTitleKey,
  formatValue,
  integrityColor,
  isErasedActor,
  isoDay,
  windowIsTooLong,
} from './audit-ledger.util';

describe('audit ledger helpers', () => {
  it('classifies an HTTP failure without inventing data', () => {
    expect(failureOf(new HttpErrorResponse({ status: 403 }))).toBe('forbidden');
    expect(failureOf(new HttpErrorResponse({ status: 422 }))).toBe('invalid');
    expect(failureOf(new HttpErrorResponse({ status: 500 }))).toBe('generic');
    expect(failureOf(new Error('boom'))).toBe('generic');
    expect(failureTitleKey('forbidden')).toBe('settings.audit.error.forbidden');
    expect(failureTitleKey('generic')).toBe('settings.audit.error.title');
  });

  it('falls back to the unknown label for an action the dictionary does not know', () => {
    expect(actionKey('UPDATED', () => true)).toBe('audit.actions.UPDATED');
    expect(actionKey('SOMETHING_NEW', () => false)).toBe('audit.actions.unknown');
  });

  it('recognises the label of an erased subject', () => {
    expect(isErasedActor('[erased subject]')).toBe(true);
    expect(isErasedActor('Mario Rossi')).toBe(false);
    expect(isErasedActor(null)).toBe(false);
  });

  it('formats diff values as text, objects as JSON and nulls as a dash', () => {
    expect(formatValue(null)).toBe('—');
    expect(formatValue(undefined)).toBe('—');
    expect(formatValue('')).toBe('""');
    expect(formatValue('Lugano')).toBe('Lugano');
    expect(formatValue(12.5)).toBe('12.5');
    expect(formatValue(false)).toBe('false');
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
  });

  it('lists the changed fields alphabetically with their old and new value', () => {
    const rows = diffRows({
      name: { old: 'Before', new: 'After' },
      city: { old: null, new: 'Lugano' },
    });

    expect(rows).toEqual([
      { field: 'city', old: '—', new: 'Lugano' },
      { field: 'name', old: 'Before', new: 'After' },
    ]);
    expect(diffRows(null)).toEqual([]);
  });

  it('colours the integrity status: only a valid chain is green', () => {
    expect(integrityColor('valid')).toBe('success');
    expect(integrityColor('running')).toBe('processing');
    expect(integrityColor('never_verified')).toBe('default');
    expect(integrityColor('broken_at')).toBe('error');
    expect(integrityColor('missing_range')).toBe('error');
  });

  it('refuses a window longer than 366 days before calling the API', () => {
    expect(windowIsTooLong(new Date(2026, 0, 1), new Date(2026, 11, 31))).toBe(false);
    expect(windowIsTooLong(new Date(2025, 0, 1), new Date(2026, 11, 31))).toBe(true);
    expect(windowIsTooLong(null, new Date())).toBe(false);
  });

  it('formats a local date as the yyyy-MM-dd the API validates', () => {
    expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(isoDay(new Date(2026, 10, 26))).toBe('2026-11-26');
  });
});
