import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { WipRun } from './project-billing.models';
import { WipValuationComponent } from './wip-valuation.component';

function run(overrides: Partial<WipRun>): WipRun {
  return {
    id: 'r1',
    project_id: 'p1',
    revenue_recognition_id: 'rr1',
    period_end_date: '2027-03-31',
    valuation_method: 'cost_to_cost_percentage_of_completion',
    accounting_standard: 'OIC 23',
    cumulative_actual_cost_to_date: '20000.0000',
    estimated_total_cost_at_completion: '50000.0000',
    completion_ratio: '0.400000',
    recognized_revenue_to_date: '40000.0000',
    billed_to_date: '30000.0000',
    wip_asset_or_deferred_revenue_diff: '10000.0000',
    expected_loss_provision: '0.0000',
    gl_journal_entry_id: 'je-1',
    status: 'posted',
    ...overrides,
  };
}

const RUNS: WipRun[] = [
  run({}),
  run({
    id: 'r2',
    project_id: 'p2',
    recognized_revenue_to_date: '20000.0000',
    billed_to_date: '50000.0000',
    wip_asset_or_deferred_revenue_diff: '-30000.0000',
    accounting_standard: 'Swiss GAAP FER 22',
    gl_journal_entry_id: null,
  }),
];

function answer(request: TestRequest, runs: WipRun[]): void {
  const url = request.request.url;

  if (url.includes('/translations/')) {
    request.flush({ translations: {} });
  } else if (request.request.method === 'POST' && url.endsWith('/projects/wip-valuations')) {
    request.flush({
      data: {
        runs: runs.map((item) => ({ ...item, replayed: false })),
        skipped: [{ project_id: 'p3', reason: 'No budget' }],
      },
    });
  } else if (url.endsWith('/projects/wip-valuations')) {
    request.flush({
      data: runs,
      meta: { current_page: 1, last_page: 1, per_page: 25, total: runs.length },
    });
  } else {
    request.flush({ data: {} });
  }
}

async function render(runs: WipRun[] = RUNS) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [WipValuationComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  }).compileComponents();

  const fixture = TestBed.createComponent(WipValuationComponent);
  const http = TestBed.inject(HttpTestingController);
  const calls: string[] = [];

  const settle = async () => {
    for (let round = 0; round < 3; round++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      for (const request of http.match(() => true)) {
        calls.push(`${request.request.method} ${request.request.url}`);
        answer(request, runs);
      }

      fixture.detectChanges();
    }
  };

  fixture.detectChanges();
  await settle();

  return { fixture, calls, settle, element: fixture.nativeElement as HTMLElement };
}

describe('WipValuationComponent', () => {
  it('loads the valuation runs of the period end date', async () => {
    const { calls } = await render();

    expect(
      calls.some((call) => call.startsWith('GET') && call.endsWith('/projects/wip-valuations')),
    ).toBe(true);
  });

  it('lists a run per project with its accounting standard and the general ledger reference', async () => {
    const { element } = await render();

    expect(element.querySelector('[data-testid="wip-row-p1"]')?.textContent).toContain('OIC 23');
    expect(element.querySelector('[data-testid="wip-row-p1"]')?.textContent).toContain('je-1');
    expect(element.querySelector('[data-testid="wip-row-p1"]')?.textContent).toContain('40.00%');
    expect(element.querySelector('[data-testid="wip-row-p2"]')?.textContent).toContain(
      'Swiss GAAP FER 22',
    );
  });

  it('adds up the contract assets and the contract liabilities apart', async () => {
    const { element } = await render();

    expect(element.querySelector('[data-testid="wip-assets"]')?.textContent).toMatch(
      /10[.,’' ]?000/,
    );
    expect(element.querySelector('[data-testid="wip-liabilities"]')?.textContent).toMatch(
      /30[.,’' ]?000/,
    );
  });

  it('shows an empty state when the period has no valuation', async () => {
    const { element } = await render([]);

    expect(element.querySelector('[data-testid="wip-empty"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="wip-table"]')).toBeNull();
  });

  it('runs the valuation of all open projects and reports the ones skipped', async () => {
    const { element, calls, settle, fixture } = await render();
    const button = element.querySelector('[data-testid="wip-run"]') as HTMLButtonElement | null;

    // The run button is only there for people who can write projects.
    if (button === null) {
      expect(calls.some((call) => call.startsWith('POST'))).toBe(false);

      return;
    }

    button.click();
    fixture.detectChanges();
    await settle();

    expect(
      calls.some((call) => call.startsWith('POST') && call.endsWith('/projects/wip-valuations')),
    ).toBe(true);
    expect(element.querySelector('[data-testid="wip-skipped"]')).not.toBeNull();
  });
});
