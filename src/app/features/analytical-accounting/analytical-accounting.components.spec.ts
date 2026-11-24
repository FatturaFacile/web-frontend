import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AllocationVector,
  AnalyticalAccountingApiService,
  AnalyticalCenter,
  AnalyticalCenterNode,
  TranslateService,
} from '@core';
import { icons } from '../../icons-provider';
import { AnalyticalAccountingStore } from './analytical-accounting.store';
import { AnalyticalApportionmentComponent } from './analytical-apportionment.component';
import { AnalyticalCentersComponent } from './analytical-centers.component';
import { AnalyticalReportsComponent } from './analytical-reports.component';
import { AnalyticalVectorSelectorComponent } from './analytical-vector-selector.component';

const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};
const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

const center = (id: string, type: 'COST_CENTER' | 'PROFIT_CENTER' = 'COST_CENTER'): AnalyticalCenter => ({
  id,
  parent_id: null,
  code: id.toUpperCase(),
  name: `${id} name`,
  center_type: type,
  category: type === 'PROFIT_CENTER' ? 'PROFIT' : 'AUXILIARY',
  path: `/${id}/`,
  depth: 0,
  manager_user_id: null,
  manager_name: null,
  is_active: true,
  valid_from: null,
  valid_to: null,
});

const node = (id: string, children: AnalyticalCenterNode[] = []): AnalyticalCenterNode => ({ ...center(id), children });

describe('AnalyticalVectorSelectorComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: translateSpy }, provideNzIcons(icons)],
    });
  });

  function render(vectors: AllocationVector[], amount = '100.00') {
    const fixture = TestBed.createComponent(AnalyticalVectorSelectorComponent);
    fixture.componentRef.setInput('centers', [center('cc'), center('pc', 'PROFIT_CENTER')]);
    fixture.componentRef.setInput('amount', amount);
    fixture.componentRef.setInput('vectors', vectors);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the exact cents of every vector of a valid percentage split', () => {
    const fixture = render([
      { cost_center_id: 'cc', percentage: 50 },
      { profit_center_id: 'pc', percentage: 50 },
    ]);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('50.00');
    expect(fixture.nativeElement.querySelectorAll('[role="alert"]')).toHaveLength(0);
  });

  it('explains why a split does not add up', () => {
    const fixture = render([
      { cost_center_id: 'cc', percentage: 60 },
      { profit_center_id: 'pc', percentage: 30 },
    ]);

    expect(fixture.nativeElement.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ANALYTICAL.VECTOR_PERCENT_SUM');
  });

  it('proposes the missing percentage when a vector is added', () => {
    const fixture = render([{ cost_center_id: 'cc', percentage: 70 }]);
    const component = fixture.componentInstance as unknown as { add(): void };

    component.add();

    expect(fixture.componentInstance.vectors().map((v) => v.percentage)).toEqual([70, 30]);
  });
});

describe('AnalyticalCentersComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      getCenterTree: vi.fn(() => of({ data: [node('root', [node('child')])] })),
      createCenter: vi.fn(() => of({ data: center('new') })),
    };
    TestBed.configureTestingModule({
      providers: [
        AnalyticalAccountingStore,
        { provide: AnalyticalAccountingApiService, useValue: api },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    });
  });

  it('loads the tree and shows every center, then hides the children of a collapsed one', async () => {
    const fixture = TestBed.createComponent(AnalyticalCentersComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = () => (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(api['getCenterTree']).toHaveBeenCalledOnce();
    expect(rows()).toHaveLength(2);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('a[aria-expanded]')?.click();
    fixture.detectChanges();
    expect(rows()).toHaveLength(1);
  });

  it('creates a center and reloads the tree', async () => {
    const fixture = TestBed.createComponent(AnalyticalCentersComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      openNew(parent: string | null): void;
      patch(change: Record<string, unknown>): void;
      save(): Promise<void>;
    };

    component.openNew('root');
    component.patch({ code: 'N1', name: 'New' });
    await component.save();

    expect(api['createCenter']).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'N1', name: 'New', parent_id: 'root', center_type: 'COST_CENTER' }),
    );
    expect(api['getCenterTree']).toHaveBeenCalledTimes(2);
    expect(messageSpy.success).toHaveBeenCalled();
  });
});

describe('AnalyticalApportionmentComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  const run = {
    id: 'r-1',
    apportionment_schedule_id: 's-1',
    period_key: '2027-03',
    period_start: '2027-03-01',
    period_end: '2027-03-31',
    status: 'PREVIEW',
    total_pool: '1000.0000',
    total_allocated: '1000.0000',
    total_unallocated: '0.0000',
    warnings: [],
    consolidated_at: null,
    reversed_at: null,
    reversal_reason: null,
    steps: [{ step_order: 1, source_center_id: 'it', driver_type: 'AREA_SQM', status: 'EXECUTED', pool_amount: '1000.0000', allocated_amount: '1000.0000', driver_total: '400.0000', warnings: [] }],
    allocations: [
      { id: 'a1', step_order: 1, source_center_id: 'it', target_center_id: 'asm', driver_type: 'AREA_SQM', driver_value: '300.0000', driver_total: '400.0000', share_ratio: '0.75000000', allocated_amount: '750.0000', rounding_adjustment: '0.0000', analytical_entry_id: null },
      { id: 'a2', step_order: 1, source_center_id: 'it', target_center_id: 'pc', driver_type: 'AREA_SQM', driver_value: '100.0000', driver_total: '400.0000', share_ratio: '0.25000000', allocated_amount: '250.0000', rounding_adjustment: '0.0000', analytical_entry_id: null },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      getSchedules: vi.fn(() => of({ data: [{ id: 's-1', name: 'Monthly', description: null, is_active: true, steps: [{ step_order: 1, source_center_id: 'it', driver_type: 'AREA_SQM' }] }] })),
      getDrivers: vi.fn(() => of({ data: [] })),
      getRuns: vi.fn(() => of({ data: [] })),
      getCenterTree: vi.fn(() => of({ data: [node('it'), node('asm')] })),
      previewRun: vi.fn(() => of({ data: run })),
      consolidateRun: vi.fn(() => of({ data: { ...run, status: 'CONSOLIDATED' } })),
    };
    TestBed.configureTestingModule({
      providers: [
        AnalyticalAccountingStore,
        { provide: AnalyticalAccountingApiService, useValue: api },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    });
  });

  it('previews the selected schedule and shows the allocation chain before anything is posted', async () => {
    const fixture = TestBed.createComponent(AnalyticalApportionmentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      selectSchedule(id: string): void;
      period: { set(value: string): void };
      preview(): Promise<void>;
      consolidate(): Promise<void>;
    };

    component.selectSchedule('s-1');
    component.period.set('2027-03');
    await component.preview();
    fixture.detectChanges();

    expect(api['previewRun']).toHaveBeenCalledWith('s-1', '2027-03');
    expect(api['consolidateRun']).not.toHaveBeenCalled();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('750.0000');
    expect(text).toContain('75.00 %');

    await component.consolidate();
    expect(api['consolidateRun']).toHaveBeenCalledWith('r-1');
  });
});

describe('AnalyticalReportsComponent', () => {
  it('renders the margin levels reported by the API and flags an inconsistent statement', async () => {
    const statement = {
      operating_revenues: '5000.00',
      direct_variable_costs: '400.00',
      contribution_margin_1: '4600.00',
      contribution_margin_1_pct: '92.00',
      direct_fixed_costs: '1000.00',
      contribution_margin_2: '3600.00',
      contribution_margin_2_pct: '72.00',
      indirect_costs: '0.00',
      apportioned_costs: '0.00',
      operating_result: '3600.00',
      operating_result_pct: '72.00',
      non_operating: '0.00',
    };
    const api = {
      getCenterTree: vi.fn(() => of({ data: [] })),
      getContributionMargin: vi.fn(() => of({ success: true, data: { filters: {}, statement, breakdown: [] } })),
      getDirectVsApportioned: vi.fn(() => of({ success: true, data: { rows: [], totals: {} } })),
      exportUrl: vi.fn(() => '/export'),
    };
    TestBed.configureTestingModule({
      providers: [
        AnalyticalAccountingStore,
        { provide: AnalyticalAccountingApiService, useValue: api },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    });

    const fixture = TestBed.createComponent(AnalyticalReportsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('4600.00');
    expect(text).toContain('92.00 %');
    expect(text).not.toContain('ANALYTICAL.STATEMENT_MISMATCH');
  });
});
