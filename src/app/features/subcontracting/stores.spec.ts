import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SctOrder, SubcontractingApiService } from '@core';
import { DashboardStore } from './dashboard.store';
import { OrderDetailStore } from './order-detail.store';
import { OrdersStore } from './orders.store';
import { RegisterStore } from './register.store';

const envelope = <T>(data: T, meta?: object) => of({ success: true, message: '', data, meta });
const problem = (code: string) =>
  throwError(() => new HttpErrorResponse({ status: 422, error: { code, detail: 'Refused', params: { max: '8.0000' } } }));
const order = (overrides: Partial<SctOrder> = {}): SctOrder =>
  ({ id: 'o1', order_number: 'SCT-1', status: 'draft', direction: 'passive', components: [], ...overrides }) as SctOrder;

describe('subcontracting stores', () => {
  const api = {
    getDashboard: vi.fn(),
    getRegister: vi.fn(),
    exportRegister: vi.fn(),
    getCrossBorder: vi.fn(),
    listOrders: vi.fn(),
    getOrder: vi.fn(),
    createOrder: vi.fn(),
    confirmOrder: vi.fn(),
    cancelOrder: vi.fn(),
    dispatchMaterials: vi.fn(),
    previewReceipt: vi.fn(),
    receiveGoods: vi.fn(),
    returnUnused: vi.fn(),
    receiveCustomerMaterials: vi.fn(),
    recordProduction: vi.fn(),
    deliverGoods: vi.fn(),
  };

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    TestBed.configureTestingModule({
      providers: [
        DashboardStore,
        OrdersStore,
        OrderDetailStore,
        RegisterStore,
        { provide: SubcontractingApiService, useValue: api },
      ],
    });
  });

  describe('DashboardStore', () => {
    it('loads the stock held by partners with the chosen filters', async () => {
      const dashboard = { kpis: { units_held: '52.5000' }, rows: [], by_partner: [] };
      api.getDashboard.mockReturnValue(envelope(dashboard));
      const store = TestBed.inject(DashboardStore);

      await store.load({ direction: 'active', deadline_status: 'expired' });

      expect(api.getDashboard).toHaveBeenCalledWith({ direction: 'active', deadline_status: 'expired' });
      expect(store.dashboard()).toEqual(dashboard);
      expect(store.filters()).toEqual({ direction: 'active', deadline_status: 'expired' });
      expect(store.loading()).toBe(false);
    });

    it('keeps the key of the refusal when the load fails', async () => {
      api.getDashboard.mockReturnValue(problem('generic'));
      const store = TestBed.inject(DashboardStore);

      await store.load();

      expect(store.error()).toBe('subcontracting.error.generic');
      expect(store.loading()).toBe(false);
    });
  });

  describe('OrdersStore', () => {
    it('lists the orders with the page of the server and reloads with the filters of the toolbar', async () => {
      api.listOrders.mockReturnValue(envelope([order()], { total: 1, current_page: 1 }));
      const store = TestBed.inject(OrdersStore);

      await store.load();
      expect(api.listOrders).toHaveBeenLastCalledWith({ per_page: 25 });

      await store.load({ per_page: 25, page: 2, direction: 'passive' });

      expect(api.listOrders).toHaveBeenLastCalledWith({ per_page: 25, page: 2, direction: 'passive' });
      expect(store.orders()).toHaveLength(1);
      expect(store.meta()?.total).toBe(1);
    });

    it('creates an order and hands it back for the redirect to its workspace', async () => {
      api.createOrder.mockReturnValue(envelope(order({ id: 'o9' })));
      const store = TestBed.inject(OrdersStore);

      const outcome = await store.create({
        direction: 'passive',
        subcontracting_type: 'full_bom',
        partner_id: 'v1',
        output_product_id: 'p1',
        planned_quantity: '10',
      });

      expect(outcome.ok).toBe(true);
      expect(outcome.order?.id).toBe('o9');
      expect(store.saving()).toBe(false);
    });

    it('answers a refused creation with the key of its code and no order', async () => {
      api.createOrder.mockReturnValue(problem('no_components'));
      const store = TestBed.inject(OrdersStore);

      const outcome = await store.create({
        direction: 'active',
        subcontracting_type: 'full_bom',
        partner_id: 'c1',
        output_product_id: 'p1',
        planned_quantity: '1',
      });

      expect(outcome.ok).toBe(false);
      expect(outcome.errorKey).toBe('subcontracting.error.no_components');
      expect(outcome.order).toBeNull();
    });

    it('confirms and cancels from the list, then reloads it', async () => {
      api.listOrders.mockReturnValue(envelope([]));
      api.confirmOrder.mockReturnValue(envelope(order({ status: 'confirmed' })));
      api.cancelOrder.mockReturnValue(problem('cancel_after_movement'));
      const store = TestBed.inject(OrdersStore);

      expect((await store.confirm('o1')).ok).toBe(true);
      expect(api.listOrders).toHaveBeenCalledTimes(1);

      const refused = await store.cancel('o1');
      expect(refused.errorKey).toBe('subcontracting.error.cancel_after_movement');
      expect(api.listOrders).toHaveBeenCalledTimes(1);
    });
  });

  describe('OrderDetailStore', () => {
    beforeEach(() => {
      api.getOrder.mockReturnValue(envelope(order({ status: 'confirmed' })));
      api.getRegister.mockReturnValue(envelope([{ id: 'l1' }]));
    });

    it('takes the order every action answers with and refreshes the ledger of the order', async () => {
      api.dispatchMaterials.mockReturnValue(envelope(order({ status: 'materials_dispatched' })));
      const store = TestBed.inject(OrderDetailStore);
      await store.load('o1');

      const outcome = await store.dispatch({ lines: [{ component_id: 'c1', quantity: '12' }] });

      expect(outcome.ok).toBe(true);
      expect(api.dispatchMaterials).toHaveBeenCalledWith('o1', { lines: [{ component_id: 'c1', quantity: '12' }] });
      expect(store.order()?.status).toBe('materials_dispatched');
      expect(api.getRegister).toHaveBeenCalledWith({ order_id: 'o1', per_page: 200 });
      expect(store.ledger()).toHaveLength(1);
    });

    it('keeps the order and reports the refusal when an action is refused', async () => {
      api.dispatchMaterials.mockReturnValue(problem('dispatch_exceeds_plan'));
      const store = TestBed.inject(OrderDetailStore);
      await store.load('o1');

      const outcome = await store.dispatch({});

      expect(outcome.ok).toBe(false);
      expect(outcome.errorKey).toBe('subcontracting.error.dispatch_exceeds_plan');
      expect(outcome.params).toEqual({ max: '8.0000' });
      expect(store.order()?.status).toBe('confirmed');
      expect(store.saving()).toBe(false);
    });

    it('previews the receipt without touching the order, and drops the plan when asked or after the receipt', async () => {
      const plan = { good_quantity: '8', unit_cost: '32.500000', lines: [] };
      api.previewReceipt.mockReturnValue(envelope(plan));
      api.receiveGoods.mockReturnValue(envelope(order({ status: 'completed' })));
      const store = TestBed.inject(OrderDetailStore);
      await store.load('o1');

      expect((await store.preview({ good_quantity: '8', scrap_quantity: '2' })).ok).toBe(true);
      expect(api.previewReceipt).toHaveBeenCalledWith('o1', { good_quantity: '8', scrap_quantity: '2' });
      expect(store.plan()).toEqual(plan);
      expect(store.order()?.status).toBe('confirmed');

      store.clearPlan();
      expect(store.plan()).toBeNull();

      await store.preview({ good_quantity: '8' });
      await store.receive({ good_quantity: '8' });
      expect(store.plan()).toBeNull();
      expect(store.order()?.status).toBe('completed');
    });

    it('drives the active flow: customer material, production and delivery', async () => {
      api.receiveCustomerMaterials.mockReturnValue(envelope(order({ status: 'materials_dispatched', direction: 'active' })));
      api.recordProduction.mockReturnValue(envelope(order({ status: 'in_progress', direction: 'active' })));
      api.deliverGoods.mockReturnValue(envelope(order({ status: 'completed', direction: 'active' })));
      const store = TestBed.inject(OrderDetailStore);
      await store.load('o1');

      await store.receiveMaterials({ customer_ddt_number: 'CL-901' });
      expect(api.receiveCustomerMaterials).toHaveBeenCalledWith('o1', { customer_ddt_number: 'CL-901' });

      await store.produce({ good_quantity: '9', scrap_quantity: '1' });
      expect(api.recordProduction).toHaveBeenCalledWith('o1', { good_quantity: '9', scrap_quantity: '1' });

      await store.deliver({ quantity: '9', return_unused_materials: true });
      expect(api.deliverGoods).toHaveBeenCalledWith('o1', { quantity: '9', return_unused_materials: true });
      expect(store.order()?.status).toBe('completed');
    });

    it('returns the unused material and confirms or cancels the order', async () => {
      api.returnUnused.mockReturnValue(envelope(order({ status: 'partially_returned' })));
      api.confirmOrder.mockReturnValue(envelope(order({ status: 'confirmed' })));
      api.cancelOrder.mockReturnValue(envelope(order({ status: 'cancelled' })));
      const store = TestBed.inject(OrderDetailStore);
      await store.load('o1');

      await store.returnUnused({});
      expect(store.order()?.status).toBe('partially_returned');
      await store.confirm();
      expect(api.confirmOrder).toHaveBeenCalledWith('o1');
      await store.cancel();
      expect(store.order()?.status).toBe('cancelled');
    });
  });

  describe('RegisterStore', () => {
    it('loads the statutory register page by page and the TPP / TPA summary', async () => {
      api.getRegister.mockReturnValue(envelope([{ id: 'l1' }], { total: 80, current_page: 2 }));
      api.getCrossBorder.mockReturnValue(envelope({ regimes: [], orders: [] }));
      const store = TestBed.inject(RegisterStore);

      await store.load({ per_page: 50, page: 2, movement_type: 'outbound_dispatch' });
      await store.loadCrossBorder('tpp_outward_processing');

      expect(api.getRegister).toHaveBeenCalledWith({ per_page: 50, page: 2, movement_type: 'outbound_dispatch' });
      expect(store.lines()).toHaveLength(1);
      expect(store.meta()?.total).toBe(80);
      expect(api.getCrossBorder).toHaveBeenCalledWith('tpp_outward_processing');
      expect(store.crossBorder()).toEqual({ regimes: [], orders: [] });
    });

    it('exports with the filters of the register but without the page, and reports a refused export', async () => {
      api.getRegister.mockReturnValue(envelope([], { total: 0 }));
      const store = TestBed.inject(RegisterStore);
      await store.load({ per_page: 50, page: 3, direction: 'passive', from: '2026-01-01' });

      const save = vi.fn();
      vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() });
      vi.spyOn(document, 'createElement').mockReturnValue({ click: save, set href(_v: string) {}, set download(_v: string) {} } as unknown as HTMLAnchorElement);
      api.exportRegister.mockReturnValue(of(new Blob(['x'])));

      const outcome = await store.exportRegister('csv');

      expect(outcome.ok).toBe(true);
      expect(api.exportRegister).toHaveBeenCalledWith('csv', { direction: 'passive', from: '2026-01-01' });
      expect(save).toHaveBeenCalled();

      api.exportRegister.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403, error: {} })));
      const refused = await store.exportRegister('pdf');
      expect(refused.ok).toBe(false);
      expect(store.exporting()).toBe(false);

      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });
  });
});
