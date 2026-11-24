import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom, Observable } from 'rxjs';
import {
  AgcAgentProfile,
  AgcEnvelope,
  AgcGeneratePayload,
  AgcPageMeta,
  AgcPayPayload,
  AgcSendPayload,
  AgcStatement,
  AgcStatementFilters,
  AgcStatementPreview,
  AgcStatementStatus,
  AgentCommissionsApiService,
} from '@core';
import {
  AGC_OK,
  AgcOutcome,
  agentName,
  failureOf,
  statementFileName,
} from './agent-commissions.util';

export interface StatementsState {
  filters: AgcStatementFilters;
  statements: AgcStatement[];
  meta: AgcPageMeta | null;
  agents: AgcAgentProfile[];
  /** The statement open in the detail drawer, with its lines. */
  detail: AgcStatement | null;
  /** What the generate dialog shows for the agent and period picked, before anything is saved. */
  preview: AgcStatementPreview | null;
  previewError: string | null;
  loading: boolean;
  loadingDetail: boolean;
  previewing: boolean;
  saving: boolean;
  error: string | null;
}

const PAGE_SIZE = 20;

const initialState: StatementsState = {
  filters: { per_page: PAGE_SIZE, page: 1 },
  statements: [],
  meta: null,
  agents: [],
  detail: null,
  preview: null,
  previewError: null,
  loading: false,
  loadingDetail: false,
  previewing: false,
  saving: false,
  error: null,
};

export interface StatementPdf extends AgcOutcome {
  blob: Blob | null;
  filename: string;
}

/** Commission statements and their liquidation: generate, approve, invoice, pay, send, void. */
export const StatementsStore = signalStore(
  withState(initialState),
  withComputed(({ meta, agents }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? PAGE_SIZE),
    agentOptions: computed(() =>
      agents().map((agent) => ({ id: agent.id, name: agentName(agent) })),
    ),
  })),
  withMethods((store, api = inject(AgentCommissionsApiService)) => {
    let sequence = 0;
    let previewSequence = 0;

    const load = async (filters: AgcStatementFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listStatements(filters));
        if (ticket === sequence) {
          patchState(store, { statements: response.data, meta: response.meta, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      }
    };

    /** Runs a workflow action: the answer replaces the statement in the detail and in the list. */
    const transition = async (call: Observable<AgcEnvelope<AgcStatement>>): Promise<AgcOutcome> => {
      patchState(store, { saving: true });
      try {
        const response = await firstValueFrom(call);
        const updated = response.data;
        const current = store.detail();
        patchState(store, {
          saving: false,
          detail:
            current?.id === updated.id
              ? { ...updated, lines: updated.lines ?? current.lines }
              : current,
          statements: store
            .statements()
            .map((row) => (row.id === updated.id ? { ...row, ...updated, lines: undefined } : row)),
        });
        return AGC_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      async init(): Promise<void> {
        const agents = await firstValueFrom(api.listAgents()).catch(() => null);
        patchState(store, { agents: agents?.data ?? [] });
        await load(store.filters());
      },
      load: (filters: AgcStatementFilters = store.filters()): Promise<void> => load(filters),
      setFilters(patch: Partial<AgcStatementFilters>): Promise<void> {
        return load({ ...store.filters(), ...patch, page: 1 });
      },
      setStatus(status: AgcStatementStatus | undefined): Promise<void> {
        return load({ ...store.filters(), status, page: 1 });
      },
      setPage(page: number): Promise<void> {
        return load({ ...store.filters(), page });
      },

      // --- Detail ---
      async openDetail(id: string): Promise<void> {
        patchState(store, { loadingDetail: true, detail: null });
        try {
          const response = await firstValueFrom(api.getStatement(id));
          patchState(store, { loadingDetail: false, detail: response.data });
        } catch (error) {
          patchState(store, { loadingDetail: false, error: (await failureOf(error)).errorKey });
        }
      },
      closeDetail(): void {
        patchState(store, { detail: null, loadingDetail: false });
      },

      // --- Generate ---
      /** The statement the agent and period would produce, without saving it. A newer call wins. */
      async previewFor(payload: AgcGeneratePayload): Promise<void> {
        const ticket = ++previewSequence;
        patchState(store, { previewing: true, previewError: null });
        try {
          const response = await firstValueFrom(api.previewStatement(payload));
          if (ticket === previewSequence) {
            patchState(store, { previewing: false, preview: response.data });
          }
        } catch (error) {
          if (ticket === previewSequence) {
            patchState(store, {
              previewing: false,
              preview: null,
              previewError: (await failureOf(error)).errorKey,
            });
          }
        }
      },
      clearPreview(): void {
        previewSequence++;
        patchState(store, { preview: null, previewError: null, previewing: false });
      },
      async generate(
        payload: AgcGeneratePayload,
      ): Promise<AgcOutcome & { statement: AgcStatement | null }> {
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(api.generateStatement(payload));
          patchState(store, { saving: false, preview: null });
          await load({ ...store.filters(), page: 1 });
          return { ...AGC_OK, statement: response.data };
        } catch (error) {
          patchState(store, { saving: false });
          return { ...(await failureOf(error)), statement: null };
        }
      },

      // --- Workflow ---
      approve: (id: string): Promise<AgcOutcome> => transition(api.approveStatement(id)),
      void: (id: string): Promise<AgcOutcome> => transition(api.voidStatement(id)),
      prepareSelfBilling: (id: string, date?: string | null): Promise<AgcOutcome> =>
        transition(api.prepareSelfBilling(id, date)),
      pay: (id: string, payload: AgcPayPayload = {}): Promise<AgcOutcome> =>
        transition(api.payStatement(id, payload)),
      send: (id: string, payload: AgcSendPayload = {}): Promise<AgcOutcome> =>
        transition(api.sendStatement(id, payload)),

      /** Fetches the PDF; the screen hands the blob to the browser. */
      async pdf(statement: Pick<AgcStatement, 'id' | 'number'>): Promise<StatementPdf> {
        const filename = statementFileName(statement.number);
        try {
          const blob = await firstValueFrom(api.downloadStatementPdf(statement.id));
          return { ...AGC_OK, blob, filename };
        } catch (error) {
          return { ...(await failureOf(error)), blob: null, filename };
        }
      },
    };
  }),
);
