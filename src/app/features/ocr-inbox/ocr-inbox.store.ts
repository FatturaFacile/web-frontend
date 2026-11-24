import { computed, inject, Service, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';
import { OcrInboxApiService } from './ocr-inbox-api.service';
import {
  BoundingBox,
  BoundingBoxMap,
  ExtractionJob,
  InboxCounters,
  InboxItem,
  InboxStatus,
  PageMeta,
  ReviewedPayload,
  Workbench,
} from './ocr-inbox.models';
import { boxMap } from './ocr-inbox.utils';

const EMPTY_COUNTERS: InboxCounters = { queued: 0, processing: 0, ready_for_review: 0, failed: 0 };

/**
 * Signal state of the AI Inbox: the queue with its counters, the selected workbench and the field that is in focus. The focus
 * (`activeFieldKey`) is what keeps the form and the document viewer in step: a field of the form that gets focus sets it and
 * the viewer scrolls to its box; a box that is clicked sets it and the form focuses the field.
 *
 * Every action returns the underlying observable, already wired to the signals, so a component only subscribes and reports the
 * outcome to the user.
 */
@Service()
export class OcrInboxStore {
  private readonly api = inject(OcrInboxApiService);

  readonly items = signal<InboxItem[]>([]);
  readonly counters = signal<InboxCounters>(EMPTY_COUNTERS);
  readonly meta = signal<PageMeta | null>(null);
  readonly statusFilter = signal<InboxStatus | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly workbench = signal<Workbench | null>(null);
  readonly loading = signal(false);
  readonly loadingWorkbench = signal(false);
  readonly busy = signal(false);
  /** Key of the field that has the focus, in the form or on the document (`header.document_number`, `lines[0].unit_price`). */
  readonly activeFieldKey = signal<string | null>(null);
  /** Increases every time the active field is chosen again, so its box pulses even when the key did not change. */
  readonly focusTick = signal(0);
  /** Regions the accountant drew for a field, over the boxes of the engine. */
  private readonly overrides = signal<BoundingBoxMap>({});

  readonly boxes = computed<BoundingBoxMap>(() => ({
    ...boxMap(this.workbench()?.bounding_boxes ?? []),
    ...this.overrides(),
  }));
  readonly confidence = computed<Record<string, number>>(
    () => this.workbench()?.payload?.field_confidence ?? {},
  );
  readonly activeBox = computed<BoundingBox | null>(() => {
    const key = this.activeFieldKey();

    return key === null ? null : (this.boxes()[key] ?? null);
  });
  readonly inboxTotal = computed(() =>
    Object.values(this.counters()).reduce((sum, count) => sum + count, 0),
  );
  readonly canReview = computed(() => this.workbench()?.status === 'ready_for_review');

  /** The queue and its counters. A job already selected stays selected. */
  loadQueue(page = 1): Observable<unknown> {
    this.loading.set(true);

    return this.api.inbox({ status: this.statusFilter(), page, perPage: 25 }).pipe(
      tap((res) => {
        this.items.set(res.data.queue);
        this.counters.set(res.data.counters);
        this.meta.set(res.data.meta);
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  setStatusFilter(status: InboxStatus | null): void {
    this.statusFilter.set(status);
  }

  /** Opens a job in the workbench, with a clean focus and no regions drawn for the previous one. */
  select(jobId: string): Observable<Workbench | null> {
    this.selectedId.set(jobId);
    this.activeFieldKey.set(null);
    this.overrides.set({});
    this.loadingWorkbench.set(true);

    return this.api.workbench(jobId).pipe(
      map((res) => res.data),
      tap((workbench) => this.workbench.set(workbench)),
      tap({ error: () => this.workbench.set(null) }),
      finalize(() => this.loadingWorkbench.set(false)),
    );
  }

  clearSelection(): void {
    this.selectedId.set(null);
    this.workbench.set(null);
    this.activeFieldKey.set(null);
    this.overrides.set({});
  }

  /** A field of the form (or a box of the document) was chosen. */
  focusField(key: string | null): void {
    this.activeFieldKey.set(key);

    if (key !== null) {
      this.focusTick.update((tick) => tick + 1);
    }
  }

  /** The accountant drew a region on the document for the active field: it replaces the box of the engine. */
  assignRegion(key: string, box: BoundingBox): void {
    this.overrides.update((current) => ({ ...current, [key]: box }));
    this.focusField(key);
  }

  saveDraft(draft: ReviewedPayload): Observable<ExtractionJob> {
    return this.act((id) => this.api.saveDraft(id, draft).pipe(map((res) => res.data)));
  }

  /** Confirms and posts the document; the job leaves the inbox, so the queue and the workbench are reloaded. */
  confirm(reviewed: ReviewedPayload): Observable<ExtractionJob> {
    return this.act((id) => this.api.confirm(id, reviewed).pipe(map((res) => res.data)), true);
  }

  reject(reason: string): Observable<ExtractionJob> {
    return this.act((id) => this.api.reject(id, reason).pipe(map((res) => res.data)), true);
  }

  rerun(): Observable<ExtractionJob> {
    return this.act((id) => this.api.rerun(id).pipe(map((res) => res.data)), true);
  }

  /** A document became ready on the server (real-time event): refresh the queue, and the workbench when it is that job. */
  onServerEvent(jobId: string): Observable<unknown> {
    const selected = this.selectedId() === jobId;

    return this.loadQueue().pipe(
      tap(() => {
        if (selected) {
          this.select(jobId)
            .pipe(catchError(() => of(null)))
            .subscribe();
        }
      }),
    );
  }

  private act(
    call: (jobId: string) => Observable<ExtractionJob>,
    reload = false,
  ): Observable<ExtractionJob> {
    const id = this.selectedId();

    if (id === null) {
      throw new Error('No document is selected.');
    }

    this.busy.set(true);

    return call(id).pipe(
      tap(() => {
        if (reload) {
          this.loadQueue()
            .pipe(catchError(() => of(null)))
            .subscribe();
          this.select(id)
            .pipe(catchError(() => of(null)))
            .subscribe();
        }
      }),
      finalize(() => this.busy.set(false)),
    );
  }
}
