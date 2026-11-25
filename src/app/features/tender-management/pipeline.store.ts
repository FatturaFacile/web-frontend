import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  TenderManagementApiService,
  TndAlert,
  TndDashboard,
  TndLookups,
  TndNotice,
  TndNoticePayload,
  TndParticipation,
  TndParticipationFilters,
  TndParticipationStatus,
} from '@core';
import { failureOf, groupByStatus, TND_OK, TndOutcome } from './tender-management.util';

export interface PipelineState {
  filters: TndParticipationFilters;
  participations: TndParticipation[];
  notices: TndNotice[];
  lookups: TndLookups | null;
  dashboard: TndDashboard | null;
  alerts: TndAlert[];
  /** Only the dossiers whose peremptory deadline falls within this many hours. */
  deadlineWithinHours: number | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** The dossier just created, so the screen can open it. */
  created: TndParticipation | null;
}

const initialState: PipelineState = {
  filters: { per_page: 200 },
  participations: [],
  notices: [],
  lookups: null,
  dashboard: null,
  alerts: [],
  deadlineWithinHours: null,
  loading: false,
  saving: false,
  error: null,
  created: null,
};

/** The tender pipeline: dossiers by status, the dashboard strip, the open alerts and the creation of notices. */
export const PipelineStore = signalStore(
  withState(initialState),
  withComputed(({ participations, deadlineWithinHours }) => ({
    visible: computed(() => {
      const hours = deadlineWithinHours();
      if (hours === null) {
        return participations();
      }
      return participations().filter((item) => {
        const deadline = item.notice?.submission_peremptory_deadline_at;
        if (!deadline) {
          return false;
        }
        const left = (new Date(deadline).getTime() - Date.now()) / 3_600_000;
        return left > 0 && left <= hours;
      });
    }),
  })),
  withComputed(({ visible }) => ({
    columns: computed(() => groupByStatus(visible())),
  })),
  withMethods((store, api = inject(TenderManagementApiService)) => {
    let sequence = 0;

    const loadParticipations = async (filters: TndParticipationFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listParticipations(filters));
        if (ticket === sequence) {
          patchState(store, { participations: response.data, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      }
    };

    const loadSide = async (): Promise<void> => {
      const [dashboard, alerts] = await Promise.all([
        firstValueFrom(api.getDashboard()).catch(() => null),
        firstValueFrom(api.listAlerts({ acknowledged: false, per_page: 20 })).catch(() => null),
      ]);
      patchState(store, { dashboard: dashboard?.data ?? null, alerts: alerts?.data ?? [] });
    };

    return {
      async init(): Promise<void> {
        const [lookups, notices] = await Promise.all([
          firstValueFrom(api.getLookups()).catch(() => null),
          firstValueFrom(api.listNotices({ per_page: 100, status: 'open' })).catch(() => null),
        ]);
        patchState(store, { lookups: lookups?.data ?? null, notices: notices?.data ?? [] });
        await Promise.all([loadParticipations(store.filters()), loadSide()]);
      },
      load: (filters: TndParticipationFilters = store.filters()): Promise<void> =>
        loadParticipations(filters),
      setFilters(patch: Partial<TndParticipationFilters>): Promise<void> {
        return loadParticipations({ ...store.filters(), ...patch });
      },
      setDeadlineWithin(hours: number | null): void {
        patchState(store, { deadlineWithinHours: hours });
      },
      /** Creates a notice (when a payload is given) and opens a dossier on it. */
      async createDossier(payload: TndNoticePayload | null, noticeId: string | null): Promise<TndOutcome> {
        patchState(store, { saving: true, created: null });
        try {
          let tenderId = noticeId;
          if (payload) {
            tenderId = (await firstValueFrom(api.createNotice(payload))).data.id;
          }
          if (!tenderId) {
            patchState(store, { saving: false });
            return { ...TND_OK, ok: false, errorKey: 'tenderManagement.error.generic' };
          }
          const created = (await firstValueFrom(api.createParticipation({ tender_id: tenderId }))).data;
          patchState(store, { saving: false, created });
          await Promise.all([loadParticipations(store.filters()), loadSide()]);
          const notices = await firstValueFrom(api.listNotices({ per_page: 100, status: 'open' })).catch(
            () => null,
          );
          patchState(store, { notices: notices?.data ?? store.notices() });
          return TND_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      async ingestSimap(payload: Record<string, unknown>): Promise<TndOutcome> {
        patchState(store, { saving: true });
        try {
          const notice = (await firstValueFrom(api.ingestSimap(payload))).data;
          patchState(store, { saving: false, notices: [notice, ...store.notices()] });
          return TND_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      async transition(id: string, status: TndParticipationStatus): Promise<TndOutcome> {
        try {
          await firstValueFrom(api.transition(id, status));
          await Promise.all([loadParticipations(store.filters()), loadSide()]);
          return TND_OK;
        } catch (error) {
          return failureOf(error);
        }
      },
      async acknowledge(id: string): Promise<void> {
        try {
          await firstValueFrom(api.acknowledgeAlert(id));
          patchState(store, { alerts: store.alerts().filter((alert) => alert.id !== id) });
        } catch {
          // The alert stays listed: the next refresh shows the state of the server.
        }
      },
    };
  }),
);
