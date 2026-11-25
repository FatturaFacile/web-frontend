import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  DcCalculation,
  DcChannel,
  DcDashboard,
  DcGenerateResult,
  DcLocale,
  DcProposalFilters,
  DcProposalGroup,
  DcProposalItem,
  DebtCollectionApiService,
} from '@core';
import {
  DC_OK,
  DcOutcome,
  failureOf,
  groupSelectionKey,
  todayIso,
  totalsByCurrency,
} from './debt-collection.util';

export interface GenerateOptions {
  channel: DcChannel;
  locale?: DcLocale;
  post_charges: boolean;
  dispatch: boolean;
}

export interface GenerateOutcome {
  outcome: DcOutcome;
  result: DcGenerateResult | null;
}

export interface WorkbenchState {
  dashboard: DcDashboard | null;
  loadingDashboard: boolean;
  filters: DcProposalFilters;
  items: DcProposalItem[];
  groups: DcProposalGroup[];
  loadingProposals: boolean;
  /** Selection keys (`customer|currency|level`) of the groups picked for the notice generation. */
  selected: string[];
  /** The item whose calculation is open in the drawer. */
  calculationItem: DcProposalItem | null;
  calculation: DcCalculation | null;
  calculating: boolean;
  generating: boolean;
  error: string | null;
}

const initialState: WorkbenchState = {
  dashboard: null,
  loadingDashboard: false,
  filters: { as_of: todayIso(), include_excluded: 0 },
  items: [],
  groups: [],
  loadingProposals: false,
  selected: [],
  calculationItem: null,
  calculation: null,
  calculating: false,
  generating: false,
  error: null,
};

/** The dunning workbench: dashboard KPIs, the proposal queue with its filters and selection, the calculation and the generation. */
export const WorkbenchStore = signalStore(
  withState(initialState),
  withComputed(({ groups, selected }) => ({
    selectedGroups: computed(() => groups().filter((group) => selected().includes(group.key))),
  })),
  withComputed(({ selectedGroups }) => ({
    selectedCount: computed(() => selectedGroups().length),
    selectedTotals: computed(() => totalsByCurrency(selectedGroups())),
    selectedItemCount: computed(() =>
      selectedGroups().reduce((count, group) => count + group.receivable_item_ids.length, 0),
    ),
  })),
  withMethods((store, api = inject(DebtCollectionApiService)) => {
    let sequence = 0;

    const loadProposals = async (filters: DcProposalFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loadingProposals: true, error: null });
      try {
        const response = await firstValueFrom(api.listProposals(filters));
        if (ticket === sequence) {
          const groups = response.data.groups.map((group) => ({
            ...group,
            key: group.key || groupSelectionKey(group),
          }));
          const keys = new Set(groups.map((group) => group.key));
          patchState(store, {
            items: response.data.items,
            groups,
            selected: store.selected().filter((key) => keys.has(key)),
            loadingProposals: false,
          });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loadingProposals: false, error: (await failureOf(error)).errorKey });
        }
      }
    };

    const loadDashboard = async (): Promise<void> => {
      patchState(store, { loadingDashboard: true });
      try {
        const response = await firstValueFrom(api.getDashboard());
        patchState(store, { dashboard: response.data, loadingDashboard: false });
      } catch (error) {
        patchState(store, { loadingDashboard: false, error: (await failureOf(error)).errorKey });
      }
    };

    return {
      loadDashboard,
      loadProposals: (filters: DcProposalFilters = store.filters()): Promise<void> =>
        loadProposals(filters),
      setFilters(patch: Partial<DcProposalFilters>): Promise<void> {
        return loadProposals({ ...store.filters(), ...patch });
      },
      /** The group an item belongs to (same customer, currency and level), if any. */
      groupOf(item: DcProposalItem): DcProposalGroup | null {
        return (
          store
            .groups()
            .find((group) => group.receivable_item_ids.includes(item.receivable_item_id)) ?? null
        );
      },
      toggleGroup(key: string, checked: boolean): void {
        const without = store.selected().filter((value) => value !== key);
        patchState(store, { selected: checked ? [...without, key] : without });
      },
      selectAll(checked: boolean): void {
        patchState(store, { selected: checked ? store.groups().map((group) => group.key) : [] });
      },
      clearSelection(): void {
        patchState(store, { selected: [] });
      },
      async openCalculation(item: DcProposalItem): Promise<void> {
        patchState(store, {
          calculationItem: item,
          calculation: null,
          calculating: true,
          error: null,
        });
        try {
          const response = await firstValueFrom(
            api.calculate({
              receivable_item_id: item.receivable_item_id,
              as_of: store.filters().as_of ?? todayIso(),
              ...(item.proposed_level !== null ? { level: item.proposed_level } : {}),
            }),
          );
          patchState(store, { calculation: response.data, calculating: false });
        } catch (error) {
          patchState(store, { calculating: false, error: (await failureOf(error)).errorKey });
        }
      },
      closeCalculation(): void {
        patchState(store, { calculationItem: null, calculation: null, calculating: false });
      },
      /** Generates the notices of the selected groups (and dispatches them when asked), then re-reads the queue. */
      async generate(options: GenerateOptions): Promise<GenerateOutcome> {
        patchState(store, { generating: true });
        try {
          const response = await firstValueFrom(
            api.generate({
              groups: store.selectedGroups().map((group) => ({
                customer_id: group.customer_id,
                currency: group.currency,
                level: group.level,
                receivable_item_ids: group.receivable_item_ids,
              })),
              as_of: store.filters().as_of ?? todayIso(),
              channel: options.channel,
              ...(options.locale ? { locale: options.locale } : {}),
              post_charges: options.post_charges,
              dispatch: options.dispatch,
            }),
          );
          patchState(store, { generating: false, selected: [] });
          await Promise.all([loadProposals(store.filters()), loadDashboard()]);
          return { outcome: DC_OK, result: response.data };
        } catch (error) {
          patchState(store, { generating: false });
          return { outcome: await failureOf(error), result: null };
        }
      },
    };
  }),
);
