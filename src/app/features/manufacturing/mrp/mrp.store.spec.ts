import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MrpApiService } from './mrp-api.service';
import { DETAIL, GANTT, PEGGING, proposal, RUN, typed } from './mrp.fixtures';
import { MrpProposal } from './mrp.models';
import { MrpStore } from './mrp.store';

const ok = <T, M = undefined>(data: T, meta?: M) => of({ success: true, message: '', data, meta });
const page = { current_page: 1, per_page: 25, total: 3, last_page: 1 };

const PROPOSALS: MrpProposal[] = [
  typed('p1', 'PlannedPurchaseRequisition'),
  typed('p2', 'PlannedProductionOrder'),
  typed('p3', 'RescheduleIn_Expedite', { exception_messages: ['Expedite'] }),
];

describe('MrpStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let notification: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
  };
  let store: MrpStore;

  beforeEach(() => {
    api = {
      runs: vi.fn(() => ok([RUN], page)),
      startRun: vi.fn(() => ok(RUN)),
      run: vi.fn(() => ok(DETAIL)),
      proposals: vi.fn(() => ok(PROPOSALS, page)),
      applyAction: vi.fn(() =>
        ok({
          action: 'release',
          processed: 2,
          purchase_requisition_ids: ['pr-1'],
          production_order_ids: ['po-1'],
          proposals: [
            { ...PROPOSALS[0], status: 'Released' },
            { ...PROPOSALS[1], status: 'Released' },
          ],
        }),
      ),
      pegging: vi.fn(() => ok(PEGGING)),
      gantt: vi.fn(() => ok(GANTT)),
      autoLevel: vi.fn(() =>
        ok({
          run: RUN,
          overloaded_buckets_before: 4,
          overloaded_buckets_after: 1,
          leveled_proposals: 3,
        }),
      ),
      reschedule: vi.fn(() =>
        ok({
          block: {},
          proposal: { ...PROPOSALS[0], need_by_date: '2027-03-20' },
          capacity: { overloaded_buckets: 0, max_load_percentage: '80.00', buckets: [] },
        }),
      ),
    };
    notification = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: MrpApiService, useValue: api },
        { provide: NzNotificationService, useValue: notification },
      ],
    });
    store = TestBed.inject(MrpStore);
  });

  it('loads the run history', () => {
    store.loadRuns().subscribe();

    expect(store.runs()).toEqual([RUN]);
    expect(store.runsLoading()).toBe(false);
  });

  it('selecting a run scopes the filters to it and resets paging and selection', () => {
    store.setPage(3);
    store.toggleSelection(PROPOSALS[0], true);
    store.selectRun('run-1');

    expect(store.filters().runId).toBe('run-1');
    expect(store.filters().page).toBe(1);
    expect(store.selectionCount()).toBe(0);
  });

  it('loads the run KPIs of the selected run', () => {
    store.selectRun('run-1');
    store.loadDetail().subscribe();

    expect(api['run']).toHaveBeenCalledWith('run-1');
    expect(store.kpis()?.overloaded_buckets).toBe(1);
    expect(store.selectedRun()?.run_code).toBe('MRP-2027-0001');
  });

  it('starts a run, selects it and reports it', () => {
    let started: unknown;

    store.startRun({ planning_horizon_days: 90 }).subscribe((run) => (started = run));

    expect(api['startRun']).toHaveBeenCalledWith({ planning_horizon_days: 90 });
    expect(started).toEqual(RUN);
    expect(store.selectedRunId()).toBe('run-1');
    expect(notification.success).toHaveBeenCalled();
    expect(store.starting()).toBe(false);
  });

  it('reports a failed run (cyclic BOM) as an error notification with the server message', () => {
    api['startRun'] = vi.fn(() =>
      ok({ ...RUN, status: 'Failed', error_message: 'Cyclic BOM detected' }),
    );

    store.startRun({ planning_horizon_days: 30 }).subscribe();

    expect(notification.error).toHaveBeenCalledWith(expect.any(String), 'Cyclic BOM detected');
    expect(notification.success).not.toHaveBeenCalled();
  });

  it('turns a failed call into a notification and a null result, never an exception', () => {
    api['startRun'] = vi.fn(() =>
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { detail: 'Horizon too long' } }),
      ),
    );
    let result: unknown = 'untouched';

    store.startRun({ planning_horizon_days: 900 }).subscribe((run) => (result = run));

    expect(result).toBeNull();
    expect(notification.error).toHaveBeenCalledWith(expect.any(String), 'Horizon too long');
    expect(store.starting()).toBe(false);
  });

  it('answers a 403 with the permission message', () => {
    api['applyAction'] = vi.fn(() =>
      throwError(() => new HttpErrorResponse({ status: 403, error: {} })),
    );
    store.selectRun('run-1');
    store.loadProposals().subscribe();
    store.toggleSelection(PROPOSALS[0], true);
    store.applyAction('release').subscribe();

    expect(notification.error).toHaveBeenCalledWith(expect.any(String), 'MRP.ERR_FORBIDDEN');
    expect(store.selectionCount()).toBe(1);
  });

  describe('proposals', () => {
    beforeEach(() => {
      store.selectRun('run-1');
      store.loadProposals().subscribe();
    });

    it('sends the filters, sorting and paging to the API', () => {
      store.setFilters({ proposalType: 'PlannedPurchaseRequisition', needByFrom: '2027-03-01' });
      store.setSort('suggested_order_qty', 'desc');
      store.setPage(2);
      store.loadProposals().subscribe();

      expect(api['proposals']).toHaveBeenLastCalledWith(
        expect.objectContaining({
          runId: 'run-1',
          proposalType: 'PlannedPurchaseRequisition',
          needByFrom: '2027-03-01',
          sortBy: 'suggested_order_qty',
          sortDirection: 'desc',
          page: 2,
        }),
      );
    });

    it('goes back to the first page when a filter changes and resets to the defaults', () => {
      store.setPage(4);
      store.setFilters({ status: 'Firm' });

      expect(store.filters().page).toBe(1);

      store.resetFilters();

      expect(store.filters().status).toBeNull();
      expect(store.filters().runId).toBe('run-1');
    });

    it('keeps the paging meta', () => {
      expect(store.meta()?.total).toBe(3);
      expect(store.proposals()).toHaveLength(3);
    });

    it('selects and counts proposals across pages', () => {
      store.togglePage(true);

      expect(store.selectionCount()).toBe(3);
      expect(store.pageAllSelected()).toBe(true);

      store.toggleSelection(PROPOSALS[0], false);

      expect(store.selectionCount()).toBe(2);
      expect(store.pageSomeSelected()).toBe(true);

      api['proposals'] = vi.fn(() => ok([proposal({ id: 'other' })], page));
      store.setPage(2);
      store.loadProposals().subscribe();

      expect(store.selectionCount()).toBe(2);
      expect(store.pageAllSelected()).toBe(false);
    });

    it('summarises the release of the selection: requisitions, production orders, ineligible', () => {
      store.togglePage(true);

      expect(store.releaseSummary()).toMatchObject({
        selected: 3,
        eligible: 2,
        ineligible: 1,
        purchaseRequisitions: 1,
        productionOrders: 1,
      });
    });

    it('keeps only the eligible proposals on request', () => {
      store.togglePage(true);
      store.keepEligible('release');

      expect(store.selectedProposals().map((row) => row.id)).toEqual(['p1', 'p2']);
    });

    it('releases the selection, updates the rows and reports the created documents', () => {
      store.toggleSelection(PROPOSALS[0], true);
      store.toggleSelection(PROPOSALS[1], true);
      store.applyAction('release').subscribe();

      expect(api['applyAction']).toHaveBeenCalledWith(['p1', 'p2'], 'release');
      expect(
        store
          .proposals()
          .filter((row) => row.status === 'Released')
          .map((row) => row.id),
      ).toEqual(['p1', 'p2']);
      expect(store.lastResult()?.purchase_requisition_ids).toEqual(['pr-1']);
      expect(store.selectionCount()).toBe(0);
      expect(notification.success).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('MRP.ACTION_DONE_TEXT'),
      );
    });

    it('keeps the selection and reports the reason when the server refuses (all-or-nothing 422)', () => {
      api['applyAction'] = vi.fn(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: { detail: 'Proposal p3 is not eligible' },
            }),
        ),
      );
      store.togglePage(true);
      store.applyAction('release').subscribe();

      expect(notification.error).toHaveBeenCalledWith(
        expect.any(String),
        'Proposal p3 is not eligible',
      );
      expect(store.selectionCount()).toBe(3);
      expect(store.proposals().every((row) => row.status === 'Proposed')).toBe(true);
    });

    it('acts on a single row without touching the bulk selection', () => {
      store.toggleSelection(PROPOSALS[2], true);
      store.applyActionTo(PROPOSALS[0], 'firm').subscribe();

      expect(api['applyAction']).toHaveBeenCalledWith(['p1'], 'firm');
      expect(store.selection()['p3']).toBeDefined();
    });

    it('does not call the API with an empty selection', () => {
      store.applyAction('release').subscribe();

      expect(api['applyAction']).not.toHaveBeenCalled();
    });
  });

  it('loads and clears the pegging of a proposal', () => {
    store.openPegging(PROPOSALS[0]).subscribe();

    expect(api['pegging']).toHaveBeenCalledWith('p1');
    expect(store.pegging()?.root_demands).toHaveLength(2);

    store.closePegging();

    expect(store.pegging()).toBeNull();
    expect(store.peggingProposal()).toBeNull();
  });

  describe('Gantt', () => {
    beforeEach(() => {
      store.selectRun('run-1');
      store.loadGantt().subscribe();
    });

    it('loads the window of the selected run', () => {
      store.setGanttWindow('2027-03-01', '2027-03-28');
      store.loadGantt().subscribe();

      expect(api['gantt']).toHaveBeenLastCalledWith('run-1', {
        from: '2027-03-01',
        to: '2027-03-28',
        workCenterIds: undefined,
      });
    });

    it('counts the overloaded buckets per work centre', () => {
      expect(store.overloadedByWorkCenter()).toEqual({ 'wc-a': 1, 'wc-b': 0, 'wc-c': 0 });
      expect(store.overloadedTotal()).toBe(1);
    });

    it('auto-levels with the direction of the run and exposes before and after', () => {
      store.autoLevel().subscribe();

      expect(api['autoLevel']).toHaveBeenCalledWith('run-1', undefined);
      expect(store.lastLevel()).toMatchObject({
        overloaded_buckets_before: 4,
        overloaded_buckets_after: 1,
      });
      expect(notification.success).toHaveBeenCalled();
    });

    it('reschedules a block and reports a refused move without raising', () => {
      store.reschedule('blk-1', { start_date: '2027-03-03', end_date: '2027-03-04' }).subscribe();

      expect(api['reschedule']).toHaveBeenCalledWith('blk-1', {
        start_date: '2027-03-03',
        end_date: '2027-03-04',
      });

      api['reschedule'] = vi.fn(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: { detail: 'Not an alternative work center' },
            }),
        ),
      );
      let result: unknown = 'untouched';

      store.reschedule('blk-1', { work_center_id: 'wc-z' }).subscribe((value) => (result = value));

      expect(result).toBeNull();
      expect(notification.error).toHaveBeenCalledWith(
        expect.any(String),
        'Not an alternative work center',
      );
      expect(store.rescheduling()).toBe(false);
    });
  });
});
