import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { DistributionApiService, DstAtp, DstAtpMatrix, DstChannel, DstLookups } from '@core';
import { failureOf } from './distribution.util';

export interface AtpState {
  matrix: DstAtpMatrix | null;
  breakdown: DstAtp | null;
  channels: DstChannel[];
  stockItemId: string | null;
  salesChannelId: string | null;
  lookups: DstLookups | null;
  loading: boolean;
  error: string | null;
}

/** The ATP matrix (item x channel) and the breakdown of one item per channel and warehouse. */
export const AtpStore = signalStore(
  withState<AtpState>({
    matrix: null,
    breakdown: null,
    channels: [],
    stockItemId: null,
    salesChannelId: null,
    lookups: null,
    loading: false,
    error: null,
  }),
  withMethods((store, api = inject(DistributionApiService)) => {
    const loadBreakdown = async (): Promise<void> => {
      const item = store.stockItemId();
      if (item === null) {
        patchState(store, { breakdown: null });
        return;
      }
      patchState(store, {
        breakdown: (await firstValueFrom(api.getAtp(item, store.salesChannelId()))).data,
      });
    };

    return {
      async init(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [lookups, matrix, channels] = await Promise.all([
            firstValueFrom(api.getLookups()),
            firstValueFrom(api.getAtpMatrix()),
            firstValueFrom(api.listChannels()),
          ]);
          patchState(store, {
            lookups: lookups.data,
            matrix: matrix.data,
            channels: channels.data,
            loading: false,
          });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      async inspect(
        stockItemId: string | null,
        salesChannelId: string | null = null,
      ): Promise<void> {
        patchState(store, { stockItemId, salesChannelId, error: null });
        try {
          await loadBreakdown();
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
      },
    };
  }),
);
