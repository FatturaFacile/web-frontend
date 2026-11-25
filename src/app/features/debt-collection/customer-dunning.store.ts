import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  DcCustomerHistory,
  DcExclusionPayload,
  DcPaymentPlanPayload,
  DcProposalItem,
  DebtCollectionApiService,
} from '@core';
import { downloadBlob } from '@shared';
import { DC_OK, DcOutcome, failureOf, todayIso } from './debt-collection.util';

export interface CustomerDunningState {
  customerId: string | null;
  history: DcCustomerHistory | null;
  /** Open items of the customer a payment plan can cover. */
  items: DcProposalItem[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: CustomerDunningState = {
  customerId: null,
  history: null,
  items: [],
  loading: false,
  saving: false,
  error: null,
};

/** The dunning view of one customer: summary, timeline, notices, dossiers, exclusions and payment plans. */
export const CustomerDunningStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(DebtCollectionApiService)) => {
    const load = async (customerId: string): Promise<void> => {
      patchState(store, { customerId, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getCustomerHistory(customerId));
        patchState(store, { history: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
      }
    };

    const write = async (work: () => Promise<unknown>): Promise<DcOutcome> => {
      patchState(store, { saving: true });
      try {
        await work();
        patchState(store, { saving: false });
        const customerId = store.customerId();
        if (customerId) {
          await load(customerId);
        }
        return DC_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      load,
      async loadItems(): Promise<void> {
        const customerId = store.customerId();
        if (!customerId) {
          return;
        }
        try {
          const response = await firstValueFrom(
            api.listProposals({ customer_id: customerId, as_of: todayIso(), include_excluded: 1 }),
          );
          patchState(store, { items: response.data.items });
        } catch (error) {
          patchState(store, { items: [], error: (await failureOf(error)).errorKey });
        }
      },
      /** Flags a dispute or a legal hold (or a manual exclusion) on the customer. */
      flag(payload: DcExclusionPayload): Promise<DcOutcome> {
        return write(() => firstValueFrom(api.createExclusion(payload)));
      },
      release(id: string, note: string): Promise<DcOutcome> {
        return write(() => firstValueFrom(api.releaseExclusion(id, note)));
      },
      createPlan(payload: DcPaymentPlanPayload): Promise<DcOutcome> {
        return write(() => firstValueFrom(api.createPaymentPlan(payload)));
      },
      transitionPlan(id: string, action: 'complete' | 'default' | 'cancel'): Promise<DcOutcome> {
        return write(() => firstValueFrom(api.transitionPaymentPlan(id, action)));
      },
      async downloadNoticePdf(id: string, number: string): Promise<DcOutcome> {
        try {
          downloadBlob(await firstValueFrom(api.downloadNoticePdf(id)), `${number}.pdf`);
          return DC_OK;
        } catch (error) {
          return failureOf(error);
        }
      },
    };
  }),
);
