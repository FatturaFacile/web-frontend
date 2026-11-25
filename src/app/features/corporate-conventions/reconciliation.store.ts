import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CcvConsolidationPreview,
  CcvConsolidationRequest,
  CcvConsolidationResult,
  CcvLookups,
  CcvPageMeta,
  CcvPendingQuota,
  CcvReconcileRequest,
  CcvReconcileResult,
  CcvWelfareFilters,
  CcvWelfareProvider,
  CcvWelfareRedemption,
  CcvWelfareSummaryRow,
  CorporateConventionsApiService,
} from '@core';
import { CCV_OK, CcvOutcome, failureOf, saveBlob, toNumber } from './corporate-conventions.util';

export interface ReconciliationState {
  lookups: CcvLookups | null;
  pending: CcvPendingQuota[];
  preview: CcvConsolidationPreview | null;
  lastInvoice: CcvConsolidationResult | null;
  vouchers: CcvWelfareRedemption[];
  voucherMeta: CcvPageMeta | null;
  voucherFilters: CcvWelfareFilters;
  summary: CcvWelfareSummaryRow[];
  lastReconciliation: CcvReconcileResult | null;
  loading: boolean;
  working: boolean;
  error: string | null;
}

const PAGE_SIZE = 25;

/** Administrative centre: employer quotas to consolidate into B2B invoices and welfare vouchers to settle with the providers. */
export const ReconciliationStore = signalStore(
  withState<ReconciliationState>({
    lookups: null,
    pending: [],
    preview: null,
    lastInvoice: null,
    vouchers: [],
    voucherMeta: null,
    voucherFilters: { per_page: PAGE_SIZE, page: 1 },
    summary: [],
    lastReconciliation: null,
    loading: false,
    working: false,
    error: null,
  }),
  withComputed(({ pending, summary, vouchers, voucherMeta }) => ({
    pendingTotal: computed(() =>
      pending().reduce((sum, row) => sum + toNumber(row.total_employer_quota), 0),
    ),
    conventions: computed(() =>
      pending().map((row) => ({ id: row.convention_id, name: row.convention_name })),
    ),
    voucherTotal: computed(() => voucherMeta()?.total ?? 0),
    voucherPage: computed(() => voucherMeta()?.current_page ?? 1),
    voucherPageSize: computed(() => voucherMeta()?.per_page ?? PAGE_SIZE),
    /** Net receivable still open with the providers (pending and submitted), by currency. */
    openReceivable: computed(() => {
      const totals: Record<string, number> = {};
      for (const row of summary()) {
        if (
          row.reimbursement_status === 'PENDING_SETTLEMENT' ||
          row.reimbursement_status === 'SUBMITTED_TO_PROVIDER'
        ) {
          totals[row.currency] = (totals[row.currency] ?? 0) + toNumber(row.net);
        }
      }
      return totals;
    }),
    openVouchers: computed(() =>
      vouchers().filter(
        (voucher) =>
          voucher.reimbursement_status === 'PENDING_SETTLEMENT' ||
          voucher.reimbursement_status === 'SUBMITTED_TO_PROVIDER',
      ),
    ),
  })),
  withMethods((store, api = inject(CorporateConventionsApiService)) => {
    let voucherSequence = 0;

    const loadVouchers = async (filters: CcvWelfareFilters): Promise<void> => {
      const ticket = ++voucherSequence;
      patchState(store, { voucherFilters: filters });
      try {
        const [page, summary] = await Promise.all([
          firstValueFrom(api.listWelfareVouchers(filters)),
          firstValueFrom(api.getWelfareSummary()),
        ]);
        if (ticket === voucherSequence) {
          patchState(store, { vouchers: page.data, voucherMeta: page.meta, summary: summary.data });
        }
      } catch (error) {
        if (ticket === voucherSequence) {
          patchState(store, { error: failureOf(error).errorKey });
        }
      }
    };

    const loadPending = async (): Promise<void> => {
      const response = await firstValueFrom(api.getPendingQuotas());
      patchState(store, { pending: response.data });
    };

    return {
      async init(): Promise<void> {
        patchState(store, { loading: true, error: null });
        const lookups = await firstValueFrom(api.getLookups()).catch(() => null);
        patchState(store, { lookups: lookups?.data ?? null });
        try {
          await Promise.all([loadPending(), loadVouchers(store.voucherFilters())]);
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
        patchState(store, { loading: false });
      },
      /** The beneficiary schedule and the total of a convention and period, nominal or anonymized. */
      async previewConsolidation(request: CcvConsolidationRequest): Promise<CcvOutcome> {
        patchState(store, { working: true, preview: null });
        try {
          const response = await firstValueFrom(api.previewConsolidation(request));
          patchState(store, { preview: response.data, working: false });
          return CCV_OK;
        } catch (error) {
          patchState(store, { working: false });
          return failureOf(error);
        }
      },
      /** One-click B2B invoice of the employer quotas of the period. */
      async generateInvoice(request: CcvConsolidationRequest): Promise<CcvOutcome> {
        patchState(store, { working: true });
        try {
          const response = await firstValueFrom(api.generateInvoice(request));
          patchState(store, { lastInvoice: response.data, preview: null, working: false });
          await loadPending();
          return CCV_OK;
        } catch (error) {
          patchState(store, { working: false });
          return failureOf(error);
        }
      },
      async downloadSchedule(invoiceId: string): Promise<CcvOutcome> {
        try {
          saveBlob(
            await firstValueFrom(api.downloadSchedule(invoiceId)),
            `beneficiary-schedule-${invoiceId}.csv`,
          );
          return CCV_OK;
        } catch (error) {
          return failureOf(error);
        }
      },
      clearPreview(): void {
        patchState(store, { preview: null });
      },
      setVoucherFilters(patch: Partial<CcvWelfareFilters>): Promise<void> {
        return loadVouchers({ ...store.voucherFilters(), ...patch, page: 1 });
      },
      setVoucherPage(page: number): Promise<void> {
        return loadVouchers({ ...store.voucherFilters(), page });
      },
      /** Sends the pending vouchers of a provider to settlement under a batch reference. */
      async submitBatch(
        provider: CcvWelfareProvider,
        batchReference: string,
        ids: string[],
      ): Promise<CcvOutcome> {
        patchState(store, { working: true });
        try {
          await firstValueFrom(api.submitVoucherBatch(provider, batchReference, ids));
          patchState(store, { working: false });
          await loadVouchers(store.voucherFilters());
          return CCV_OK;
        } catch (error) {
          patchState(store, { working: false });
          return failureOf(error);
        }
      },
      /** Reconciles the vouchers against the settlement statement or self-invoice of a provider. */
      async reconcile(request: CcvReconcileRequest): Promise<CcvOutcome> {
        patchState(store, { working: true });
        try {
          const response = await firstValueFrom(api.reconcileVouchers(request));
          patchState(store, { lastReconciliation: response.data, working: false });
          await loadVouchers(store.voucherFilters());
          return CCV_OK;
        } catch (error) {
          patchState(store, { working: false });
          return failureOf(error);
        }
      },
    };
  }),
);
