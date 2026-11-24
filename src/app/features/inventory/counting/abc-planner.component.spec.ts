import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AbcRun, CountPolicy, CycleCountPlan, InventoryCountApiService, InventoryValuationApiService } from '@core';
import { inventoryTestProviders } from '../shared/inventory-valuation.testing';
import { AbcPlannerComponent } from './abc-planner.component';

const POLICY = {
  is_default: false,
  abc_a_share: 80,
  abc_b_share: 95,
  abc_period_days: 365,
  interval_days_a: 90,
  interval_days_b: 180,
  interval_days_c: 365,
  new_item_class: 'A',
  blind_by_default: true,
  reveal_first_count_on_recount: false,
  recount_threshold_percent: 5,
  recount_threshold_value: null,
  max_recount_rounds: 2,
  approval_mode: 'multi_level',
  auto_approve_within_tolerance: false,
  level1_threshold_percent: 2,
  level1_threshold_value: 100,
  level2_threshold_percent: 10,
  level2_threshold_value: 1000,
  enforce_segregation_of_duties: true,
  inventory_account_code: '1200',
  gain_account_code: '3900',
  loss_account_code: '4900',
} as CountPolicy;

const RUN = {
  id: 'r1',
  warehouse_id: null,
  period_days: 365,
  a_share: 80,
  b_share: 95,
  period_start: '2025-11-22',
  period_end: '2026-11-22',
  total_consumption_value: '1000.00',
  item_count: 2,
  class_a_count: 1,
  class_b_count: 0,
  class_c_count: 1,
  applied: false,
  items: [
    { stock_item_id: 'i1', sku: 'SKU-1', name: 'Bolt', rank: 1, consumption_value: '800.00', cumulative_share: '80.00', abc_class: 'A', previous_class: null, is_manual_override: true, is_new_item: false },
    { stock_item_id: 'i2', sku: 'SKU-2', name: 'Nut', rank: 2, consumption_value: '200.00', cumulative_share: '100.00', abc_class: 'C', previous_class: 'B', is_manual_override: false, is_new_item: true },
  ],
} as AbcRun;

const PLAN = {
  id: 'p1',
  warehouse_id: 'w1',
  warehouse_zone_id: null,
  name: 'Class A monthly',
  abc_class: 'A',
  cadence: 'quarterly',
  interval_days: 90,
  freezes_stock: false,
  is_active: true,
  last_run_at: null,
  next_run_on: '2026-12-01',
} as CycleCountPlan;

describe('AbcPlannerComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    api = {
      getPolicy: vi.fn(() => of(POLICY)),
      updatePolicy: vi.fn(() => of(POLICY)),
      listAbcRuns: vi.fn(() => of([RUN])),
      runAbc: vi.fn(() => of(RUN)),
      getAbcRun: vi.fn(() => of(RUN)),
      listAbcOverrides: vi.fn(() => of([])),
      createAbcOverride: vi.fn(() => of({})),
      listPlans: vi.fn(() => of([PLAN])),
      createPlan: vi.fn(() => of(PLAN)),
      updatePlan: vi.fn(() => of(PLAN)),
      deletePlan: vi.fn(() => of({})),
      runPlan: vi.fn(() => of({})),
      runDuePlans: vi.fn(() => of({ opened: 2 })),
      generatePlans: vi.fn(() => of([PLAN])),
    };
    TestBed.configureTestingModule({
      imports: [AbcPlannerComponent],
      providers: [
        ...inventoryTestProviders(),
        { provide: InventoryCountApiService, useValue: api },
        {
          provide: InventoryValuationApiService,
          useValue: {
            listWarehouses: vi.fn(() => of([{ id: 'w1', name: 'Main' }])),
            searchItems: vi.fn(() => of([{ id: 'i1', sku: 'SKU-1', name: 'Bolt' }])),
          },
        },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(AbcPlannerComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the policy into the run form and renders runs and plans', () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.runForm.getRawValue().a_share).toBe(80);
    expect(fixture.componentInstance.policyForm.getRawValue().approval_mode).toBe('multi_level');
    expect(el.querySelectorAll('[data-testid="plans-table"] tbody tr').length).toBe(1);
    expect(el.textContent).toContain('Class A monthly');
    expect(el.textContent).toContain('INVENTORY_COUNT.PLAN.CADENCE_QUARTERLY');
  });

  it('runs the classification and shows class tags, manual and new item badges', () => {
    const fixture = render();
    const c = fixture.componentInstance;
    c.runForm.patchValue({ warehouse_id: 'w1', apply: true });

    c.runAbc();
    fixture.detectChanges();

    expect(api['runAbc']).toHaveBeenCalledWith({ period_days: 365, a_share: 80, b_share: 95, warehouse_id: 'w1', apply: true });
    const el = fixture.nativeElement as HTMLElement;
    const classes = Array.from(el.querySelectorAll('[data-testid="abc-class"]')).map((t) => t.textContent?.trim());
    expect(classes).toEqual(['A', 'C']);
    expect(el.textContent).toContain('INVENTORY_COUNT.ABC.MANUAL');
    expect(el.textContent).toContain('INVENTORY_COUNT.ABC.NEW_ITEM');
  });

  it('requires a reason for a manual class override and clears the class with null', () => {
    const fixture = render();
    const c = fixture.componentInstance;
    c.openOverride({ stock_item_id: 'i1', sku: 'SKU-1', name: 'Bolt' });

    c.saveOverride();
    expect(api['createAbcOverride']).not.toHaveBeenCalled();

    c.overrideForm.patchValue({ abc_class: 'none', reason: '  Seasonal item ' });
    c.saveOverride();
    expect(api['createAbcOverride']).toHaveBeenCalledWith({ stock_item_id: 'i1', abc_class: null, reason: 'Seasonal item' });
  });

  it('saves the policy with blank thresholds as null', () => {
    const c = render().componentInstance;
    c.policyForm.patchValue({ recount_threshold_percent: null, level2_threshold_value: null, gain_account_code: '' });

    c.savePolicy();

    expect(api['updatePolicy']).toHaveBeenCalledWith(
      expect.objectContaining({
        recount_threshold_percent: null,
        level2_threshold_value: null,
        gain_account_code: null,
        approval_mode: 'multi_level',
        abc_a_share: 80,
      }),
    );
  });

  it('generates plans for the chosen warehouse only', () => {
    const c = render().componentInstance;

    c.generatePlans();
    expect(api['generatePlans']).not.toHaveBeenCalled();

    c.setPlanWarehouse('w1');
    expect(api['listPlans']).toHaveBeenLastCalledWith('w1');
    c.generatePlans();
    expect(api['generatePlans']).toHaveBeenCalledWith({ warehouse_id: 'w1' });
  });

  it('creates a plan without class when "all" is chosen, runs and deletes plans', () => {
    const c = render().componentInstance;
    c.openPlanModal();
    c.planForm.patchValue({ name: ' Weekly ', warehouse_id: 'w1', interval_days: 7 });
    c.savePlan();

    expect(api['createPlan']).toHaveBeenCalledWith({
      name: 'Weekly',
      warehouse_id: 'w1',
      abc_class: null,
      interval_days: 7,
      freezes_stock: false,
    });

    c.runPlan(PLAN);
    expect(api['runPlan']).toHaveBeenCalledWith('p1');
    c.deletePlan(PLAN);
    expect(api['deletePlan']).toHaveBeenCalledWith('p1');
    c.runDue();
    expect(api['runDuePlans']).toHaveBeenCalled();
  });
});
