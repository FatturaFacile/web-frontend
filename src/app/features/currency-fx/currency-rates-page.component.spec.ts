import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseProviders, page, rate, settle, wrap } from './currency-fx.testing';
import { CurrencyRatesPageComponent } from './currency-rates-page.component';

describe('CurrencyRatesPageComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      listRates: vi.fn(() =>
        of(
          page([
            rate('1', { valid_on: '2026-11-19' }),
            rate('2', {
              valid_on: '2026-11-20',
              rate_type: 'contract',
              is_contract: true,
              source: 'manual',
              tenant_id: 't-1',
              reason: 'Annual supply contract',
              contract_reference: 'CTR-7',
            }),
            rate('3', { base: 'USD', is_derived: true, valid_on: '2026-11-20' }),
          ]),
        ),
      ),
      exportRates: vi.fn(() => of(new Blob(['id,rate']))),
      listSyncRuns: vi.fn(() => of(page([]))),
      getExposure: vi.fn(),
      getSettings: vi.fn(),
      createRate: vi.fn(() => of(wrap(rate('9')))),
    };
    TestBed.configureTestingModule({ providers: baseProviders(api) });
  });

  afterEach(() => vi.restoreAllMocks());

  async function render() {
    const fixture = TestBed.createComponent(CurrencyRatesPageComponent);
    await settle(fixture);
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  function rowOf(root: HTMLElement, text: string): Element | undefined {
    return Array.from(root.querySelectorAll('tbody tr.ant-table-row')).find((row) =>
      (row.textContent ?? '').includes(text),
    );
  }

  function type(root: HTMLElement, selector: string, value: string): void {
    const input = root.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('change'));
  }

  it('lists the rates of the first page with pair, rate, type, source and date', async () => {
    const { root } = await render();

    expect(api['listRates']).toHaveBeenCalledWith({ per_page: 25, page: 1 });
    expect(root.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(3);
    const first = rowOf(root, '2026-11-19')?.textContent ?? '';
    expect(first).toContain('EUR/CHF');
    expect(first).toContain('0.941200');
    expect(first).toContain('FINANCE.CURRENCIES.RATE_TYPE.mid');
    expect(first).toContain('FINANCE.CURRENCIES.SOURCE.ecb');
  });

  it('marks contract and derived rates with a badge and shows the contract reference and reason', async () => {
    const { root } = await render();

    const contract = rowOf(root, 'CTR-7');
    expect(contract?.querySelector('.badge-contract')?.textContent).toContain(
      'FINANCE.CURRENCIES.BADGE.CONTRACT',
    );
    expect(contract?.textContent).toContain('Annual supply contract');
    expect(contract?.querySelector('.badge-derived')).toBeNull();

    const derived = rowOf(root, 'USD/CHF');
    expect(derived?.querySelector('.badge-derived')?.textContent).toContain(
      'FINANCE.CURRENCIES.BADGE.DERIVED',
    );
    expect(derived?.querySelector('.badge-contract')).toBeNull();
  });

  it('reloads from the first page when a filter changes', async () => {
    const { fixture, root } = await render();
    api['listRates'].mockClear();

    type(root, '#fx-f-from', '2026-11-01');
    await settle(fixture);

    expect(api['listRates']).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-11-01', page: 1, per_page: 25 }),
    );
  });

  it('ignores an incomplete currency code and applies a complete one', async () => {
    const { fixture, root } = await render();
    api['listRates'].mockClear();

    type(root, '#fx-f-base', 'EU');
    await settle(fixture);
    expect(api['listRates']).not.toHaveBeenCalled();

    type(root, '#fx-f-base', 'eur');
    await settle(fixture);
    expect(api['listRates']).toHaveBeenCalledWith(expect.objectContaining({ base: 'EUR' }));
  });

  it('draws the trend of the filtered pair from its own request', async () => {
    const { fixture, root } = await render();
    expect(root.querySelector('app-fx-rate-trend')).toBeNull();

    type(root, '#fx-f-base', 'EUR');
    type(root, '#fx-f-quote', 'CHF');
    await settle(fixture);

    expect(api['listRates']).toHaveBeenCalledWith(
      expect.objectContaining({ base: 'EUR', quote: 'CHF', per_page: 90, page: 1 }),
    );
    expect(root.querySelector('app-fx-rate-trend svg polyline')).not.toBeNull();
  });

  it('exports the audit file in the chosen format', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:rates');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { fixture, root } = await render();

    (root.querySelector('.export-xlsx') as HTMLButtonElement).click();
    await settle(fixture);

    expect(api['exportRates']).toHaveBeenCalledWith({ from: undefined, to: undefined }, 'xlsx');
  });

  it('hides the manual rate action from a member who cannot write', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: baseProviders(api, undefined, () => false) });
    const { root } = await render();

    expect(root.querySelector('.new-rate')).toBeNull();
    expect(root.querySelector('.export-csv')).not.toBeNull();
  });
});
