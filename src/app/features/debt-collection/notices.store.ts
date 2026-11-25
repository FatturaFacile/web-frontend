import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  DcBatch,
  DcChannel,
  DcNotice,
  DcNoticeFilters,
  DcPageMeta,
  DcReceiptPayload,
  DebtCollectionApiService,
} from '@core';
import { downloadBlob } from '@shared';
import { DC_OK, DcOutcome, failureOf } from './debt-collection.util';

export interface NoticesState {
  filters: DcNoticeFilters;
  notices: DcNotice[];
  meta: DcPageMeta | null;
  loading: boolean;
  /** The notice open in the detail drawer (with its lines and PEC receipts). */
  detail: DcNotice | null;
  loadingDetail: boolean;
  /** Id of the notice a write is running for. */
  busyId: string | null;
  batches: DcBatch[];
  loadingBatches: boolean;
  batchDetail: DcBatch | null;
  error: string | null;
}

const initialState: NoticesState = {
  filters: { page: 1 },
  notices: [],
  meta: null,
  loading: false,
  detail: null,
  loadingDetail: false,
  busyId: null,
  batches: [],
  loadingBatches: false,
  batchDetail: null,
  error: null,
};

/** Notices (reminders and messa in mora) with their PEC receipts, and the dispatch batches. */
export const NoticesStore = signalStore(
  withState(initialState),
  withComputed(({ meta }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? 20),
  })),
  withMethods((store, api = inject(DebtCollectionApiService)) => {
    let sequence = 0;

    const load = async (filters: DcNoticeFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listNotices(filters));
        if (ticket === sequence) {
          patchState(store, { notices: response.data, meta: response.meta, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      }
    };

    const loadBatches = async (): Promise<void> => {
      patchState(store, { loadingBatches: true, error: null });
      try {
        const response = await firstValueFrom(api.listBatches());
        patchState(store, { batches: response.data, loadingBatches: false });
      } catch (error) {
        patchState(store, { loadingBatches: false, error: (await failureOf(error)).errorKey });
      }
    };

    /** Replaces a notice in the list and, when open, in the drawer. */
    const replace = (notice: DcNotice): void => {
      patchState(store, {
        notices: store.notices().map((row) => (row.id === notice.id ? notice : row)),
        detail: store.detail()?.id === notice.id ? notice : store.detail(),
      });
    };

    const write = async (id: string, run: () => Promise<void>): Promise<DcOutcome> => {
      patchState(store, { busyId: id });
      try {
        await run();
        patchState(store, { busyId: null });
        return DC_OK;
      } catch (error) {
        patchState(store, { busyId: null });
        return failureOf(error);
      }
    };

    const download = (
      id: string,
      request: () => Promise<Blob>,
      filename: string,
    ): Promise<DcOutcome> => write(id, async () => downloadBlob(await request(), filename));

    return {
      load: (filters: DcNoticeFilters = store.filters()): Promise<void> => load(filters),
      setFilters(patch: Partial<DcNoticeFilters>): Promise<void> {
        return load({ ...store.filters(), ...patch, page: 1 });
      },
      setPage(page: number): Promise<void> {
        return load({ ...store.filters(), page });
      },
      loadBatches,
      async openDetail(id: string): Promise<void> {
        patchState(store, { loadingDetail: true, detail: null });
        try {
          const response = await firstValueFrom(api.getNotice(id));
          patchState(store, { loadingDetail: false, detail: response.data });
        } catch (error) {
          patchState(store, { loadingDetail: false, error: (await failureOf(error)).errorKey });
        }
      },
      closeDetail(): void {
        patchState(store, { detail: null, loadingDetail: false });
      },
      send(id: string, channel?: DcChannel): Promise<DcOutcome> {
        return write(id, async () =>
          replace((await firstValueFrom(api.sendNotice(id, channel))).data),
        );
      },
      cancel(id: string): Promise<DcOutcome> {
        return write(id, async () => replace((await firstValueFrom(api.cancelNotice(id))).data));
      },
      /** Registers a PEC receipt and re-reads the notice so the receipts panel and the status follow. */
      registerReceipt(id: string, payload: DcReceiptPayload): Promise<DcOutcome> {
        return write(id, async () => {
          await firstValueFrom(api.registerReceipt(id, payload));
          replace((await firstValueFrom(api.getNotice(id))).data);
        });
      },
      downloadPdf(notice: DcNotice): Promise<DcOutcome> {
        return download(
          notice.id,
          () => firstValueFrom(api.downloadNoticePdf(notice.id)),
          `${notice.number}.pdf`,
        );
      },
      exportPackage(notice: DcNotice): Promise<DcOutcome> {
        return download(
          notice.id,
          () => firstValueFrom(api.exportNotice(notice.id)),
          `${notice.number}.zip`,
        );
      },
      async openBatch(id: string): Promise<void> {
        try {
          const response = await firstValueFrom(api.getBatch(id));
          patchState(store, { batchDetail: response.data });
        } catch (error) {
          patchState(store, { error: (await failureOf(error)).errorKey });
        }
      },
      closeBatch(): void {
        patchState(store, { batchDetail: null });
      },
      async retryBatch(id: string): Promise<DcOutcome> {
        const outcome = await write(id, async () => {
          await firstValueFrom(api.retryBatch(id));
        });
        if (outcome.ok) {
          await loadBatches();
        }
        return outcome;
      },
    };
  }),
);
