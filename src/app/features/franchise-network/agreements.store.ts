import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  FranchiseNetworkApiService,
  FrnAgreement,
  FrnAgreementPayload,
  FrnFormula,
  FrnStore,
} from '@core';
import { failureOf, FRN_OK, FrnOutcome } from './franchise-network.util';

export interface AgreementsState {
  agreements: FrnAgreement[];
  stores: FrnStore[];
  formulas: FrnFormula[];
  detail: FrnAgreement | null;
  statusFilter: string | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** Affiliation agreements: drafting with the L. 129/2004 findings, activation, renewal, termination and the entry fee schedule. */
export const AgreementsStore = signalStore(
  withState<AgreementsState>({
    agreements: [],
    stores: [],
    formulas: [],
    detail: null,
    statusFilter: null,
    loading: false,
    saving: false,
    error: null,
  }),
  withMethods((store, api = inject(FranchiseNetworkApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const status = store.statusFilter() ?? undefined;
        const [agreements, lookups] = await Promise.all([
          firstValueFrom(api.listAgreements({ status })),
          firstValueFrom(api.getLookups()),
        ]);
        patchState(store, {
          agreements: agreements.data,
          stores: lookups.data.stores,
          formulas: lookups.data.formulas,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const write = async (call: () => Promise<unknown>): Promise<FrnOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        await load();
        return FRN_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      load,
      setStatusFilter(status: string | null): Promise<void> {
        patchState(store, { statusFilter: status });
        return load();
      },
      save: (payload: FrnAgreementPayload, id?: string): Promise<FrnOutcome> =>
        write(() =>
          firstValueFrom(id ? api.updateAgreement(id, payload) : api.createAgreement(payload)),
        ),
      activate: (id: string): Promise<FrnOutcome> => write(() => firstValueFrom(api.activateAgreement(id))),
      terminate: (id: string): Promise<FrnOutcome> => write(() => firstValueFrom(api.terminateAgreement(id))),
      renew: (id: string, endDate: string): Promise<FrnOutcome> =>
        write(() => firstValueFrom(api.renewAgreement(id, endDate))),
      remove: (id: string): Promise<FrnOutcome> => write(() => firstValueFrom(api.deleteAgreement(id))),
      async openDetail(id: string): Promise<void> {
        try {
          const response = await firstValueFrom(api.getAgreement(id));
          patchState(store, { detail: response.data });
        } catch (error) {
          patchState(store, { error: failureOf(error).errorKey });
        }
      },
      closeDetail(): void {
        patchState(store, { detail: null });
      },
    };
  }),
);
