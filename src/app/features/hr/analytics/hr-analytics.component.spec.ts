import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { HrWorkforceApiService, I18nService } from '@core';
import { barPercent, HrAnalyticsComponent, toIsoDate } from './hr-analytics.component';

const wrap = <T>(data: T) => of({ success: true, message: '', data });

describe('analytics helpers', () => {
  it('formats a local date as Y-m-d', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('scales a bar against the largest value and never leaves 0..100', () => {
    expect(barPercent(5, 10)).toBe(50);
    expect(barPercent(5, 0)).toBe(0);
    expect(barPercent(30, 10)).toBe(100);
    expect(barPercent(-4, 10)).toBe(0);
  });
});

describe('HrAnalyticsComponent', () => {
  const api = {
    getHeadcountAnalytics: vi.fn(),
    getTurnoverAnalytics: vi.fn(),
    getTenureAnalytics: vi.fn(),
    getAbsenteeismAnalytics: vi.fn(),
    getPositionsAnalytics: vi.fn(),
    getUpcomingExpiries: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    message.error.mockClear();
    api.getHeadcountAnalytics.mockReturnValue(
      wrap({
        as_of: '2026-11-06',
        total: 3,
        by_department: [],
        by_contract_type: [],
        by_employment_type: [],
        series: [{ period: '2026-10', date: '2026-10-31', headcount: 3 }],
      }),
    );
    api.getTurnoverAnalytics.mockReturnValue(
      wrap({ from: '', to: '', granularity: 'month', periods: [], totals: { turnover_rate: 12.5 }, by_reason: [], leavers_without_exit_interview: 0 }),
    );
    api.getTenureAnalytics.mockReturnValue(
      wrap({ as_of: '', employees: 3, average_tenure_years: 3.42, average_tenure_leavers_years: null, distribution: [], by_department: [] }),
    );
    api.getAbsenteeismAnalytics.mockReturnValue(
      wrap({ from: '', to: '', scheduled_days: 15, absence_days: 2, planned_leave_days: 0, absenteeism_rate: 13.33, total_leave_rate: 13.33, by_category: [], by_department: [] }),
    );
    api.getPositionsAnalytics.mockReturnValue(wrap({ as_of: '', budget: 3, filled: 2, open: 1, open_job_postings: 1, positions: [] }));
    api.getUpcomingExpiries.mockReturnValue(wrap({ from: '', to: '', days: 90, probation_ends: [], contract_expiries: [] }));
    TestBed.configureTestingModule({
      imports: [HrAnalyticsComponent],
      providers: [
        { provide: HrWorkforceApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
  });

  it('loads the six reports with the range of the filters and shows the key figures', () => {
    const fixture = TestBed.createComponent(HrAnalyticsComponent);
    fixture.detectChanges();

    expect(api.getHeadcountAnalytics).toHaveBeenCalledTimes(1);
    const query = api.getTurnoverAnalytics.mock.calls[0][0];
    expect(query.granularity).toBe('month');
    expect(query.from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(api.getUpcomingExpiries).toHaveBeenCalledWith({ days: 90 });
    expect(api.getTenureAnalytics.mock.calls[0][0].as_of).toBe(query.to);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('12.5%');
    expect(text).toContain('13.33%');
    expect(text).toContain('1 / 3');
  });

  it('reports a failing report and keeps the others', () => {
    api.getTenureAnalytics.mockReturnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(HrAnalyticsComponent);
    fixture.detectChanges();

    expect(message.error).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement as HTMLElement).textContent ?? '').toContain('12.5%');
  });
});
