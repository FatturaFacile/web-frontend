import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CcvRoi, CcvRoiRow, CorporateConventionsApiService } from '@core';
import { wrap } from './corporate-conventions.testing';
import { DashboardStore } from './dashboard.store';

function row(id: string, extra: Partial<CcvRoiRow> = {}): CcvRoiRow {
  return {
    convention_id: id,
    code: id,
    name: `Convention ${id}`,
    partner_company_name: `Partner ${id}`,
    country_code: 'IT',
    status: 'ACTIVE',
    enrolled_employees: 10,
    enrolled_family_members: 2,
    eligible_population: 100,
    conversion_rate: '10.00',
    transactions: 5,
    gross_revenue: '1000.00',
    discount_granted: '150.00',
    net_revenue: '850.00',
    average_discount_percentage: '15.00',
    employer_subsidy_total: '100.00',
    employer_subsidy_billed: '60.00',
    employer_subsidy_pending: '40.00',
    cost_amount: '400.00',
    welfare_fees: '10.00',
    net_margin: '440.00',
    ...extra,
  };
}

const roi: CcvRoi = {
  currency: 'EUR',
  kpis: {
    active_conventions: 2,
    enrolled_employees: 20,
    enrolled_family_members: 4,
    transactions: 10,
    gross_revenue: '2000.00',
    discount_granted: '300.00',
    net_revenue: '1700.00',
    average_discount_percentage: '15.00',
    employer_subsidy_billed: '120.00',
    net_margin: '860.00',
    pending_split_billing_amount: '80.00',
    pending_welfare_vouchers: 3,
    pending_welfare_amount: '55.00',
  },
  conventions: [
    row('a', { net_margin: '100.00', net_revenue: '500.00' }),
    row('b', { net_margin: '440.00', net_revenue: '850.00' }),
    row('c', { net_margin: '-20.00', net_revenue: '10.00' }),
  ],
};

describe('DashboardStore', () => {
  const api = { getRoi: vi.fn(), exportRoi: vi.fn() };
  let store: InstanceType<typeof DashboardStore>;

  beforeEach(() => {
    api.getRoi.mockReset().mockReturnValue(of(wrap(roi)));
    api.exportRoi.mockReset();
    TestBed.configureTestingModule({
      providers: [DashboardStore, { provide: CorporateConventionsApiService, useValue: api }],
    });
    store = TestBed.inject(DashboardStore);
  });

  it('loads the KPIs and one row per convention', async () => {
    await store.init();

    expect(store.kpis()?.active_conventions).toBe(2);
    expect(store.currency()).toBe('EUR');
    expect(store.rows()).toHaveLength(3);
    expect(api.getRoi).toHaveBeenCalledWith({});
  });

  it('scales the bars to the largest net revenue and ranks the conventions by margin', async () => {
    await store.init();

    expect(store.maxNetRevenue()).toBe(850);
    expect(store.byMargin().map((r) => r.convention_id)).toEqual(['b', 'a', 'c']);
  });

  it('keeps the filters when one changes', async () => {
    await store.init();
    await store.setFilters({ currency: 'CHF' });
    await store.setFilters({ country_code: 'CH' });

    expect(api.getRoi).toHaveBeenLastCalledWith({ currency: 'CHF', country_code: 'CH' });
  });

  it('reports a failed load by its translation key', async () => {
    api.getRoi.mockReturnValue(throwError(() => new Error('down')));

    await store.init();

    expect(store.error()).toBe('corporateConventions.error.generic');
    expect(store.loading()).toBe(false);
  });

  it('hands the CSV of the table to the browser', async () => {
    const created = vi.fn(() => 'blob:csv');
    const revoked = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: created, revokeObjectURL: revoked });
    api.exportRoi.mockReturnValue(of(new Blob(['a;b'], { type: 'text/csv' })));

    const outcome = await store.exportCsv();

    expect(outcome.ok).toBe(true);
    expect(created).toHaveBeenCalled();
    expect(revoked).toHaveBeenCalledWith('blob:csv');
    expect(store.exporting()).toBe(false);
    vi.unstubAllGlobals();
  });
});
