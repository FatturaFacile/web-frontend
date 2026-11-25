import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ExmBalance,
  ExpenseManagementApiService,
  ExmLookups,
  ExmPageMeta,
  ExmReport,
  ExmReportFilters,
  ExmReportPayload,
} from '@core';
import { EXM_OK, ExmOutcome, failureOf } from './expense-management.util';

export interface ReportsState {
  filters: ExmReportFilters;
  reports: ExmReport[];
  meta: ExmPageMeta | null;
  lookups: ExmLookups | null;
  balance: ExmBalance | null;
  /** The report just created, so the screen can open it. */
  created: ExmReport | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const PAGE_SIZE = 25;

const initialState: ReportsState = {
  filters: { per_page: PAGE_SIZE, page: 1 },
  reports: [],
  meta: null,
  lookups: null,
  balance: null,
  created: null,
  loading: false,
  saving: false,
  error: null,
};

/** The expense reports of the company (or of the member): filters, paging, creation and the balance widget. */
export const ReportsStore = signalStore(
  withState(initialState),
  withComputed(({ meta, lookups }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? PAGE_SIZE),
    employees: computed(() => lookups()?.employees ?? []),
    jurisdiction: computed(() => lookups()?.jurisdiction ?? 'IT'),
    currency: computed(() => lookups()?.base_currency ?? 'EUR'),
    fiscalNoticeCodes: computed(() => lookups()?.fiscal_notice_codes ?? []),
  })),
  withMethods((store, api = inject(ExpenseManagementApiService)) => {
    let sequence = 0;

    const load = async (filters: ExmReportFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listReports(filters));
        if (ticket === sequence) {
          patchState(store, { reports: response.data, meta: response.meta, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      }
    };

    return {
      async init(): Promise<void> {
        const [lookups, balance] = await Promise.all([
          firstValueFrom(api.getLookups()).catch(() => null),
          firstValueFrom(api.getBalance()).catch(() => null),
        ]);
        patchState(store, { lookups: lookups?.data ?? null, balance: balance?.data ?? null });
        await load(store.filters());
      },
      load: (filters: ExmReportFilters = store.filters()): Promise<void> => load(filters),
      /** Applies filters from the first page. */
      setFilters(patch: Partial<ExmReportFilters>): Promise<void> {
        return load({ ...store.filters(), ...patch, page: 1 });
      },
      setPage(page: number): Promise<void> {
        return load({ ...store.filters(), page });
      },
      async create(payload: ExmReportPayload): Promise<ExmOutcome> {
        patchState(store, { saving: true, created: null });
        try {
          const response = await firstValueFrom(api.createReport(payload));
          patchState(store, { saving: false, created: response.data });
          await load(store.filters());
          return EXM_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      async remove(id: string): Promise<ExmOutcome> {
        try {
          await firstValueFrom(api.deleteReport(id));
          await load(store.filters());
          return EXM_OK;
        } catch (error) {
          return failureOf(error);
        }
      },
    };
  }),
);
