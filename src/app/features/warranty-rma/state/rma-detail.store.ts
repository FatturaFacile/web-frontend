import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, EMPTY, Observable, pipe, switchMap, tap } from 'rxjs';
import {
  CancelRmaPayload,
  CompleteRepairPayload,
  DiagnosisPayload,
  EsmEnvelope,
  IssueLoanerPayload,
  Loaner,
  NotePayload,
  ReceiveRmaPayload,
  ReturnRmaPayload,
  RmaOrder,
  RmaWithEstimateLink,
  WarrantyRmaApiService,
} from '@core';
import { ActionResult, RmaNotifier, runRequest } from './action-result';

/** A raw link/token returned by an action: shown once in a dialog, never persisted. */
export interface TokenReveal {
  kind: 'estimate' | 'tracking';
  url: string | null;
  token: string | null;
}

export interface RmaDetailState {
  rmaId: string | null;
  rma: RmaOrder | null;
  isLoading: boolean;
  busy: boolean;
  error: boolean;
  reveal: TokenReveal | null;
}

const initialState: RmaDetailState = {
  rmaId: null,
  rma: null,
  isLoading: false,
  busy: false,
  error: false,
  reveal: null,
};

export const RmaDetailStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(WarrantyRmaApiService)) => ({
    load: rxMethod<string>(
      pipe(
        tap((id) => patchState(store, { rmaId: id, isLoading: true, error: false })),
        switchMap((id) =>
          api.getRma(id).pipe(
            tap((res) => patchState(store, { rma: res.data, isLoading: false })),
            catchError(() => {
              patchState(store, { isLoading: false, error: true });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),
  })),
  withMethods((store, api = inject(WarrantyRmaApiService), notifier = inject(RmaNotifier)) => {
    /**
     * Runs a transition: on success the RMA is replaced by the response (and a returned estimate
     * link is revealed once); on 409 the user is told and the RMA reloaded from the server.
     */
    async function perform<T extends RmaOrder>(
      request: (id: string) => Observable<EsmEnvelope<T>>,
      successKey: string,
    ): Promise<ActionResult<T>> {
      const id = store.rmaId();
      if (!id) {
        return { ok: false, status: null, code: null, error: null };
      }
      patchState(store, { busy: true });
      const result = await runRequest(request(id));
      patchState(store, { busy: false });
      if (result.ok) {
        // The raw link/token only lives in `reveal` (dropped on dismiss), never in the kept RMA.
        const { estimate_url, estimate_token, ...rma } = result.data.data as T &
          Partial<RmaWithEstimateLink>;
        patchState(store, { rma: rma as RmaOrder });
        if (estimate_url || estimate_token) {
          patchState(store, {
            reveal: { kind: 'estimate', url: estimate_url ?? null, token: estimate_token ?? null },
          });
        }
        notifier.success(successKey);
        return { ok: true, data: rma as T };
      }
      if (result.status === 409) {
        notifier.conflict(result.code);
        store.load(id);
      }
      return result;
    }

    return {
      open(id: string): void {
        patchState(store, { rma: null, reveal: null });
        store.load(id);
      },
      reload(): void {
        const id = store.rmaId();
        if (id) {
          store.load(id);
        }
      },
      close(): void {
        patchState(store, initialState);
      },
      dismissReveal(): void {
        patchState(store, { reveal: null });
      },
      receive: (payload: ReceiveRmaPayload) =>
        perform((id) => api.receive(id, payload), 'RMA.MESSAGES.RECEIVED'),
      diagnose: (payload: DiagnosisPayload) =>
        perform((id) => api.diagnose(id, payload), 'RMA.MESSAGES.DIAGNOSIS_SAVED'),
      approveEstimate: (payload: NotePayload = {}) =>
        perform((id) => api.approveEstimate(id, payload), 'RMA.MESSAGES.ESTIMATE_APPROVED'),
      declineEstimate: (payload: NotePayload = {}) =>
        perform((id) => api.declineEstimate(id, payload), 'RMA.MESSAGES.ESTIMATE_DECLINED'),
      resendEstimate: () => perform((id) => api.resendEstimate(id), 'RMA.MESSAGES.ESTIMATE_RESENT'),
      partsReceived: () => perform((id) => api.partsReceived(id), 'RMA.MESSAGES.PARTS_RECEIVED'),
      completeRepair: (payload: CompleteRepairPayload) =>
        perform((id) => api.completeRepair(id, payload), 'RMA.MESSAGES.REPAIR_COMPLETED'),
      returnToCustomer: (payload: ReturnRmaPayload) =>
        perform((id) => api.returnToCustomer(id, payload), 'RMA.MESSAGES.RETURNED'),
      closeRma: () => perform((id) => api.close(id), 'RMA.MESSAGES.CLOSED'),
      cancel: (payload: CancelRmaPayload) =>
        perform((id) => api.cancel(id, payload), 'RMA.MESSAGES.CANCELLED'),

      async issueLoaner(payload: IssueLoanerPayload): Promise<ActionResult<Loaner>> {
        const id = store.rmaId();
        if (!id) {
          return { ok: false, status: null, code: null, error: null };
        }
        patchState(store, { busy: true });
        const result = await runRequest(api.issueLoaner(id, payload));
        patchState(store, { busy: false });
        if (result.ok) {
          notifier.success('RMA.MESSAGES.LOANER_ISSUED');
          store.load(id);
          return { ok: true, data: result.data.data };
        }
        if (result.status === 409) {
          notifier.conflict(result.code);
          store.load(id);
        }
        return result;
      },
    };
  }),
);
