import { TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nService, TaxPreviewResult } from '@core';
import { InvoiceTotalsBreakdownComponent } from './invoice-totals-breakdown.component';

const zero = '0.00';
function result(overrides: Partial<TaxPreviewResult> = {}, totals = {}): TaxPreviewResult {
  return {
    totals: {
      net: zero,
      fund: zero,
      taxable_vat: zero,
      vat: zero,
      stamp_duty: zero,
      gross: zero,
      withholding: zero,
      enasarco: zero,
      split_payment_vat: zero,
      due: zero,
      ...totals,
    },
    vat_summary: [],
    lines: [],
    fund: null,
    withholding: null,
    enasarco: null,
    stamp_duty: { applied: false, amount: zero, charged_to_customer: true, exempt_base: zero },
    split_payment: false,
    legal_notices: [],
    warnings: [],
    ...overrides,
  };
}

describe('InvoiceTotalsBreakdownComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InvoiceTotalsBreakdownComponent],
      providers: [
        { provide: LOCALE_ID, useValue: 'en-US' },
        { provide: I18nService, useValue: { translate: (k: string) => k } },
      ],
    });
  });

  function render(r: TaxPreviewResult | null, inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(InvoiceTotalsBreakdownComponent);
    fixture.componentRef.setInput('result', r);
    fixture.componentRef.setInput('currency', 'EUR');
    Object.entries(inputs).forEach(([k, v]) => fixture.componentRef.setInput(k, v));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = (id: string) =>
      el.querySelector(`[data-testid="${id}"]`)?.textContent?.trim() ?? null;
    return { el, text };
  }

  it('shows the professional breakdown (cassa + ritenuta) exactly as returned by the preview', () => {
    const { text, el } = render(
      result(
        {
          fund: {
            type: 'TC22',
            percent: '4.00',
            base: '1000.00',
            amount: '40.00',
            vat_rate: '22.00',
            natura: null,
            withholding_applies: false,
          },
          withholding: {
            type: 'RT01',
            reason: 'A',
            rate: '20.00',
            taxable_percent: '100.00',
            includes_fund: false,
            base: '1000.00',
            amount: '200.00',
          },
          vat_summary: [
            { rate: '22.00', natura: null, taxable: '1040.00', tax: '228.80', payability: 'I' },
          ],
        },
        {
          net: '1000.00',
          fund: '40.00',
          taxable_vat: '1040.00',
          vat: '228.80',
          gross: '1268.80',
          withholding: '200.00',
          due: '1068.80',
        },
      ),
    );
    expect(text('net')).toBe('€1,000.00');
    expect(text('fund')).toBe('€40.00');
    expect(text('taxable-vat')).toBe('€1,040.00');
    expect(text('vat')).toBe('€228.80');
    expect(text('gross')).toBe('€1,268.80');
    expect(text('withholding')).toContain('€200.00');
    expect(text('due')).toBe('€1,068.80');
    expect(el.querySelector('.vat-summary tbody tr')?.textContent).toContain('€228.80');
    expect(text('stamp-duty')).toBeNull();
    expect(text('enasarco')).toBeNull();
  });

  it('labels VAT as not collected under split payment and shows due = gross - VAT', () => {
    const { el, text } = render(
      result(
        { split_payment: true },
        {
          net: '1000.00',
          taxable_vat: '1000.00',
          vat: '220.00',
          gross: '1220.00',
          split_payment_vat: '220.00',
          due: '1000.00',
        },
      ),
    );
    expect(el.textContent).toContain('SALES.INVOICES.FISCAL.TOTALS.VAT_SPLIT');
    expect(text('split-vat')).toContain('€220.00');
    expect(text('due')).toBe('€1,000.00');
  });

  it('shows stamp duty and legal notices for exempt lines over the threshold', () => {
    const { el, text } = render(
      result(
        {
          stamp_duty: {
            applied: true,
            amount: '2.00',
            charged_to_customer: true,
            exempt_base: '100.00',
          },
          legal_notices: ['Esente art. 10 DPR 633/72'],
          warnings: ['Check the customer'],
        },
        { net: '100.00', stamp_duty: '2.00', gross: '102.00', due: '102.00' },
      ),
    );
    expect(text('stamp-duty')).toBe('€2.00');
    expect(text('legal-notices')).toContain('Esente art. 10 DPR 633/72');
    expect(el.textContent).toContain('Check the customer');
  });

  it('keeps the last result visible with a warning when the newer preview failed', () => {
    const { el, text } = render(result({}, { net: '50.00', due: '50.00' }), {
      error: 'Preview failed',
      loading: true,
    });
    expect(el.textContent).toContain('Preview failed');
    expect(text('due')).toBe('€50.00');
    expect(el.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
  });

  it('shows a placeholder until the first preview', () => {
    const { el } = render(null);
    expect(el.textContent).toContain('SALES.INVOICES.FISCAL.NO_PREVIEW');
  });
});
