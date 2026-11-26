import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiquidityPlanningApiService, TranslateService } from '@core';
import * as shared from '@shared';
import { icons } from '../../icons-provider';
import { LiquidityPlanningComponent } from './liquidity-planning.component';
import { LiquidityPlanningStore } from './liquidity-planning.store';
import { LpCashChartComponent } from './lp-cash-chart.component';
import { LpChartComponent } from './lp-chart.component';
import { LpReportComponent } from './lp-report.component';
import {
  manualItems,
  overview,
  presets,
  report,
  scenarios,
  settings,
} from './liquidity-planning.fixtures';

vi.mock('@shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shared')>()),
  downloadBlob: vi.fn(),
}));

@Component({ selector: 'app-lp-chart', template: '<div data-testid="lp-chart-stub"></div>' })
class ChartStubComponent {
  readonly option = input<unknown>(null);
  readonly label = input<string>('');
}

const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};
const messageSpy = { success: vi.fn(), error: vi.fn() };

describe('LiquidityPlanningComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      getOverview: vi.fn(() => of({ data: overview })),
      getReport: vi.fn(() => of({ data: report })),
      exportReport: vi.fn(() => of(new Blob(['x']))),
      getPresets: vi.fn(() => of({ data: presets })),
      listScenarios: vi.fn(() => of({ data: scenarios })),
      listManualItems: vi.fn(() => of({ data: manualItems })),
      getSettings: vi.fn(() => of({ data: settings })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: LiquidityPlanningComponent }]),
        LiquidityPlanningStore,
        { provide: LiquidityPlanningApiService, useValue: api },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    });
    TestBed.overrideComponent(LpCashChartComponent, {
      remove: { imports: [LpChartComponent] },
      add: { imports: [ChartStubComponent] },
    });
  });

  it('loads the workspace and shows the snapshots, the indicators and the alert banner', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/', LiquidityPlanningComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(component).toBeTruthy();
    expect(api['getOverview']).toHaveBeenCalledTimes(1);
    const html = harness.routeNativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="lp-kpis"]')).not.toBeNull();
    expect(html.querySelector('[data-testid="lp-kpi-dscr"]')).not.toBeNull();
    expect(html.querySelector('[data-testid="lp-banner"]')).not.toBeNull();
    expect(html.querySelector('[data-testid="lp-chart-stub"]')).not.toBeNull();
  });

  it('applies a preset from the what-if panel', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', LiquidityPlanningComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();

    const button = (harness.routeNativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="lp-preset-collection_delay_20"]',
    );
    button?.click();
    await harness.fixture.whenStable();

    expect(api['getOverview']).toHaveBeenLastCalledWith({
      levers: { collection_delay_days: 20, collection_delay_share_percent: 100 },
    });
  });

  it('downloads the spreadsheet', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', LiquidityPlanningComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();

    (harness.routeNativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="lp-export-xlsx"]')
      ?.click();
    await harness.fixture.whenStable();

    expect(api['exportReport']).toHaveBeenCalledWith('xlsx', {});
    expect(shared.downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      'liquidity-plan-2027-01-04.xlsx',
    );
  });
});

describe('LpReportComponent', () => {
  it('renders the EBA sections of the report and prints it', async () => {
    const api = {
      getReport: vi.fn(() => of({ data: report })),
      exportReport: vi.fn(() => of(new Blob(['x']))),
    };
    TestBed.configureTestingModule({
      providers: [
        // The report sits below the workspace, as in the real routes: its back link (`..`) needs a parent route.
        provideRouter([
          { path: 'liquidity-planning', children: [{ path: 'report', component: LpReportComponent }] },
        ]),
        LiquidityPlanningStore,
        { provide: LiquidityPlanningApiService, useValue: api },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    });
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/liquidity-planning/report', LpReportComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();

    const html = harness.routeNativeElement as HTMLElement;
    expect(html.querySelectorAll('[data-testid="lp-eba"] li')).toHaveLength(1);
    html.querySelector<HTMLButtonElement>('[data-testid="lp-print"]')?.click();
    expect(print).toHaveBeenCalled();
  });
});
