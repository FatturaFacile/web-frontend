import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrisisMonitoringApiService, PermissionsService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { CmChartComponent } from './cm-chart.component';
import { CmDscrPanelComponent } from './cm-dscr-panel.component';
import { CrisisMonitoringComponent } from './crisis-monitoring.component';
import {
  dashboard,
  loans,
  metadata,
  profile,
  requirement,
  stressResult,
} from './crisis-monitoring.fixtures';
import { CrisisMonitoringStore } from './crisis-monitoring.store';

@Component({ selector: 'app-cm-chart', template: '<div data-testid="cm-chart-stub"></div>' })
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

describe('CrisisMonitoringComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    canWrite = true;
    api = {
      getDashboard: vi.fn(() => of({ data: dashboard })),
      compute: vi.fn(() => of({ data: dashboard })),
      getRequirement: vi.fn(() => of({ data: requirement })),
      stressTest: vi.fn(() => of({ data: stressResult })),
      getProfile: vi.fn(() => of({ data: profile })),
      getMetadata: vi.fn(() => of({ data: metadata })),
      listLoans: vi.fn(() => of({ data: loans })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: CrisisMonitoringComponent }]),
        CrisisMonitoringStore,
        { provide: CrisisMonitoringApiService, useValue: api },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        { provide: PermissionsService, useValue: { canWrite: () => canWrite } },
        provideNzIcons(icons),
      ],
    });
    TestBed.overrideComponent(CmDscrPanelComponent, {
      remove: { imports: [CmChartComponent] },
      add: { imports: [ChartStubComponent] },
    });
  });

  it('loads the workspace and shows the overall status and the DSCR gauge', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', CrisisMonitoringComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(api['getDashboard']).toHaveBeenCalledTimes(1);
    const html = harness.routeNativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="cm-overall"]')).not.toBeNull();
    expect(html.querySelector('[data-testid="cm-gauge-card"]')).not.toBeNull();
    expect(html.querySelectorAll('[data-testid="cm-chart-stub"]').length).toBe(2);
    expect(html.querySelector('[data-testid="cm-dscr-status"]')?.textContent).toContain(
      'crisis.status.green',
    );
  });

  it('recomputes the snapshots from the toolbar', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', CrisisMonitoringComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();

    (harness.routeNativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="cm-compute"]')
      ?.click();
    await harness.fixture.whenStable();

    expect(api['compute']).toHaveBeenCalledTimes(1);
    expect(messageSpy.success).toHaveBeenCalledWith('crisis.computed');
  });

  it('hides the write actions from a read-only user', async () => {
    canWrite = false;
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', CrisisMonitoringComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();

    const html = harness.routeNativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="cm-compute"]')).toBeNull();
    expect(html.querySelector('[data-testid="cm-open-profile"]')).toBeNull();
  });
});
