import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  DC_CHANNELS,
  DC_CURRENCIES,
  DC_EXCLUSION_TYPES,
  DC_INTEREST_BASES,
  DC_INTEREST_KINDS,
  DC_JURISDICTIONS,
  DC_LEVELS,
  DC_NOTICE_KINDS,
  DC_NOTICE_STATUSES,
  DC_PLAN_STATUSES,
  DC_RECEIPT_KINDS,
  DebtCollectionApiService,
  DcLookups,
} from '@core';

/** What the screens offer before the API answers (and when the lookups call fails): the values of the contract. */
export const DEFAULT_LOOKUPS: DcLookups = {
  levels: [...DC_LEVELS],
  channels: [...DC_CHANNELS],
  jurisdictions: [...DC_JURISDICTIONS],
  exclusion_types: [...DC_EXCLUSION_TYPES],
  notice_kinds: [...DC_NOTICE_KINDS],
  notice_statuses: [...DC_NOTICE_STATUSES],
  receipt_kinds: [...DC_RECEIPT_KINDS],
  interest_bases: [...DC_INTEREST_BASES],
  interest_kinds: [...DC_INTEREST_KINDS],
  currencies: [...DC_CURRENCIES],
  plan_statuses: [...DC_PLAN_STATUSES],
  template_codes: [],
};

interface LookupsState {
  lookups: DcLookups;
  loaded: boolean;
}

/** The enumerations of the module, read once from the API and shared by every screen of the feature. */
export const DcLookupsStore = signalStore(
  { providedIn: 'root' },
  withState<LookupsState>({ lookups: DEFAULT_LOOKUPS, loaded: false }),
  withMethods((store, api = inject(DebtCollectionApiService)) => ({
    async ensureLoaded(): Promise<void> {
      if (store.loaded()) {
        return;
      }
      try {
        const response = await firstValueFrom(api.getLookups());
        patchState(store, { lookups: { ...DEFAULT_LOOKUPS, ...response.data }, loaded: true });
      } catch {
        patchState(store, { loaded: true });
      }
    },
  })),
);
