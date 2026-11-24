import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { BreakdownRow, WbsBreakdown } from './project-evm.models';
import { ProjectEvmDashboardComponent } from './project-evm-dashboard.component';

const FIGURES: BreakdownRow = {
  has_snapshot: true,
  bac: '100000.00',
  committed: '1000.00',
  actual: '30000.00',
  total_exposure: '31000.00',
  pv: '50000.00',
  ev: '25000.00',
  cv: '-5000.00',
  sv: '-25000.00',
  cpi: '0.8333',
  spi: '0.5000',
  cpi_light: 'red',
  spi_light: 'red',
  eac: '120000.00',
  etc: '90000.00',
  vac: '-20000.00',
  budget_absorption_percent: '85.00',
  recognized_revenue: '50000.00',
  gross_margin_amount: '20000.00',
  gross_margin_percent: '40.00',
  manual_etc_override: null,
};

const BREAKDOWN: WbsBreakdown = {
  project_id: 'p1',
  currency: 'EUR',
  snapshot_date: '2027-03-01',
  project: FIGURES,
  reconciliation: {
    standard: 'OIC 23',
    valuation_method: 'percentage_of_completion',
    managerial_actual_cost: '30000.0000',
    statutory_cumulative_revenue: '0.0000',
    statutory_cumulative_cost: '0.0000',
    cost_difference: null,
    cost_center_overhead: '0.0000',
    last_recognition_date: null,
    is_reconciled: false,
  },
  nodes: [
    {
      wbs_node_id: 'n1',
      wbs_code: '1',
      title: 'Phase one',
      ...FIGURES,
      children: [{ wbs_node_id: 'n11', wbs_code: '1.1', title: 'Package', ...FIGURES, children: [] }],
    },
  ],
};

function answer(request: TestRequest): void {
  const url = request.request.url;

  if (url.includes('/translations/')) {
    request.flush({ translations: {} });
  } else if (url.endsWith('/evm/wbs-breakdown')) {
    request.flush({ data: BREAKDOWN });
  } else if (url.endsWith('/evm/waterfall')) {
    request.flush({ data: { project_id: 'p1', currency: 'EUR', snapshot_date: null, steps: [] } });
  } else if (url.endsWith('/evm/scurve')) {
    request.flush({ data: { granularity: 'month', currency: 'EUR', points: [], forecast: [] } });
  } else {
    request.flush({ data: {} });
  }
}

async function render() {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [ProjectEvmDashboardComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'p1' })) } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ProjectEvmDashboardComponent);
  const http = TestBed.inject(HttpTestingController);
  const urls: string[] = [];

  fixture.detectChanges();

  for (let round = 0; round < 3; round++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    for (const request of http.match(() => true)) {
      urls.push(`${request.request.method} ${request.request.url}`);
      answer(request);
    }

    fixture.detectChanges();
  }

  return { fixture, urls, element: fixture.nativeElement as HTMLElement };
}

describe('ProjectEvmDashboardComponent', () => {
  it('loads the breakdown, the waterfall and the S-curve of the project', async () => {
    const { urls } = await render();

    expect(urls.some((url) => url.endsWith('/projects/p1/evm/wbs-breakdown'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/projects/p1/evm/waterfall'))).toBe(true);
    expect(urls.some((url) => url.includes('/projects/evm/scurve'))).toBe(true);
  });

  it('shows the KPI traffic lights, the absorption warning and the breached thresholds', async () => {
    const { element } = await render();

    expect(element.querySelector('[data-testid="evm-cpi"]')?.textContent).toContain('0.8333');
    expect(element.querySelector('[data-testid="evm-spi"]')?.textContent).toContain('0.5000');
    expect(element.querySelector('[data-testid="evm-absorption-warning"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="evm-alerts"]')).not.toBeNull();
  });

  it('lists the top-level WBS nodes and opens their children on demand', async () => {
    const { fixture, element } = await render();

    expect(element.querySelector('[data-testid="evm-row-1"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="evm-row-1.1"]')).toBeNull();

    (element.querySelector('.evm-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="evm-row-1.1"]')).not.toBeNull();
  });

  it('shows the reconciliation with the accounting standard of the tenant', async () => {
    const { element } = await render();

    expect(element.querySelector('[data-testid="evm-reconciliation"]')?.textContent).toContain('OIC 23');
  });
});
