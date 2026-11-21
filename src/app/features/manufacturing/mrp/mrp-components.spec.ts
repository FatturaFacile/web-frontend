import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManufacturingApiService } from '@core';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { MrpApiService } from './mrp-api.service';
import { MrpGanttComponent } from './mrp-gantt.component';
import { MrpPeggingDrawerComponent } from './mrp-pegging-drawer.component';
import { MrpRunBarComponent } from './mrp-run-bar.component';
import { MrpWorkbenchComponent } from './mrp-workbench.component';
import { DETAIL, GANTT, PEGGING, RUN, typed } from './mrp.fixtures';
import { MrpProposal } from './mrp.models';
import { MrpStore } from './mrp.store';

const ok = <T>(data: T) => of({ success: true, message: '', data });
const q = (root: ParentNode, selector: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(selector);
const all = (root: ParentNode, selector: string): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(selector));
const byId = (root: ParentNode, id: string): HTMLElement | null => q(root, `[data-testid="${id}"]`);
const host = (fixture: ComponentFixture<unknown>): HTMLElement =>
  fixture.nativeElement as HTMLElement;

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function emit(target: HTMLElement, type: string, clientX = 0): void {
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'clientX', { value: clientX });
  target.dispatchEvent(event);
}

let api: Record<string, ReturnType<typeof vi.fn>>;
let notification: {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
};

function configure(): MrpStore {
  api = {
    runs: vi.fn(() => ok([RUN])),
    startRun: vi.fn(() => ok(RUN)),
    run: vi.fn(() => ok(DETAIL)),
    proposals: vi.fn(() => ok([])),
    applyAction: vi.fn(() =>
      ok({
        action: 'release',
        processed: 2,
        purchase_requisition_ids: ['pr-1'],
        production_order_ids: ['po-1'],
        proposals: [],
      }),
    ),
    pegging: vi.fn(() => ok(PEGGING)),
    gantt: vi.fn(() => ok(GANTT)),
    autoLevel: vi.fn(() =>
      ok({
        run: RUN,
        overloaded_buckets_before: 3,
        overloaded_buckets_after: 0,
        leveled_proposals: 2,
      }),
    ),
    reschedule: vi.fn(() =>
      ok({
        block: {},
        proposal: typed('p-1', 'PlannedProductionOrder'),
        capacity: { overloaded_buckets: 0, max_load_percentage: '80', buckets: [] },
      }),
    ),
  };
  notification = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      provideNzIcons(icons),
      provideNzI18n(en_US),
      provideNzDateFnsAdapter(),
      MrpStore,
      { provide: MrpApiService, useValue: api },
      { provide: NzNotificationService, useValue: notification },
      {
        provide: ManufacturingApiService,
        useValue: { getWorkCenters: () => ok([]), getMfgItems: () => ok([]) },
      },
    ] as never,
  });

  return TestBed.inject(MrpStore);
}

const ROWS: MrpProposal[] = [
  typed('r-pr', 'PlannedPurchaseRequisition', {
    exception_messages: ['PastDueRelease', 'BelowSafetyStock'],
  }),
  typed('r-po', 'PlannedProductionOrder', { exception_messages: ['CapacityOverload'] }),
  typed('r-sub', 'PlannedSubcontractOrder'),
  typed('r-exp', 'RescheduleIn_Expedite', { exception_messages: ['Expedite'] }),
  typed('r-def', 'RescheduleOut_Defer', { exception_messages: ['Defer'] }),
  typed('r-done', 'PlannedPurchaseRequisition', { status: 'Released' }),
];

describe('MrpWorkbenchComponent', () => {
  let store: MrpStore;
  let fixture: ComponentFixture<MrpWorkbenchComponent>;

  beforeEach(async () => {
    store = configure();
    store.proposals.set(ROWS);
    store.meta.set({ current_page: 1, per_page: 25, total: ROWS.length, last_page: 1 });
    fixture = TestBed.createComponent(MrpWorkbenchComponent);
    await settle(fixture);
  });

  const rowCheckbox = (id: string): HTMLInputElement =>
    byId(host(fixture), `row-${id}`)?.querySelector('input[type="checkbox"]') as HTMLInputElement;

  it('renders a type badge per proposal and the exception tags with distinct colours', () => {
    const badges = all(host(fixture), '[data-testid="type-badge"]').map((badge) =>
      badge.textContent?.trim(),
    );

    expect(badges).toEqual([
      'MRP.TYPE_PURCHASE_REQUISITION',
      'MRP.TYPE_PRODUCTION_ORDER',
      'MRP.TYPE_SUBCONTRACT_ORDER',
      'MRP.TYPE_RESCHEDULE_IN',
      'MRP.TYPE_RESCHEDULE_OUT',
      'MRP.TYPE_PURCHASE_REQUISITION',
    ]);

    const tags = all(host(fixture), '[data-testid="exception-tag"]');
    const codes = tags.map((tag) => tag.dataset['code']);

    expect(codes).toEqual([
      'PastDueRelease',
      'BelowSafetyStock',
      'CapacityOverload',
      'Expedite',
      'Defer',
    ]);
    expect(tags.map((tag) => tag.textContent?.trim())).toContain('MRP.EXC_BELOW_SAFETY_STOCK');

    const colourOf = (tag: HTMLElement): string =>
      tag.className
        .split(' ')
        .find((name) => name.startsWith('ant-tag-') && name !== 'ant-tag-has-color') ??
      tag.style.backgroundColor;

    expect(new Set(tags.map(colourOf)).size).toBe(tags.length);
  });

  it('shows the quantity columns, trimmed, and the dates', () => {
    const row = byId(host(fixture), 'row-r-pr') as HTMLElement;
    const cells = all(row, 'td.num').map((cell) => cell.textContent?.trim());

    expect(cells).toEqual(['25', '5', '20', '24']);
    expect(row.textContent).toContain('2027-03-10');
    expect(row.textContent).toContain('2027-03-01');
  });

  it('enables the row actions the proposal is eligible for only', () => {
    const buttons = (id: string): Record<string, boolean> => {
      const row = byId(host(fixture), `row-${id}`) as HTMLElement;

      return {
        firm: (byId(row, 'act-firm') as HTMLButtonElement).disabled,
        release: (byId(row, 'act-release') as HTMLButtonElement).disabled,
        dismiss: (byId(row, 'act-dismiss') as HTMLButtonElement).disabled,
      };
    };

    expect(buttons('r-pr')).toEqual({ firm: false, release: false, dismiss: false });
    expect(buttons('r-exp')).toEqual({ firm: true, release: true, dismiss: false });
    expect(buttons('r-done')).toEqual({ firm: true, release: true, dismiss: true });
  });

  it('bulk selection opens a confirmation that counts requisitions, production orders and ineligible rows', async () => {
    for (const id of ['r-pr', 'r-po', 'r-sub', 'r-exp']) {
      rowCheckbox(id).click();
    }
    await settle(fixture);

    expect(byId(host(fixture), 'selection-count')?.textContent).toContain('MRP.SELECTED_COUNT');
    expect(store.selectionCount()).toBe(4);

    (byId(host(fixture), 'mass-release') as HTMLButtonElement).click();
    await settle(fixture);

    expect(byId(document.body, 'summary-requisitions')?.textContent?.trim()).toBe('1');
    expect(byId(document.body, 'summary-orders')?.textContent?.trim()).toBe('2');
    expect(byId(document.body, 'summary-ineligible')?.textContent?.trim()).toBe('1');
    expect(byId(document.body, 'release-ineligible-alert')).not.toBeNull();
  });

  it('only calls the server once the ineligible rows are dropped, then reports the created documents', async () => {
    for (const id of ['r-pr', 'r-po', 'r-exp']) {
      rowCheckbox(id).click();
    }
    await settle(fixture);
    (byId(host(fixture), 'mass-release') as HTMLButtonElement).click();
    await settle(fixture);

    const confirm = (): HTMLButtonElement =>
      q(document.body, '.ant-modal-footer .ant-btn-primary') as HTMLButtonElement;

    expect(confirm().disabled).toBe(true);

    (byId(document.body, 'keep-eligible') as HTMLButtonElement).click();
    await settle(fixture);

    expect(byId(document.body, 'summary-ineligible')?.textContent?.trim()).toBe('0');
    expect(confirm().disabled).toBe(false);

    confirm().click();
    await settle(fixture);

    expect(api['applyAction']).toHaveBeenCalledWith(['r-pr', 'r-po'], 'release');
    expect(byId(host(fixture), 'result-banner')).not.toBeNull();
    expect(store.lastResult()?.production_order_ids).toEqual(['po-1']);
  });

  it('asks for the pegging of a row', async () => {
    const asked: MrpProposal[] = [];

    fixture.componentInstance.pegging.subscribe((row) => asked.push(row));
    (
      byId(byId(host(fixture), 'row-r-po') as HTMLElement, 'act-pegging') as HTMLButtonElement
    ).click();

    expect(asked.map((row) => row.id)).toEqual(['r-po']);
  });

  it('reloads from the server when a filter changes', async () => {
    store.selectRun('run-1');
    fixture.componentInstance['filter']({ exceptionCode: 'Expedite' });
    await settle(fixture);

    expect(api['proposals']).toHaveBeenCalledWith(
      expect.objectContaining({ exceptionCode: 'Expedite', runId: 'run-1', page: 1 }),
    );
  });
});

describe('MrpPeggingDrawerComponent', () => {
  let fixture: ComponentFixture<MrpPeggingDrawerComponent>;

  beforeEach(async () => {
    const store = configure();

    store.peggingProposal.set(typed('p-top', 'PlannedProductionOrder'));
    store.pegging.set(PEGGING);
    fixture = TestBed.createComponent(MrpPeggingDrawerComponent);
    await settle(fixture);
  });

  it('renders the upstream root demands and the downstream children', () => {
    const tree = byId(document.body, 'pegging-tree') as HTMLElement;

    expect(tree).not.toBeNull();
    expect(all(tree, '[data-testid="root-demand"]').map((tag) => tag.textContent?.trim())).toEqual([
      'MRP.SOURCE_SALES_ORDER',
      'MRP.SOURCE_MPS',
    ]);
    expect(byId(tree, 'node-up/mrp_proposal:p-parent')?.textContent).toContain('BIKE');
    expect(byId(tree, 'node-down/p-tube')?.textContent).toContain('TUBE');
    expect(byId(tree, 'node-down/p-tube/p-steel')?.textContent).toContain('STEEL');
    expect(all(byId(document.body, 'root-demands') as HTMLElement, 'li')).toHaveLength(2);
  });

  it('shows the focus proposal in the inspector and the source of a clicked root demand', async () => {
    expect(byId(document.body, 'inspector-item')?.textContent).toContain('FRAME');
    expect(byId(document.body, 'inspector-quantity')?.textContent?.trim()).toBe('10');

    const node = byId(document.body, 'node-up/sales_order_line:sol-1') as HTMLElement;

    (node.closest('.ant-tree-node-content-wrapper') as HTMLElement).click();
    await settle(fixture);

    expect(byId(document.body, 'inspector-source')?.textContent).toContain(
      'MRP.SOURCE_SALES_ORDER',
    );
    expect(byId(document.body, 'inspector-quantity')?.textContent?.trim()).toBe('6');
  });
});

describe('MrpGanttComponent', () => {
  let store: MrpStore;
  let fixture: ComponentFixture<MrpGanttComponent>;

  const lane = (id: string): HTMLElement =>
    q(host(fixture), `[data-testid="lane"][data-work-center-id="${id}"]`) as HTMLElement;
  const block = (id: string): HTMLElement => byId(host(fixture), `block-${id}`) as HTMLElement;

  beforeEach(async () => {
    store = configure();
    store.gantt.set(GANTT);
    fixture = TestBed.createComponent(MrpGanttComponent);
    await settle(fixture);
  });

  it('highlights an overloaded bucket in red with a warning icon, and only that one', () => {
    const over = byId(host(fixture), 'bucket-wc-a-2027-03-01-DAY') as HTMLElement;
    const fine = byId(host(fixture), 'bucket-wc-a-2027-03-02-DAY') as HTMLElement;

    expect(over.classList.contains('bucket--overload')).toBe(true);
    expect(byId(host(fixture), 'warn-wc-a-2027-03-01-DAY')).not.toBeNull();
    expect(fine.classList.contains('bucket--overload')).toBe(false);
    expect(fine.classList.contains('bucket--ok')).toBe(true);
    expect(byId(host(fixture), 'warn-wc-a-2027-03-02-DAY')).toBeNull();
  });

  it('flags the work centre with overloaded buckets and the total', () => {
    expect(byId(host(fixture), 'wc-overload-wc-a')).not.toBeNull();
    expect(byId(host(fixture), 'wc-overload-wc-b')).toBeNull();
    expect(byId(host(fixture), 'overload-total')).not.toBeNull();
  });

  it('marks manual blocks, blocks moved from their original work centre and exception tags', () => {
    expect(q(block('blk-2'), '[data-testid="manual-marker"]')).not.toBeNull();
    expect(q(block('blk-2'), '[data-testid="moved-marker"]')).not.toBeNull();
    expect(q(block('blk-1'), '[data-testid="manual-marker"]')).toBeNull();
    expect(q(block('blk-1'), '[data-testid="block-exception"]')?.textContent).toContain(
      'MRP.EXC_CAPACITY_OVERLOAD',
    );
  });

  it('positions blocks by date and duration', () => {
    expect(block('blk-1').style.left).toBe('0px');
    expect(block('blk-1').style.width).toBe('80px');
    expect(block('blk-2').style.left).toBe('120px');
    expect(block('blk-2').style.width).toBe('40px');
  });

  it('reschedules a dropped block with the dropped date, keeping its span', async () => {
    emit(block('blk-1'), 'dragstart', 0);
    emit(lane('wc-a'), 'drop', 130);
    await settle(fixture);

    expect(api['reschedule']).toHaveBeenCalledWith('blk-1', {
      start_date: '2027-03-04',
      end_date: '2027-03-05',
    });
    expect(api['gantt']).not.toHaveBeenCalledTimes(0);
  });

  it('moves a block to the lane of an alternative work centre', async () => {
    emit(block('blk-1'), 'dragstart', 0);
    emit(lane('wc-b'), 'drop', 10);
    await settle(fixture);

    expect(api['reschedule']).toHaveBeenCalledWith('blk-1', { work_center_id: 'wc-b' });
  });

  it('refuses a drop on a work centre that is not an alternative', async () => {
    emit(block('blk-1'), 'dragstart', 0);
    emit(lane('wc-c'), 'drop', 10);
    await settle(fixture);

    expect(api['reschedule']).not.toHaveBeenCalled();
    expect(notification.warning).toHaveBeenCalled();
  });

  it('does nothing when a block is dropped where it already is', async () => {
    emit(block('blk-1'), 'dragstart', 0);
    emit(lane('wc-a'), 'drop', 10);
    await settle(fixture);

    expect(api['reschedule']).not.toHaveBeenCalled();
  });

  it('offers only the alternatives of the work centre in the block drawer', async () => {
    block('blk-1').click();
    await settle(fixture);

    expect(byId(document.body, 'block-detail')).not.toBeNull();
    expect(fixture.componentInstance['alternativeOptions']().map((center) => center.id)).toEqual([
      'wc-b',
    ]);

    document.body.querySelector<HTMLElement>('.ant-drawer-close')?.click();
    await settle(fixture);
  });

  it('auto-levels and shows the overloaded buckets before and after', async () => {
    (byId(host(fixture), 'auto-level') as HTMLButtonElement).click();
    await settle(fixture);

    expect(api['autoLevel']).toHaveBeenCalled();
    expect(store.lastLevel()).toMatchObject({
      overloaded_buckets_before: 3,
      overloaded_buckets_after: 0,
    });
    expect(byId(host(fixture), 'level-result')).not.toBeNull();
  });
});

describe('MrpRunBarComponent', () => {
  let store: MrpStore;
  let fixture: ComponentFixture<MrpRunBarComponent>;

  beforeEach(async () => {
    store = configure();
    store.runs.set([RUN]);
    store.selectRun('run-1');
    store.detail.set(DETAIL);
    fixture = TestBed.createComponent(MrpRunBarComponent);
    await settle(fixture);
  });

  it('shows the status, the duration and the KPI cards of the selected run', () => {
    expect(byId(host(fixture), 'run-status')?.textContent).toContain('MRP.RUN_STATUS_COMPLETED');
    expect(byId(host(fixture), 'run-duration')?.textContent).toContain('MRP.RUN_DURATION');
    expect(byId(host(fixture), 'kpi-proposals')?.textContent).toContain('4');
    expect(byId(host(fixture), 'kpi-overloaded')?.textContent).toContain('1');
    expect(byId(host(fixture), 'kpi-max-load')?.textContent).toContain('166.67');
    expect(byId(host(fixture), 'run-failed')).toBeNull();
  });

  it('shows the error of a failed run', async () => {
    store.detail.set({
      ...DETAIL,
      run: { ...RUN, status: 'Failed', error_message: 'Cyclic BOM detected' },
    });
    await settle(fixture);

    expect(byId(host(fixture), 'run-failed')?.textContent).toContain('Cyclic BOM detected');
  });

  it('validates the horizon between 1 and 730 days and starts the run with the form values', async () => {
    const form = fixture.componentInstance['form'];
    const refreshed = vi.fn();

    fixture.componentInstance.refresh.subscribe(refreshed);
    form.patchValue({ planning_horizon_days: 0 });
    expect(form.invalid).toBe(true);
    form.patchValue({ planning_horizon_days: 731 });
    expect(form.invalid).toBe(true);
    form.patchValue({
      planning_horizon_days: 120,
      capacity_scheduling_mode: 'FiniteCapacityConstraint',
      include_cross_border_customs_lead_time: true,
    });
    expect(form.valid).toBe(true);

    fixture.componentInstance['submit']();
    await settle(fixture);

    expect(api['startRun']).toHaveBeenCalledWith({
      planning_horizon_days: 120,
      run_mode: 'RegenerativeFull',
      capacity_scheduling_mode: 'FiniteCapacityConstraint',
      scheduling_direction: 'BackwardFromDueDate',
      include_cross_border_customs_lead_time: true,
      apply_supplier_shutdown_calendars: false,
    });
    expect(refreshed).toHaveBeenCalled();
  });

  it('does not start a run with an invalid horizon', async () => {
    fixture.componentInstance['form'].patchValue({ planning_horizon_days: 1000 });
    fixture.componentInstance['submit']();
    await settle(fixture);

    expect(api['startRun']).not.toHaveBeenCalled();
  });
});
