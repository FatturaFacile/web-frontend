import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { PcAnalysisComponent } from './pc-analysis.component';

const envelope = (data: unknown) => ({ success: true, message: '', data });

const PROFIT = {
  project_id: 'p1',
  project_number: 'PRJ-1',
  currency: 'EUR',
  revenue_recognition_method: null,
  contract_value: '10000.0000',
  budget: { status: 'approved', revenue: '10000.0000', cost: '7000.0000', margin: '3000.0000' },
  revenue: { billed: '2000.0000', draft_billing: '0.0000', recognised: '2500.0000', unbilled_time_and_materials: '0.0000', contract_asset_balance: '0.0000' },
  cost: { by_category: [], actual: '1500.0000', committed: '500.0000', work_in_progress: '0.0000' },
  margin: { gross_margin: '1000.0000', gross_margin_percentage: '40.00' },
  forecast: {
    estimate_at_completion: '7000.0000',
    estimate_to_complete: '5500.0000',
    forecast_revenue: '10000.0000',
    forecast_margin: '-100.0000',
    forecast_margin_percentage: '-1.00',
    is_loss_forecast: true,
  },
  hours: { approved: '40.00', billable: '30.00', billable_ratio_percentage: '75.00' },
};

const CLOSURE = {
  can_close: false,
  blockers: [{ code: 'open_tasks', message: 'Open tasks remain' }],
  warnings: [{ code: 'unbilled', message: 'Unbilled time exists' }],
};

const GANTT = {
  project_id: 'p1',
  project_name: 'Alpha',
  planned_start_date: '2026-01-01',
  planned_end_date: '2026-06-30',
  baseline_start_date: null,
  baseline_end_date: null,
  progress_percentage: '35.00',
  schedule_finish: '2026-06-30',
  critical_path: ['t1'],
  milestones: [],
  tasks: [
    {
      id: 't1',
      task_number: 'T-1',
      wbs_code: '1.1',
      title: 'Design phase',
      status: 'in_progress',
      progress_percentage: '50.00',
      planned_start_date: '2026-01-01',
      planned_end_date: '2026-02-01',
      baseline_start_date: null,
      baseline_end_date: null,
      finish_variance_days: null,
      dependencies: [],
    },
  ],
};

describe('PcAnalysisComponent', () => {
  it('loads profitability, closure checks and the schedule and renders them', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PcAnalysisComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(PcAnalysisComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne((r) => r.url.endsWith('/p1/profitability')).flush(envelope(PROFIT));
    http.expectOne((r) => r.url.endsWith('/p1/closure-checks')).flush(envelope(CLOSURE));
    http.expectOne((r) => r.url.endsWith('/p1/gantt')).flush(envelope(GANTT));
    for (const request of http.match(() => true)) {
      if (request.request.url.endsWith('.svg')) {
        request.flush('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>');
        continue;
      }
      request.flush(request.request.url.includes('/translations/') ? { translations: {} } : envelope([]));
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Open tasks remain');
    expect(text).toContain('Unbilled time exists');
    expect(text).toContain('40.00%');
    expect(text).toContain('Design phase');
    expect(text).toContain('35.00%');
  });
});
