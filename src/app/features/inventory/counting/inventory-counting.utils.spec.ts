import { describe, expect, it } from 'vitest';
import { VarianceLine } from '@core';
import {
  currentStepIndex,
  decidableLevels,
  nullableNumber,
  recountableLines,
  stepStatus,
  toNumber,
} from './inventory-counting.utils';

describe('inventory counting utils', () => {
  it('parses decimals sent as strings and falls back to zero', () => {
    expect(toNumber('12.50')).toBe(12.5);
    expect(toNumber(3)).toBe(3);
    expect(toNumber(null)).toBe(0);
    expect(toNumber('abc')).toBe(0);
  });

  it('treats blank policy fields as null', () => {
    expect(nullableNumber('')).toBeNull();
    expect(nullableNumber(null)).toBeNull();
    expect(nullableNumber(0)).toBe(0);
    expect(nullableNumber('5')).toBe(5);
  });

  it('only allows deciding the first pending level once lower levels are approved', () => {
    expect([...decidableLevels([{ level: 1, status: 'pending' }, { level: 2, status: 'pending' }])]).toEqual([1]);
    expect([...decidableLevels([{ level: 1, status: 'approved' }, { level: 2, status: 'pending' }])]).toEqual([2]);
    expect(decidableLevels([{ level: 1, status: 'rejected' }, { level: 2, status: 'pending' }]).size).toBe(0);
    expect(decidableLevels([{ level: 1, status: 'approved' }]).size).toBe(0);
  });

  it('locates the current approval step and maps step status', () => {
    expect(currentStepIndex([{ status: 'approved' }, { status: 'pending' }])).toBe(1);
    expect(currentStepIndex([{ status: 'approved' }, { status: 'approved' }])).toBe(1);
    expect(currentStepIndex([])).toBe(0);
    expect(stepStatus('approved')).toBe('finish');
    expect(stepStatus('rejected')).toBe('error');
    expect(stepStatus('pending')).toBe('process');
    expect(stepStatus('cancelled')).toBe('wait');
  });

  it('keeps counted lines without a pending recount as recountable', () => {
    const lines = [
      { id: 'a', is_counted: true, recount_required: false },
      { id: 'b', is_counted: true, recount_required: true },
      { id: 'c', is_counted: false, recount_required: false },
    ] as VarianceLine[];
    expect(recountableLines(lines).map((l) => l.id)).toEqual(['a']);
  });
});
