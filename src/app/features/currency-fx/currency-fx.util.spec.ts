import { describe, expect, it } from 'vitest';
import { isValidRate, normalizeRate } from '@shared';
import { rate } from './currency-fx.testing';
import {
  isSyncActive,
  previousMonthEnd,
  revaluationResultColor,
  revaluationStatusColor,
  signClass,
  sparklinePath,
  syncStatusColor,
  trendPoints,
} from './currency-fx.util';

describe('currency fx util', () => {
  describe('rates', () => {
    it('accepts positive decimals with at most six places and keeps them as strings', () => {
      expect(isValidRate('0.941200')).toBe(true);
      expect(isValidRate('1')).toBe(true);
      expect(isValidRate('0.9412345')).toBe(false);
      expect(isValidRate('0')).toBe(false);
      expect(isValidRate('0.000000')).toBe(false);
      expect(isValidRate('-1')).toBe(false);
      expect(isValidRate('')).toBe(false);
      expect(normalizeRate(' 0,9412 ')).toBe('0.9412');
    });
  });

  describe('colours', () => {
    it('maps the synchronisation statuses', () => {
      expect(syncStatusColor('succeeded')).toBe('success');
      expect(syncStatusColor('failed')).toBe('error');
      expect(syncStatusColor('running')).toBe('processing');
      expect(syncStatusColor('queued')).toBe('default');
      expect(isSyncActive('queued')).toBe(true);
      expect(isSyncActive('running')).toBe(true);
      expect(isSyncActive('succeeded')).toBe(false);
      expect(isSyncActive('failed')).toBe(false);
    });

    it('maps the revaluation statuses and results', () => {
      expect(revaluationStatusColor('posted')).toBe('success');
      expect(revaluationStatusColor('reversed')).toBe('warning');
      expect(revaluationResultColor('gain')).toBe('success');
      expect(revaluationResultColor('loss')).toBe('error');
    });

    it('classes a signed decimal as gain, loss or nothing', () => {
      expect(signClass('10.00')).toBe('fx-gain');
      expect(signClass('-0.01')).toBe('fx-loss');
      expect(signClass('0.00')).toBe('');
      expect(signClass('-0.00')).toBe('');
      expect(signClass(null)).toBe('');
    });
  });

  describe('trend', () => {
    it('orders the points by date, skips superseded rates and keeps the last rate of a day', () => {
      const points = trendPoints([
        rate('1', { valid_on: '2026-11-20', rate: '0.94' }),
        rate('2', { valid_on: '2026-11-18', rate: '0.93' }),
        rate('3', { valid_on: '2026-11-19', rate: '0.99', superseded_by: '9' }),
        rate('4', { valid_on: '2026-11-20', rate: '0.95' }),
      ]);

      expect(points).toEqual([
        { date: '2026-11-18', rate: '0.93' },
        { date: '2026-11-20', rate: '0.95' },
      ]);
    });

    it('draws the lowest rate at the bottom and the highest at the top', () => {
      const path = sparklinePath(
        [
          { date: '2026-11-18', rate: '0.90' },
          { date: '2026-11-19', rate: '1.00' },
        ],
        100,
        50,
      );

      expect(path).toBe('4.0,46.0 96.0,4.0');
    });

    it('draws a flat line in the middle and nothing without points', () => {
      expect(
        sparklinePath(
          [
            { date: '2026-11-18', rate: '1.00' },
            { date: '2026-11-19', rate: '1.00' },
          ],
          100,
          50,
        ),
      ).toBe('4.0,25.0 96.0,25.0');
      expect(sparklinePath([], 100, 50)).toBe('');
    });
  });

  describe('dates', () => {
    it('is the last day of the previous month', () => {
      expect(previousMonthEnd(new Date(2026, 10, 26))).toBe('2026-10-31');
      expect(previousMonthEnd(new Date(2028, 2, 1))).toBe('2028-02-29');
      expect(previousMonthEnd(new Date(2026, 0, 15))).toBe('2025-12-31');
    });
  });
});
