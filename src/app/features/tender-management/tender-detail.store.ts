import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  TenderManagementApiService,
  TndBenchmark,
  TndConversionResult,
  TndConvertPayload,
  TndEdgue,
  TndEligibility,
  TndEnvelopeKey,
  TndLookups,
  TndNoticePayload,
  TndOfferPayload,
  TndOfferResult,
  TndParticipationDetail,
  TndParticipationPayload,
  TndParticipationStatus,
  TndReadiness,
  TndVaultDocument,
} from '@core';
import { failureOf, submissionGate, TND_OK, TndOutcome } from './tender-management.util';

export interface TenderDetailState {
  detail: TndParticipationDetail | null;
  lookups: TndLookups | null;
  eligibility: TndEligibility | null;
  readiness: TndReadiness | null;
  /** Server answer of the last economic offer calculation (the authoritative one). */
  offer: TndOfferResult | null;
  vaultDocuments: TndVaultDocument[];
  benchmarks: TndBenchmark[];
  edgue: TndEdgue | null;
  conversion: TndConversionResult | null;
  loading: boolean;
  saving: boolean;
  busyEnvelope: TndEnvelopeKey | null;
  error: string | null;
}

const initialState: TenderDetailState = {
  detail: null,
  lookups: null,
  eligibility: null,
  readiness: null,
  offer: null,
  vaultDocuments: [],
  benchmarks: [],
  edgue: null,
  conversion: null,
  loading: false,
  saving: false,
  busyEnvelope: null,
  error: null,
};

/** One tender dossier: requirements, Go/No-Go evaluation, envelopes, the economic offer and the conversion. */
export const TenderDetailStore = signalStore(
  withState(initialState),
  withComputed(({ detail, lookups, readiness, offer, benchmarks, vaultDocuments }) => ({
    notice: computed(() => detail()?.notice ?? null),
    country: computed(() => {
      const jurisdiction = detail()?.notice.jurisdiction;
      return jurisdiction === 'CH_SIMAP_LAPub' ? 'CH' : jurisdiction === 'IT_Dlgs36_2023_ANAC' ? 'IT' : null;
    }),
    allowedTransitions: computed(() => detail()?.allowed_transitions ?? []),
    gate: computed(() => submissionGate(readiness(), offer()?.submission_blocked ?? false)),
    competitorDiscounts: computed(() =>
      benchmarks()
        .map((item) => Number(item.offered_discount_percentage))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
    bondRates: computed(() =>
      Object.fromEntries(
        Object.entries(lookups()?.bid_bond.reductions ?? {}).map(([key, rate]) => [key, Number(rate)]),
      ),
    ),
    reductionKeyByType: computed(() =>
      Object.fromEntries((lookups()?.vault_doc_types ?? []).map((type) => [type.value, type.bond_reduction_key])),
    ),
    heldDocuments: computed(() => vaultDocuments()),
  })),
  withMethods((store, api = inject(TenderManagementApiService)) => {
    const refreshReadiness = async (id: string): Promise<void> => {
      const readiness = await firstValueFrom(api.getReadiness(id)).catch(() => null);
      patchState(store, { readiness: readiness?.data ?? null });
    };

    const reload = async (id: string): Promise<void> => {
      const detail = await firstValueFrom(api.getParticipation(id));
      patchState(store, { detail: detail.data });
    };

    const wrap = async (action: () => Promise<void>): Promise<TndOutcome> => {
      patchState(store, { saving: true });
      try {
        await action();
        patchState(store, { saving: false });
        return TND_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      async load(id: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [detail, lookups] = await Promise.all([
            firstValueFrom(api.getParticipation(id)),
            firstValueFrom(api.getLookups()).catch(() => null),
          ]);
          const notice = detail.data.notice;
          patchState(store, {
            detail: detail.data,
            lookups: lookups?.data ?? null,
            eligibility: detail.data.go_no_go_score,
            offer: detail.data.offer_simulation,
            loading: false,
          });
          const [vault, benchmarks] = await Promise.all([
            firstValueFrom(api.listVaultDocuments({ per_page: 100 })).catch(() => null),
            firstValueFrom(
              api.listBenchmarks({ contracting_authority_name: notice.contracting_authority_name, per_page: 100 }),
            ).catch(() => null),
          ]);
          patchState(store, { vaultDocuments: vault?.data ?? [], benchmarks: benchmarks?.data ?? [] });
          await refreshReadiness(id);
        } catch (error) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      },

      refreshReadiness,

      saveParticipation(id: string, payload: TndParticipationPayload): Promise<TndOutcome> {
        return wrap(async () => {
          await firstValueFrom(api.updateParticipation(id, payload));
          await reload(id);
        });
      },

      saveNotice(id: string, noticeId: string, payload: TndNoticePayload): Promise<TndOutcome> {
        return wrap(async () => {
          await firstValueFrom(api.updateNotice(noticeId, payload));
          await reload(id);
        });
      },

      transition(id: string, status: TndParticipationStatus, reason?: string): Promise<TndOutcome> {
        return wrap(async () => {
          await firstValueFrom(api.transition(id, status, reason));
          await reload(id);
          await refreshReadiness(id);
        });
      },

      async evaluate(id: string): Promise<TndOutcome> {
        return wrap(async () => {
          const response = await firstValueFrom(api.evaluateEligibility(id));
          patchState(store, { eligibility: response.data });
          await reload(id);
        });
      },

      /** Server calculation of the offer; with `persist` the dossier keeps the figures and the bid bond. */
      calculateOffer(id: string, payload: TndOfferPayload): Promise<TndOutcome> {
        return wrap(async () => {
          const response = await firstValueFrom(api.calculateOffer(id, payload));
          patchState(store, { offer: response.data });
          if (payload.persist) {
            await reload(id);
            await refreshReadiness(id);
          }
        });
      },

      async uploadDocument(id: string, envelope: TndEnvelopeKey, docKey: string, file: File): Promise<TndOutcome> {
        patchState(store, { busyEnvelope: envelope });
        try {
          await firstValueFrom(api.uploadEnvelopeDocument(id, envelope, docKey, file));
          await Promise.all([reload(id), refreshReadiness(id)]);
          patchState(store, { busyEnvelope: null });
          return TND_OK;
        } catch (error) {
          patchState(store, { busyEnvelope: null });
          return failureOf(error);
        }
      },

      removeDocument(id: string, envelope: TndEnvelopeKey, docKey: string): Promise<TndOutcome> {
        return wrap(async () => {
          await firstValueFrom(api.removeEnvelopeDocument(id, envelope, docKey));
          await Promise.all([reload(id), refreshReadiness(id)]);
        });
      },

      seedChecklist(id: string, envelope: TndEnvelopeKey): Promise<TndOutcome> {
        return wrap(async () => {
          await firstValueFrom(api.seedChecklist(id, envelope));
          await Promise.all([reload(id), refreshReadiness(id)]);
        });
      },

      async loadEdgue(id: string): Promise<TndOutcome> {
        return wrap(async () => {
          const response = await firstValueFrom(api.getEdgue(id));
          patchState(store, { edgue: response.data });
          await refreshReadiness(id);
        });
      },

      async downloadEdgue(id: string, format: 'xml' | 'pdf'): Promise<TndOutcome & { blob: Blob | null }> {
        try {
          const blob = await firstValueFrom(api.downloadEdgue(id, format));
          return { ...TND_OK, blob };
        } catch (error) {
          return { ...(await failureOf(error)), blob: null };
        }
      },

      submit(id: string): Promise<TndOutcome> {
        return wrap(async () => {
          await firstValueFrom(api.submit(id));
          await reload(id);
          await refreshReadiness(id);
        });
      },

      convert(id: string, payload: TndConvertPayload): Promise<TndOutcome> {
        return wrap(async () => {
          const response = await firstValueFrom(api.convert(id, payload));
          patchState(store, { conversion: response.data });
          await reload(id);
        });
      },
    };
  }),
);
