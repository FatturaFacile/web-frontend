import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  GdoTradeTermsApiService,
  GdtContract,
  GdtContractPayload,
  GdtDeliveryPoint,
  GdtLookups,
  GdtProgress,
  GdtPromotionPayload,
  GdtScalePayload,
  GdtTransition,
} from '@core';
import { failureOf, GDT_OK, GdtOutcome } from './gdo-trade-terms.util';

export interface ContractDetailState {
  contract: GdtContract | null;
  progress: GdtProgress | null;
  lookups: GdtLookups | null;
  points: GdtDeliveryPoint[];
  loading: boolean;
  progressLoading: boolean;
  saving: boolean;
  error: string | null;
}

/** One contract with its rebate scales, promotions and attainment: the editor of the framework contract. */
export const ContractDetailStore = signalStore(
  withState<ContractDetailState>({
    contract: null,
    progress: null,
    lookups: null,
    points: [],
    loading: false,
    progressLoading: false,
    saving: false,
    error: null,
  }),
  withComputed(({ contract, lookups }) => ({
    scales: computed(() => contract()?.scales ?? []),
    promotions: computed(() => contract()?.promotions ?? []),
    editable: computed(() => {
      const status = contract()?.status;
      return status === 'draft' || status === 'active' || status === 'suspended';
    }),
    categories: computed(() => lookups()?.categories ?? []),
    brands: computed(() => lookups()?.brands ?? []),
    accounts: computed(() => lookups()?.accounts ?? []),
    customers: computed(() => lookups()?.customers ?? []),
    taxRates: computed(() => lookups()?.tax_rates ?? { IT: '22', CH: '8.1' }),
  })),
  withMethods((store, api = inject(GdoTradeTermsApiService)) => {
    const reload = async (id: string): Promise<void> => {
      const response = await firstValueFrom(api.getContract(id));
      patchState(store, { contract: response.data });
    };

    const progress = async (id: string, asOf?: string): Promise<void> => {
      patchState(store, { progressLoading: true });
      try {
        const response = await firstValueFrom(api.getProgress(id, asOf));
        patchState(store, { progress: response.data, progressLoading: false });
      } catch {
        patchState(store, { progress: null, progressLoading: false });
      }
    };

    /** Runs a write, then reloads the contract and its attainment so the screen shows what the API now holds. */
    const write = async (id: string, action: () => Promise<unknown>): Promise<GdtOutcome> => {
      patchState(store, { saving: true });
      try {
        await action();
        await reload(id);
        patchState(store, { saving: false });
        await progress(id);
        return GDT_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      async load(id: string): Promise<void> {
        patchState(store, { loading: true, error: null, contract: null, progress: null });
        try {
          const [contract, lookups] = await Promise.all([
            firstValueFrom(api.getContract(id)),
            firstValueFrom(api.getLookups()).catch(() => null),
          ]);
          patchState(store, { contract: contract.data, lookups: lookups?.data ?? null, loading: false });
          const points = await firstValueFrom(
            api.listDeliveryPoints({ contact_id: contract.data.contact_id, per_page: 100 }),
          ).catch(() => null);
          patchState(store, { points: points?.data ?? [] });
          await progress(id);
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      loadProgress: progress,
      saveContract(id: string, payload: Partial<GdtContractPayload>): Promise<GdtOutcome> {
        return write(id, () => firstValueFrom(api.updateContract(id, payload)));
      },
      transition(id: string, action: GdtTransition): Promise<GdtOutcome> {
        return write(id, () => firstValueFrom(api.transitionContract(id, action)));
      },
      saveScale(id: string, scaleId: string | null, payload: GdtScalePayload): Promise<GdtOutcome> {
        return write(id, () =>
          firstValueFrom(
            scaleId === null ? api.createScale(id, payload) : api.updateScale(id, scaleId, payload),
          ),
        );
      },
      removeScale(id: string, scaleId: string): Promise<GdtOutcome> {
        return write(id, () => firstValueFrom(api.deleteScale(id, scaleId)));
      },
      savePromotion(
        id: string,
        promotionId: string | null,
        payload: GdtPromotionPayload,
      ): Promise<GdtOutcome> {
        return write(id, () =>
          firstValueFrom(
            promotionId === null
              ? api.createPromotion(id, payload)
              : api.updatePromotion(id, promotionId, payload),
          ),
        );
      },
      transitionPromotion(id: string, promotionId: string, action: GdtTransition): Promise<GdtOutcome> {
        return write(id, () => firstValueFrom(api.transitionPromotion(id, promotionId, action)));
      },
      removePromotion(id: string, promotionId: string): Promise<GdtOutcome> {
        return write(id, () => firstValueFrom(api.deletePromotion(id, promotionId)));
      },
    };
  }),
);
