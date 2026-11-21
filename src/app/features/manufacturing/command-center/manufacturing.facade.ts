import { computed, DestroyRef, inject, Service, signal } from '@angular/core';
import {
  ManufacturingApiService,
  ManufacturingCockpitApiService,
  MfgCapacityDay,
  MfgCockpit,
  MfgConfirmationResult,
  MfgCostReport,
  MfgEdgeGateway,
  MfgGenealogy,
  MfgOrderOperation,
  MfgPlannedOrderResource,
  MfgProductionOrderResource,
  MfgShortageResource,
  MfgWorkCenterResource,
  QueryFilterParams,
} from '@core';
import {
  catchError,
  concatMap,
  EMPTY,
  finalize,
  forkJoin,
  from,
  map,
  Observable,
  of,
  Subscription,
  switchMap,
  tap,
  timer,
  toArray,
} from 'rxjs';
import {
  demandsOf,
  GanttWindow,
  machineStateCounts,
  ownBookedHours,
  pipelineStages,
  RescheduleCheck,
  validateReschedule,
  wipBars,
} from './command-center.utils';

export const DEFAULT_POLL_MS = 15_000;
const MIN_POLL_MS = 5_000;
type StatusQuery = QueryFilterParams & { status?: string };

export interface RescheduleOutcome {
  check: RescheduleCheck;
  /** The order as saved; `null` when the check refused the move (nothing was sent to the API). */
  order: MfgProductionOrderResource | null;
}

export interface BatchReleaseResult {
  plannedOrderId: string;
  plannedOrderNumber: string;
  productionOrderId: string | null;
  released: boolean;
  error: string | null;
}

export interface ConfirmationInput {
  runMinutes: string;
  setupMinutes?: string;
  downtimeMinutes?: string;
  goodQuantity: string;
  scrapQuantity: string;
  scrapReason?: string;
  isFinal: boolean;
}

/** A production order with the operations as the API returns them. */
export type KioskOrder = Omit<MfgProductionOrderResource, 'operations'> & { operations?: MfgOrderOperation[] };

interface PostingDraft {
  /** `orderId:operationId` plus the booked values: a retry of the same booking has the same key. */
  key: string;
  uuid: string;
}

export function apiMessage(error: unknown): string {
  const body = (error as { error?: { message?: string } } | null)?.error;
  return body?.message ?? (error instanceof Error ? error.message : 'ERROR');
}

/**
 * Signal facade of the manufacturing workspace (plant control tower, MRP Gantt, shop-floor kiosk, genealogy and cost
 * inspector) on the endpoints under `/api/v1/manufacturing`.
 *
 * The API has no push channel (no SSE or WebSocket endpoint), so the machine matrix is kept fresh by polling the cockpit,
 * pausing while the tab is hidden.
 */
@Service()
export class ManufacturingFacadeService {
  private readonly cockpitApi = inject(ManufacturingCockpitApiService);
  private readonly api = inject(ManufacturingApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Control tower ---------------------------------------------------------------------------------------------------

  readonly cockpit = signal<MfgCockpit | null>(null);
  readonly cockpitLoading = signal(false);
  readonly cockpitError = signal<string | null>(null);
  readonly lastUpdated = signal<number | null>(null);
  readonly windowDays = signal(30);
  readonly polling = signal(false);
  readonly pollMs = signal(DEFAULT_POLL_MS);
  readonly gateways = signal<MfgEdgeGateway[]>([]);
  private pollSub: Subscription | null = null;

  readonly pipeline = computed(() => pipelineStages(this.cockpit()?.orders.by_strategy ?? {}));
  readonly machineMatrix = computed(() => machineStateCounts(this.cockpit()?.machines.by_state ?? {}));
  readonly machineAlerts = computed(() => this.cockpit()?.machines.alerts ?? []);
  readonly oee = computed(() => this.cockpit()?.oee ?? []);
  readonly bottlenecks = computed(() => this.cockpit()?.bottlenecks ?? []);
  readonly wip = computed(() => {
    const wip = this.cockpit()?.wip;
    return wip === undefined ? null : wipBars(wip);
  });
  /** Gateways that never reported or have not reported for 10 minutes. */
  readonly staleGateways = computed(() => {
    const limit = (this.lastUpdated() ?? Date.now()) - 10 * 60_000;
    return this.gateways().filter((g) => g.is_active && (g.last_seen_at === null || Date.parse(g.last_seen_at) < limit));
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  refreshCockpit(): Observable<MfgCockpit> {
    this.cockpitLoading.set(true);

    return this.cockpitApi.getCockpit(this.windowDays()).pipe(
      map((res) => res.data),
      tap((data) => {
        this.cockpit.set(data);
        this.cockpitError.set(null);
        this.lastUpdated.set(Date.now());
      }),
      tap({ error: (error: unknown) => this.cockpitError.set(apiMessage(error)) }),
      finalize(() => this.cockpitLoading.set(false)),
    );
  }

  loadGateways(): void {
    this.cockpitApi
      .getEdgeGateways()
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (res !== null) {
          this.gateways.set(res.data);
        }
      });
  }

  setWindowDays(days: number): void {
    this.windowDays.set(Math.min(365, Math.max(1, Math.round(days))));
  }

  /** Polls the cockpit every `ms` (at least 5 s); a failing poll keeps the last data and the next tick retries. */
  startPolling(ms: number = DEFAULT_POLL_MS): void {
    this.stopPolling();
    this.pollMs.set(Math.max(MIN_POLL_MS, ms));
    this.polling.set(true);
    this.pollSub = timer(0, this.pollMs())
      .pipe(
        switchMap(() =>
          typeof document !== 'undefined' && document.hidden ? EMPTY : this.refreshCockpit().pipe(catchError(() => EMPTY)),
        ),
      )
      .subscribe();
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
    this.polling.set(false);
  }

  // --- Planning: planned orders, orders, capacity -----------------------------------------------------------------------

  readonly plannedOrders = signal<MfgPlannedOrderResource[]>([]);
  readonly orders = signal<MfgProductionOrderResource[]>([]);
  readonly shortages = signal<MfgShortageResource[]>([]);
  readonly workCenters = signal<MfgWorkCenterResource[]>([]);
  readonly planningLoading = signal(false);
  readonly planningError = signal<string | null>(null);
  readonly selectedPlanned = signal<ReadonlySet<string>>(new Set());
  readonly batchResults = signal<BatchReleaseResult[]>([]);
  readonly batchRunning = signal(false);

  readonly openPlanned = computed(() => this.plannedOrders().filter((p) => p.status === 'planned'));
  /** Planned orders that can be converted: make orders only (purchase suggestions are converted by Procurement). */
  readonly releasablePlanned = computed(() => this.openPlanned().filter((p) => p.order_type === 'make'));
  readonly workCenterName = computed(() => new Map(this.workCenters().map((w) => [w.id, `${w.work_center_code} ${w.name}`])));

  private readonly operationsCache = new Map<string, MfgOrderOperation[]>();
  private readonly capacityCache = new Map<string, MfgCapacityDay[]>();

  loadPlanning(): void {
    this.planningLoading.set(true);
    this.planningError.set(null);

    const page = (status?: string): StatusQuery => ({ per_page: 200, ...(status ? { status } : {}) });

    forkJoin({
      planned: this.api.getPlannedOrders(page('planned')),
      planOrders: this.api.getProductionOrders(page('planned')),
      released: this.api.getProductionOrders(page('released')),
      shortages: this.api.getShortages({ per_page: 100 }),
      centers: this.api.getWorkCenters({ per_page: 200 }),
    })
      .pipe(finalize(() => this.planningLoading.set(false)))
      .subscribe({
        next: ({ planned, planOrders, released, shortages, centers }) => {
          this.plannedOrders.set(planned.data);
          this.orders.set([...planOrders.data, ...released.data].sort((a, b) => a.planned_start_date.localeCompare(b.planned_start_date)));
          this.shortages.set(shortages.data);
          this.workCenters.set(centers.data);
          this.operationsCache.clear();
          this.capacityCache.clear();
          this.selectedPlanned.set(new Set());
        },
        error: (error: unknown) => this.planningError.set(apiMessage(error)),
      });
  }

  toggleSelected(id: string, selected: boolean): void {
    const next = new Set(this.selectedPlanned());
    if (selected) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.selectedPlanned.set(next);
  }

  selectAllReleasable(selected: boolean): void {
    this.selectedPlanned.set(selected ? new Set(this.releasablePlanned().map((p) => p.id)) : new Set());
  }

  /**
   * Checks a move against the capacity of the work centres of the order and, only when it fits, books it with
   * `POST /production-orders/{id}/reschedule` (the API itself only validates status and date order).
   */
  checkReschedule(orderId: string, target: GanttWindow): Observable<RescheduleCheck> {
    const order = this.orders().find((o) => o.id === orderId);
    if (order === undefined) {
      return of({ ok: false, issues: [{ code: 'status' }] });
    }

    return this.operationsOf(orderId).pipe(
      switchMap((operations) => {
        const demands = demandsOf(operations);
        if (demands.length === 0) {
          return of(validateReschedule({ status: order.status, target, demands, capacity: {} }));
        }
        return forkJoin(
          demands.map((demand) => this.capacityOf(demand.workCenterId, target).pipe(map((days) => [demand.workCenterId, days] as const))),
        ).pipe(
          map((entries) =>
            validateReschedule({
              status: order.status,
              target,
              demands,
              capacity: Object.fromEntries(entries),
              ownBooked: Object.fromEntries(demands.map((d) => [d.workCenterId, ownBookedHours(operations, d.workCenterId, target)])),
            }),
          ),
        );
      }),
    );
  }

  reschedule(orderId: string, target: GanttWindow): Observable<RescheduleOutcome> {
    return this.checkReschedule(orderId, target).pipe(
      switchMap((check) => {
        if (!check.ok) {
          return of<RescheduleOutcome>({ check, order: null });
        }
        return this.cockpitApi.rescheduleOrder(orderId, target.start, target.end).pipe(
          tap((res) => {
            this.orders.update((list) => list.map((o) => (o.id === orderId ? { ...o, ...res.data } : o)));
            this.operationsCache.delete(orderId);
            this.capacityCache.clear();
          }),
          map((res): RescheduleOutcome => ({ check, order: res.data })),
        );
      }),
    );
  }

  /** Converts the selected make planned orders into production orders and releases each, one after the other. */
  batchRelease(): Observable<BatchReleaseResult[]> {
    const selected = this.releasablePlanned().filter((p) => this.selectedPlanned().has(p.id));
    this.batchRunning.set(true);
    this.batchResults.set([]);

    return from(selected).pipe(
      concatMap((planned) =>
        this.api.convertPlannedOrder(planned.id).pipe(
          switchMap((converted) =>
            this.api.releaseProductionOrder(converted.data.id).pipe(
              map((released): BatchReleaseResult => ({ plannedOrderId: planned.id, plannedOrderNumber: planned.planned_order_number, productionOrderId: released.data.id, released: true, error: null })),
              // Converted but not releasable (for example missing stock): keep the order planned and say so.
              catchError((error: unknown) =>
                of<BatchReleaseResult>({ plannedOrderId: planned.id, plannedOrderNumber: planned.planned_order_number, productionOrderId: converted.data.id, released: false, error: apiMessage(error) }),
              ),
            ),
          ),
          catchError((error: unknown) =>
            of<BatchReleaseResult>({ plannedOrderId: planned.id, plannedOrderNumber: planned.planned_order_number, productionOrderId: null, released: false, error: apiMessage(error) }),
          ),
        ),
      ),
      tap((result) => this.batchResults.update((list) => [...list, result])),
      toArray(),
      finalize(() => {
        this.batchRunning.set(false);
        this.loadPlanning();
      }),
    );
  }

  private operationsOf(orderId: string): Observable<MfgOrderOperation[]> {
    const cached = this.operationsCache.get(orderId);
    if (cached !== undefined) {
      return of(cached);
    }
    return this.api.getProductionOrder(orderId).pipe(
      map((res) => ((res.data as { operations?: unknown }).operations ?? []) as MfgOrderOperation[]),
      tap((operations) => this.operationsCache.set(orderId, operations)),
    );
  }

  private capacityOf(workCenterId: string, window: GanttWindow): Observable<MfgCapacityDay[]> {
    const key = `${workCenterId}|${window.start}|${window.end}`;
    const cached = this.capacityCache.get(key);
    if (cached !== undefined) {
      return of(cached);
    }
    return this.cockpitApi.getWorkCenterCapacity(workCenterId, window.start, window.end).pipe(
      map((res) => res.data),
      tap((days) => this.capacityCache.set(key, days)),
    );
  }

  // --- Shop-floor kiosk -------------------------------------------------------------------------------------------------

  readonly kioskOrders = signal<MfgProductionOrderResource[]>([]);
  readonly kioskOrder = signal<KioskOrder | null>(null);
  readonly kioskLoading = signal(false);
  readonly posting = signal(false);
  readonly lastConfirmation = signal<MfgConfirmationResult | null>(null);
  private draft: PostingDraft | null = null;

  readonly kioskOperations = computed<MfgOrderOperation[]>(() =>
    (this.kioskOrder()?.operations ?? []).filter((o) => o.status !== 'completed' && !o.is_subcontracted),
  );

  loadKioskOrders(): void {
    this.kioskLoading.set(true);
    forkJoin([
      this.api.getProductionOrders({ per_page: 100, status: 'in_progress' } as StatusQuery),
      this.api.getProductionOrders({ per_page: 100, status: 'released' } as StatusQuery),
    ])
      .pipe(finalize(() => this.kioskLoading.set(false)))
      .subscribe({ next: ([a, b]) => this.kioskOrders.set([...a.data, ...b.data]), error: () => this.kioskOrders.set([]) });
  }

  selectKioskOrder(orderId: string): void {
    this.lastConfirmation.set(null);
    this.api.getProductionOrder(orderId).subscribe({
      next: (res) => this.kioskOrder.set(res.data as unknown as KioskOrder),
      error: () => this.kioskOrder.set(null),
    });
  }

  /** Records the start of an operation on the shop floor (the timer itself runs on the device). */
  startOperation(operationId: string, operatorId?: string): Observable<unknown> {
    return this.cockpitApi.startExecution(operationId, operatorId);
  }

  /**
   * The idempotency key of the next posting: a retry of the same booking (same order, operation and values) reuses the
   * uuid of the failed attempt, so the API answers 200 and books nothing twice; any change of the values is a new action.
   */
  postingUuid(orderId: string, operationId: string, input: ConfirmationInput): string {
    const key = [orderId, operationId, input.runMinutes, input.setupMinutes ?? '', input.downtimeMinutes ?? '', input.goodQuantity, input.scrapQuantity, input.scrapReason ?? '', input.isFinal].join('|');
    if (this.draft === null || this.draft.key !== key) {
      this.draft = { key, uuid: crypto.randomUUID() };
    }
    return this.draft.uuid;
  }

  confirmOperation(orderId: string, operationId: string, input: ConfirmationInput): Observable<MfgConfirmationResult> {
    const uuid = this.postingUuid(orderId, operationId, input);
    this.posting.set(true);

    return this.cockpitApi
      .confirmOperation(orderId, operationId, {
        run_minutes: input.runMinutes,
        ...(input.setupMinutes ? { setup_minutes: input.setupMinutes } : {}),
        ...(input.downtimeMinutes ? { downtime_minutes: input.downtimeMinutes } : {}),
        good_quantity: input.goodQuantity,
        scrap_quantity: input.scrapQuantity,
        ...(input.scrapReason ? { scrap_reason: input.scrapReason } : {}),
        is_final: input.isFinal,
        operation_posting_uuid: uuid,
      })
      .pipe(
        tap((result) => {
          this.draft = null;
          this.lastConfirmation.set(result);
        }),
        finalize(() => this.posting.set(false)),
      );
  }

  // --- Genealogy and cost inspector -------------------------------------------------------------------------------------

  readonly genealogy = signal<MfgGenealogy | null>(null);
  readonly costReport = signal<MfgCostReport | null>(null);
  readonly inspectorLoading = signal(false);
  readonly inspectorError = signal<string | null>(null);
  readonly inspectableOrders = signal<MfgProductionOrderResource[]>([]);

  loadInspectableOrders(): void {
    this.api.getProductionOrders({ per_page: 100 }).subscribe({
      next: (res) => this.inspectableOrders.set(res.data),
      error: () => this.inspectableOrders.set([]),
    });
  }

  inspect(orderId: string): void {
    this.inspectorLoading.set(true);
    this.inspectorError.set(null);
    this.genealogy.set(null);
    this.costReport.set(null);

    forkJoin({ genealogy: this.cockpitApi.getGenealogy(orderId), cost: this.cockpitApi.getCostReport(orderId) })
      .pipe(finalize(() => this.inspectorLoading.set(false)))
      .subscribe({
        next: ({ genealogy, cost }) => {
          this.genealogy.set(genealogy.data);
          this.costReport.set(cost.data);
        },
        error: (error: unknown) => this.inspectorError.set(apiMessage(error)),
      });
  }
}
