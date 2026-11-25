import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CcvCartLine, CcvPricing } from '@core';
import { baseProviders, enrollment, lookups, wrap } from './corporate-conventions.testing';
import { PosConventionWidgetComponent } from './pos-convention-widget.component';

const lines: CcvCartLine[] = [{ line_id: '1', quantity: 2, unit_price: 100 }];

const pricing: CcvPricing = {
  enrollment: enrollment('e-1'),
  lines: [
    {
      line_id: '1',
      gross: '200.00',
      existing_discount: '0.00',
      convention_discount: '30.00',
      net: '170.00',
      cost: '80.00',
      applied_rule_ids: ['r-1'],
    },
  ],
  totals: {
    total_gross_amount: '200.00',
    convention_discount_amount: '30.00',
    payable_after_discount: '170.00',
    employer_subsidy_amount: '34.00',
    employee_paid_amount: '136.00',
    cost_amount: '80.00',
  },
  cap: { remaining_before: '750.00', counted_spend: '170.00', reached: false },
  subsidy: { remaining_before: '180.00' },
};

describe('PosConventionWidgetComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let fixture: ComponentFixture<PosConventionWidgetComponent>;

  beforeEach(() => {
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      verifyIdentifier: vi.fn(() => of(wrap(enrollment('e-1')))),
      priceCart: vi.fn(() => of(wrap(pricing))),
      checkout: vi.fn(() => of(wrap({ ...pricing, split_billing: { id: 'sb-1' } }))),
      redeemVoucher: vi.fn(() =>
        of(
          wrap({
            id: 'w-1',
            provider: 'EDENRED',
            voucher_code_masked: '****1234',
            gross_voucher_amount: '10.00',
            currency: 'EUR',
          }),
        ),
      ),
    };
    TestBed.configureTestingModule({ providers: baseProviders(api) });
  });

  afterEach(() => {
    fixture?.destroy();
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((element) => (element.innerHTML = ''));
  });

  async function render(documentId: string | null = 'doc-1'): Promise<HTMLElement> {
    fixture = TestBed.createComponent(PosConventionWidgetComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('lines', lines);
    fixture.componentRef.setInput('currency', 'EUR');
    fixture.componentRef.setInput('documentId', documentId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return document.body;
  }

  async function verify(root: HTMLElement, identifier: string): Promise<void> {
    const input = root.querySelector<HTMLInputElement>('#ccv-pos-identifier');
    expect(input).not.toBeNull();
    (input as HTMLInputElement).value = identifier;
    (input as HTMLInputElement).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    (input as HTMLInputElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('identifies the customer by the pass and shows the remaining cap', async () => {
    const root = await render();

    await verify(root, 'FFCONV:0192f0f0-0000-7000-8000-000000000001');

    expect(api['verifyIdentifier']).toHaveBeenCalledWith({
      identifier: 'FFCONV:0192f0f0-0000-7000-8000-000000000001',
      convention_id: null,
    });
    expect(root.textContent).toContain('Mario Rossi');
    expect(root.textContent).toContain('corporateConventions.pos.capRemaining');
    expect(root.textContent).toContain('corporateConventions.beneficiaryType.PRIMARY_EMPLOYEE');
  });

  it('previews the split: total, convention discount, employer quota and employee payable', async () => {
    const root = await render();

    await verify(root, 'card');

    expect(api['priceCart']).toHaveBeenCalledWith({
      identifier: 'FFCONV:0192f0f0-0000-7000-8000-000000000001',
      convention_id: 'c-1',
      currency: 'EUR',
      lines,
    });
    const rows = Array.from(root.querySelectorAll('.split-table tr')).map(
      (row) => row.textContent ?? '',
    );
    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain('corporateConventions.pos.total');
    expect(rows[1]).toContain('corporateConventions.pos.conventionDiscount');
    expect(rows[2]).toContain('corporateConventions.pos.employerQuota');
    expect(rows[3]).toContain('corporateConventions.pos.employeePayable');
    expect(rows[3]).toContain('136');
  });

  it('commits the sale once and reports it to the host', async () => {
    const root = await render();
    const applied = vi.fn();
    fixture.componentInstance.applied.subscribe(applied);
    await verify(root, 'card');

    const button = Array.from(root.querySelectorAll('button')).find((candidate) =>
      (candidate.textContent ?? '').includes('corporateConventions.pos.apply'),
    );
    expect(button).toBeDefined();
    (button as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api['checkout']).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollment_id: 'e-1',
        source_document_type: 'POS_RECEIPT',
        source_document_id: 'doc-1',
        currency: 'EUR',
      }),
    );
    expect(applied).toHaveBeenCalledTimes(1);
    expect(root.textContent).toContain('corporateConventions.pos.applied');
  });

  it('cannot apply the convention before the sale has a document', async () => {
    const root = await render(null);

    await verify(root, 'card');

    const button = Array.from(root.querySelectorAll('button')).find((candidate) =>
      (candidate.textContent ?? '').includes('corporateConventions.pos.apply'),
    );
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers the providers of the jurisdiction of the currency with their default merchant fee', async () => {
    const root = await render();
    await verify(root, 'card');

    const component = fixture.componentInstance as unknown as {
      providers: () => { provider: string }[];
      onProvider: (provider: string) => void;
      feePercentage: () => number;
      categories: () => string[];
    };

    expect(component.providers().map((option) => option.provider)).toEqual(['EDENRED']);
    component.onProvider('EDENRED');
    expect(component.feePercentage()).toBe(8);
    expect(component.categories()).toEqual(['EDUCATION', 'HEALTHCARE', 'MEAL_VOUCHER']);
  });
});
