import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { SfPreview, StatutoryFinancialsApiService } from '@core';
import { failureOf } from './statutory-financials.util';

export interface PreviewState {
  preview: SfPreview | null;
  loading: boolean;
  error: string | null;
}

/** The official TEBENI / ministerial preview of the dossier. */
export const PreviewStore = signalStore(
  withState<PreviewState>({ preview: null, loading: false, error: null }),
  withMethods((store, api = inject(StatutoryFinancialsApiService)) => ({
    async load(id: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getPreview(id));
        patchState(store, { preview: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, preview: null, error: failureOf(error).errorKey });
      }
    },
  })),
);
