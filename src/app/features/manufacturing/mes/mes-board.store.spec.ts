import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { beforeEach, describe, expect, it } from 'vitest';
import { MesBoardStore } from './mes-board.store';
import { MesAction, MesBoard, MesPhase, MesPhaseStatus } from './mes.models';

const base = `${environment.apiBaseUrl}/manufacturing/mes`;

function row(overrides: Partial<MesPhase> = {}): MesPhase {
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
      setup_seconds: 0,
      run_seconds: 100,
      attended_run_seconds: 100,
      unattended_run_seconds: 0,
      downtime_seconds: 0,
      man_seconds: 100,
      machine_seconds: 100,
      setup_minutes: '0.00',
      run_minutes: '1.67',
      downtime_minutes: '0.00',
      man_minutes: '1.67',
      machine_minutes: '1.67',
      man_seconds_by_operator: {},
      downtime_seconds_by_reason: {},
    },
    declared: { good_quantity: '0.0000', scrap_quantity: '0.0000' },
    consumptions_count: 0,
    taken_over_at: '2026-01-05T07:00:00Z',
    closed_at: null,
    server_time: '2026-01-05T08:01:40Z',
    ...overrides,
  };
}

const available = (): MesPhase =>
  row({
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

const board = (
  phases: MesPhase[],
  open: MesPhase[] = [],
): { success: boolean; message: string; data: MesBoard } => ({
  success: true,
  message: 'OK',
  data: {
    server_time: '2026-01-05T08:01:40Z',
    work_center: { id: 'wc-1', code: 'WC-1', name: 'Assembly' },
    phases,
    available: open,
  },
});

describe('MesBoardStore', () => {
  let store: MesBoardStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), MesBoardStore],
    });
    store = TestBed.inject(MesBoardStore);
    http = TestBed.inject(HttpTestingController);
    store.setOperator('u-1');
  });

  function load(phases: MesPhase[], open: MesPhase[] = []): void {
    store.load('wc-1').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/board`);
    expect(req.request.params.get('work_center_id')).toBe('wc-1');
    req.flush(board(phases, open));
  }

  it('lists the phases first and the operations to take over after them, and selects the first row', () => {
    load([row()], [available()]);

    expect(store.loading()).toBe(false);
    expect(store.rows().map((r) => r.operation.sequence)).toEqual([10, 20]);
    expect(store.selected()?.id).toBe('p-1');
    store.select('op:op-20');
    expect(store.selected()?.status).toBe('available');
  });

  it('enables only the actions the server allows for the selected row', () => {
    load([row()], [available()]);
    const allowed = (action: MesAction): boolean => store.allowed().has(action);

    expect(allowed('suspend')).toBe(true);
    expect(allowed('resume')).toBe(false);
    expect(store.suspend('break')).not.toBeNull();
    expect(store.resume()).toBeNull();
    expect(store.startSetup()).toBeNull();

    store.select('op:op-20');
    expect(store.suspend('break')).toBeNull();
    expect(store.takeOver()).not.toBeNull();
  });

  it('advances the counters of the open interval from the time the board was received', () => {
    load([row()]);
    const received = store.receivedAtMs();

    store.nowMs.set(received + 30_000);
    expect(store.live()?.man).toBe(130);
    expect(store.live()?.machine).toBe(130);

    store.nowMs.set(received + 90_000);
    expect(store.live()?.run).toBe(190);
  });

  it('sends a command with the idempotency key, the version the operator saw and reloads the board', () => {
    load([row()]);

    store.suspend('machine_breakdown')?.subscribe();
    const req = http.expectOne(`${base}/phases/p-1/suspend`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.reason).toBe('machine_breakdown');
    expect(req.request.body.expected_version).toBe(2);
    expect(req.request.headers.get('Idempotency-Key')).toBe(req.request.body.idempotency_key);
    expect(store.busy()).toBe(true);
    req.flush({ success: true, message: 'OK', data: row({ status: 'suspended', version: 3 }) });

    const reload = http.expectOne((r) => r.url === `${base}/board`);
    reload.flush(
      board([row({ status: 'suspended', version: 3, allowed_actions: ['resume', 'close'] })]),
    );
    expect(store.busy()).toBe(false);
    expect(store.selected()?.status).toBe('suspended' satisfies MesPhaseStatus);
    expect(store.allowed().has('resume')).toBe(true);
  });

  it('reuses the key when the same action is retried after a network failure, and a new one for a new action', () => {
    load([row()]);

    store.close()?.subscribe({ error: () => undefined });
    const first = http.expectOne(`${base}/phases/p-1/close`);
    const key = first.request.body.idempotency_key as string;
    first.error(new ProgressEvent('error'), { status: 0 });
    expect(store.busy()).toBe(false);

    store.close()?.subscribe({ error: () => undefined });
    const retry = http.expectOne(`${base}/phases/p-1/close`);
    expect(retry.request.body.idempotency_key).toBe(key);
    retry.flush({ success: true, message: 'OK', data: row({ status: 'closed' }) });
    http.expectOne((r) => r.url === `${base}/board`).flush(board([]));

    load([row()]);
    store.suspend('break')?.subscribe({ error: () => undefined });
    const next = http.expectOne(`${base}/phases/p-1/suspend`);
    expect(next.request.body.idempotency_key).not.toBe(key);
    next.flush({ success: true, message: 'OK', data: row() });
    http.expectOne((r) => r.url === `${base}/board`).flush(board([row()]));
  });

  it('shows the validation message of a refused command and reloads when the phase is stale', () => {
    load([row()]);

    store.suspend('break')?.subscribe({ error: () => undefined });
    http
      .expectOne(`${base}/phases/p-1/suspend`)
      .flush(
        {
          message: 'The phase changed meanwhile',
          errors: { version: ['The phase changed meanwhile (version 5, expected 2): reload it.'] },
        },
        { status: 422, statusText: 'Unprocessable' },
      );

    expect(store.failure()).toEqual({
      field: 'version',
      message: 'The phase changed meanwhile (version 5, expected 2): reload it.',
      stale: true,
    });
    http.expectOne((r) => r.url === `${base}/board`).flush(board([row({ version: 5 })]));
    expect(store.selected()?.version).toBe(5);

    store.clearFailure();
    expect(store.failure()).toBeNull();
  });

  it('keeps the selection on the operation after the take-over gave it a phase', () => {
    load([], [available()]);
    expect(store.selected()?.id).toBeNull();

    store.takeOver()?.subscribe();
    const req = http.expectOne(`${base}/phases/take-over`);
    expect(req.request.body).toMatchObject({
      production_order_operation_id: 'op-20',
      operator_id: 'u-1',
    });
    expect(req.request.body.expected_version).toBeUndefined();
    req.flush({ success: true, message: 'OK', data: row() });

    http
      .expectOne((r) => r.url === `${base}/board`)
      .flush(board([row({ id: 'p-9', status: 'assigned', operation: available().operation })]));
    expect(store.selected()?.id).toBe('p-9');
  });

  it('declines the take-over without an operator', () => {
    load([], [available()]);
    store.setOperator(null);

    expect(store.takeOver()).toBeNull();
  });
});
