import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  EsigAuditEntry,
  EsigDashboard,
  EsigDownloadKind,
  EsigEnvelope,
  EsigEnvelopeFilters,
  ElectronicSignatureApiService,
} from '@core';
import { downloadName, ESIG_OK, EsigOutcome, failureOf, saveBlob } from './e-signature.util';

export interface SignatureCenterState {
  envelopes: EsigEnvelope[];
  dashboard: EsigDashboard | null;
  total: number;
  page: number;
  pageSize: number;
  filters: EsigEnvelopeFilters;
  loading: boolean;
  error: string | null;
  /** Ids of the envelopes with a write in flight. */
  busy: string[];
  audit: {
    envelope: EsigEnvelope | null;
    entries: EsigAuditEntry[];
    chainValid: boolean | null;
    loading: boolean;
  };
}

const initialState: SignatureCenterState = {
  envelopes: [],
  dashboard: null,
  total: 0,
  page: 1,
  pageSize: 20,
  filters: {},
  loading: false,
  error: null,
  busy: [],
  audit: { envelope: null, entries: [], chainValid: null, loading: false },
};

/** The signature center: KPI cards, the filtered list of envelopes, the row actions and the audit trail drawer. */
export const SignatureCenterStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(ElectronicSignatureApiService)) => {
    const loadEnvelopes = async (): Promise<void> => {
      const response = await firstValueFrom(
        api.listEnvelopes({ ...store.filters(), page: store.page(), per_page: store.pageSize() }),
      );
      patchState(store, {
        envelopes: response.data,
        total: response.meta?.total ?? response.data.length,
      });
    };

    const loadDashboard = async (): Promise<void> => {
      const response = await firstValueFrom(api.getDashboard());
      patchState(store, { dashboard: response.data });
    };

    const guarded = async (id: string, call: () => Promise<void>): Promise<EsigOutcome> => {
      patchState(store, { busy: [...store.busy(), id] });
      try {
        await call();
        return ESIG_OK;
      } catch (error) {
        return failureOf(error);
      } finally {
        patchState(store, { busy: store.busy().filter((busyId) => busyId !== id) });
      }
    };

    return {
      async init(): Promise<void> {
        await this.load();
      },
      async load(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          await Promise.all([loadEnvelopes(), loadDashboard()]);
          patchState(store, { loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      },
      async setFilters(filters: Partial<EsigEnvelopeFilters>): Promise<void> {
        patchState(store, { filters: { ...store.filters(), ...filters }, page: 1 });
        await this.load();
      },
      async setPage(page: number): Promise<void> {
        patchState(store, { page });
        await this.load();
      },
      remind(id: string): Promise<EsigOutcome> {
        return guarded(id, async () => {
          await firstValueFrom(api.remindEnvelope(id));
          await loadEnvelopes();
        });
      },
      voidEnvelope(id: string, reason: string | null): Promise<EsigOutcome> {
        return guarded(id, async () => {
          await firstValueFrom(api.voidEnvelope(id, reason));
          await Promise.all([loadEnvelopes(), loadDashboard()]);
        });
      },
      download(envelope: EsigEnvelope, kind: EsigDownloadKind): Promise<EsigOutcome> {
        return guarded(envelope.id, async () => {
          const blob = await firstValueFrom(api.downloadEnvelope(envelope.id, kind));
          const suffix =
            kind === 'certificate'
              ? '-certificate.pdf'
              : kind === 'signed'
                ? `-signed.${envelope.document_format === 'pades' ? 'pdf' : envelope.document_format === 'xades' ? 'xml' : 'p7m'}`
                : `.${envelope.document_format === 'pades' ? 'pdf' : 'bin'}`;
          saveBlob(blob, downloadName(envelope, suffix));
        });
      },
      async openAudit(envelope: EsigEnvelope): Promise<void> {
        patchState(store, { audit: { envelope, entries: [], chainValid: null, loading: true } });
        try {
          const response = await firstValueFrom(api.getAudit(envelope.id));
          patchState(store, {
            audit: {
              envelope,
              entries: response.data,
              chainValid: response.meta?.chain_valid ?? null,
              loading: false,
            },
          });
        } catch (error) {
          patchState(store, {
            audit: { envelope, entries: [], chainValid: null, loading: false },
            error: (await failureOf(error)).errorKey,
          });
        }
      },
      closeAudit(): void {
        patchState(store, {
          audit: { envelope: null, entries: [], chainValid: null, loading: false },
        });
      },
    };
  }),
);
