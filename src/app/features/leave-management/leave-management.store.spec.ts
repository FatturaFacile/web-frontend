import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { LeaveManagementStore } from './leave-management.store';

describe('LeaveManagementStore', () => {
  const base = `${environment.apiBaseUrl}/leave-management`;
  let store: InstanceType<typeof LeaveManagementStore>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), LeaveManagementStore],
    });
    store = TestBed.inject(LeaveManagementStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads Gantt calendar and updates breached days count', async () => {
    const loadPromise = store.loadGantt({ from: '2026-06-01', to: '2026-06-02', country: 'CH' });

    http
      .expectOne((r) => r.url === `${base}/department-calendar`)
      .flush({
        success: true,
        message: '',
        data: {
          from: '2026-06-01',
          to: '2026-06-02',
          department_id: null,
          country: 'CH',
          canton_or_province_code: 'TI',
          total_employees: 2,
          threshold: {
            min_present_count: 2,
            min_present_percent: 50,
            effective_min_required: 2,
            enforce_hard_block: false,
          },
          days: [
            {
              date: '2026-06-01',
              weekday: 'Mon',
              is_weekend: false,
              holiday: null,
              absent_count: 1,
              present_count: 1,
              required_min: 2,
              threshold_breached: true,
            },
          ],
          employees: [],
        },
      });
    http.expectOne(`${base}/staffing-thresholds`).flush({ success: true, message: '', data: [] });

    await loadPromise;
    expect(store.staffingBreachedDaysCount()).toBe(1);
  });

  it('runs monthly accruals and updates ledgers state', async () => {
    const promise = store.calculateMonthlyAccruals({ fiscal_year: 2026, month: 3, country: 'IT' });
    http.expectOne(`${base}/ledgers/calculate-monthly`).flush({
      success: true,
      message: '',
      data: {
        processed_ledgers: 1,
        ledgers: [
          {
            id: 'l1',
            employee_id: 'e1',
            policy_id: 'p1',
            fiscal_year: 2026,
            country: 'IT',
            leave_type: 'AnnualVacation_Ferie_Ferien',
            unit_mode: 'days',
            prior_year_carry_over: 5,
            accrued_ytd: 6.5,
            curtailment_reduction_ytd: 0,
            taken_ytd: 0,
            planned_approved_future: 0,
            pending_approval_amount: 0,
            projected_year_end_balance: 11.5,
            annual_entitlement_target: 26,
            expiration_deadline_date: '2027-06-30',
            expiring_carry_over_amount: 5,
            deadline_alert_level: 'warning',
            last_accrued_period: '2026-03',
          },
        ],
      },
    });

    const processed = await promise;
    expect(processed).toBe(1);
    expect(store.expiringLedgersCount()).toBe(1);
  });
});
