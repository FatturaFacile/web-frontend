import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CcvConvention,
  CcvConventionFilters,
  CcvConventionPayload,
  CcvIdentifierStats,
  CcvImportResult,
  CcvLookups,
  CcvPageMeta,
  CorporateConventionsApiService,
} from '@core';
import { CCV_OK, CcvOutcome, failureOf, saveBlob } from './corporate-conventions.util';

export interface ConventionsState {
  filters: CcvConventionFilters;
  conventions: CcvConvention[];
  meta: CcvPageMeta | null;
  lookups: CcvLookups | null;
  detail: CcvConvention | null;
  identifierStats: CcvIdentifierStats | null;
  importPreview: CcvImportResult | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const PAGE_SIZE = 25;

/** The conventions: filters, paging, creation and edit with the discount matrix, lifecycle, the SHA-256 employer list and the files. */
export const ConventionsStore = signalStore(
  withState<ConventionsState>({
    filters: { per_page: PAGE_SIZE, page: 1 },
    conventions: [],
    meta: null,
    lookups: null,
    detail: null,
    identifierStats: null,
    importPreview: null,
    loading: false,
    saving: false,
    error: null,
  }),
  withComputed(({ meta, lookups }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? PAGE_SIZE),
    partnerTypes: computed(() => lookups()?.partner_types ?? []),
    statuses: computed(() => lookups()?.convention_statuses ?? []),
    priceLists: computed(() => lookups()?.price_lists ?? []),
    categories: computed(() => lookups()?.categories ?? []),
  })),
  withMethods((store, api = inject(CorporateConventionsApiService)) => {
    let sequence = 0;

    const load = async (filters: CcvConventionFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listConventions(filters));
        if (ticket === sequence) {
          patchState(store, { conventions: response.data, meta: response.meta, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      }
    };

    const write = async <T>(
      call: () => Promise<T>,
      after?: (result: T) => void,
    ): Promise<CcvOutcome> => {
      patchState(store, { saving: true });
      try {
        const result = await call();
        after?.(result);
        patchState(store, { saving: false });
        await load(store.filters());
        return CCV_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      async init(): Promise<void> {
        const lookups = await firstValueFrom(api.getLookups()).catch(() => null);
        patchState(store, { lookups: lookups?.data ?? null });
        await load(store.filters());
      },
      load: (filters: CcvConventionFilters = store.filters()): Promise<void> => load(filters),
      /** Applies filters from the first page. */
      setFilters(patch: Partial<CcvConventionFilters>): Promise<void> {
        return load({ ...store.filters(), ...patch, page: 1 });
      },
      setPage(page: number): Promise<void> {
        return load({ ...store.filters(), page });
      },
      /** Loads one convention with its discount matrix for the edit form. */
      async open(id: string): Promise<CcvOutcome> {
        patchState(store, { detail: null, identifierStats: null, importPreview: null });
        try {
          const [detail, stats] = await Promise.all([
            firstValueFrom(api.getConvention(id)),
            firstValueFrom(api.getIdentifierStats(id)).catch(() => null),
          ]);
          patchState(store, { detail: detail.data, identifierStats: stats?.data ?? null });
          return CCV_OK;
        } catch (error) {
          return failureOf(error);
        }
      },
      closeDetail(): void {
        patchState(store, { detail: null, identifierStats: null, importPreview: null });
      },
      create: (payload: CcvConventionPayload): Promise<CcvOutcome> =>
        write(
          () => firstValueFrom(api.createConvention(payload)),
          (response) => patchState(store, { detail: response.data }),
        ),
      update: (id: string, payload: Partial<CcvConventionPayload>): Promise<CcvOutcome> =>
        write(
          () => firstValueFrom(api.updateConvention(id, payload)),
          (response) => patchState(store, { detail: response.data }),
        ),
      transition: (id: string, status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED'): Promise<CcvOutcome> =>
        write(() => firstValueFrom(api.transitionConvention(id, status))),
      remove: (id: string): Promise<CcvOutcome> =>
        write(() => firstValueFrom(api.deleteConvention(id))),
      /** Hashes and previews (dry run) or stores the identifiers of the employer list. */
      async importIdentifiers(
        id: string,
        identifiers: string[],
        dryRun: boolean,
      ): Promise<CcvOutcome> {
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(api.importIdentifiers(id, identifiers, dryRun));
          patchState(store, { importPreview: response.data, saving: false });
          if (!dryRun) {
            const stats = await firstValueFrom(api.getIdentifierStats(id)).catch(() => null);
            patchState(store, { identifierStats: stats?.data ?? store.identifierStats() });
          }
          return CCV_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      /** Downloads the PDF contract of a convention. */
      async downloadContract(id: string, code: string): Promise<CcvOutcome> {
        try {
          saveBlob(await firstValueFrom(api.downloadContract(id)), `${code}-contract.pdf`);
          return CCV_OK;
        } catch (error) {
          return failureOf(error);
        }
      },
      uploadContract: (id: string, file: File): Promise<CcvOutcome> =>
        write(
          () => firstValueFrom(api.uploadContract(id, file)),
          (response) => patchState(store, { detail: response.data }),
        ),
      uploadLogo: (id: string, file: File): Promise<CcvOutcome> =>
        write(
          () => firstValueFrom(api.uploadLogo(id, file)),
          (response) => patchState(store, { detail: response.data }),
        ),
    };
  }),
);
