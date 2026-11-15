import { describe, expect, it } from 'vitest';
import { InvoiceDetailResource } from '@core';
import {
  buildFiscalPayload,
  fiscalDefaults,
  fiscalPreferences,
  isPreviewable,
} from './invoice-fiscal.form';

describe('invoice fiscal form helpers', () => {
  const prefs = {
    regime_fiscale: 'RF01',
    default_fund: {
      type: 'TC22',
      percent: 4,
      vat_rate: 22,
      natura: null,
      withholding_applies: false,
    },
    default_withholding: {
      type: 'RT01',
      reason: 'A',
      rate: 20,
      taxable_percent: 100,
      includes_fund: false,
    },
    stamp_duty_charge_mode: 'issuer' as const,
    enasarco_enabled: true,
  };

  it('treats the empty `[]` preference group as no preferences', () => {
    expect(fiscalPreferences([])).toBeNull();
    expect(fiscalPreferences(undefined)).toBeNull();
    expect(fiscalPreferences(prefs)).toBe(prefs);
  });

  it('prefills cassa, ritenuta, ENASARCO and stamp payer from the tenant defaults', () => {
    const d = fiscalDefaults(prefs, null);
    expect(d.fund_enabled).toBe(true);
    expect(d.fund).toMatchObject({ type: 'TC22', percent: 4, vat_rate: 22 });
    expect(d.withholding_enabled).toBe(true);
    expect(d.withholding).toMatchObject({ type: 'RT01', reason: 'A', rate: 20 });
    expect(d.enasarco).toBe(true);
    expect(d.stamp_duty_charged_to_customer).toBe(false);
  });

  it('uses the fiscal data of a duplicated invoice over the tenant defaults', () => {
    const tpl = {
      fund: null,
      withholding: {
        type: 'RT02',
        reason: 'B',
        rate: '23.00',
        taxable_percent: '50.00',
        includes_fund: false,
        base: '500.00',
        amount: '115.00',
      },
      enasarco: null,
      split_payment: true,
      stamp_duty_charged_to_customer: true,
    } as unknown as InvoiceDetailResource;
    const d = fiscalDefaults(prefs, tpl);
    expect(d.fund_enabled).toBe(false);
    expect(d.withholding).toMatchObject({ type: 'RT02', rate: 23, taxable_percent: 50 });
    expect(d.enasarco).toBe(false);
    expect(d.split_payment).toBe(true);
    expect(d.stamp_duty_charged_to_customer).toBe(true);
  });

  it('sends explicit blocks, `null` for disabled ones and S payability for split payment', () => {
    const v = { ...fiscalDefaults(prefs, null), fund_enabled: false, split_payment: true };
    const p = buildFiscalPayload(v, { forfettario: false, hasContact: true });
    expect(p.fund).toBeNull();
    expect(p.withholding).toEqual({
      type: 'RT01',
      reason: 'A',
      rate: 20,
      taxable_percent: 100,
      includes_fund: false,
    });
    expect(p.enasarco).toEqual({ enabled: true });
    expect(p.split_payment).toBe(true);
    expect(p.vat_payability).toBe('S');
    expect(p.stamp_duty_charged_to_customer).toBe(false);
  });

  it('leaves ENASARCO out until a contact is selected', () => {
    const p = buildFiscalPayload(fiscalDefaults(prefs, null), {
      forfettario: false,
      hasContact: false,
    });
    expect(p.enasarco).toBeNull();
  });

  it('omits ritenuta, split payment and reverse charge for a forfettario tenant', () => {
    const v = { ...fiscalDefaults(prefs, null), split_payment: true, reverse_charge: true };
    const p = buildFiscalPayload(v, { forfettario: true, hasContact: true });
    expect('withholding' in p).toBe(false);
    expect('split_payment' in p).toBe(false);
    expect('reverse_charge' in p).toBe(false);
    expect('vat_payability' in p).toBe(false);
  });

  it('only previews lines the backend can price', () => {
    const line = {
      description: '',
      quantity: 1,
      unit_price: 100,
      tax_rate: 22,
      discount_percentage: 0,
      natura: null,
      withholding_applies: true,
      fund_applies: true,
    };
    expect(isPreviewable([line])).toBe(true);
    expect(isPreviewable([])).toBe(false);
    expect(isPreviewable([{ ...line, quantity: 0 }])).toBe(false);
    expect(isPreviewable([{ ...line, tax_rate: 101 }])).toBe(false);
  });
});
