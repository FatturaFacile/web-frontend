import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import {
  IssueRmaPayload,
  RmaIssueResult,
  RmaLabel,
  SerialLookupResult,
  StockHint,
  WarrantyRmaApiService,
} from '@core';
import { esmErrorBody } from '../utils/rma-status';
import { ActionResult, RmaNotifier, runRequest } from './action-result';

export type LookupOutcome = 'idle' | 'found' | 'serial_not_found' | 'passport_missing' | 'error';

export interface SerialLookupState {
  serial: string;
  outcome: LookupOutcome;
  result: SerialLookupResult | null;
  stockHint: StockHint | null;
  isLoading: boolean;
  issuing: boolean;
  /** Label of the RMA just issued: carries the raw tracking token, shown once then dropped. */
  issuedLabel: RmaLabel | null;
}

const initialState: SerialLookupState = {
  serial: '',
  outcome: 'idle',
  result: null,
  stockHint: null,
  isLoading: false,
  issuing: false,
  issuedLabel: null,
};

export const SerialLookupStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(WarrantyRmaApiService), notifier = inject(RmaNotifier)) => ({
    async lookup(serial: string): Promise<void> {
      const trimmed = serial.trim();
      if (!trimmed) {
        return;
      }
      patchState(store, {
        serial: trimmed,
        isLoading: true,
        result: null,
        stockHint: null,
        outcome: 'idle',
      });
      const res = await runRequest(api.lookupSerial(trimmed));
      if (res.ok) {
        patchState(store, { isLoading: false, outcome: 'found', result: res.data.data });
        return;
      }
      if (res.status === 404 && res.code === 'passport_missing') {
        patchState(store, {
          isLoading: false,
          outcome: 'passport_missing',
          stockHint: esmErrorBody(res.error)?.stock_hint ?? null,
        });
        return;
      }
      patchState(store, {
        isLoading: false,
        outcome: res.status === 404 ? 'serial_not_found' : 'error',
      });
    },

    async issueRma(payload: IssueRmaPayload): Promise<ActionResult<RmaIssueResult>> {
      patchState(store, { issuing: true });
      const res = await runRequest(api.issueRma(payload));
      patchState(store, { issuing: false });
      if (!res.ok) {
        if (res.status === 409 || res.status === 404) {
          notifier.conflict(res.code);
        }
        return res;
      }
      const rma = res.data.data;
      patchState(store, {
        issuedLabel: rma.label ?? {
          rma_number: rma.rma_number,
          serial_number: rma.serial_number,
          product_name: null,
          customer_name: rma.customer?.name ?? null,
          return_address: null,
          barcode_payload: rma.rma_number,
        },
      });
      notifier.success('RMA.MESSAGES.ISSUED', { rma: rma.rma_number });
      // Refresh the RMA history of the looked-up serial.
      const refreshed = await runRequest(api.lookupSerial(store.serial()));
      if (refreshed.ok) {
        patchState(store, { result: refreshed.data.data });
      }
      return { ok: true, data: rma };
    },

    dismissLabel(): void {
      patchState(store, { issuedLabel: null });
    },
  })),
);
