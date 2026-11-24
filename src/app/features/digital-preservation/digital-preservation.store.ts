import { computed, inject, Service, signal } from '@angular/core';
import { defer, finalize, Observable, tap } from 'rxjs';
import { DigitalPreservationApiService } from './digital-preservation-api.service';
import {
  AuditFilters,
  BatchFilters,
  BatchVerification,
  CreateBatchPayload,
  ItemFilters,
  ItemVerification,
  PageMeta,
  PreservationAuditLog,
  PreservationBatch,
  PreservationBatchDetail,
  PreservationConfiguration,
  PreservationConfigurationUpdate,
  PreservationDashboard,
  PreservationItem,
  TestConnectionResult,
} from './digital-preservation.models';

const EMPTY_META: PageMeta = { current_page: 1, last_page: 1, per_page: 15, total: 0 };

/**
 * Signal state of the digital preservation area. Every action returns the underlying observable (already wired to
 * update the signals), so a component only subscribes and reports the outcome to the user.
 */
@Service()
export class DigitalPreservationStore {
  private readonly api = inject(DigitalPreservationApiService);

  readonly dashboard = signal<PreservationDashboard | null>(null);
  readonly configuration = signal<PreservationConfiguration | null>(null);
  readonly batches = signal<PreservationBatch[]>([]);
  readonly batchMeta = signal<PageMeta>(EMPTY_META);
  readonly batchFilters = signal<BatchFilters>({ page: 1, per_page: 15 });
  readonly selectedBatch = signal<PreservationBatchDetail | null>(null);
  readonly items = signal<PreservationItem[]>([]);
  readonly itemMeta = signal<PageMeta>(EMPTY_META);
  readonly itemFilters = signal<ItemFilters>({ page: 1, per_page: 15 });
  readonly auditLogs = signal<PreservationAuditLog[]>([]);
  readonly auditMeta = signal<PageMeta>(EMPTY_META);
  readonly auditFilters = signal<AuditFilters>({ page: 1, per_page: 25 });
  readonly loading = signal(false);
  readonly busy = signal(false);

  readonly chainOk = computed(() => this.dashboard()?.chain_status !== 'alert');
  readonly hasFilters = computed(() => {
    const { page: _page, per_page: _perPage, ...rest } = this.itemFilters();
    return Object.values(rest).some((value) => value !== undefined && value !== '');
  });

  loadDashboard(): Observable<unknown> {
    return this.track(this.api.dashboard()).pipe(tap((res) => this.dashboard.set(res.data)));
  }

  loadConfiguration(): Observable<unknown> {
    return this.track(this.api.configuration()).pipe(
      tap((res) => this.configuration.set(res.data)),
    );
  }

  saveConfiguration(payload: PreservationConfigurationUpdate): Observable<unknown> {
    return this.act(this.api.saveConfiguration(payload)).pipe(
      tap((res) => this.configuration.set(res.data)),
    );
  }

  testConnection(): Observable<{ data: TestConnectionResult }> {
    return this.act(this.api.testConnection());
  }

  setBatchFilters(patch: Partial<BatchFilters>): void {
    this.batchFilters.update((current) => ({ ...current, page: 1, ...patch }));
  }

  loadBatches(): Observable<unknown> {
    return this.track(this.api.batches(this.batchFilters())).pipe(
      tap((res) => {
        this.batches.set(res.data);
        this.batchMeta.set(res.meta);
      }),
    );
  }

  openBatch(id: string): Observable<unknown> {
    return this.track(this.api.batch(id)).pipe(tap((res) => this.selectedBatch.set(res.data)));
  }

  closeBatch(): void {
    this.selectedBatch.set(null);
  }

  createBatch(payload: CreateBatchPayload): Observable<unknown> {
    return this.act(this.api.createBatch(payload)).pipe(tap((res) => this.upsertBatch(res.data)));
  }

  seal(id: string): Observable<unknown> {
    return this.act(this.api.seal(id)).pipe(tap((res) => this.afterTransition(res.data)));
  }

  dispatch(id: string): Observable<unknown> {
    return this.act(this.api.dispatch(id)).pipe(tap((res) => this.afterTransition(res.data)));
  }

  verifyBatch(id: string): Observable<{ data: BatchVerification }> {
    return this.act(this.api.verifyBatch(id));
  }

  exportBatchPdd(id: string): Observable<Blob> {
    return this.act(this.api.exportBatchPdd(id));
  }

  exportItemPdd(id: string): Observable<Blob> {
    return this.act(this.api.exportItemPdd(id));
  }

  setItemFilters(patch: Partial<ItemFilters>): void {
    this.itemFilters.update((current) => ({ ...current, page: 1, ...patch }));
  }

  resetItemFilters(): void {
    this.itemFilters.set({ page: 1, per_page: 15 });
    this.items.set([]);
    this.itemMeta.set(EMPTY_META);
  }

  searchItems(): Observable<unknown> {
    return this.track(this.api.items(this.itemFilters())).pipe(
      tap((res) => {
        this.items.set(res.data);
        this.itemMeta.set(res.meta);
      }),
    );
  }

  verifyItem(id: string): Observable<{ data: ItemVerification }> {
    return this.act(this.api.verifyItem(id));
  }

  setAuditFilters(patch: Partial<AuditFilters>): void {
    this.auditFilters.update((current) => ({ ...current, page: 1, ...patch }));
  }

  loadAuditLogs(): Observable<unknown> {
    return this.track(this.api.auditLogs(this.auditFilters())).pipe(
      tap((res) => {
        this.auditLogs.set(res.data);
        this.auditMeta.set(res.meta);
      }),
    );
  }

  private afterTransition(batch: PreservationBatch): void {
    this.upsertBatch(batch);
    const selected = this.selectedBatch();
    if (selected?.id === batch.id) {
      this.selectedBatch.set({ ...selected, ...batch });
    }
  }

  private upsertBatch(batch: PreservationBatch): void {
    this.batches.update((list) =>
      list.some((b) => b.id === batch.id)
        ? list.map((b) => (b.id === batch.id ? batch : b))
        : [batch, ...list],
    );
  }

  private track<T>(source: Observable<T>): Observable<T> {
    return defer(() => {
      this.loading.set(true);
      return source.pipe(finalize(() => this.loading.set(false)));
    });
  }

  private act<T>(source: Observable<T>): Observable<T> {
    return defer(() => {
      this.busy.set(true);
      return source.pipe(finalize(() => this.busy.set(false)));
    });
  }
}
