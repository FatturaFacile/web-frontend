import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CurrencyApiService } from '@core/api/currency-api.service';
import { I18nService } from '@core/i18n/i18n.service';
import { ResolvedCurrencyRate } from '@core/models/currency-fx.model';
import { icons } from '../../../icons-provider';
import { DocumentCurrencyRateFieldComponent } from './document-currency-rate-field.component';

const settings = {
  functional_currency: 'CHF',
  active_currencies: ['CHF', 'EUR', 'USD'],
  alert_threshold_percent: '2.50',
  unrealized_gain_treatment: 'recognise',
  vat_rate_method: 'estv_monthly',
};

function resolvedRate(extra: Partial<ResolvedCurrencyRate> = {}): {
  success: boolean;
  message: string;
  data: ResolvedCurrencyRate;
} {
  return {
    success: true,
    message: 'ok',
    data: {
      base: 'EUR',
      quote: 'CHF',
      rate: '0.941200',
      rate_type: 'mid',
      source: 'ecb',
      valid_on: '2026-11-20',
      requested_date: '2026-11-20',
      is_derived: false,
      is_contract: false,
      is_fallback_date: false,
      rate_id: 'r-1',
      ...extra,
    },
  };
}

function missingRate(): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 422,
    error: {
      success: false,
      message: 'No exchange rate',
      code: 'exchange_rate_missing',
      errors: { exchange_rate: ['No exchange rate within 5 days'] },
    },
  });
}

describe('DocumentCurrencyRateFieldComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      getSettings: vi.fn(() => of({ success: true, message: 'ok', data: settings })),
      resolveRate: vi.fn(() => of(resolvedRate())),
      createRate: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: CurrencyApiService, useValue: api },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: I18nService, useValue: { translate: vi.fn((key: string) => key) } },
      ],
    });
  });

  async function render(
    inputs: Record<string, unknown> = { currency: 'EUR', documentDate: '2026-11-20' },
  ) {
    const fixture = TestBed.createComponent(DocumentCurrencyRateFieldComponent);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await settle(fixture);
    return {
      fixture,
      component: fixture.componentInstance,
      root: fixture.nativeElement as HTMLElement,
    };
  }

  async function settle(fixture: {
    detectChanges: () => void;
    whenStable: () => Promise<unknown>;
  }): Promise<void> {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
  }

  const rateInput = (root: HTMLElement) =>
    root.querySelector('input[nz-input]') as HTMLInputElement | null;

  it('resolves the rate of the document currency for the document date', async () => {
    const { component, root } = await render();

    expect(api['resolveRate']).toHaveBeenCalledWith({
      base: 'EUR',
      quote: 'CHF',
      date: '2026-11-20',
      rate_type: 'mid',
      contract_reference: null,
    });
    expect(component.rate()).toBe('0.941200');
    expect(rateInput(root)?.value).toBe('0.941200');
    expect(component.manual()).toBe(false);
    expect(root.querySelector('.fx-error')).toBeNull();
  });

  it('resolves again when the document date changes', async () => {
    const { fixture } = await render();

    fixture.componentRef.setInput('documentDate', '2026-11-25');
    await settle(fixture);

    expect(api['resolveRate']).toHaveBeenCalledTimes(2);
    expect(api['resolveRate']).toHaveBeenLastCalledWith(
      expect.objectContaining({ date: '2026-11-25' }),
    );
  });

  it('shows the contract badge when the rate is a contract rate', async () => {
    api['resolveRate'].mockReturnValue(
      of(resolvedRate({ is_contract: true, rate_type: 'contract' })),
    );
    const { root } = await render();

    expect(root.textContent).toContain('FINANCE.CURRENCIES.BADGE.CONTRACT');
  });

  it('does not show the contract badge for a market rate', async () => {
    const { root } = await render();

    expect(root.textContent).not.toContain('FINANCE.CURRENCIES.BADGE.CONTRACT');
  });

  it('hints that the rate is the one of an earlier date when no rate exists on the document date', async () => {
    api['resolveRate'].mockReturnValue(
      of(
        resolvedRate({
          is_fallback_date: true,
          valid_on: '2026-11-18',
          requested_date: '2026-11-20',
        }),
      ),
    );
    const { root } = await render();

    expect(root.textContent).toContain('FINANCE.CURRENCIES.HINT.FALLBACK_DATE');
  });

  it('does not show the hint when the rate is of the document date', async () => {
    const { root } = await render();

    expect(root.textContent).not.toContain('FINANCE.CURRENCIES.HINT.FALLBACK_DATE');
  });

  it('maps a 422 exchange_rate_missing to a field error and offers to enter a manual rate', async () => {
    api['resolveRate'].mockReturnValue(throwError(missingRate));
    const { component, root } = await render();

    expect(root.querySelector('.fx-error')?.textContent).toContain('ERRORS.EXCHANGE_RATE_MISSING');
    expect(rateInput(root)?.getAttribute('aria-invalid')).toBe('true');
    expect(component.rate()).toBeNull();
    const action = Array.from(root.querySelectorAll('button')).find((button) =>
      (button.textContent ?? '').includes('FINANCE.CURRENCIES.ACTION.ENTER_MANUAL_RATE'),
    );
    expect(action).toBeDefined();

    action?.click();

    expect(component['dialogOpen']()).toBe(true);
  });

  it('resolves again once the manual rate is saved', async () => {
    api['resolveRate']
      .mockReturnValueOnce(throwError(missingRate))
      .mockReturnValue(of(resolvedRate({ source: 'manual' })));
    const { fixture, component, root } = await render();
    expect(root.querySelector('.fx-error')).not.toBeNull();

    component['onManualSaved']({} as never);
    await settle(fixture);

    expect(api['resolveRate']).toHaveBeenCalledTimes(2);
    expect(component.rate()).toBe('0.941200');
    expect(root.querySelector('.fx-error')).toBeNull();
    expect(root.textContent).not.toContain('FINANCE.CURRENCIES.ACTION.ENTER_MANUAL_RATE');
  });

  it('keeps the rate 1.000000 and hides the rate field when the document is in the functional currency', async () => {
    const { component, root } = await render({ currency: 'CHF', documentDate: '2026-11-20' });

    expect(api['resolveRate']).not.toHaveBeenCalled();
    expect(component.rate()).toBe('1.000000');
    expect(rateInput(root)).toBeNull();
  });

  it('lets the user type a rate while the document is a draft and flags a wrong format', async () => {
    const { fixture, component, root } = await render();
    const input = rateInput(root) as HTMLInputElement;

    input.value = '0.9412345';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);

    expect(component.manual()).toBe(true);
    expect(component.rate()).toBe('0.9412345');
    expect(root.querySelector('.fx-error')?.textContent).toContain(
      'FINANCE.CURRENCIES.ERROR.RATE_FORMAT',
    );

    input.value = '0,9500';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);

    expect(component.rate()).toBe('0.9500');
    expect(root.querySelector('.fx-error')).toBeNull();
  });

  it('does not resolve nor accept typing when the document is not a draft any more', async () => {
    const { fixture, component, root } = await render({
      currency: 'EUR',
      documentDate: '2026-11-20',
      rate: '0.930000',
      readonly: true,
    });
    const input = rateInput(root) as HTMLInputElement;

    expect(api['resolveRate']).not.toHaveBeenCalled();
    expect(input.readOnly).toBe(true);
    input.value = '1.5';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);

    expect(component.rate()).toBe('0.930000');
    expect(component.manual()).toBe(false);
  });

  it('offers the active currencies of the tenant', async () => {
    const { component } = await render();

    expect(component['options']().map((option) => option.value)).toEqual(['CHF', 'EUR', 'USD']);
  });
});
