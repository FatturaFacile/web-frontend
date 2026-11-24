import { describe, expect, it } from 'vitest';
import {
  calculateCompetencePreview,
  inclusiveCalendarDays,
  isValidCompetencePair,
  presetFullCalendarYear,
  presetTwelveMonths,
} from './competence-calculator.util';

describe('competence calculator util', () => {
  it('counts inclusive calendar days across standard and leap years', () => {
    expect(inclusiveCalendarDays('2026-01-01', '2026-12-31')).toBe(365);
    expect(inclusiveCalendarDays('2028-01-01', '2028-12-31')).toBe(366);
    expect(inclusiveCalendarDays('2026-05-10', '2026-05-10')).toBe(1);
    expect(inclusiveCalendarDays('2026-05-11', '2026-05-10')).toBe(0);
  });

  it('validates competence date pairs accurately', () => {
    expect(isValidCompetencePair(null, null)).toBe('empty');
    expect(isValidCompetencePair('2026-01-01', null)).toBe('incomplete');
    expect(isValidCompetencePair(null, '2026-12-31')).toBe('incomplete');
    expect(isValidCompetencePair('2026-12-31', '2026-01-01')).toBe('inverted');
    expect(isValidCompetencePair('2026-01-01', '2026-12-31')).toBe('valid');
  });

  it('computes penny-accurate 12-month prepaid expense deferral', () => {
    const res = calculateCompetencePreview({
      totalAmount: 1200,
      startDate: '2026-10-01',
      endDate: '2027-09-30',
      documentDate: '2026-10-01',
      direction: 'cost',
    });

    expect(res).not.toBeNull();
    expect(res!.accrualType).toBe('prepaid_expense');
    expect(res!.totalDays).toBe(365);
    expect(res!.periodDays).toBe(92);
    expect(res!.transitoryDays).toBe(273);
    expect(res!.recognizedAmount).toBe(302.47);
    expect(res!.transitoryAmount).toBe(897.53);
    expect(res!.cutoffDate).toBe('2026-12-31');
    expect(res!.reversalDate).toBe('2027-01-01');
  });

  it('apportions multi-year licenses across leap year 2028 without penny loss', () => {
    const res = calculateCompetencePreview({
      totalAmount: 1000,
      startDate: '2026-07-01',
      endDate: '2029-06-30',
      documentDate: '2026-07-01',
      direction: 'revenue',
    });

    expect(res).not.toBeNull();
    expect(res!.accrualType).toBe('deferred_revenue');
    expect(res!.totalDays).toBe(1096);
    expect(res!.yearlySchedule).toHaveLength(4);
    const totalCents = res!.yearlySchedule.reduce(
      (sum, slice) => sum + Math.round(Number(slice.amount) * 100),
      0,
    );
    expect(totalCents).toBe(100000);
  });

  it('classifies rateo attivo and rateo passivo when document date is in next year', () => {
    const rateoAttivo = calculateCompetencePreview({
      totalAmount: 365,
      startDate: '2026-07-01',
      endDate: '2027-06-30',
      documentDate: '2027-07-01',
      direction: 'revenue',
    });
    const rateoPassivo = calculateCompetencePreview({
      totalAmount: 365,
      startDate: '2026-07-01',
      endDate: '2027-06-30',
      documentDate: '2027-07-01',
      direction: 'cost',
    });

    expect(rateoAttivo!.accrualType).toBe('accrued_revenue');
    expect(rateoAttivo!.transitoryAmount).toBe(184);
    expect(rateoPassivo!.accrualType).toBe('accrued_expense');
    expect(rateoPassivo!.transitoryAmount).toBe(184);
  });

  it('builds calendar year and 12-month presets cleanly', () => {
    expect(presetFullCalendarYear('2026-05-10')).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
    expect(presetTwelveMonths('2026-10-01')).toEqual({
      start: '2026-10-01',
      end: '2027-09-30',
    });
  });
});
