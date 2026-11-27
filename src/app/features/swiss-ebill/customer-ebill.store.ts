import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  EbillCustomerData,
  EbillLookupPayload,
  EbillParticipant,
  SwissEbillApiService,
} from '@core';
import { EBILL_OK, EbillOutcome, failureOf } from './swiss-ebill.util';

export interface CustomerEbillState {
  customer: EbillCustomerData | null;
  participant: EbillParticipant | null;
  /** True once a lookup answered, so "not found" can be told apart from "not asked yet". */
  looked: boolean;
  working: boolean;
}

/** The eBill card of one customer: verification, directory lookup and manual link. */
export const CustomerEbillStore = signalStore(
  withState<CustomerEbillState>({
    customer: null,
    participant: null,
    looked: false,
    working: false,
  }),
  withMethods((store, api = inject(SwissEbillApiService)) => ({
    init: (customer: EbillCustomerData | null): void => {
      patchState(store, { customer });
    },
    sync: async (customerId: string, forceRefresh = false): Promise<EbillOutcome> => {
      patchState(store, { working: true });
      try {
        const response = await firstValueFrom(api.syncCustomer(customerId, forceRefresh));
        patchState(store, {
          customer: response.data.customer,
          participant: response.data.participant,
          looked: true,
          working: false,
        });
        return EBILL_OK;
      } catch (error) {
        patchState(store, { working: false });
        return failureOf(error);
      }
    },
    lookup: async (payload: EbillLookupPayload): Promise<EbillOutcome> => {
      patchState(store, { working: true });
      try {
        const response = await firstValueFrom(api.lookupParticipant(payload));
        patchState(store, { participant: response.data, looked: true, working: false });
        return EBILL_OK;
      } catch (error) {
        patchState(store, { working: false });
        return failureOf(error);
      }
    },
    link: async (customerId: string, participantId: string): Promise<EbillOutcome> => {
      patchState(store, { working: true });
      try {
        const response = await firstValueFrom(api.linkCustomer(customerId, participantId));
        patchState(store, { customer: response.data.customer, working: false });
        return EBILL_OK;
      } catch (error) {
        patchState(store, { working: false });
        return failureOf(error);
      }
    },
  })),
);
