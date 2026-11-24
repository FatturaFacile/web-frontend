import { computed, inject, Service, signal } from '@angular/core';
import { finalize, map, Observable, switchMap, tap } from 'rxjs';
import { HseApiService } from './hse-api.service';
import {
  AuditsOverview,
  ClearanceContext,
  DvrPayload,
  MsslAuditPayload,
  RequirementMatrix,
  RequirementMatrixPayload,
  ClearanceResult,
  IncidentPayload,
  IncidentReport,
  MatrixFilters,
  MatrixKpis,
  MatrixMeta,
  MatrixRow,
  PpeDistribution,
  PpeIssuePayload,
} from './hse.models';
import { ppeColumns, trainingColumns } from './hse.utils';

const EMPTY_KPIS: MatrixKpis = {
  overall_compliance_percent: 100,
  hard_blocked_workers: 0,
  expiring_in_30_days: 0,
  open_near_miss_and_capas: 0,
};

/**
 * Signal state of the HSE workspace: the traffic-light matrix with its KPI cards and filters, the incident registry and the
 * hard-block verdict of a dispatch. Every action returns the observable already wired to the signals, so a component only
 * subscribes and reports the outcome to the user.
 */
@Service()
export class HseStore {
  private readonly api = inject(HseApiService);

  readonly rows = signal<MatrixRow[]>([]);
  readonly meta = signal<Omit<MatrixMeta, 'kpis'> | null>(null);
  readonly kpis = signal<MatrixKpis>(EMPTY_KPIS);
  readonly filters = signal<MatrixFilters>({ page: 1, perPage: 25 });
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly incidents = signal<IncidentReport[]>([]);
  readonly requirementMatrices = signal<RequirementMatrix[]>([]);
  readonly audits = signal<AuditsOverview>({ mssl_audits: [], dvr_revisions: [] });

  readonly trainingColumns = computed(() => trainingColumns(this.rows()));
  readonly ppeColumns = computed(() => ppeColumns(this.rows()));
  readonly hasBlockedWorkers = computed(() => this.kpis().hard_blocked_workers > 0);

  setFilters(patch: Partial<MatrixFilters>): void {
    this.filters.update((current) => ({ ...current, page: 1, ...patch }));
  }

  setPage(page: number): void {
    this.filters.update((current) => ({ ...current, page }));
  }

  loadMatrix(): Observable<unknown> {
    this.loading.set(true);

    return this.api.complianceMatrix(this.filters()).pipe(
      tap((res) => {
        const { kpis, ...meta } = res.meta as MatrixMeta;
        this.rows.set(res.data);
        this.meta.set(meta);
        this.kpis.set(kpis);
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  /** Asks the gatekeeper whether a worker may be dispatched; a failed call is an error, never a silent "cleared". */
  checkClearance(query: {
    employeeId: string;
    contextType: ClearanceContext;
    targetId: string;
    scheduledAt: string;
  }): Observable<ClearanceResult> {
    return this.api.clearance(query).pipe(map((res) => res.data));
  }

  issuePpe(payload: PpeIssuePayload): Observable<PpeDistribution> {
    this.busy.set(true);

    return this.api.issuePpe(payload).pipe(
      map((res) => res.data),
      finalize(() => this.busy.set(false)),
    );
  }

  loadIncidents(): Observable<unknown> {
    this.loading.set(true);

    return this.api.incidents().pipe(
      tap((res) => this.incidents.set(res.data)),
      finalize(() => this.loading.set(false)),
    );
  }

  reportIncident(payload: IncidentPayload): Observable<IncidentReport> {
    this.busy.set(true);

    return this.api.reportIncident(payload).pipe(
      map((res) => res.data),
      tap((incident) => this.incidents.update((list) => [incident, ...list])),
      finalize(() => this.busy.set(false)),
    );
  }

  loadRequirementMatrices(): Observable<unknown> {
    this.loading.set(true);

    return this.api.requirementMatrices().pipe(
      tap((res) => this.requirementMatrices.set(res.data)),
      finalize(() => this.loading.set(false)),
    );
  }

  /** Creates the rule, or updates it when an id is given; the saved rule replaces its row in the list. */
  saveRequirementMatrix(
    payload: RequirementMatrixPayload,
    id?: string,
  ): Observable<RequirementMatrix> {
    this.busy.set(true);

    return this.api.saveRequirementMatrix(payload, id).pipe(
      map((res) => res.data),
      tap((saved) =>
        this.requirementMatrices.update((list) =>
          list.some((item) => item.id === saved.id)
            ? list.map((item) => (item.id === saved.id ? saved : item))
            : [saved, ...list],
        ),
      ),
      finalize(() => this.busy.set(false)),
    );
  }

  loadAudits(): Observable<unknown> {
    this.loading.set(true);

    return this.api.audits().pipe(
      tap((res) => this.audits.set(res.data)),
      finalize(() => this.loading.set(false)),
    );
  }

  saveMsslAudit(payload: MsslAuditPayload): Observable<unknown> {
    this.busy.set(true);

    return this.api.saveMsslAudit(payload).pipe(
      switchMap(() => this.loadAudits()),
      finalize(() => this.busy.set(false)),
    );
  }

  registerDvr(payload: DvrPayload): Observable<unknown> {
    this.busy.set(true);

    return this.api.registerDvr(payload).pipe(
      switchMap(() => this.loadAudits()),
      finalize(() => this.busy.set(false)),
    );
  }
}
