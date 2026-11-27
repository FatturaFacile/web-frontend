import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { BankingApiService } from '@core/api/banking-api.service';
import { CategorizePayload } from '@core/models/banking.model';
import {
  DifferenceHandling,
  ReconciliationException,
  ReconciliationExceptionCode,
  ReconciliationExceptionCounts,
} from '@core/models/iso20022.model';
import { uploadErrorMessage } from './iso-reconciliation.util';

export interface ExceptionStoreError {
  action: 'load' | 'assign' | 'categorize';
  /** The message the API sent (already translated), empty when the failure had none. */
  detail: string;
}

export interface ReconciliationExceptionsState {
  lines: ReconciliationException[];
  counts: ReconciliationExceptionCounts;
  code: ReconciliationExceptionCode | null;
  direction: 'credit' | 'debit' | null;
  search: string;
  page: number;
  perPage: number;
  total: number;
  loading: boolean;
  saving: boolean;
  error: ExceptionStoreError | null;
}

export const emptyCounts = (): ReconciliationExceptionCounts => ({
  Unmatched: 0,
  AmountMismatch: 0,
  DuplicatePayment: 0,
  AlreadyPaid: 0,
  InvalidReference: 0,
});

const initialState: ReconciliationExceptionsState = {
  lines: [],
  counts: emptyCounts(),
  code: null,
  direction: null,
  search: '',
  page: 1,
  perPage: 25,
  total: 0,
  loading: false,
  saving: false,
  error: null,
};

/** The queue of bank lines the automatic reconciliation could not settle, grouped by exception code. */
export const ReconciliationExceptionsStore = signalStore(
  withState(initialState),
  withComputed(({ counts }) => ({
    totalOpen: computed(() => Object.values(counts()).reduce((sum, count) => sum + count, 0)),
  })),
  withMethods((store, api = inject(BankingApiService)) => {
    let sequence = 0;

    /** Takes a settled line out of the queue and keeps the tab counters in step without another round trip. */
    const removeLine = (id: string): void => {
      const line = store.lines().find((entry) => entry.id === id);

      if (!line) {
        return;
      }

      const code = line.exception_code;

      patchState(store, {
        lines: store.lines().filter((entry) => entry.id !== id),
        total: Math.max(0, store.total() - 1),
        counts: { ...store.counts(), [code]: Math.max(0, store.counts()[code] - 1) },
      });
    };

    const settle = async (
      action: 'assign' | 'categorize',
      lineId: string,
      request: () => Promise<unknown>,
    ): Promise<boolean> => {
      patchState(store, { saving: true, error: null });

      try {
        await request();
        removeLine(lineId);
        patchState(store, { saving: false });

        return true;
      } catch (error: unknown) {
        patchState(store, { saving: false, error: { action, detail: uploadErrorMessage(error) } });

        return false;
      }
    };

    const load = async (): Promise<void> => {
      const current = ++sequence;
      patchState(store, { loading: true, error: null });

      try {
        const res = await firstValueFrom(
          api.getReconciliationExceptions({
            code: store.code() ?? undefined,
            direction: store.direction() ?? undefined,
            search: store.search().trim() || undefined,
            page: store.page(),
            per_page: store.perPage(),
          }),
        );

        if (current !== sequence) {
          return;
        }

        patchState(store, {
          lines: res.data ?? [],
          counts: { ...emptyCounts(), ...res.meta?.counts },
          total: res.meta?.total ?? res.data?.length ?? 0,
          loading: false,
        });
      } catch (error: unknown) {
        if (current === sequence) {
          patchState(store, {
            lines: [],
            loading: false,
            error: { action: 'load', detail: uploadErrorMessage(error) },
          });
        }
      }
    };

    return {
      load,
      setCode(code: ReconciliationExceptionCode | null): Promise<void> {
        patchState(store, { code, page: 1 });

        return load();
      },
      setDirection(direction: 'credit' | 'debit' | null): Promise<void> {
        patchState(store, { direction, page: 1 });

        return load();
      },
      setSearch(search: string): Promise<void> {
        patchState(store, { search, page: 1 });

        return load();
      },
      goTo(page: number): Promise<void> {
        patchState(store, { page });

        return load();
      },
      assign(lineId: string, invoiceId: string, handling: DifferenceHandling = 'none'): Promise<boolean> {
        return settle('assign', lineId, () =>
          firstValueFrom(
            api.assignLineToInvoice(lineId, { invoice_id: invoiceId, difference_handling: handling }),
          ),
        );
      },
      categorize(lineId: string, payload: CategorizePayload): Promise<boolean> {
        return settle('categorize', lineId, () => firstValueFrom(api.categorizeLine(lineId, payload)));
      },
      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
);
