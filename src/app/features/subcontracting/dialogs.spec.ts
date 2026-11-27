import { signal, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SctComponent, SctOrder, TranslateService } from '@core';
import { MovementDialogComponent, MovementKind } from './movement-dialog.component';
import { OrderDetailStore } from './order-detail.store';
import { ProductionDialogComponent } from './production-dialog.component';
import { ReceiveDialogComponent } from './receive-dialog.component';
import { SubcontractingLookupService } from './subcontracting-lookup.service';
import { SCT_OK, SctOutcome } from './subcontracting.util';

const line = (overrides: Partial<SctComponent> = {}): SctComponent => ({
  id: 'c1',
  component_product_id: 'p1',
  sku: 'RAW',
  product_name: 'Raw steel',
  unit_of_measure: 'KG',
  required_qty_per_unit: '2.000000',
  total_planned_qty: '20.0000',
  dispatched_qty: '20.0000',
  consumed_qty: '0.0000',
  scrap_qty: '0.0000',
  returned_unused_qty: '0.0000',
  held_qty: '20.0000',
  to_dispatch_qty: '0.0000',
  lot_id: null,
  serial_number: null,
  ...overrides,
});

const order = (overrides: Partial<SctOrder> = {}): SctOrder =>
  ({
    id: 'o1',
    order_number: 'SCT-1',
    direction: 'passive',
    status: 'confirmed',
    partner_name: 'Galvanica Rossi',
    planned_quantity: '10.0000',
    received_quantity: '0.0000',
    delivered_quantity: '0.0000',
    open_quantity: '10.0000',
    currency: 'EUR',
    zero_balance_sheet_value: false,
    linked_production_order_id: null,
    components: [
      line({ id: 'c1', to_dispatch_qty: '20.0000', dispatched_qty: '0.0000', held_qty: '0.0000' }),
      line({ id: 'c2', component_product_id: 'p2', to_dispatch_qty: '5.0000', dispatched_qty: '0.0000', held_qty: '0.0000' }),
      line({ id: 'c3', component_product_id: 'p3', to_dispatch_qty: '0.0000', held_qty: '0.0000' }),
    ],
    ...overrides,
  }) as SctOrder;

/** The store the dialogs talk to: every action is a spy, the signals the templates read are plain signals. */
function fakeStore() {
  return {
    saving: signal(false),
    previewing: signal(false),
    plan: signal(null),
    clearPlan: vi.fn(),
    dispatch: vi.fn(),
    returnUnused: vi.fn(),
    receiveMaterials: vi.fn(),
    deliver: vi.fn(),
    receive: vi.fn(),
    preview: vi.fn(),
    produce: vi.fn(),
  };
}

const failed: SctOutcome = {
  ok: false,
  errorKey: 'subcontracting.error.dispatch_exceeds_plan',
  code: 'dispatch_exceeds_plan',
  detail: null,
  params: { max: '8.0000' },
  errors: {},
};

describe('subcontracting dialogs', () => {
  let store: ReturnType<typeof fakeStore>;

  async function open<T>(
    component: Type<T>,
    inputs: Record<string, unknown>,
  ): Promise<ComponentFixture<T>> {
    TestBed.overrideComponent(component, { set: { template: '<div></div>', imports: [] } });
    const fixture = TestBed.createComponent(component);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  beforeEach(() => {
    store = fakeStore();
    TestBed.configureTestingModule({
      providers: [
        { provide: OrderDetailStore, useValue: store },
        { provide: SubcontractingLookupService, useValue: { options: () => ({ subscribe: vi.fn() }) } },
        {
          provide: TranslateService,
          useValue: { currentLanguage: signal('en'), translate: (key: string) => key, instant: (key: string) => key },
        },
      ],
    });
  });

  describe('MovementDialogComponent', () => {
    const openMovement = (kind: MovementKind, current: SctOrder = order()) =>
      open(MovementDialogComponent, { order: current, kind, visible: true });

    it('starts the dispatch from the quantities still to send, skipping the lines with nothing left', async () => {
      const fixture = await openMovement('dispatch');

      const rows = fixture.componentInstance['rows']();
      expect(rows.map((row) => [row.component.id, row.max, row.quantity])).toEqual([
        ['c1', 20, 20],
        ['c2', 5, 5],
      ]);
    });

    it('dispatches the quantities the user changed and closes on success', async () => {
      store.dispatch.mockResolvedValue(SCT_OK);
      const fixture = await openMovement('dispatch');
      const closed = vi.fn();
      fixture.componentInstance.closed.subscribe(closed);
      fixture.componentInstance['rows']()[0].quantity = 12;
      fixture.componentInstance['rows']()[1].quantity = 0;
      fixture.componentInstance['carrier'] = ' Corriere Rapido ';

      await fixture.componentInstance['submit']();

      expect(store.dispatch).toHaveBeenCalledWith({
        lines: [{ component_id: 'c1', quantity: '12' }],
        carrier_name: 'Corriere Rapido',
      });
      expect(closed).toHaveBeenCalled();
    });

    it('keeps the drawer open and shows the refusal when the dispatch is refused', async () => {
      store.dispatch.mockResolvedValue(failed);
      const fixture = await openMovement('dispatch');
      const closed = vi.fn();
      fixture.componentInstance.closed.subscribe(closed);

      await fixture.componentInstance['submit']();

      expect(closed).not.toHaveBeenCalled();
      expect(fixture.componentInstance['feedback']()).toEqual(failed);
    });

    it('returns the material still held, line by line', async () => {
      store.returnUnused.mockResolvedValue(SCT_OK);
      const held = order({
        components: [line({ id: 'c1', held_qty: '10.0000', to_dispatch_qty: '0.0000' }), line({ id: 'c2', held_qty: '0.0000' })],
      });
      const fixture = await openMovement('returnUnused', held);

      expect(fixture.componentInstance['rows']().map((row) => row.component.id)).toEqual(['c1']);
      await fixture.componentInstance['submit']();

      expect(store.returnUnused).toHaveBeenCalledWith({ lines: [{ component_id: 'c1', quantity: '10' }] });
    });

    it('receives the customer material with the customer DDT', async () => {
      store.receiveMaterials.mockResolvedValue(SCT_OK);
      const fixture = await openMovement('receiveMaterials', order({ direction: 'active', zero_balance_sheet_value: true }));
      fixture.componentInstance['customerDdtNumber'] = ' CL-901 ';
      fixture.componentInstance['customerDdtDate'] = new Date(2026, 10, 3);

      await fixture.componentInstance['submit']();

      expect(store.receiveMaterials).toHaveBeenCalledWith({
        lines: [
          { component_id: 'c1', quantity: '20' },
          { component_id: 'c2', quantity: '5' },
        ],
        customer_ddt_number: 'CL-901',
        customer_ddt_date: '2026-11-03',
      });
    });

    it('delivers the processed goods not yet delivered, with the unused material when asked', async () => {
      store.deliver.mockResolvedValue(SCT_OK);
      const processed = order({ direction: 'active', received_quantity: '9.0000', delivered_quantity: '4.0000' });
      const fixture = await openMovement('deliver', processed);

      expect(fixture.componentInstance['deliverMax']).toBe(5);
      expect(fixture.componentInstance['deliverQuantity']).toBe(5);

      fixture.componentInstance['returnUnused'] = true;
      fixture.componentInstance['carrier'] = 'Corriere Rapido';
      await fixture.componentInstance['submit']();

      expect(store.deliver).toHaveBeenCalledWith({
        quantity: '5',
        return_unused_materials: true,
        carrier_name: 'Corriere Rapido',
      });
    });
  });

  describe('ReceiveDialogComponent', () => {
    const heldOrder = () =>
      order({
        status: 'materials_dispatched',
        components: [line({ id: 'c1' }), line({ id: 'c2', component_product_id: 'p2', held_qty: '5.0000' })],
      });

    it('proposes the whole quantity still expected as good units', async () => {
      const fixture = await open(ReceiveDialogComponent, { order: heldOrder(), visible: true });

      expect(fixture.componentInstance['good']).toBe(10);
      expect(fixture.componentInstance['overrides']().map((row) => row.component.id)).toEqual(['c1', 'c2']);
      expect(store.clearPlan).toHaveBeenCalled();
    });

    it('previews with the declared scrap and only the overrides the user typed', async () => {
      store.preview.mockResolvedValue(SCT_OK);
      const fixture = await open(ReceiveDialogComponent, { order: heldOrder(), visible: true });
      fixture.componentInstance['good'] = 8;
      fixture.componentInstance['scrapUnits'] = 2;
      fixture.componentInstance['overrides']()[0].consumed = 18;

      await fixture.componentInstance['preview']();

      expect(store.preview).toHaveBeenCalledWith({
        good_quantity: '8',
        scrap_quantity: '2',
        components: [{ component_id: 'c1', consumed_qty: '18' }],
      });
      expect(fixture.componentInstance['feedback']()).toBeNull();
    });

    it('receives with the vendor DDT and closes, or shows the refusal', async () => {
      const fixture = await open(ReceiveDialogComponent, { order: heldOrder(), visible: true });
      const closed = vi.fn();
      fixture.componentInstance.closed.subscribe(closed);
      fixture.componentInstance['good'] = 8;
      fixture.componentInstance['vendorDdtNumber'] = ' TZ-77 ';
      fixture.componentInstance['vendorDdtDate'] = new Date(2026, 10, 3);

      store.receive.mockResolvedValue({ ...failed, errorKey: 'subcontracting.error.receipt_exceeds_planned' });
      await fixture.componentInstance['submit']();
      expect(closed).not.toHaveBeenCalled();
      expect(fixture.componentInstance['feedback']()?.errorKey).toBe('subcontracting.error.receipt_exceeds_planned');

      store.receive.mockResolvedValue(SCT_OK);
      await fixture.componentInstance['submit']();

      expect(store.receive).toHaveBeenLastCalledWith({
        good_quantity: '8',
        scrap_quantity: '0',
        vendor_ddt_number: 'TZ-77',
        vendor_ddt_date: '2026-11-03',
      });
      expect(closed).toHaveBeenCalled();
    });
  });

  describe('ProductionDialogComponent', () => {
    it('records the production with the production order of Mod 064', async () => {
      store.produce.mockResolvedValue(SCT_OK);
      const active = order({ direction: 'active', status: 'materials_dispatched', linked_production_order_id: 'mo1' });
      const fixture = await open(ProductionDialogComponent, { order: active, visible: true });
      const closed = vi.fn();
      fixture.componentInstance.closed.subscribe(closed);

      expect(fixture.componentInstance['good']).toBe(10);
      expect(fixture.componentInstance['productionOrderId']).toBe('mo1');

      fixture.componentInstance['good'] = 9;
      fixture.componentInstance['scrapUnits'] = 1;
      await fixture.componentInstance['submit']();

      expect(store.produce).toHaveBeenCalledWith({
        good_quantity: '9',
        scrap_quantity: '1',
        production_order_id: 'mo1',
      });
      expect(closed).toHaveBeenCalled();
    });
  });
});
