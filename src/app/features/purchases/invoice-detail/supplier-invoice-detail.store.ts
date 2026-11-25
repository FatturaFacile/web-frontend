import { computed, inject } from '@angular/core';
import { ProcurementApiService, SupplierInvoiceLine } from '@core/api/procurement-api.service';
import { PurchasesExtraApiService } from '@core/api/purchases-extra-api.service';
import { SupplierInvoice, SupplierInvoiceApproval } from '@core/models';
import { InvoiceMatchingApiService } from '@data-access/procurement/invoice-matching-api.service';
import { InvoiceMatchRun } from '@domain/procurement/invoice-matching.models';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { catchError, finalize, of, tap } from 'rxjs';
import { extractApiErrorMessage } from '../../procurement/requisitions/pr-status.helpers';

/** Fiscal fields the invoice record carries beyond the common supplier invoice summary. */
export interface SupplierInvoiceDetail extends SupplierInvoice {
  withholding_tax_amount?: string | null;
  stamp_duty_amount?: string | null;
  exchange_rate?: string | null;
}

export interface SupplierInvoiceDetailState {
  invoice: SupplierInvoiceDetail | null;
  lines: SupplierInvoiceLine[];
  matchRuns: InvoiceMatchRun[];
  approval: SupplierInvoiceApproval | null;
  loading: boolean;
  error: string | null;
}

const initialState: SupplierInvoiceDetailState = {
  invoice: null,
  lines: [],
  matchRuns: [],
  approval: null,
  loading: false,
  error: null,
};

/**
 * Detail of one supplier invoice. The invoice record is required; lines, the 3-way match history and the approval workflow
 * are secondary and fall back to empty when they do not exist yet or the user cannot read them.
 */
export const SupplierInvoiceDetailStore = signalStore(
  withState(initialState),
  withComputed(({ invoice, matchRuns }) => ({
    currentRun: computed(() => matchRuns().find((run) => run.is_current) ?? matchRuns()[0] ?? null),
    /** Amount still to pay (display only); null while the invoice is not loaded or the amounts are not numeric. */
    outstanding: computed((): number | null => {
      const current = invoice();
      if (!current) {
        return null;
      }
      const total = Number(current.total_amount);
      const paid = Number(current.total_paid ?? 0);
      return Number.isFinite(total) && Number.isFinite(paid) ? Math.max(0, total - paid) : null;
    }),
  })),
  withMethods(
    (
      store,
      purchases = inject(PurchasesExtraApiService),
      procurement = inject(ProcurementApiService),
      matching = inject(InvoiceMatchingApiService),
    ) => ({
      load(id: string): void {
        patchState(store, { ...initialState, loading: true });

        purchases
          .getSupplierInvoice(id)
          .pipe(
            tap((res) => patchState(store, { invoice: res.data as SupplierInvoiceDetail })),
            catchError((err: unknown) => {
              patchState(store, { error: extractApiErrorMessage(err) || String(err) });
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          )
          .subscribe();

        procurement
          .getSupplierInvoiceLines(id)
          .pipe(catchError(() => of(null)))
          .subscribe((res) => patchState(store, { lines: res?.data ?? [] }));

        matching
          .invoiceHistory(id)
          .pipe(catchError(() => of([] as InvoiceMatchRun[])))
          .subscribe((matchRuns) => patchState(store, { matchRuns }));

        procurement
          .getSupplierInvoiceApproval(id)
          .pipe(catchError(() => of(null)))
          .subscribe((res) => patchState(store, { approval: res?.data ?? null }));
      },
    }),
  ),
);
