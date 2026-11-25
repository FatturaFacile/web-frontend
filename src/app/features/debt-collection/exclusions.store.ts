import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  DcExclusion,
  DcExclusionPayload,
  DcPaymentPlan,
  DcPaymentPlanPayload,
  DcProposalItem,
  DebtCollectionApiService,
} from '@core';
import { DC_OK, DcOutcome, failureOf, todayIso } from './debt-collection.util';

export interface ExclusionsState {
  customerId: string | null;
  activeOnly: boolean;
  exclusions: DcExclusion[];
  plans: DcPaymentPlan[];
  /** Open items of the customer a payment plan can cover. */
  items: DcProposalItem[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: ExclusionsState = {
  customerId: null,
  activeOnly: true,
  exclusions: [],
  plans: [],
  items: [],
  loading: false,
  saving: false,
  error: null,
};

/** Dunning exclusions (manual, dispute, legal hold) and payment plans (piano di rientro). */
export const ExclusionsStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(DebtCollectionApiService)) => {
    let sequence = 0;

    const load = async (): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { loading: true, error: null });
      const customerId = store.customerId() ?? undefined;
      try {
        const [exclusions, plans] = await Promise.all([
          firstValueFrom(
            api.listExclusions({
              ...(customerId ? { customer_id: customerId } : {}),
              ...(store.activeOnly() ? { active: 1 as const } : {}),
            }),
          ),
          firstValueFrom(api.listPaymentPlans(customerId)),
        ]);
        if (ticket === sequence) {
          patchState(store, { exclusions: exclusions.data, plans: plans.data, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      }
    };

    const write = async (work: () => Promise<unknown>): Promise<DcOutcome> => {
      patchState(store, { saving: true });
      try {
        await work();
        patchState(store, { saving: false });
        await load();
        return DC_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      load,
      setCustomer(customerId: string | null): Promise<void> {
        patchState(store, { customerId });
        return load();
      },
      setActiveOnly(activeOnly: boolean): Promise<void> {
        patchState(store, { activeOnly });
        return load();
      },
      async loadItems(customerId: string | null): Promise<void> {
        if (!customerId) {
          patchState(store, { items: [] });
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
      createExclusion(payload: DcExclusionPayload): Promise<DcOutcome> {
        return write(() => firstValueFrom(api.createExclusion(payload)));
      },
      releaseExclusion(id: string, note: string): Promise<DcOutcome> {
        return write(() => firstValueFrom(api.releaseExclusion(id, note)));
      },
      createPlan(payload: DcPaymentPlanPayload): Promise<DcOutcome> {
        return write(() => firstValueFrom(api.createPaymentPlan(payload)));
      },
      transitionPlan(id: string, action: 'complete' | 'default' | 'cancel'): Promise<DcOutcome> {
        return write(() => firstValueFrom(api.transitionPaymentPlan(id, action)));
      },
    };
  }),
);
