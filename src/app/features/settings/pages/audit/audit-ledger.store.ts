import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { AuditEntry, AuditEntryFilters, AuditLedgerApiService } from '@core';
import { AuditFailure, failureOf } from './audit-ledger.util';

export interface AuditLedgerState {
  entries: AuditEntry[];
  filters: AuditEntryFilters;
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  /** Set when the last request failed: the page shows an error result, never fallback data. */
  failure: AuditFailure | null;
  selected: AuditEntry | null;
}

const PAGE_SIZE = 50;

/** Cursor-paginated entries of the audit ledger, newest first, with the filters applied by the API. */
export const AuditLedgerStore = signalStore(
  withState<AuditLedgerState>({
    entries: [],
    filters: {},
    nextCursor: null,
    loading: false,
    loadingMore: false,
    failure: null,
    selected: null,
  }),
  withMethods((store, api = inject(AuditLedgerApiService)) => ({
    /** Starts over from the first page with the given filters. */
    load: async (filters: AuditEntryFilters = store.filters()): Promise<void> => {
      patchState(store, { filters, loading: true, failure: null, entries: [], nextCursor: null });
      try {
        const response = await firstValueFrom(api.search(filters, null, PAGE_SIZE));
        patchState(store, {
          entries: response.data,
          nextCursor: response.meta?.next_cursor ?? null,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, failure: failureOf(error) });
      }
    },
    /** Appends the next page; does nothing at the end of the list or while a page is loading. */
    loadMore: async (): Promise<void> => {
      const cursor = store.nextCursor();
      if (cursor === null || store.loading() || store.loadingMore()) {
        return;
      }
      patchState(store, { loadingMore: true });
      try {
        const response = await firstValueFrom(api.search(store.filters(), cursor, PAGE_SIZE));
        patchState(store, {
          entries: [...store.entries(), ...response.data],
          nextCursor: response.meta?.next_cursor ?? null,
          loadingMore: false,
        });
      } catch {
        // The loaded entries stay on screen; the "load more" button stays available to retry.
        patchState(store, { loadingMore: false });
      }
    },
    select: (entry: AuditEntry | null): void => patchState(store, { selected: entry }),
  })),
);
