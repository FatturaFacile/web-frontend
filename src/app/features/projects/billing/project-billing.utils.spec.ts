import { describe, expect, it } from 'vitest';
import {
  fromCents,
  modelSupports,
  previewSal,
  retainerBurnPercent,
  toCents,
  wipNature,
} from './project-billing.utils';

const BASE = {
  contractValue: '100000.00',
  cumulativePercent: 30,
  previousPercent: 0,
  previousCumulativeGross: '0',
  advanceTotal: '10000.00',
  advanceRecouped: '0',
  retentionPercent: '5',
};

describe('project billing utils', () => {
  it('converts amounts to whole cents without binary drift', () => {
    expect(toCents('19.99')).toBe(1999);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(null)).toBe(0);
    expect(fromCents(1999)).toBe('19.99');
  });

  it('previews the first SAL with proportional advance recoupment and retention', () => {
    const preview = previewSal(BASE);

    expect(preview).toEqual({
      cumulativeGross: '30000.00',
      currentGross: '30000.00',
      advanceDeduction: '3000.00',
      retentionWithheld: '1500.00',
      invoiceAmount: '27000.00',
      netBillable: '25500.00',
      isFinal: false,
    });
  });

  it('previews the incremental value of a later SAL against what the previous ones recouped', () => {
    const preview = previewSal({
      ...BASE,
      cumulativePercent: 60,
      previousPercent: 30,
      previousCumulativeGross: '30000.00',
      advanceRecouped: '3000.00',
    });

    expect(preview?.currentGross).toBe('30000.00');
    expect(preview?.advanceDeduction).toBe('3000.00');
    expect(preview?.netBillable).toBe('25500.00');
  });

  it('recoups the whole remaining advance on the final SAL', () => {
    const preview = previewSal({
      ...BASE,
      cumulativePercent: 100,
      previousPercent: 90,
      previousCumulativeGross: '90000.00',
      advanceRecouped: '8000.00',
    });

    expect(preview?.isFinal).toBe(true);
    expect(preview?.currentGross).toBe('10000.00');
    expect(preview?.advanceDeduction).toBe('2000.00');
  });

  it('never recoups more than the gross of the certificate', () => {
    const preview = previewSal({ ...BASE, advanceTotal: '50000.00', cumulativePercent: 10 });

    expect(preview?.advanceDeduction).toBe('5000.00');
    expect(Number(preview?.invoiceAmount)).toBeGreaterThanOrEqual(0);
  });

  it('applies the 0.50 percent statutory retention of Italian public contracts', () => {
    expect(previewSal({ ...BASE, retentionPercent: '0.5' })?.retentionWithheld).toBe('150.00');
  });

  it('refuses a progress that does not advance or exceeds 100 percent', () => {
    expect(previewSal({ ...BASE, cumulativePercent: 0 })).toBeNull();
    expect(previewSal({ ...BASE, cumulativePercent: 30, previousPercent: 30 })).toBeNull();
    expect(previewSal({ ...BASE, cumulativePercent: 101 })).toBeNull();
    expect(previewSal({ ...BASE, contractValue: 0 })).toBeNull();
  });

  it('tells a contract asset from a contract liability', () => {
    expect(wipNature('1500.00')).toBe('contract_asset');
    expect(wipNature('-200.00')).toBe('contract_liability');
    expect(wipNature('0.00')).toBe('balanced');
    expect(wipNature(null)).toBe('balanced');
  });

  it('turns the remaining retainer share into a burned share', () => {
    expect(retainerBurnPercent({ remaining_percent: '25.00' })).toBe(75);
    expect(retainerBurnPercent({ remaining_percent: '-5.00' })).toBe(100);
    expect(retainerBurnPercent(null)).toBe(0);
  });

  it('offers each billing step only to the models that use it', () => {
    expect(modelSupports('time_and_materials', 'time_and_materials')).toBe(true);
    expect(modelSupports('time_and_materials', 'progress')).toBe(false);
    expect(modelSupports('prepaid_retainer', 'retainer')).toBe(true);
    expect(modelSupports('fixed_milestone', 'milestones')).toBe(true);
    expect(modelSupports('hybrid', 'progress')).toBe(true);
    expect(modelSupports(null, 'milestones')).toBe(false);
  });
});
