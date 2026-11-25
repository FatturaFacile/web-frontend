import { inject } from '@angular/core';
import { SrmApiService } from '@data-access/procurement/srm-api.service';
import {
  DocumentFlow,
  DocumentFlowEntryType,
  SrmDashboard,
  SrmPeriod,
  SupplierRating,
} from '@domain/procurement/srm.models';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { catchError, finalize, of, tap } from 'rxjs';
import { extractApiErrorMessage } from '../requisitions/pr-status.helpers';

export interface SrmState {
  dashboard: SrmDashboard | null;
  scorecards: SupplierRating[];
  flow: DocumentFlow | null;
  loading: boolean;
  error: string | null;
}

const initialState: SrmState = {
  dashboard: null,
  scorecards: [],
  flow: null,
  loading: false,
  error: null,
};

/** Signal store of the purchasing / SRM overview, the supplier rating ranking and the document flow. */
export const SrmStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(SrmApiService)) => {
    const begin = (): void => patchState(store, { loading: true, error: null });
    const fail = (err: unknown): void =>
      patchState(store, { error: extractApiErrorMessage(err) || String(err) });

    return {
      loadDashboard(period: SrmPeriod = {}): void {
        begin();
        api
          .dashboard(period)
          .pipe(
            tap((dashboard) => patchState(store, { dashboard })),
            catchError((err: unknown) => {
              fail(err);
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          )
          .subscribe();
      },

      loadScorecards(period: SrmPeriod = {}): void {
        begin();
        api
          .scorecards(period)
          .pipe(
            tap((scorecards) => patchState(store, { scorecards })),
            catchError((err: unknown) => {
              fail(err);
              return of([]);
            }),
            finalize(() => patchState(store, { loading: false })),
          )
          .subscribe();
      },

      loadFlow(type: DocumentFlowEntryType, id: string): void {
        patchState(store, { flow: null });
        begin();
        api
          .documentFlow(type, id)
          .pipe(
            tap((flow) => patchState(store, { flow })),
            catchError((err: unknown) => {
              fail(err);
              return of(null);
            }),
            finalize(() => patchState(store, { loading: false })),
          )
          .subscribe();
      },
    };
  }),
);
