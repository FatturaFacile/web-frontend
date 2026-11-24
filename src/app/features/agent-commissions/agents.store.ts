import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  AgcAgentPayload,
  AgcAgentProfile,
  AgcRepresentative,
  AgentCommissionsApiService,
} from '@core';
import { AGC_OK, AgcOutcome, failureOf } from './agent-commissions.util';

export interface AgentsState {
  agents: AgcAgentProfile[];
  /** Sales representatives that have no agent profile yet: the ones a new agent can be created from. */
  representatives: AgcRepresentative[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: AgentsState = {
  agents: [],
  representatives: [],
  loading: false,
  saving: false,
  error: null,
};

/** Agent registry: the contract conditions of the sales representatives that earn commissions. */
export const AgentsStore = signalStore(
  withState(initialState),
  withComputed(({ agents }) => ({
    activeCount: computed(() => agents().filter((agent) => agent.is_active).length),
  })),
  withMethods((store, api = inject(AgentCommissionsApiService)) => {
    let sequence = 0;

    const load = async (): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listAgents());
        if (ticket === sequence) {
          patchState(store, { agents: response.data, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      }
    };

    return {
      load,
      async loadRepresentatives(): Promise<void> {
        try {
          const response = await firstValueFrom(api.getAvailableRepresentatives());
          patchState(store, { representatives: response.data });
        } catch (error) {
          patchState(store, { representatives: [], error: (await failureOf(error)).errorKey });
        }
      },
      /** Creates the profile (no id) or updates its conditions, then reads the list again. */
      async save(id: string | null, payload: AgcAgentPayload): Promise<AgcOutcome> {
        patchState(store, { saving: true });
        try {
          await firstValueFrom(id ? api.updateAgent(id, payload) : api.createAgent(payload));
          patchState(store, { saving: false });
          await load();
          return AGC_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      async remove(id: string): Promise<AgcOutcome> {
        patchState(store, { saving: true });
        try {
          await firstValueFrom(api.deleteAgent(id));
          patchState(store, {
            saving: false,
            agents: store.agents().filter((agent) => agent.id !== id),
          });
          return AGC_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
);
