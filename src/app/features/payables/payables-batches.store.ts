import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom, Observable } from 'rxjs';
import {
  ApBatch,
  ApBatchFilters,
  ApBatchPreview,
  ApBatchStatus,
  ApEnvelope,
  ApProposalParams,
  LaravelPaginationMeta,
  PayablesApiService,
} from '@core';
import { AP_OK, apFailure, ApOutcome, apiErrorMessage, todayIso } from './payables.util';

export interface PayablesBatchesState {
  filters: ApBatchFilters;
  batches: ApBatch[];
  meta: LaravelPaginationMeta | null;
  /** The batch shown on the detail page. */
  detail: ApBatch | null;
  // --- Wizard ---
  params: ApProposalParams;
  preview: ApBatchPreview | null;
  selectedItemIds: string[];
  selectedSetOffIds: string[];
  loading: boolean;
  previewing: boolean;
  saving: boolean;
  error: string | null;
}

const PAGE_SIZE = 20;

const initialState: PayablesBatchesState = {
  filters: { per_page: PAGE_SIZE, page: 1 },
  batches: [],
  meta: null,
  detail: null,
  params: { cutoff_date: '', prioritize_skonto: true },
  preview: null,
  selectedItemIds: [],
  selectedSetOffIds: [],
  loading: false,
  previewing: false,
  saving: false,
  error: null,
};

/** Payment batches (Distinte di Pagamento): list, guided creation, CFO approval and payment execution. */
export const PayablesBatchesStore = signalStore(
  withState(initialState),
  withComputed(({ meta, preview, selectedItemIds }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? PAGE_SIZE),
    /** The proposed batch as the API computed it for the current selection. */
    proposed: computed(() => preview()?.batch ?? null),
    canCreate: computed(() => selectedItemIds().length > 0 && preview() !== null),
  })),
  withMethods((store, api = inject(PayablesApiService)) => {
    let sequence = 0;
    let previewSequence = 0;

    const runPreview = async (params: ApProposalParams): Promise<void> => {
      const ticket = ++previewSequence;
      patchState(store, { params, previewing: true, error: null });
      try {
        const response = await firstValueFrom(api.previewBatch(params));
        if (ticket === previewSequence) {
          const batch = response.data.batch;
          patchState(store, {
            preview: response.data,
            // The first call (no selection sent) ticks what the API proposed; later calls keep the user's choice.
            selectedItemIds:
              params.item_ids ??
              batch.transfers.flatMap((group) => group.lines.map((line) => line.item_id)),
            selectedSetOffIds:
              params.set_off_ids ?? batch.set_offs.map((setOff) => setOff.credit_note_id),
            previewing: false,
          });
        }
      } catch (error) {
        if (ticket === previewSequence) {
          patchState(store, {
            previewing: false,
            error: apiErrorMessage(error) ?? 'AP.PREVIEW_ERROR',
          });
        }
      }
    };

    const transition = async (call: Observable<ApEnvelope<ApBatch>>): Promise<ApOutcome> => {
      patchState(store, { saving: true });
      try {
        const response = await firstValueFrom(call);
        patchState(store, {
          saving: false,
          detail: response.data,
          batches: store
            .batches()
            .map((row) => (row.id === response.data.id ? response.data : row)),
        });
        return AP_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return apFailure(error);
      }
    };

    const loadList = async (filters: ApBatchFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listBatches(filters));
        if (ticket === sequence) {
          patchState(store, { batches: response.data, meta: response.meta, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: apiErrorMessage(error) ?? 'AP.LOAD_ERROR' });
        }
      }
    };

    return {
      loadList: (filters: ApBatchFilters = store.filters()): Promise<void> => loadList(filters),
      setStatus(status: ApBatchStatus | undefined): Promise<void> {
        return loadList({ ...store.filters(), status, page: 1 });
      },
      setPage(page: number): Promise<void> {
        return loadList({ ...store.filters(), page });
      },

      // --- Detail ---
      async loadDetail(id: string): Promise<void> {
        patchState(store, { loading: true, error: null, detail: null });
        try {
          const response = await firstValueFrom(api.getBatch(id));
          patchState(store, { detail: response.data, loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: apiErrorMessage(error) ?? 'AP.LOAD_ERROR' });
        }
      },
      submit: (id: string): Promise<ApOutcome> => transition(api.submitBatch(id)),
      approve: (id: string, reason?: string): Promise<ApOutcome> =>
        transition(api.approveBatch(id, reason ? { reason } : {})),
      reject: (id: string, reason: string): Promise<ApOutcome> =>
        transition(api.rejectBatch(id, { reason })),
      execute: (id: string): Promise<ApOutcome> => transition(api.executeBatch(id)),
      cancel: (id: string): Promise<ApOutcome> => transition(api.cancelBatch(id)),

      // --- Wizard ---
      resetWizard(): void {
        previewSequence++;
        patchState(store, {
          params: { cutoff_date: todayIso(), prioritize_skonto: true },
          preview: null,
          selectedItemIds: [],
          selectedSetOffIds: [],
          previewing: false,
          error: null,
        });
      },
      /** Step 1: proposes the items due up to the cutoff (every candidate ticked, credit notes netted). */
      propose(params: ApProposalParams): Promise<void> {
        return runPreview({ ...params, item_ids: undefined, set_off_ids: undefined });
      },
      /** Ticks or unticks an item and asks the API to recompute set-off, IBAN groups and totals. */
      toggleItem(id: string, selected: boolean): Promise<void> {
        const current = store.selectedItemIds().filter((value) => value !== id);
        const itemIds = selected ? [...current, id] : current;
        return runPreview({
          ...store.params(),
          item_ids: itemIds,
          set_off_ids: store.selectedSetOffIds(),
        });
      },
      toggleSetOff(id: string, selected: boolean): Promise<void> {
        const current = store.selectedSetOffIds().filter((value) => value !== id);
        const setOffIds = selected ? [...current, id] : current;
        return runPreview({
          ...store.params(),
          item_ids: store.selectedItemIds(),
          set_off_ids: setOffIds,
        });
      },
      /** Step 3: saves the batch as a draft. */
      async create(): Promise<ApOutcome & { batch: ApBatch | null }> {
        const params = store.params();
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(
            api.createBatch({
              cutoff_date: params.cutoff_date,
              prioritize_skonto: params.prioritize_skonto,
              ...(params.currency ? { currency: params.currency } : {}),
              item_ids: store.selectedItemIds(),
              set_off_ids: store.selectedSetOffIds(),
            }),
          );
          patchState(store, { saving: false, detail: response.data });
          return { ...AP_OK, batch: response.data };
        } catch (error) {
          patchState(store, { saving: false });
          return { ...apFailure(error), batch: null };
        }
      },
    };
  }),
);
