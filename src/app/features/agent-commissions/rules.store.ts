import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  AgcAgentProfile,
  AgcResolveParams,
  AgcResolveResult,
  AgcRule,
  AgcRulePayload,
  AgcZone,
  AgentCommissionsApiService,
  CatalogApiService,
  ContactResource,
  CrmApiService,
  ProductCategory,
} from '@core';
import { AGC_OK, agentName, AgcOutcome, failureOf } from './agent-commissions.util';

export interface NamedOption {
  id: string;
  name: string;
}

export interface RulesState {
  rules: AgcRule[];
  agents: AgcAgentProfile[];
  zones: AgcZone[];
  categories: ProductCategory[];
  /** Customers found by the search of the form, and the ones the rules point to: id to display name. */
  customers: Record<string, string>;
  customerOptions: NamedOption[];
  /** The result of the precedence simulator, null until it has run. */
  resolved: AgcResolveResult | null;
  loading: boolean;
  saving: boolean;
  resolving: boolean;
  error: string | null;
  resolveError: string | null;
}

const initialState: RulesState = {
  rules: [],
  agents: [],
  zones: [],
  categories: [],
  customers: {},
  customerOptions: [],
  resolved: null,
  loading: false,
  saving: false,
  resolving: false,
  error: null,
  resolveError: null,
};

export function contactName(contact: ContactResource): string {
  const company = contact.company_name?.trim();
  if (company) {
    return company;
  }
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim();
}

/** Commission rules by product line, customer and zone, with the simulator of their precedence. */
export const RulesStore = signalStore(
  withState(initialState),
  withComputed(({ rules, agents, zones, categories, customers }) => ({
    agentOptions: computed<NamedOption[]>(() =>
      agents().map((agent) => ({ id: agent.id, name: agentName(agent) })),
    ),
    agentNames: computed(() => new Map(agents().map((agent) => [agent.id, agentName(agent)]))),
    zoneNames: computed(
      () => new Map(zones().map((zone) => [zone.id, `${zone.code} ${zone.name}`])),
    ),
    categoryNames: computed(() => new Map(categories().map((entry) => [entry.id, entry.name]))),
    customerNames: computed(() => new Map(Object.entries(customers()))),
    sortedRules: computed(() =>
      [...rules()].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)),
    ),
  })),
  withMethods((store, api = inject(AgentCommissionsApiService)) => {
    const catalog = inject(CatalogApiService);
    const crm = inject(CrmApiService);
    let sequence = 0;
    let searchSequence = 0;

    /** Reads the names of the customers the rules point to, so the table does not show raw ids. */
    const loadCustomerNames = async (rules: readonly AgcRule[]): Promise<void> => {
      const ids = [
        ...new Set(rules.map((rule) => rule.customer_id).filter((id): id is string => id !== null)),
      ].filter((id) => store.customers()[id] === undefined);
      const found = await Promise.all(
        ids.map((id) => firstValueFrom(crm.getContactById(id)).catch(() => null)),
      );
      const names: Record<string, string> = {};
      for (const response of found) {
        if (response) {
          names[response.data.id] = contactName(response.data);
        }
      }
      if (Object.keys(names).length > 0) {
        patchState(store, { customers: { ...store.customers(), ...names } });
      }
    };

    const loadRules = async (): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listRules());
        if (ticket === sequence) {
          patchState(store, { rules: response.data, loading: false });
          void loadCustomerNames(response.data);
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      }
    };

    return {
      /** Loads the rules and what the form and the simulator pick from: agents, zones, product lines. */
      async init(): Promise<void> {
        const [agents, zones, categories] = await Promise.all([
          firstValueFrom(api.listAgents()).catch(() => null),
          firstValueFrom(api.listZones()).catch(() => null),
          firstValueFrom(catalog.getCategories()).catch(() => null),
        ]);
        patchState(store, {
          agents: agents?.data ?? [],
          zones: zones?.data ?? [],
          categories: categories?.data ?? [],
        });
        await loadRules();
      },
      load: loadRules,
      async save(id: string | null, payload: AgcRulePayload): Promise<AgcOutcome> {
        patchState(store, { saving: true });
        try {
          await firstValueFrom(id ? api.updateRule(id, payload) : api.createRule(payload));
          patchState(store, { saving: false });
          await loadRules();
          return AGC_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      async remove(id: string): Promise<AgcOutcome> {
        patchState(store, { saving: true });
        try {
          await firstValueFrom(api.deleteRule(id));
          patchState(store, {
            saving: false,
            rules: store.rules().filter((rule) => rule.id !== id),
          });
          return AGC_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      /** Customer search of the form: the first matches of the term, remembered by name. */
      async searchCustomers(term: string): Promise<void> {
        const ticket = ++searchSequence;
        try {
          const response = await firstValueFrom(
            crm.getClients({ search: term.trim(), per_page: 20 }),
          );
          if (ticket === searchSequence) {
            const options = response.data.map((contact) => ({
              id: contact.id,
              name: contactName(contact),
            }));
            patchState(store, {
              customerOptions: options,
              customers: {
                ...store.customers(),
                ...Object.fromEntries(options.map((option) => [option.id, option.name])),
              },
            });
          }
        } catch {
          if (ticket === searchSequence) {
            patchState(store, { customerOptions: [] });
          }
        }
      },
      /** Which rule would win for an agent, a customer and a product line on a date. */
      async resolve(params: AgcResolveParams): Promise<void> {
        patchState(store, { resolving: true, resolveError: null });
        try {
          const response = await firstValueFrom(api.resolveRule(params));
          patchState(store, { resolving: false, resolved: response.data });
        } catch (error) {
          patchState(store, {
            resolving: false,
            resolved: null,
            resolveError: (await failureOf(error)).errorKey,
          });
        }
      },
      clearResolved(): void {
        patchState(store, { resolved: null, resolveError: null });
      },
    };
  }),
);
