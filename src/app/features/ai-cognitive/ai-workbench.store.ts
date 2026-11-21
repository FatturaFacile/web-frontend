import { computed, inject, Service, signal } from '@angular/core';
import { finalize, map, Observable, tap } from 'rxjs';
import { AiCognitiveApiService } from './ai-cognitive-api.service';
import {
  AiSuggestion,
  Priority,
  QueueMeta,
  SuggestionKind,
  SuggestionStatus,
} from './ai-cognitive.models';
import { isEdited, isOpen } from './ai-cognitive.utils';

/**
 * Signal state of the Cognitive Review Workbench: the queue with its filters, the selected suggestion and the payload the
 * reviewer is correcting. An unchanged payload is approved as proposed; a changed one is sent as "Edit and Approve".
 *
 * Every action returns the underlying observable, already wired to the signals, so a component only subscribes and reports the
 * outcome to the user.
 */
@Service()
export class AiWorkbenchStore {
  private readonly api = inject(AiCognitiveApiService);

  readonly items = signal<AiSuggestion[]>([]);
  readonly meta = signal<QueueMeta | null>(null);
  readonly kindFilter = signal<SuggestionKind | null>(null);
  readonly statusFilter = signal<SuggestionStatus | null>(null);
  readonly priorityFilter = signal<Priority | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  /** The payload as the reviewer has it now; null until a suggestion is open. */
  readonly draft = signal<Record<string, unknown> | null>(null);
  /** The suggestion opened by id that is not in the loaded page (a link from the insights, a decided item). */
  private readonly opened = signal<AiSuggestion | null>(null);

  readonly selected = computed<AiSuggestion | null>(() => {
    const id = this.selectedId();

    return id === null ? null : (this.items().find((item) => item.id === id) ?? this.opened());
  });
  readonly openTotal = computed(() =>
    Object.values(this.meta()?.open_by_kind ?? {}).reduce((sum, count) => sum + (count ?? 0), 0),
  );
  readonly edited = computed(() => {
    const selected = this.selected();
    const draft = this.draft();

    return selected !== null && draft !== null && isEdited(selected.proposed_payload, draft);
  });
  readonly canDecide = computed(() => {
    const selected = this.selected();

    return selected !== null && isOpen(selected.status) && !this.busy();
  });

  loadQueue(page = 1): Observable<unknown> {
    this.loading.set(true);

    return this.api
      .queue({
        status: this.statusFilter(),
        kind: this.kindFilter(),
        priority: this.priorityFilter(),
        page,
        perPage: 25,
      })
      .pipe(
        tap((res) => {
          this.items.set(res.data);
          this.meta.set(res.meta ?? null);
        }),
        finalize(() => this.loading.set(false)),
      );
  }

  setKindFilter(kind: SuggestionKind | null): void {
    this.kindFilter.set(kind);
  }

  setStatusFilter(status: SuggestionStatus | null): void {
    this.statusFilter.set(status);
  }

  setPriorityFilter(priority: Priority | null): void {
    this.priorityFilter.set(priority);
  }

  /** Opens a suggestion of the page; the payload to correct starts as the proposal. */
  select(id: string): void {
    this.selectedId.set(id);
    this.draft.set(this.selected()?.proposed_payload ?? null);
  }

  /** Opens a suggestion that may not be in the loaded page, fetching it by id. */
  open(id: string): Observable<AiSuggestion> {
    return this.api.suggestion(id).pipe(
      map((res) => res.data),
      tap((suggestion) => {
        this.opened.set(suggestion);
        this.select(suggestion.id);
      }),
    );
  }

  clearSelection(): void {
    this.selectedId.set(null);
    this.draft.set(null);
    this.opened.set(null);
  }

  setDraft(payload: Record<string, unknown>): void {
    this.draft.set(payload);
  }

  resetDraft(): void {
    this.draft.set(this.selected()?.proposed_payload ?? null);
  }

  /** Approve as proposed, or, when the payload was changed, Edit and Approve. */
  approve(feedback: string | null = null): Observable<AiSuggestion> {
    const edited = this.edited() ? this.draft() : null;

    return this.act((id) => this.api.approve(id, edited, feedback).pipe(map((res) => res.data)));
  }

  reject(reason: string): Observable<AiSuggestion> {
    return this.act((id) => this.api.reject(id, reason).pipe(map((res) => res.data)));
  }

  /** The decided item leaves the queue and the counter of its kind drops; the next item of the queue is opened. */
  private act(call: (id: string) => Observable<AiSuggestion>): Observable<AiSuggestion> {
    const id = this.selectedId();

    if (id === null) {
      throw new Error('No suggestion is selected.');
    }

    this.busy.set(true);

    return call(id).pipe(
      tap((decided) => {
        const remaining = this.items().filter((item) => item.id !== id);
        const kind = decided.kind;

        this.items.set(remaining);
        this.meta.update((meta) =>
          meta === null
            ? meta
            : {
                ...meta,
                total: Math.max(0, meta.total - 1),
                open_by_kind: {
                  ...meta.open_by_kind,
                  [kind]: Math.max(0, (meta.open_by_kind[kind] ?? 1) - 1),
                },
              },
        );

        if (remaining[0] !== undefined) {
          this.select(remaining[0].id);
        } else {
          this.clearSelection();
        }
      }),
      finalize(() => this.busy.set(false)),
    );
  }
}
