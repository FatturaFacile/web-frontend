import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CurrencyExposureWidgetComponent } from './currency-exposure-widget.component';
import { baseProviders, exposure, settle, wrap } from './currency-fx.testing';

describe('CurrencyExposureWidgetComponent', () => {
  let api: { getExposure: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { getExposure: vi.fn(() => of(wrap(exposure()))) };
    TestBed.configureTestingModule({ providers: baseProviders(api) });
  });

  async function render(asOf?: string) {
    const fixture = TestBed.createComponent(CurrencyExposureWidgetComponent);
    if (asOf !== undefined) {
      fixture.componentRef.setInput('asOf', asOf);
    }
    await settle(fixture);
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('asks for the exposure of the given date', async () => {
    await render('2026-11-26');

    expect(api.getExposure).toHaveBeenCalledWith('2026-11-26');
  });

  it('asks for today when no date is given', async () => {
    await render();

    expect(api.getExposure).toHaveBeenCalledWith(undefined);
  });

  it('reloads when the date changes', async () => {
    const { fixture } = await render('2026-11-26');

    fixture.componentRef.setInput('asOf', '2026-10-31');
    await settle(fixture);

    expect(api.getExposure).toHaveBeenLastCalledWith('2026-10-31');
  });

  it('shows the positions, the historical and current value and the unrealised result of each currency', async () => {
    const { root } = await render('2026-11-26');

    const row = root.querySelector('tbody tr.ant-table-row')?.textContent ?? '';
    for (const text of [
      'EUR',
      '12000.00',
      '3000.00',
      '1000.00',
      '10000.00',
      '9400.00',
      '9500.00',
      '100.00',
      '0.950000',
    ]) {
      expect(row).toContain(text);
    }
    expect(root.querySelector('.rate-missing')).toBeNull();
  });

  it('shows the totals in the functional currency', async () => {
    const { root } = await render('2026-11-26');

    const totals = root.querySelector('.totals')?.textContent ?? '';
    expect(totals).toContain('9400.00 CHF');
    expect(totals).toContain('9500.00 CHF');
    expect(totals).toContain('100.00 CHF');
  });

  it('colours a gain green and a loss red', async () => {
    api.getExposure.mockReturnValue(
      of(
        wrap(
          exposure({
            totals: {
              historical_value: '100.00',
              current_value: '90.00',
              unrealized_gain_loss: '-10.00',
            },
          }),
        ),
      ),
    );
    const { root } = await render('2026-11-26');

    expect(root.querySelector('.totals strong.fx-loss')?.textContent).toContain('-10.00');
    expect(root.querySelector('tbody td.fx-gain')?.textContent).toContain('100.00');
  });

  it('warns when the closing rate of a currency is missing', async () => {
    api.getExposure.mockReturnValue(
      of(
        wrap(
          exposure({
            items: [
              { ...exposure().items[0], currency: 'USD', closing_rate: null, rate_missing: true },
            ],
          }),
        ),
      ),
    );
    const { root } = await render('2026-11-26');

    expect(root.querySelector('.rate-missing')?.textContent).toContain(
      'FINANCE.CURRENCIES.EXPOSURE.RATE_MISSING_WARNING',
    );
    expect(root.querySelector('.rate-missing-tag')?.textContent).toContain(
      'FINANCE.CURRENCIES.EXPOSURE.RATE_MISSING',
    );
  });

  it('shows an error when the exposure cannot be loaded', async () => {
    api.getExposure.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Boom' } })),
    );
    const { root } = await render('2026-11-26');

    expect(root.querySelector('.exposure-error')?.textContent).toContain(
      'FINANCE.CURRENCIES.ERROR.EXPOSURE_FAILED',
    );
  });
});
