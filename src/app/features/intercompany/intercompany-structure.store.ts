import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  IcPartyLink,
  IcPartyLinkPayload,
  IcPeriodRate,
  IcPeriodRateFilters,
  IcPeriodRatePayload,
  IcSettings,
  IcSettingsPayload,
  IntercompanyApiService,
} from '@core';
import { attempt, IcOutcome } from './intercompany.util';

export interface IntercompanyStructureState {
  settings: IcSettings | null;
  partyLinks: IcPartyLink[];
  rates: IcPeriodRate[];
  rateFilters: IcPeriodRateFilters;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: IntercompanyStructureState = {
  settings: null,
  partyLinks: [],
  rates: [],
  rateFilters: {},
  loading: false,
  saving: false,
  error: null,
};

/** Mirror settings, the contacts that stand for the other entities, and the period rates of one consolidation group. */
export const IntercompanyStructureStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(IntercompanyApiService)) => {
    const write = async <T>(call: () => Promise<T>, apply: (value: T) => void): Promise<IcOutcome> => {
      patchState(store, { saving: true });
      const { outcome, value } = await attempt(call);
      patchState(store, { saving: false });
      if (outcome.ok && value !== null) {
        apply(value);
      }
      return outcome;
    };

    return {
      async load(groupId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        const { outcome, value } = await attempt(async () => {
          const [settings, links, rates] = await Promise.all([
            firstValueFrom(api.getSettings(groupId)),
            firstValueFrom(api.getPartyLinks(groupId)),
            firstValueFrom(api.getPeriodRates(groupId, store.rateFilters())),
          ]);
          return { settings: settings.data, partyLinks: links.data ?? [], rates: rates.data ?? [] };
        });
        patchState(store, value ?? {}, { loading: false, error: outcome.errorKey });
      },
      saveSettings(groupId: string, payload: IcSettingsPayload): Promise<IcOutcome> {
        return write(
          async () => (await firstValueFrom(api.saveSettings(groupId, payload))).data,
          (settings) => patchState(store, { settings }),
        );
      },
      addPartyLink(groupId: string, payload: IcPartyLinkPayload): Promise<IcOutcome> {
        return write(
          async () => (await firstValueFrom(api.createPartyLink(groupId, payload))).data,
          (link) => patchState(store, { partyLinks: [...store.partyLinks(), link] }),
        );
      },
      removePartyLink(id: string): Promise<IcOutcome> {
        return write(
          async () => firstValueFrom(api.deletePartyLink(id)),
          () => patchState(store, { partyLinks: store.partyLinks().filter((link) => link.id !== id) }),
        );
      },
      async filterRates(groupId: string, rateFilters: IcPeriodRateFilters): Promise<void> {
        patchState(store, { rateFilters });
        const { value } = await attempt(() => firstValueFrom(api.getPeriodRates(groupId, rateFilters)));
        if (value !== null) {
          patchState(store, { rates: value.data ?? [] });
        }
      },
      saveRate(groupId: string, payload: IcPeriodRatePayload): Promise<IcOutcome> {
        return write(
          async () => (await firstValueFrom(api.savePeriodRate(groupId, payload))).data,
          (rate) => {
            const others = store
              .rates()
              .filter((row) => !(row.currency === rate.currency && row.rate_type === rate.rate_type && row.period_end === rate.period_end));
            patchState(store, { rates: [rate, ...others] });
          },
        );
      },
      removeRate(id: string): Promise<IcOutcome> {
        return write(
          async () => firstValueFrom(api.deletePeriodRate(id)),
          () => patchState(store, { rates: store.rates().filter((rate) => rate.id !== id) }),
        );
      },
    };
  }),
);
