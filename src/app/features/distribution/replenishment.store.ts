import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { DistributionApiService, DstLookups, DstRule, DstRulePayload } from '@core';
import { attempt, DstOutcome, failureOf } from './distribution.util';

export interface ReplenishmentState {
  rules: DstRule[];
  lookups: DstLookups | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** Replenishment policies per warehouse and item: min/max, reorder point, periodic review and demand driven DRP. */
export const ReplenishmentStore = signalStore(
  withState<ReplenishmentState>({
    rules: [],
    lookups: null,
    loading: false,
    saving: false,
    error: null,
  }),
  withMethods((store, api = inject(DistributionApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const [lookups, rules] = await Promise.all([
          firstValueFrom(api.getLookups()),
          firstValueFrom(api.listRules()),
        ]);
        patchState(store, { lookups: lookups.data, rules: rules.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const write = async (call: () => Promise<unknown>): Promise<DstOutcome> => {
      patchState(store, { saving: true });
      const outcome = await attempt(call);
      patchState(store, { saving: false });
      if (outcome.ok) {
        await load();
      }
      return outcome;
    };

    return {
      load,
      save: (payload: DstRulePayload, id?: string): Promise<DstOutcome> =>
        write(() => firstValueFrom(id ? api.updateRule(id, payload) : api.createRule(payload))),
      remove: (id: string): Promise<DstOutcome> => write(() => firstValueFrom(api.deleteRule(id))),
    };
  }),
);
