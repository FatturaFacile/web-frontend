import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { MfgCockpit, MfgProductionOrderResource } from '@core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmationInput, ManufacturingFacadeService } from './manufacturing.facade';

const base = `${environment.apiBaseUrl}/manufacturing`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COCKPIT: MfgCockpit = {
  orders: { by_strategy: { MTO: 2, MTS: 1, ATO: 1 }, by_status: { released: 3, in_progress: 1 }, open: 4 },
  machines: {
    by_state: { RUNNING: 3, SETUP: 1, IDLE: 0, FAULT: 1, MAINTENANCE: 0 },
    alerts: [{ machine_id: 'm1', machine_code: 'CNC-1', state: 'FAULT', since: '2026-03-01T08:00:00+00:00' }],
  },
  oee: [],
  bottlenecks: [{ work_center_id: 'wc-1', work_center_code: 'WC1', utilization_percent: '91.00' }],
  mrp_exceptions: { run_id: null, shortages: 0, items: [] },
  wip: { valuation: '120.0000', standard_cost: '100.0000', variance: '20.0000' },
  kpis: {
    window_days: 30,
    orders: { completed: 0, average_lead_time_days: null, on_time_percent: null },
    quality: { good_quantity: '0', scrap_quantity: '0', scrap_rate_percent: null },
    variances: { orders_closed: 0, material: '0', labor: '0', overhead: '0', subcontract: '0', total: '0' },
  },
};

const order = (id: string, status: MfgProductionOrderResource['status'] = 'planned'): MfgProductionOrderResource => ({
  id,
  order_number: `PO-${id}`,
  mfg_item_id: 'item',
  status,
  target_quantity: '10',
  completed_quantity: '0',
  scrapped_quantity: '0',
  uom: 'pcs',
  planned_start_date: '2026-03-02',
  planned_end_date: '2026-03-03',
});

const input = (overrides: Partial<ConfirmationInput> = {}): ConfirmationInput => ({
  runMinutes: '12.50',
  goodQuantity: '5',
  scrapQuantity: '0',
  isFinal: false,
  ...overrides,
});

describe('ManufacturingFacadeService', () => {
  let facade: ManufacturingFacadeService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    facade = TestBed.inject(ManufacturingFacadeService);
    http = TestBed.inject(HttpTestingController);
  });

  describe('control tower', () => {
    it('loads the cockpit for the window and derives the views', () => {
      facade.setWindowDays(14);
      facade.refreshCockpit().subscribe();
      const req = http.expectOne(`${base}/cockpit?window_days=14`);
      expect(facade.cockpitLoading()).toBe(true);
      req.flush({ success: true, message: '', data: COCKPIT });

      expect(facade.cockpitLoading()).toBe(false);
      expect(facade.pipeline().map((s) => s.count)).toEqual([2, 1, 1]);
      expect(facade.pipeline()[0]?.share).toBe(50);
      expect(facade.machineMatrix().find((r) => r.state === 'FAULT')?.count).toBe(1);
      expect(facade.machineAlerts()).toHaveLength(1);
      expect(facade.wip()).toMatchObject({ valuation: 120, standard: 100, variance: 20 });
      expect(facade.lastUpdated()).not.toBeNull();
    });

    it('keeps the last data and reports the error when a refresh fails', () => {
      facade.refreshCockpit().subscribe();
      http.expectOne(`${base}/cockpit?window_days=30`).flush({ success: true, message: '', data: COCKPIT });

      facade.refreshCockpit().subscribe({ error: () => undefined });
      http.expectOne(`${base}/cockpit?window_days=30`).flush({ message: 'down' }, { status: 500, statusText: 'x' });

      expect(facade.cockpit()).not.toBeNull();
      expect(facade.cockpitError()).toBe('down');
      expect(facade.cockpitLoading()).toBe(false);
    });

    it('clamps the window to the range the API accepts', () => {
      facade.setWindowDays(0);
      expect(facade.windowDays()).toBe(1);
      facade.setWindowDays(900);
      expect(facade.windowDays()).toBe(365);
    });

    it('polls until stopped', () => {
      vi.useFakeTimers();
      facade.startPolling(1000);
      vi.advanceTimersByTime(1);
      expect(facade.polling()).toBe(true);
      expect(facade.pollMs()).toBe(5000);
      http.expectOne(`${base}/cockpit?window_days=30`).flush({ success: true, message: '', data: COCKPIT });
      facade.stopPolling();
      vi.advanceTimersByTime(60_000);
      expect(facade.polling()).toBe(false);
      http.verify();
      vi.useRealTimers();
    });
  });

  describe('operation confirmations', () => {
    const url = `${base}/production-orders/o1/operations/op1/confirmations`;

    it('sends a uuid and reports a booking (201)', () => {
      let replayed: boolean | undefined;
      facade.confirmOperation('o1', 'op1', input()).subscribe((r) => (replayed = r.replayed));
      const req = http.expectOne(url);
      expect(req.request.body.operation_posting_uuid).toMatch(UUID);
      expect(req.request.body).toMatchObject({ run_minutes: '12.50', good_quantity: '5', scrap_quantity: '0', is_final: false });
      req.flush({ success: true, message: '', data: { id: 'c1' } }, { status: 201, statusText: 'Created' });
      expect(replayed).toBe(false);
      expect(facade.posting()).toBe(false);
    });

    it('reuses the uuid when the same booking is retried after a failure', () => {
      facade.confirmOperation('o1', 'op1', input()).subscribe({ error: () => undefined });
      const first = http.expectOne(url);
      const uuid = first.request.body.operation_posting_uuid as string;
      first.flush({ message: 'timeout' }, { status: 503, statusText: 'x' });

      let replayed: boolean | undefined;
      facade.confirmOperation('o1', 'op1', input()).subscribe((r) => (replayed = r.replayed));
      const retry = http.expectOne(url);
      expect(retry.request.body.operation_posting_uuid).toBe(uuid);
      retry.flush({ success: true, message: '', data: { id: 'c1' } }, { status: 200, statusText: 'OK' });
      expect(replayed).toBe(true);
    });

    it('generates a new uuid when the values change or after a success', () => {
      facade.confirmOperation('o1', 'op1', input()).subscribe({ error: () => undefined });
      const first = http.expectOne(url);
      const uuid = first.request.body.operation_posting_uuid as string;
      first.flush({ message: 'x' }, { status: 500, statusText: 'x' });

      facade.confirmOperation('o1', 'op1', input({ goodQuantity: '6' })).subscribe();
      const changed = http.expectOne(url);
      expect(changed.request.body.operation_posting_uuid).not.toBe(uuid);
      changed.flush({ success: true, message: '', data: { id: 'c2' } }, { status: 201, statusText: 'Created' });

      facade.confirmOperation('o1', 'op1', input({ goodQuantity: '6' })).subscribe();
      const next = http.expectOne(url);
      expect(next.request.body.operation_posting_uuid).not.toBe(changed.request.body.operation_posting_uuid);
      next.flush({ success: true, message: '', data: { id: 'c3' } }, { status: 201, statusText: 'Created' });
    });

    it('sends the scrap reason only with scrap', () => {
      facade.confirmOperation('o1', 'op1', input({ scrapQuantity: '2', scrapReason: 'defect' })).subscribe();
      const req = http.expectOne(url);
      expect(req.request.body).toMatchObject({ scrap_quantity: '2', scrap_reason: 'defect' });
      req.flush({ success: true, message: '', data: { id: 'c1' } }, { status: 201, statusText: 'Created' });
    });
  });

  describe('rescheduling', () => {
    const target = { start: '2026-03-09', end: '2026-03-10' };

    function answerLoad(orderId: string, workCenterId: string, available: string, load: string): void {
      http.expectOne(`${base}/production-orders/${orderId}`).flush({
        success: true,
        message: '',
        data: {
          ...order(orderId),
          operations: [
            {
              id: 'op1', sequence: 10, operation_code: null, name: 'Turn', work_center_id: workCenterId, status: 'pending',
              is_subcontracted: false, scheduled_date: null, planned_setup_minutes: '60', planned_run_minutes: '180',
              planned_labor_minutes: null, actual_setup_minutes: '0', actual_run_minutes: '0', completed_quantity: '0', scrapped_quantity: '0',
            },
          ],
        },
      });
      http
        .expectOne((req) => req.url === `${base}/work-centers/${workCenterId}/capacity`)
        .flush({
          success: true,
          message: '',
          data: [
            { date: '2026-03-09', gross_hours: available, available_hours: available, load_hours: load, utilization_percent: null, is_exception: false },
            { date: '2026-03-10', gross_hours: available, available_hours: available, load_hours: '0', utilization_percent: null, is_exception: false },
          ],
        });
    }

    it('books the move when the work centres have the capacity', () => {
      facade.orders.set([order('o1')]);
      let saved: string | undefined;
      facade.reschedule('o1', target).subscribe((o) => (saved = o.order?.id));
      answerLoad('o1', 'wc-1', '8', '2');

      const post = http.expectOne(`${base}/production-orders/o1/reschedule`);
      expect(post.request.body).toEqual({ planned_start_date: '2026-03-09', planned_end_date: '2026-03-10' });
      post.flush({ success: true, message: '', data: { ...order('o1'), planned_start_date: '2026-03-09', planned_end_date: '2026-03-10' } });

      expect(saved).toBe('o1');
      expect(facade.orders()[0]?.planned_start_date).toBe('2026-03-09');
    });

    it('refuses an overload without calling the reschedule endpoint', () => {
      facade.orders.set([order('o1')]);
      let outcome: { ok: boolean; saved: boolean } | undefined;
      facade.reschedule('o1', target).subscribe((o) => (outcome = { ok: o.check.ok, saved: o.order !== null }));
      answerLoad('o1', 'wc-1', '2', '1');

      http.expectNone(`${base}/production-orders/o1/reschedule`);
      expect(outcome).toEqual({ ok: false, saved: false });
      expect(facade.orders()[0]?.planned_start_date).toBe('2026-03-02');
    });

    it('refuses an order that is already in progress', () => {
      facade.orders.set([order('o1', 'in_progress')]);
      let ok: boolean | undefined;
      facade.reschedule('o1', target).subscribe((o) => (ok = o.check.ok));
      http.expectOne(`${base}/production-orders/o1`).flush({ success: true, message: '', data: { ...order('o1', 'in_progress'), operations: [] } });
      http.expectNone(`${base}/production-orders/o1/reschedule`);
      expect(ok).toBe(false);
    });
  });

  describe('batch release', () => {
    it('converts and releases the selected make orders one after the other and reports each', () => {
      facade.plannedOrders.set([
        { id: 'p1', planned_order_number: 'PL-1', mrp_run_id: 'r', mfg_item_id: 'i', order_type: 'make', quantity: '1', net_requirement: '1', bom_level: 0, uom: 'pcs', start_date: '2026-03-02', due_date: '2026-03-04', status: 'planned' },
        { id: 'p2', planned_order_number: 'PL-2', mrp_run_id: 'r', mfg_item_id: 'i', order_type: 'make', quantity: '1', net_requirement: '1', bom_level: 0, uom: 'pcs', start_date: '2026-03-02', due_date: '2026-03-04', status: 'planned' },
        { id: 'p3', planned_order_number: 'PL-3', mrp_run_id: 'r', mfg_item_id: 'i', order_type: 'buy', quantity: '1', net_requirement: '1', bom_level: 0, uom: 'pcs', start_date: '2026-03-02', due_date: '2026-03-04', status: 'planned' },
      ]);
      expect(facade.releasablePlanned().map((p) => p.id)).toEqual(['p1', 'p2']);
      facade.selectAllReleasable(true);

      let done: { released: boolean; error: string | null }[] = [];
      facade.batchRelease().subscribe((r) => (done = r));

      http.expectOne(`${base}/mrp/planned-orders/p1/convert`).flush({ success: true, message: '', data: order('o1') });
      http.expectOne(`${base}/production-orders/o1/release`).flush({ success: true, message: '', data: order('o1', 'released') });
      http.expectOne(`${base}/mrp/planned-orders/p2/convert`).flush({ message: 'No BOM' }, { status: 422, statusText: 'x' });

      expect(done.map((r) => [r.released, r.error])).toEqual([
        [true, null],
        [false, 'No BOM'],
      ]);
      expect(facade.batchRunning()).toBe(false);
      // The planning data are reloaded after the batch.
      http.match(() => true).forEach((req) => req.flush({ success: true, message: '', data: [], meta: {} }));
    });
  });

  describe('inspector', () => {
    it('loads genealogy and cost report together', () => {
      facade.inspect('o1');
      http.expectOne(`${base}/production-orders/o1/genealogy`).flush({
        success: true,
        message: '',
        data: { production_order_id: 'o1', order_number: 'PO-1', output_lots: [], operations: [], machine_events: [] },
      });
      http.expectOne(`${base}/production-orders/o1/cost-rollup`).flush({
        success: true,
        message: '',
        data: { production_order_id: 'o1', totals: { variance: '1.00' }, elements: {} },
      });
      expect(facade.genealogy()?.order_number).toBe('PO-1');
      expect(facade.costReport()).not.toBeNull();
      expect(facade.inspectorLoading()).toBe(false);
    });

    it('reports a failing load', () => {
      facade.inspect('o1');
      http.expectOne(`${base}/production-orders/o1/genealogy`).flush({ message: 'gone' }, { status: 404, statusText: 'x' });
      http.match(`${base}/production-orders/o1/cost-rollup`);
      expect(facade.inspectorError()).toBe('gone');
    });
  });
});
