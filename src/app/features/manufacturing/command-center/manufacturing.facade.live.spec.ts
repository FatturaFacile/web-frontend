import { HttpDownloadProgressEvent, HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { MfgCockpit, MfgCockpitMachines, MfgPlannedOrderResource, MfgProductionOrderResource } from '@core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManufacturingFacadeService } from './manufacturing.facade';

const base = `${environment.apiBaseUrl}/manufacturing`;
const STREAM = `${base}/machines/stream`;
const COCKPIT_URL = `${base}/cockpit?window_days=30`;

const MACHINES: MfgCockpitMachines = {
  by_state: { RUNNING: 2, SETUP: 0, IDLE: 0, FAULT: 1, MAINTENANCE: 0 },
  alerts: [{ machine_id: 'm1', machine_code: 'CNC-1', state: 'FAULT', since: null }],
};

const COCKPIT: MfgCockpit = {
  orders: { by_strategy: { MTO: 1, MTS: 0, ATO: 0 }, by_status: {}, open: 1 },
  machines: { by_state: { RUNNING: 3, SETUP: 0, IDLE: 0, FAULT: 0, MAINTENANCE: 0 }, alerts: [] },
  oee: [],
  bottlenecks: [],
  mrp_exceptions: { run_id: null, shortages: 0, items: [] },
  wip: { valuation: '0', standard_cost: '0', variance: '0' },
  kpis: {
    window_days: 30,
    orders: { completed: 0, average_lead_time_days: null, on_time_percent: null },
    quality: { good_quantity: '0', scrap_quantity: '0', scrap_rate_percent: null },
    variances: { orders_closed: 0, material: '0', labor: '0', overhead: '0', subcontract: '0', total: '0' },
  },
};

const sse = (machines: MfgCockpitMachines): string => `event: machines\ndata: ${JSON.stringify(machines)}\n\n`;
const progress = (partialText: string): HttpDownloadProgressEvent => ({
  type: HttpEventType.DownloadProgress,
  loaded: partialText.length,
  partialText,
});

const order = (id: string): MfgProductionOrderResource => ({
  id,
  order_number: `PO-${id}`,
  mfg_item_id: 'item',
  status: 'planned',
  target_quantity: '10',
  completed_quantity: '0',
  scrapped_quantity: '0',
  uom: 'pcs',
  planned_start_date: '2026-03-02',
  planned_end_date: '2026-03-03',
});

describe('ManufacturingFacadeService live mode and server-side rescheduling', () => {
  let facade: ManufacturingFacadeService;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    facade = TestBed.inject(ManufacturingFacadeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    facade.stopLive();
    vi.useRealTimers();
  });

  describe('live mode', () => {
    it('patches the machine matrix from the stream and slows the cockpit refresh down', () => {
      facade.startLive();
      vi.advanceTimersByTime(1);
      expect(facade.connection()).toBe('polling');
      http.expectOne(COCKPIT_URL).flush({ success: true, message: '', data: COCKPIT });

      const stream = http.expectOne(STREAM);
      stream.event(progress(sse(MACHINES)));

      expect(facade.connection()).toBe('sse');
      expect(facade.pollMs()).toBe(60_000);
      expect(facade.machineMatrix().find((r) => r.state === 'FAULT')?.count).toBe(1);
      expect(facade.machineAlerts()[0]?.machine_code).toBe('CNC-1');
      // The rest of the cockpit is kept.
      expect(facade.pipeline()[0]?.count).toBe(1);

      // The next chunk carries the heartbeat and a second event: only the new complete event is applied.
      const second: MfgCockpitMachines = { ...MACHINES, by_state: { ...MACHINES.by_state, FAULT: 0, RUNNING: 3 }, alerts: [] };
      stream.event(progress(`${sse(MACHINES)}: heartbeat\n\n${sse(second)}`));
      expect(facade.machineAlerts()).toHaveLength(0);
    });

    it('reconnects when the server ends the stream at its deadline', () => {
      facade.startLive();
      vi.advanceTimersByTime(1);
      http.expectOne(COCKPIT_URL).flush({ success: true, message: '', data: COCKPIT });
      http.expectOne(STREAM).flush(sse(MACHINES));

      vi.advanceTimersByTime(1_000);
      http.expectOne(STREAM);
    });

    it('falls back to polling when the stream cannot be opened and tries it again after a minute', () => {
      facade.startLive();
      vi.advanceTimersByTime(1);
      http.expectOne(COCKPIT_URL).flush({ success: true, message: '', data: COCKPIT });
      http.expectOne(STREAM).flush('no', { status: 503, statusText: 'Unavailable' });

      expect(facade.connection()).toBe('polling');
      expect(facade.pollMs()).toBe(15_000);
      expect(facade.live()).toBe(true);

      vi.advanceTimersByTime(1);
      http.match(COCKPIT_URL).forEach((req) => req.flush({ success: true, message: '', data: COCKPIT }));
      vi.advanceTimersByTime(60_000);
      http.expectOne(STREAM);
    });

    it('stops everything', () => {
      facade.startLive();
      vi.advanceTimersByTime(1);
      http.expectOne(COCKPIT_URL).flush({ success: true, message: '', data: COCKPIT });
      http.expectOne(STREAM);

      facade.stopLive();
      expect(facade.live()).toBe(false);
      expect(facade.connection()).toBe('off');
      expect(facade.polling()).toBe(false);
      vi.advanceTimersByTime(120_000);
      http.expectNone(COCKPIT_URL);
    });
  });

  describe('rescheduling', () => {
    const target = { start: '2026-03-09', end: '2026-03-10' };

    it('reports the refusal of the API as a failed check and books nothing', () => {
      facade.orders.set([order('o1')]);
      let outcome: { ok: boolean; message?: string; saved: boolean } | undefined;
      facade.reschedule('o1', target, true).subscribe((o) => (outcome = { ok: o.check.ok, message: o.check.issues[0]?.message, saved: o.order !== null }));

      const post = http.expectOne(`${base}/production-orders/o1/reschedule`);
      expect(post.request.body).toEqual({ planned_start_date: '2026-03-09', planned_end_date: '2026-03-10', allow_overload: true });
      post.flush({ message: 'Work centre [WC] is overloaded' }, { status: 422, statusText: 'Unprocessable' });

      expect(outcome).toEqual({ ok: false, message: 'Work centre [WC] is overloaded', saved: false });
      expect(facade.orders()[0]?.planned_start_date).toBe('2026-03-02');
    });

    it('does not send allow_overload unless asked and skips the local check when it is', () => {
      facade.orders.set([order('o1')]);
      facade.reschedule('o1', target, true).subscribe();
      // No operations or capacity requests: the move goes straight to the API.
      http.expectNone(`${base}/production-orders/o1`);
      http.expectOne(`${base}/production-orders/o1/reschedule`).flush({ success: true, message: '', data: { ...order('o1'), planned_start_date: '2026-03-09' } });
      expect(facade.orders()[0]?.planned_start_date).toBe('2026-03-09');
    });

    it('moves an MRP planned order and reports a refusal of the API', () => {
      const planned: MfgPlannedOrderResource = {
        id: 'p1', planned_order_number: 'PL-1', mrp_run_id: 'r', mfg_item_id: 'i', order_type: 'make', quantity: '1',
        net_requirement: '1', bom_level: 0, uom: 'pcs', start_date: '2026-03-02', due_date: '2026-03-04', status: 'planned',
      };
      facade.plannedOrders.set([planned]);

      let moved: string | null | undefined;
      facade.reschedulePlannedOrder('p1', target).subscribe((o) => (moved = o.plannedOrder?.start_date));
      const post = http.expectOne(`${base}/mrp/planned-orders/p1/reschedule`);
      expect(post.request.body).toEqual({ start_date: '2026-03-09', due_date: '2026-03-10' });
      post.flush({ success: true, message: '', data: { ...planned, start_date: '2026-03-09', due_date: '2026-03-10' } });
      expect(moved).toBe('2026-03-09');
      expect(facade.plannedOrders()[0]?.due_date).toBe('2026-03-10');

      let error: string | null | undefined;
      facade.reschedulePlannedOrder('p1', target).subscribe((o) => (error = o.error));
      http.expectOne(`${base}/mrp/planned-orders/p1/reschedule`).flush({ message: 'Planned order [PL-1] is converted' }, { status: 422, statusText: 'x' });
      expect(error).toBe('Planned order [PL-1] is converted');
    });
  });
});
