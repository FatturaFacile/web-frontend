import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { baseProviders, wrap } from './corporate-conventions.testing';
import { DashboardComponent } from './dashboard.component';

const row = (id: string, margin: string, revenue: string) => ({
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
  net_revenue: revenue,
  average_discount_percentage: '15.00',
  employer_subsidy_total: '100.00',
  employer_subsidy_billed: '60.00',
  employer_subsidy_pending: '40.00',
  cost_amount: '400.00',
  welfare_fees: '10.00',
  net_margin: margin,
});

describe('DashboardComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      getRoi: vi.fn(() =>
        of(
          wrap({
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
            conventions: [row('a', '100.00', '500.00'), row('b', '-20.00', '850.00')],
          }),
        ),
      ),
      exportRoi: vi.fn(() => of(new Blob(['x']))),
    };
    TestBed.configureTestingModule({ providers: baseProviders(api) });
  });

  async function render() {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the KPI cards for the commercial director', async () => {
    const root = await render();
    const text = root.textContent ?? '';

    expect(api['getRoi']).toHaveBeenCalledWith({});
    for (const key of [
      'activeConventions',
      'enrolledEmployees',
      'grossRevenue',
      'averageDiscount',
      'netMargin',
      'pendingSplitBilling',
    ]) {
      expect(text, key).toContain(`corporateConventions.kpi.${key}`);
    }
    expect(root.querySelectorAll('nz-card')).toHaveLength(6);
    expect(text).toContain('15.00 %');
  });

  it('breaks the ROI down by convention with a bar per convention and flags a negative margin', async () => {
    const root = await render();

    expect(root.querySelectorAll('.bar-row')).toHaveLength(2);
    expect(root.querySelector('.bar.margin.negative')).not.toBeNull();
    const rows = Array.from(root.querySelectorAll('tbody tr.ant-table-row'));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Convention a');
    expect(rows[0].textContent).toContain('10.00 %');
    expect(root.querySelector('.negative-text')).not.toBeNull();
  });
});
