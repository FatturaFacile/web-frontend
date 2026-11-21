import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { TranslateService } from '@core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';
import { defaultWindow, isOverloaded } from './mrp-gantt.utils';
import { MrpApiService } from './mrp-api.service';
import {
  MrpAutoLevelResult,
  MrpGantt,
  MrpPageMeta,
  MrpPegging,
  MrpProposal,
  MrpProposalAction,
  MrpProposalActionResult,
  MrpProposalFilters,
  MrpReschedulePayload,
  MrpRescheduleResult,
  MrpRun,
  MrpRunDetail,
  MrpRunPayload,
} from './mrp.models';
import { ActionSummary, errorDetail, isEligible, summarizeAction } from './mrp.utils';

const DEFAULT_FILTERS: MrpProposalFilters = {
  runId: null,
  proposalType: null,
  status: null,
  exceptionCode: null,
  itemId: null,
  workCenterId: null,
  needByFrom: null,
  needByTo: null,
  sortBy: 'need_by_date',
  sortDirection: 'asc',
  page: 1,
  perPage: 25,
};

/**
 * Signal state of the MRP workspace (Mod 063): the run history and the selected run with its KPIs, the proposals workbench
 * (filters, server paging, multi-page selection and the firm / release / dismiss actions), the pegging of one proposal and the
 * finite-capacity Gantt (window, auto-level, reschedule). Every action returns a cold observable wired to the signals that never
 * errors: a failure is reported as a notification and the observable emits `null`, so a component only subscribes.
 */
@Service()
export class MrpStore {
  private readonly api = inject(MrpApiService);
  private readonly notification = inject(NzNotificationService);
  private readonly i18n = inject(TranslateService);

  readonly runs = signal<MrpRun[]>([]);
  readonly runsLoading = signal(false);
  readonly starting = signal(false);
  readonly selectedRunId = signal<string | null>(null);
  readonly detail = signal<MrpRunDetail | null>(null);

  readonly proposals = signal<MrpProposal[]>([]);
  readonly meta = signal<MrpPageMeta | null>(null);
  readonly filters = signal<MrpProposalFilters>(DEFAULT_FILTERS);
  readonly loading = signal(false);
  readonly acting = signal(false);
  readonly lastResult = signal<MrpProposalActionResult | null>(null);
  /** The selected proposals by id; the selection survives paging and filtering. */
  readonly selection = signal<Record<string, MrpProposal>>({});

  readonly pegging = signal<MrpPegging | null>(null);
  readonly peggingProposal = signal<MrpProposal | null>(null);
  readonly peggingLoading = signal(false);

  readonly gantt = signal<MrpGantt | null>(null);
  readonly ganttWindow = signal(defaultWindow());
  readonly ganttLoading = signal(false);
  readonly leveling = signal(false);
  readonly rescheduling = signal(false);
  readonly lastLevel = signal<MrpAutoLevelResult | null>(null);

  readonly selectedRun = computed<MrpRun | null>(
    () => this.detail()?.run ?? this.runs().find((run) => run.id === this.selectedRunId()) ?? null,
  );
  readonly kpis = computed(() => this.detail()?.kpis ?? null);
  readonly selectedProposals = computed(() => Object.values(this.selection()));
  readonly selectionCount = computed(() => this.selectedProposals().length);
  /** What "Mass Firm & Release" would generate for the selection. */
  readonly releaseSummary = computed<ActionSummary>(() =>
    summarizeAction(this.selectedProposals(), 'release'),
  );
  readonly firmSummary = computed<ActionSummary>(() =>
    summarizeAction(this.selectedProposals(), 'firm'),
  );
  readonly pageAllSelected = computed(
    () =>
      this.proposals().length > 0 &&
      this.proposals().every((proposal) => this.selection()[proposal.id] !== undefined),
  );
  readonly pageSomeSelected = computed(
    () =>
      !this.pageAllSelected() &&
      this.proposals().some((proposal) => this.selection()[proposal.id] !== undefined),
  );
  /** Overloaded buckets of the Gantt window per work centre id. */
  readonly overloadedByWorkCenter = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {};

    for (const workCenter of this.gantt()?.work_centers ?? []) {
      counts[workCenter.id] = workCenter.buckets.filter(isOverloaded).length;
    }

    return counts;
  });
  readonly overloadedTotal = computed(() =>
    Object.values(this.overloadedByWorkCenter()).reduce((sum, count) => sum + count, 0),
  );

  /** Runs `source`; a failure becomes a notification titled `titleKey` and the result `null`. */
  private guard<T>(source: Observable<T>, titleKey: string): Observable<T | null> {
    return source.pipe(
      catchError((error: unknown) => {
        const forbidden = error instanceof HttpErrorResponse && error.status === 403;
        const description = forbidden
          ? this.i18n.instant('MRP.ERR_FORBIDDEN')
          : (errorDetail(error) ?? '');

        this.notification.error(this.i18n.instant(titleKey), description);

        return of(null);
      }),
    );
  }

  loadRuns(): Observable<MrpRun[] | null> {
    this.runsLoading.set(true);

    return this.guard(
      this.api.runs({ perPage: 50 }).pipe(
        map((res) => res.data),
        tap((runs) => this.runs.set(runs)),
      ),
      'MRP.ERR_LOAD_RUNS',
    ).pipe(finalize(() => this.runsLoading.set(false)));
  }

  /** Makes a run the current one: the KPIs and the proposals of the run are reloaded. */
  selectRun(runId: string | null): void {
    this.selectedRunId.set(runId);
    this.detail.set(null);
    this.gantt.set(null);
    this.clearSelection();
    this.filters.update((current) => ({ ...current, runId, page: 1 }));
  }

  loadDetail(): Observable<MrpRunDetail | null> {
    const runId = this.selectedRunId();

    if (runId === null) {
      return of(null);
    }

    return this.guard(
      this.api.run(runId).pipe(
        map((res) => res.data),
        tap((detail) => this.detail.set(detail)),
      ),
      'MRP.ERR_LOAD_RUN',
    );
  }

  startRun(payload: MrpRunPayload): Observable<MrpRun | null> {
    this.starting.set(true);

    return this.guard(
      this.api.startRun(payload).pipe(
        map((res) => res.data),
        tap((run) => {
          this.runs.update((runs) => [run, ...runs.filter((existing) => existing.id !== run.id)]);
          this.selectRun(run.id);

          if (run.status === 'Failed') {
            this.notification.error(
              this.i18n.instant('MRP.RUN_FAILED_TITLE'),
              run.error_message ?? '',
            );
          } else {
            this.notification.success(
              this.i18n.instant('MRP.RUN_DONE_TITLE'),
              this.i18n.instant('MRP.RUN_DONE_TEXT', {
                code: run.run_code,
                proposals: run.summary_metrics?.proposals_total ?? 0,
              }),
            );
          }
        }),
      ),
      'MRP.ERR_START_RUN',
    ).pipe(finalize(() => this.starting.set(false)));
  }

  setFilters(patch: Partial<MrpProposalFilters>): void {
    this.filters.update((current) => ({ ...current, page: 1, ...patch }));
  }

  setPage(page: number): void {
    this.filters.update((current) => ({ ...current, page }));
  }

  setSort(
    sortBy: MrpProposalFilters['sortBy'],
    sortDirection: MrpProposalFilters['sortDirection'],
  ): void {
    this.filters.update((current) => ({ ...current, sortBy, sortDirection, page: 1 }));
  }

  resetFilters(): void {
    this.filters.update((current) => ({
      ...DEFAULT_FILTERS,
      runId: current.runId,
      perPage: current.perPage,
    }));
  }

  loadProposals(): Observable<MrpProposal[] | null> {
    this.loading.set(true);

    return this.guard(
      this.api.proposals(this.filters()).pipe(
        tap((res) => {
          this.proposals.set(res.data);
          this.meta.set(res.meta ?? null);
        }),
        map((res) => res.data),
      ),
      'MRP.ERR_LOAD_PROPOSALS',
    ).pipe(finalize(() => this.loading.set(false)));
  }

  toggleSelection(proposal: MrpProposal, checked: boolean): void {
    this.selection.update((current) => {
      const next = { ...current };

      if (checked) {
        next[proposal.id] = proposal;
      } else {
        delete next[proposal.id];
      }

      return next;
    });
  }

  /** Selects or clears every proposal of the page on screen. */
  togglePage(checked: boolean): void {
    for (const proposal of this.proposals()) {
      this.toggleSelection(proposal, checked);
    }
  }

  /** Drops from the selection the proposals the action cannot be applied to, so an all-or-nothing call can go through. */
  keepEligible(action: MrpProposalAction): void {
    this.selection.update((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([, proposal]) => isEligible(proposal, action)),
      ),
    );
  }

  clearSelection(): void {
    this.selection.set({});
  }

  /** Runs the action on the selection; all-or-nothing on the server, a 422 keeps the selection and reports the reason. */
  applyAction(
    action: MrpProposalAction,
    targets: MrpProposal[] = this.selectedProposals(),
  ): Observable<MrpProposalActionResult | null> {
    const ids = targets.map((proposal) => proposal.id);

    if (ids.length === 0) {
      return of(null);
    }
    this.acting.set(true);

    return this.guard(
      this.api.applyAction(ids, action).pipe(
        map((res) => res.data),
        tap((result) => {
          const updated = new Map(result.proposals.map((proposal) => [proposal.id, proposal]));

          this.proposals.update((rows) => rows.map((row) => updated.get(row.id) ?? row));
          this.lastResult.set(result);
          this.selection.update((current) => {
            const next = { ...current };

            for (const id of ids) {
              delete next[id];
            }

            return next;
          });
          this.notification.success(
            this.i18n.instant('MRP.ACTION_DONE_TITLE'),
            this.i18n.instant('MRP.ACTION_DONE_TEXT', {
              processed: result.processed,
              requisitions: result.purchase_requisition_ids.length,
              orders: result.production_order_ids.length,
            }),
          );
        }),
      ),
      'MRP.ERR_ACTION',
    ).pipe(finalize(() => this.acting.set(false)));
  }

  /** Runs the action on one proposal (the row buttons), leaving the bulk selection untouched. */
  applyActionTo(
    proposal: MrpProposal,
    action: MrpProposalAction,
  ): Observable<MrpProposalActionResult | null> {
    return this.applyAction(action, [proposal]);
  }

  openPegging(proposal: MrpProposal): Observable<MrpPegging | null> {
    this.peggingProposal.set(proposal);
    this.pegging.set(null);
    this.peggingLoading.set(true);

    return this.guard(
      this.api.pegging(proposal.id).pipe(
        map((res) => res.data),
        tap((pegging) => this.pegging.set(pegging)),
      ),
      'MRP.ERR_LOAD_PEGGING',
    ).pipe(finalize(() => this.peggingLoading.set(false)));
  }

  closePegging(): void {
    this.peggingProposal.set(null);
    this.pegging.set(null);
  }

  setGanttWindow(from: string, to: string): void {
    this.ganttWindow.set({ from, to });
  }

  loadGantt(workCenterIds?: string[]): Observable<MrpGantt | null> {
    const runId = this.selectedRunId();

    if (runId === null) {
      return of(null);
    }
    this.ganttLoading.set(true);

    return this.guard(
      this.api.gantt(runId, { ...this.ganttWindow(), workCenterIds }).pipe(
        map((res) => res.data),
        tap((gantt) => this.gantt.set(gantt)),
      ),
      'MRP.ERR_LOAD_GANTT',
    ).pipe(finalize(() => this.ganttLoading.set(false)));
  }

  /** Levels the overloaded buckets; the caller reloads the Gantt and the KPIs afterwards. */
  autoLevel(): Observable<MrpAutoLevelResult | null> {
    const run = this.selectedRun();

    if (run === null) {
      return of(null);
    }
    this.leveling.set(true);

    return this.guard(
      this.api.autoLevel(run.id, run.scheduling_direction).pipe(
        map((res) => res.data),
        tap((result) => {
          this.lastLevel.set(result);
          this.notification.success(
            this.i18n.instant('MRP.LEVEL_DONE_TITLE'),
            this.i18n.instant('MRP.LEVEL_DONE_TEXT', {
              before: result.overloaded_buckets_before,
              after: result.overloaded_buckets_after,
              proposals: result.leveled_proposals,
            }),
          );
        }),
      ),
      'MRP.ERR_LEVEL',
    ).pipe(finalize(() => this.leveling.set(false)));
  }

  /** Moves a block (dates and/or work centre); a refused move (422) is reported and leaves the Gantt as it was. */
  reschedule(
    blockId: string,
    payload: MrpReschedulePayload,
  ): Observable<MrpRescheduleResult | null> {
    this.rescheduling.set(true);

    return this.guard(
      this.api.reschedule(blockId, payload).pipe(
        map((res) => res.data),
        tap((result) => {
          this.proposals.update((rows) =>
            rows.map((row) => (row.id === result.proposal.id ? result.proposal : row)),
          );
          this.notification.success(
            this.i18n.instant('MRP.RESCHEDULE_DONE_TITLE'),
            this.i18n.instant('MRP.RESCHEDULE_DONE_TEXT', {
              overloaded: result.capacity.overloaded_buckets,
            }),
          );
        }),
      ),
      'MRP.ERR_RESCHEDULE',
    ).pipe(finalize(() => this.rescheduling.set(false)));
  }
}
