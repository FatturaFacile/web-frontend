import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  WithholdingRecipientsApiService,
  WrAnnualRecord,
  WrF24Preview,
  WrInlNotification,
  WrJurisdiction,
  WrPageMeta,
  WrRecipient,
  WrRegime,
  WrSettlement,
  WrSimulation,
} from '@core';
import {
  annualFileName,
  currentMonth,
  f24FileName,
  failureOf,
  isBatchValid,
  isMonthParam,
  paymentPayloadOf,
  PaymentFormValue,
  simulatePayloadOf,
  defaultSimulatorForm,
  uniEmensFileName,
  WR_OK,
  WrOutcome,
} from './withholding-recipients.util';

export type FlowKind = 'f24' | 'uniemens' | 'annual';

export interface SettlementsState {
  recipients: WrRecipient[];
  // Tax register
  rows: WrSettlement[];
  meta: WrPageMeta | null;
  filterRecipient: string | null;
  filterRegime: WrRegime | null;
  filterJurisdiction: WrJurisdiction | null;
  filterYear: number | null;
  filterMonth: string | null;
  page: number;
  loading: boolean;
  // Posting
  posting: boolean;
  inlByRecipient: Record<string, WrInlNotification[]>;
  // Flows
  flowMonth: string;
  f24: WrF24Preview | null;
  f24Loading: boolean;
  // Annual returns
  annualYear: number;
  annualRecords: WrAnnualRecord[];
  annualLoading: boolean;
  exporting: FlowKind | null;
  error: string | null;
}

const initialState = (): SettlementsState => ({
  recipients: [],
  rows: [],
  meta: null,
  filterRecipient: null,
  filterRegime: null,
  filterJurisdiction: null,
  filterYear: new Date().getFullYear(),
  filterMonth: null,
  page: 1,
  loading: false,
  posting: false,
  inlByRecipient: {},
  flowMonth: currentMonth(),
  f24: null,
  f24Loading: false,
  annualYear: new Date().getFullYear(),
  annualRecords: [],
  annualLoading: false,
  exporting: null,
  error: null,
});

export interface FlowFile extends WrOutcome {
  blob: Blob | null;
  filename: string;
}

export interface BatchResult extends WrOutcome {
  posted: WrSettlement[];
}

/** The settlement and export center: the tax register, the posting of compensations, F24 / UniEmens flows, annual CU / AVS. */
export const SettlementsStore = signalStore(
  withState(initialState()),
  withComputed(({ recipients }) => ({
    activeRecipients: computed(() => recipients().filter((entry) => entry.is_active)),
  })),
  withMethods((store, api = inject(WithholdingRecipientsApiService)) => {
    let registerTicket = 0;

    const loadRegister = async (): Promise<void> => {
      const ticket = ++registerTicket;
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(
          api.listSettlements({
            recipient_profile_id: store.filterRecipient(),
            regime: store.filterRegime(),
            jurisdiction: store.filterJurisdiction(),
            tax_year: store.filterYear(),
            accrual_month: isMonthParam(store.filterMonth()) ? store.filterMonth() : null,
            page: store.page(),
            per_page: 20,
          }),
        );
        if (ticket === registerTicket) {
          patchState(store, { rows: response.data, meta: response.meta, loading: false });
        }
      } catch (error) {
        if (ticket === registerTicket) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      }
    };

    const download = async (
      kind: FlowKind,
      filename: string,
      call: () => Promise<Blob>,
    ): Promise<FlowFile> => {
      patchState(store, { exporting: kind, error: null });
      try {
        const blob = await call();
        patchState(store, { exporting: null });
        return { ...WR_OK, blob, filename };
      } catch (error) {
        const outcome = await failureOf(error);
        patchState(store, { exporting: null, error: outcome.errorKey });
        return { ...outcome, blob: null, filename };
      }
    };

    const loadAnnual = async (): Promise<void> => {
      patchState(store, { annualLoading: true, error: null });
      try {
        const response = await firstValueFrom(api.listAnnualReturns(store.annualYear()));
        patchState(store, { annualRecords: response.data, annualLoading: false });
      } catch (error) {
        patchState(store, {
          annualRecords: [],
          annualLoading: false,
          error: (await failureOf(error)).errorKey,
        });
      }
    };

    return {
      loadRegister,
      async init(): Promise<void> {
        try {
          const response = await firstValueFrom(api.listRecipients());
          patchState(store, { recipients: response.data });
        } catch (error) {
          patchState(store, { error: (await failureOf(error)).errorKey });
        }
      },
      /** Applies a change of the register filters (back to the first page) and reads the register again. */
      async setRegisterFilters(
        change: Partial<
          Pick<
            SettlementsState,
            'filterRecipient' | 'filterRegime' | 'filterJurisdiction' | 'filterYear' | 'filterMonth'
          >
        >,
      ): Promise<void> {
        patchState(store, { ...change, page: 1 });
        await loadRegister();
      },
      async setPage(page: number): Promise<void> {
        patchState(store, { page });
        await loadRegister();
      },

      // --- Posting ---

      /** The INL communications of a recipient, read from its profile for the pre-payment gate. */
      async loadCoverage(recipientId: string): Promise<void> {
        try {
          const response = await firstValueFrom(api.getRecipient(recipientId));
          patchState(store, {
            inlByRecipient: {
              ...store.inlByRecipient(),
              [recipientId]: response.data.inl_notifications ?? [],
            },
          });
        } catch (error) {
          patchState(store, { error: (await failureOf(error)).errorKey });
        }
      },
      /** The preview of one payment: the simulator on the facts of a registered recipient. Null when it cannot be computed. */
      async preview(form: PaymentFormValue): Promise<WrSimulation | null> {
        if (!form.recipient_profile_id || !form.gross_amount || form.gross_amount <= 0) {
          return null;
        }
        try {
          const response = await firstValueFrom(
            api.simulate(
              simulatePayloadOf({
                ...defaultSimulatorForm(),
                recipient_profile_id: form.recipient_profile_id,
                gross_amount: form.gross_amount,
                payment_date: form.payment_date,
                service_date: form.service_date,
                performance_days: form.performance_days,
                acquisition_expenses: form.acquisition_expenses,
              }),
            ),
          );
          return response.data;
        } catch {
          return null;
        }
      },
      async post(form: PaymentFormValue): Promise<WrOutcome & { settlement: WrSettlement | null }> {
        patchState(store, { posting: true });
        try {
          const response = await firstValueFrom(api.postPayment(paymentPayloadOf(form)));
          patchState(store, { posting: false });
          await loadRegister();
          return { ...WR_OK, settlement: response.data };
        } catch (error) {
          patchState(store, { posting: false });
          return { ...(await failureOf(error)), settlement: null };
        }
      },
      /** Posts up to 200 payments in one call: all of them or none. */
      async postBatch(rows: readonly PaymentFormValue[]): Promise<BatchResult> {
        if (!isBatchValid(rows)) {
          return { ...WR_OK, ok: false, posted: [] };
        }
        patchState(store, { posting: true });
        try {
          const response = await firstValueFrom(api.postBatch(rows.map(paymentPayloadOf)));
          patchState(store, { posting: false });
          await loadRegister();
          return { ...WR_OK, posted: response.data };
        } catch (error) {
          patchState(store, { posting: false });
          return { ...(await failureOf(error)), posted: [] };
        }
      },

      // --- Flows ---

      setFlowMonth(month: string): void {
        patchState(store, { flowMonth: month, f24: null });
      },
      async loadF24(): Promise<void> {
        if (!isMonthParam(store.flowMonth())) {
          return;
        }
        patchState(store, { f24Loading: true, error: null });
        try {
          const response = await firstValueFrom(api.getF24(store.flowMonth()));
          patchState(store, { f24: response.data, f24Loading: false });
        } catch (error) {
          patchState(store, {
            f24: null,
            f24Loading: false,
            error: (await failureOf(error)).errorKey,
          });
        }
      },
      exportF24: (): Promise<FlowFile> =>
        download('f24', f24FileName(store.flowMonth()), () =>
          firstValueFrom(api.exportF24(store.flowMonth())),
        ),
      exportUniEmens: (): Promise<FlowFile> =>
        download('uniemens', uniEmensFileName(store.flowMonth()), () =>
          firstValueFrom(api.exportUniEmens(store.flowMonth())),
        ),

      // --- Annual returns ---

      async setAnnualYear(year: number): Promise<void> {
        patchState(store, { annualYear: year });
        await loadAnnual();
      },
      loadAnnual,
      async generateAnnual(recipientId?: string | null): Promise<WrOutcome> {
        patchState(store, { annualLoading: true, error: null });
        try {
          await firstValueFrom(api.generateAnnualReturns(store.annualYear(), recipientId));
          patchState(store, { annualLoading: false });
          await loadAnnual();
          return WR_OK;
        } catch (error) {
          patchState(store, { annualLoading: false });
          return failureOf(error);
        }
      },
      exportAnnual: (): Promise<FlowFile> =>
        download('annual', annualFileName(store.annualYear()), () =>
          firstValueFrom(api.exportAnnualReturns(store.annualYear())),
        ),
      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
);
