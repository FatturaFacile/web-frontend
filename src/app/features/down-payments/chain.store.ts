import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  DownPaymentsApiService,
  DpChainDetail,
  DpConfirmPaymentPayload,
  DpCreatePayload,
  DpCreditNotePayload,
  DpCreditNotePreview,
  DpEmitPayload,
  DpLookups,
  DpPlanPayload,
  DpPlanPreview,
  DpResolutionPreview,
  DpResolvePayload,
  DpSettlementPayload,
  DpSettlementPreview,
  DpSourceType,
} from '@core';
import { DP_OK, DpOutcome, failureOf } from './down-payments.util';

export interface ChainState {
  chain: DpChainDetail | null;
  /** The source was looked up and has no chain yet (the widget then offers to open one). */
  missing: boolean;
  lookups: DpLookups | null;
  plan: DpPlanPreview | null;
  settlement: DpSettlementPreview | null;
  resolution: DpResolutionPreview | null;
  creditNote: DpCreditNotePreview | null;
  loading: boolean;
  saving: boolean;
  previewing: boolean;
  error: string | null;
}

export type CreateOutcome = DpOutcome & {
  chain: DpChainDetail | null;
  /** The chain was opened but its first installment could not be emitted. */
  emitFailure: DpOutcome | null;
};

export type SettleOutcome = DpOutcome & { invoiceNumber: string | null };

const INITIAL: ChainState = {
  chain: null,
  missing: false,
  lookups: null,
  plan: null,
  settlement: null,
  resolution: null,
  creditNote: null,
  loading: false,
  saving: false,
  previewing: false,
  error: null,
};

/**
 * One down-payment chain with the actions of its workflow: every write answers with the chain it changed. The same store serves the
 * wizard (plan preview and creation), the deposit resolution, the final settlement drawer and the credit note of an advance.
 */
export const ChainStore = signalStore(
  withState<ChainState>(INITIAL),
  withMethods((store, api = inject(DownPaymentsApiService)) => {
    const idOf = (): string => store.chain()?.id ?? '';

    const load = async (id: string): Promise<void> => {
      patchState(store, { loading: true, error: null, missing: false });
      try {
        patchState(store, { chain: (await firstValueFrom(api.getChain(id))).data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    /** The chain of a sales order or quote: the list filtered by the source, then the detail of the live one. */
    const loadBySource = async (type: DpSourceType, sourceId: string): Promise<void> => {
      patchState(store, { loading: true, error: null, missing: false, chain: null });
      try {
        const list = await firstValueFrom(
          api.listChains({ source_type: type, source_id: sourceId, per_page: 5 }),
        );
        const live = list.data.find((item) => item.status !== 'cancelled') ?? null;
        if (live === null) {
          patchState(store, { loading: false, missing: true });
          return;
        }
        patchState(store, {
          chain: (await firstValueFrom(api.getChain(live.id))).data,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    /** Runs a write that answers with the chain and takes it. */
    const act = async (
      call: () => Promise<{ data: DpChainDetail }>,
      reset: Partial<ChainState> = {},
    ): Promise<DpOutcome> => {
      patchState(store, { saving: true });
      try {
        const response = await call();
        patchState(store, { chain: response.data, saving: false, ...reset });
        return DP_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    /** A write whose answer is not the chain: the chain is read again afterwards. */
    const actThenReload = async <T>(
      call: () => Promise<T>,
      reset: Partial<ChainState> = {},
    ): Promise<DpOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, {
          chain: (await firstValueFrom(api.getChain(idOf()))).data,
          saving: false,
          ...reset,
        });
        return DP_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      load,
      loadBySource,
      reload: (): Promise<void> => load(idOf()),
      clearPreviews: (): void =>
        patchState(store, { plan: null, settlement: null, resolution: null, creditNote: null }),
      clearPlan: (): void => patchState(store, { plan: null }),
      clearSettlement: (): void => patchState(store, { settlement: null }),
      clearResolution: (): void => patchState(store, { resolution: null }),
      clearCreditNote: (): void => patchState(store, { creditNote: null }),

      loadLookups: async (): Promise<void> => {
        if (store.lookups() !== null) {
          return;
        }
        try {
          patchState(store, { lookups: (await firstValueFrom(api.getLookups())).data });
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
      },

      // --- Plan wizard ---

      previewPlan: async (payload: DpPlanPayload): Promise<DpOutcome> => {
        patchState(store, { previewing: true });
        try {
          patchState(store, {
            plan: (await firstValueFrom(api.previewPlan(payload))).data,
            previewing: false,
          });
          return DP_OK;
        } catch (error) {
          patchState(store, { plan: null, previewing: false });
          return failureOf(error);
        }
      },

      /** Opens the chain and, when asked, emits its first installment at once. */
      create: async (payload: DpCreatePayload, emitFirst: boolean): Promise<CreateOutcome> => {
        patchState(store, { saving: true });
        let chain: DpChainDetail;
        try {
          chain = (await firstValueFrom(api.createFromSource(payload))).data;
          patchState(store, { chain, missing: false, plan: null, saving: false });
        } catch (error) {
          patchState(store, { saving: false });
          return { ...failureOf(error), chain: null, emitFailure: null };
        }

        const first = chain.installments.find((item) => item.status === 'planned');
        if (!emitFirst || first === undefined) {
          return { ...DP_OK, chain, emitFailure: null };
        }

        patchState(store, { saving: true });
        try {
          const emitted = (await firstValueFrom(api.emitInstallment(chain.id, first.id, {}))).data;
          patchState(store, { chain: emitted.chain, saving: false });
          return { ...DP_OK, chain: emitted.chain, emitFailure: null };
        } catch (error) {
          patchState(store, { saving: false });
          return { ...DP_OK, chain, emitFailure: failureOf(error) };
        }
      },

      cancel: (): Promise<DpOutcome> => act(() => firstValueFrom(api.cancelChain(idOf()))),

      // --- Emission and payments ---

      emit: async (installmentId: string, payload: DpEmitPayload = {}): Promise<DpOutcome> => {
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(
            api.emitInstallment(idOf(), installmentId, payload),
          );
          patchState(store, { chain: response.data.chain, saving: false });
          return DP_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },

      confirmProforma: (linkId: string, payload: DpConfirmPaymentPayload): Promise<DpOutcome> =>
        act(() => firstValueFrom(api.confirmProformaPayment(idOf(), linkId, payload))),

      confirmDeposit: (depositId: string, payload: DpConfirmPaymentPayload): Promise<DpOutcome> =>
        actThenReload(() => firstValueFrom(api.confirmDepositPayment(idOf(), depositId, payload))),

      // --- Deposit resolution ---

      previewResolution: async (
        depositId: string,
        payload: DpResolvePayload,
      ): Promise<DpOutcome> => {
        patchState(store, { previewing: true });
        try {
          const response = await firstValueFrom(
            api.previewDepositResolution(idOf(), depositId, payload),
          );
          patchState(store, { resolution: response.data, previewing: false });
          return DP_OK;
        } catch (error) {
          patchState(store, { resolution: null, previewing: false });
          return failureOf(error);
        }
      },

      resolve: (depositId: string, payload: DpResolvePayload): Promise<DpOutcome> =>
        act(() => firstValueFrom(api.resolveDeposit(idOf(), depositId, payload)), {
          resolution: null,
        }),

      // --- Final settlement ---

      previewSettlement: async (): Promise<DpOutcome> => {
        patchState(store, { previewing: true });
        try {
          const response = await firstValueFrom(api.previewFinalSettlement(idOf()));
          patchState(store, { settlement: response.data, previewing: false });
          return DP_OK;
        } catch (error) {
          patchState(store, { settlement: null, previewing: false });
          return failureOf(error);
        }
      },

      generateSettlement: async (payload: DpSettlementPayload): Promise<SettleOutcome> => {
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(api.generateFinalSettlement(idOf(), payload));
          patchState(store, { chain: response.data.chain, settlement: null, saving: false });
          return { ...DP_OK, invoiceNumber: response.data.invoice_number };
        } catch (error) {
          patchState(store, { saving: false });
          return { ...failureOf(error), invoiceNumber: null };
        }
      },

      // --- Credit note of an advance ---

      previewCreditNote: async (
        linkId: string,
        payload: DpCreditNotePayload,
      ): Promise<DpOutcome> => {
        patchState(store, { previewing: true });
        try {
          const response = await firstValueFrom(api.previewCreditNote(idOf(), linkId, payload));
          patchState(store, { creditNote: response.data, previewing: false });
          return DP_OK;
        } catch (error) {
          patchState(store, { creditNote: null, previewing: false });
          return failureOf(error);
        }
      },

      issueCreditNote: async (linkId: string, payload: DpCreditNotePayload): Promise<DpOutcome> => {
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(api.issueCreditNote(idOf(), linkId, payload));
          patchState(store, { chain: response.data.chain, creditNote: null, saving: false });
          return DP_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
    };
  }),
);
