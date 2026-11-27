import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  DistributionApiService,
  DstConsignmentDirection,
  DstConsignmentStock,
  DstLookups,
  DstReconciliation,
  DstReconciliationPayload,
  DstReturnPayload,
  DstSettlement,
  DstSettlementPayload,
} from '@core';
import { attempt, DstOutcome, failureOf, toNumber } from './distribution.util';

export interface ConsignmentState {
  direction: DstConsignmentDirection;
  stock: DstConsignmentStock[];
  totalValue: number;
  settlements: DstSettlement[];
  reconciliations: DstReconciliation[];
  lookups: DstLookups | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** Consignment stock (held at third parties / from third parties), its settlements and returns, and the 3PL reconciliations. */
export const ConsignmentStore = signalStore(
  withState<ConsignmentState>({
    direction: 'out',
    stock: [],
    totalValue: 0,
    settlements: [],
    reconciliations: [],
    lookups: null,
    loading: false,
    saving: false,
    error: null,
  }),
  withMethods((store, api = inject(DistributionApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const [stock, settlements, reconciliations] = await Promise.all([
          firstValueFrom(api.listConsignmentStock(store.direction())),
          firstValueFrom(api.listSettlements()),
          firstValueFrom(api.listReconciliations()),
        ]);
        patchState(store, {
          stock: stock.data,
          totalValue: toNumber(stock.meta['total_value'] as number | string | undefined),
          settlements: settlements.data,
          reconciliations: reconciliations.data,
          loading: false,
        });
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
      async init(): Promise<void> {
        try {
          patchState(store, { lookups: (await firstValueFrom(api.getLookups())).data });
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
        await load();
      },
      setDirection(direction: DstConsignmentDirection): Promise<void> {
        patchState(store, { direction });
        return load();
      },
      settle: (payload: DstSettlementPayload): Promise<DstOutcome> =>
        write(() => firstValueFrom(api.createSettlement(payload))),
      giveBack: (payload: DstReturnPayload): Promise<DstOutcome> =>
        write(() => firstValueFrom(api.createConsignmentReturn(payload))),
      reconcile: (payload: DstReconciliationPayload): Promise<DstOutcome> =>
        write(() => firstValueFrom(api.createReconciliation(payload))),
    };
  }),
);
