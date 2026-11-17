import { describe, expect, it } from 'vitest';
import {
  computeImportVat,
  isPlausibleMrn,
  isTransitOverdue,
  normalizeMrn,
  orderedCounts,
  roundCents,
} from './trade-compliance.utils';

describe('trade-compliance utils', () => {
  it('computes the import VAT on value + duty + ancillary costs, rounded to cents', () => {
    expect(computeImportVat(1000, 50, 25, 8.1)).toBe(87.08); // 1075 * 8.1 / 100 = 87.075
    expect(computeImportVat(1000, 0, null, 0)).toBe(0);
    expect(computeImportVat(null, null, null, 8.1)).toBe(0);
    expect(computeImportVat(100, 0, 0, 7.7)).toBe(7.7);
  });

  it('rounds half away from zero without floating point drift', () => {
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(2.675)).toBe(2.68);
    expect(roundCents(-1.005)).toBe(-1.01);
  });

  it('accepts Union and Swiss MRN lengths and rejects the rest', () => {
    expect(isPlausibleMrn('25it00000000000001')).toBe(true);
    expect(isPlausibleMrn('25CH0000000000000A1B2')).toBe(true);
    expect(isPlausibleMrn('25IT0000000000001')).toBe(false);
    expect(isPlausibleMrn('25IT000000000000000000')).toBe(false);
    expect(isPlausibleMrn('25IT0000000000000-')).toBe(false);
    expect(normalizeMrn(' 25it 0000 ')).toBe('25IT0000');
  });

  it('flags only undischarged transits past their deadline', () => {
    const today = new Date('2026-11-17T10:00:00');
    expect(isTransitOverdue('2026-11-16', null, today)).toBe(true);
    expect(isTransitOverdue('2026-11-17', null, today)).toBe(false);
    expect(isTransitOverdue('2026-11-16', '2026-11-16T12:00:00Z', today)).toBe(false);
    expect(isTransitOverdue(null, null, today)).toBe(false);
  });

  it('orders dashboard counters and keeps unknown keys', () => {
    expect(orderedCounts({ export: 2, other: 1 }, ['import', 'export'])).toEqual([
      { key: 'import', count: 0 },
      { key: 'export', count: 2 },
      { key: 'other', count: 1 },
    ]);
    expect(orderedCounts(undefined, ['import'])).toEqual([{ key: 'import', count: 0 }]);
  });
});
