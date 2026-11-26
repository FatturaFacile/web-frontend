import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { PcAttribute, PcAttributePayload, ProductCatalogApiService } from '@core';
import { failureOf, PC_OK, PcOutcome } from './product-catalog.util';

export interface AttributesState {
  attributes: PcAttribute[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** The attribute definitions (the axes of a variant matrix) and their values with SKU tokens and surcharges. */
export const AttributesStore = signalStore(
  withState<AttributesState>({ attributes: [], loading: false, saving: false, error: null }),
  withMethods((store, api = inject(ProductCatalogApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listAttributes());
        patchState(store, { attributes: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const write = async (call: () => Promise<unknown>): Promise<PcOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        await load();
        return PC_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      init: load,

      save(payload: PcAttributePayload, id: string | null): Promise<PcOutcome> {
        return write(() =>
          id === null
            ? firstValueFrom(api.createAttribute(payload))
            : firstValueFrom(api.updateAttribute(id, { ...payload, code: undefined })),
        );
      },

      remove(id: string): Promise<PcOutcome> {
        return write(() => firstValueFrom(api.deleteAttribute(id)));
      },
    };
  }),
);
