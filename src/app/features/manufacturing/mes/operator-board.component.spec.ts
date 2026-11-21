import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManufacturingApiService } from '@core';
import { AuthStore } from '@core/auth/auth.store';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { icons } from '../../../icons-provider';
import { MesApiService } from './mes-api.service';
import { MesDeclarationDialogComponent } from './mes-declaration-dialog.component';
import { MesLotDialogComponent } from './mes-lot-dialog.component';
import { OperatorBoardComponent } from './operator-board.component';
import { MesBoard, MesComponent, MesPhase } from './mes.models';

const ok = <T>(data: T) => of({ success: true, message: '', data });
const byId = (f: ComponentFixture<unknown>, id: string): HTMLButtonElement | null =>
  (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);

async function settle(f: ComponentFixture<unknown>): Promise<void> {
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

function phase(overrides: Partial<MesPhase> = {}): MesPhase {
  return {
    id: 'p-1',
    version: 2,
    status: 'running',
    allowed_actions: [
      'start_production',
      'suspend',
      'declare_production',
      'consume_material',
      'close',
    ],
    resume_to: null,
    machine_mode: 'attended',
    operator_id: 'u-1',
    machine_id: null,
    work_center_id: 'wc-1',
    production_order: {
      id: 'o-1',
      order_number: 'PO-1',
      item_code: 'FG',
      item_name: 'Pump',
      target_quantity: '10.0000',
    },
    operation: {
      id: 'op-10',
      sequence: 10,
      name: 'Machining',
      completed_quantity: '0.0000',
      scrapped_quantity: '0.0000',
    },
    open_interval: {
      category: 'run',
      started_at: '2026-01-05T08:00:00Z',
      machine_attended: true,
      suspension_reason: null,
    },
    times: {
      setup_seconds: 900,
      run_seconds: 3600,
      attended_run_seconds: 3600,
      unattended_run_seconds: 0,
      downtime_seconds: 60,
      man_seconds: 4500,
      machine_seconds: 4500,
      setup_minutes: '15.00',
      run_minutes: '60.00',
      downtime_minutes: '1.00',
      man_minutes: '75.00',
      machine_minutes: '75.00',
      man_seconds_by_operator: {},
      downtime_seconds_by_reason: {},
    },
    declared: { good_quantity: '4.0000', scrap_quantity: '1.0000' },
    consumptions_count: 0,
    components: [],
    taken_over_at: '2026-01-05T07:00:00Z',
    closed_at: null,
    server_time: '2026-01-05T08:00:00Z',
    ...overrides,
  };
}

function setup(board: MesBoard): ComponentFixture<OperatorBoardComponent> {
  TestBed.configureTestingModule({
    providers: [
      provideNzIcons(icons),
      provideNzI18n(en_US),
      provideNzDateFnsAdapter(),
      { provide: AuthStore, useValue: { user: () => ({ id: 'u-1' }) } },
      {
        provide: ManufacturingApiService,
        useValue: {
          getWorkCenters: () => ok([{ id: 'wc-1', work_center_code: 'WC-1', name: 'Assembly' }]),
        },
      },
      { provide: MesApiService, useValue: { getBoard: () => ok(board) } },
    ] as never,
  });

  return TestBed.createComponent(OperatorBoardComponent);
}

const emptyBoard = (phases: MesPhase[], available: MesPhase[] = []): MesBoard => ({
  server_time: '2026-01-05T08:00:00Z',
  work_center: { id: 'wc-1', code: 'WC-1', name: 'Assembly' },
  phases,
  available,
});

describe('OperatorBoardComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the live counters and enables only the actions allowed in the running state', async () => {
    const fixture = setup(emptyBoard([phase()]));
    await settle(fixture);
    (
      fixture.componentInstance as unknown as { selectWorkCenter(id: string): void }
    ).selectWorkCenter('wc-1');
    await settle(fixture);

    expect(byId(fixture, 'man-time')?.textContent?.trim()).toMatch(/^01:15:0\d$/);
    expect(byId(fixture, 'downtime')?.textContent?.trim()).toMatch(/^00:01:0\d$/);
    expect(byId(fixture, 'suspend')?.disabled).toBe(false);
    expect(byId(fixture, 'declare')?.disabled).toBe(false);
    expect(byId(fixture, 'close')?.disabled).toBe(false);
    expect(byId(fixture, 'resume')?.disabled).toBe(true);
    expect(byId(fixture, 'start-setup')?.disabled).toBe(true);
    expect(byId(fixture, 'take-over')?.disabled).toBe(true);
    expect(byId(fixture, 'start-run')?.disabled).toBe(true);
    expect(byId(fixture, 'start-run-unattended')?.disabled).toBe(false);
  });

  it('offers only the take-over on an operation nobody took over', async () => {
    const open = phase({
      id: null,
      version: 0,
      status: 'available',
      allowed_actions: ['take_over'],
      open_interval: null,
      operation: {
        id: 'op-20',
        sequence: 20,
        name: 'Assembly',
        completed_quantity: '0.0000',
        scrapped_quantity: '0.0000',
      },
    });
    const fixture = setup(emptyBoard([], [open]));
    await settle(fixture);
    (
      fixture.componentInstance as unknown as { selectWorkCenter(id: string): void }
    ).selectWorkCenter('wc-1');
    await settle(fixture);

    expect(byId(fixture, 'take-over')?.disabled).toBe(false);
    for (const id of ['start-setup', 'start-run', 'suspend', 'resume', 'declare', 'lot', 'close']) {
      expect(byId(fixture, id)?.disabled, id).toBe(true);
    }
  });

  it('tells the operator to pick a work centre first', async () => {
    const fixture = setup(emptyBoard([]));
    await settle(fixture);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'MFG_MES.PICK_WORK_CENTER',
    );
    expect(byId(fixture, 'close')).toBeNull();
  });
});

describe('MesDeclarationDialogComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideNzIcons(icons), provideNzI18n(en_US), provideNzDateFnsAdapter()] as never,
    });
  });

  interface Dialog {
    good: { set(v: string): void };
    scrap: { set(v: string): void };
    defect: { set(v: 'surface' | null): void };
    canConfirm(): boolean;
    confirm(): void;
  }
  const dialog = (): { component: Dialog; emitted: unknown[] } => {
    const fixture = TestBed.createComponent(MesDeclarationDialogComponent);
    const emitted: unknown[] = [];
    fixture.componentInstance.confirmed.subscribe((value) => emitted.push(value));

    return { component: fixture.componentInstance as unknown as Dialog, emitted };
  };

  it('needs a piece, and a defect reason as soon as pieces are scrapped', () => {
    const { component, emitted } = dialog();

    expect(component.canConfirm()).toBe(false);
    component.good.set('5');
    expect(component.canConfirm()).toBe(true);
    component.scrap.set('2');
    expect(component.canConfirm()).toBe(false);
    component.confirm();
    expect(emitted).toEqual([]);

    component.defect.set('surface');
    expect(component.canConfirm()).toBe(true);
    component.confirm();
    expect(emitted).toEqual([
      { goodQuantity: '5', scrapQuantity: '2', defectReason: 'surface', note: null },
    ]);
  });

  it('drops a defect reason when nothing is scrapped', () => {
    const { component, emitted } = dialog();
    component.good.set('3');
    component.defect.set('surface');
    component.confirm();

    expect(emitted).toEqual([
      { goodQuantity: '3', scrapQuantity: '0', defectReason: null, note: null },
    ]);
  });
});

describe('MesLotDialogComponent', () => {
  const components: MesComponent[] = [
    {
      mfg_item_id: 'i-1',
      item_code: 'RM-ALLOY',
      item_name: 'Alloy',
      required_quantity: '10.0000',
      consumed_quantity: '0.0000',
      lot_tracked: true,
    },
    {
      mfg_item_id: 'i-2',
      item_code: 'RM-SEAL',
      item_name: 'Seal',
      required_quantity: '5.0000',
      consumed_quantity: '0.0000',
      lot_tracked: false,
    },
  ];

  interface Dialog {
    itemId: { set(v: string | null): void };
    lot: { set(v: string): void };
    quantity: { set(v: string): void };
    canConfirm(): boolean;
    onEnter(event: Event): void;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideNzIcons(icons), provideNzI18n(en_US), provideNzDateFnsAdapter()] as never,
    });
  });

  function lotDialog(): { component: Dialog; emitted: unknown[] } {
    const fixture = TestBed.createComponent(MesLotDialogComponent);
    fixture.componentRef.setInput('components', components);
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.confirmed.subscribe((value) => emitted.push(value));

    return { component: fixture.componentInstance as unknown as Dialog, emitted };
  }

  it('requires the lot for a lot-tracked component and only a quantity for the others', () => {
    const { component } = lotDialog();

    component.itemId.set('i-1');
    component.quantity.set('2');
    expect(component.canConfirm()).toBe(false);
    component.lot.set('AL-2026-001');
    expect(component.canConfirm()).toBe(true);

    component.itemId.set('i-2');
    component.lot.set('');
    expect(component.canConfirm()).toBe(true);
    component.quantity.set('0');
    expect(component.canConfirm()).toBe(false);
  });

  it('confirms on the Enter of a barcode scanner once everything is typed, and does nothing before', () => {
    const { component, emitted } = lotDialog();
    const enter = new Event('keydown', { cancelable: true });

    component.itemId.set('i-1');
    component.lot.set('AL-2026-001');
    component.onEnter(enter);
    expect(emitted).toEqual([]);
    expect(enter.defaultPrevented).toBe(true);

    component.quantity.set('4');
    component.onEnter(new Event('keydown'));
    expect(emitted).toEqual([
      { mfgItemId: 'i-1', lotCode: 'AL-2026-001', quantity: '4', overConsumptionConfirmed: false },
    ]);
  });
});
