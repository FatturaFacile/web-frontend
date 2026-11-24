import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  AccrualScheduleStatus,
  AccrualSourceType,
  AccrualSummaryFilters,
  AccrualSummaryItem,
  AccrualSummaryKpis,
  AccrualSummaryResponse,
  AccrualType,
  GeneralLedgerApiService,
  GenerateClosingEntriesPayload,
  GenerateClosingEntriesResult,
  GenerateReversalsPayload,
  GenerateReversalsResult,
  GlFiscalYear,
} from '@core';

export interface GlAccrualsState {
  fiscalYears: GlFiscalYear[];
  fiscalYearId: string | null;
  accrualType: AccrualType | null;
  accountId: string | null;
  sourceType: AccrualSourceType | null;
  status: AccrualScheduleStatus | null;
  competenceFrom: string | null;
  competenceTo: string | null;
  search: string;
  summary: AccrualSummaryResponse | null;
  selectedKeys: string[];
  loading: boolean;
  closingBusy: boolean;
  reversalBusy: boolean;
  exporting: boolean;
  error: unknown;
}

const EMPTY_KPIS: AccrualSummaryKpis = {
  prepaid_expense_total: '0.00',
  deferred_revenue_total: '0.00',
  accrued_revenue_total: '0.00',
  accrued_expense_total: '0.00',
  total_recognized: '0.00',
  total_transitory: '0.00',
  pending_closing_count: 0,
  closing_posted_count: 0,
  pending_reversal_count: 0,
  reversal_posted_count: 0,
};

function initialState(): GlAccrualsState {
  return {
    fiscalYears: [],
    fiscalYearId: null,
    accrualType: null,
    accountId: null,
    sourceType: null,
    status: null,
    competenceFrom: null,
    competenceTo: null,
    search: '',
    summary: null,
    selectedKeys: [],
    loading: false,
    closingBusy: false,
    reversalBusy: false,
    exporting: false,
    error: null,
  };
}

function normalizeSummary(raw: unknown): AccrualSummaryResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Partial<AccrualSummaryResponse>;
  return {
    fiscal_year: obj.fiscal_year ?? null,
    year_label: obj.year_label ?? String(new Date().getFullYear()),
    cutoff_date: obj.cutoff_date ?? '',
    reversal_date: obj.reversal_date ?? '',
    currency: obj.currency ?? 'EUR',
    kpis: obj.kpis ?? EMPTY_KPIS,
    items: Array.isArray(obj.items) ? obj.items : [],
  };
}

export const GlAccrualsStore = signalStore(
  withState<GlAccrualsState>(initialState()),
  withComputed((store) => {
    const items = computed<AccrualSummaryItem[]>(() => store.summary()?.items ?? []);
    const kpis = computed<AccrualSummaryKpis>(() => store.summary()?.kpis ?? EMPTY_KPIS);
    const pendingItems = computed(() => items().filter((item) => item.status === 'calculated'));
    const reversibleItems = computed(() =>
      items().filter((item) => item.status === 'closing_posted' && !!item.accrual_id),
    );
    const selectedSet = computed(() => new Set(store.selectedKeys()));
    const filters = computed<AccrualSummaryFilters>(() => ({
      fiscal_year_id: store.fiscalYearId() || undefined,
      accrual_type: store.accrualType() || undefined,
      account_id: store.accountId() || undefined,
      source_type: store.sourceType() || undefined,
      status: store.status() || undefined,
      competence_from: store.competenceFrom() || undefined,
      competence_to: store.competenceTo() || undefined,
      search: store.search().trim() || undefined,
    }));

    return {
      items,
      kpis,
      pendingItems,
      reversibleItems,
      selectedSet,
      filters,
      currency: computed(() => store.summary()?.currency ?? 'EUR'),
      cutoffDate: computed(() => store.summary()?.cutoff_date ?? ''),
      reversalDate: computed(() => store.summary()?.reversal_date ?? ''),
    };
  }),
  withMethods((store, api = inject(GeneralLedgerApiService)) => ({
    async loadFiscalYears(): Promise<void> {
      try {
        const res = await firstValueFrom(api.getFiscalYears({ per_page: 100 }));
        const years = Array.isArray(res?.data) ? res.data : [];
        const selected =
          store.fiscalYearId() ??
          years.find((y) => y.status === 'open')?.id ??
          years[0]?.id ??
          null;
        patchState(store, { fiscalYears: years, fiscalYearId: selected });
      } catch {
        patchState(store, { fiscalYears: [] });
      }
    },

    async loadSummary(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const res = await firstValueFrom(api.getAccrualsSummary(store.filters()));
        patchState(store, {
          loading: false,
          summary: normalizeSummary(res?.data),
          selectedKeys: [],
        });
      } catch (error) {
        patchState(store, { loading: false, error });
      }
    },

    setFilter(patch: Partial<Pick<GlAccrualsState, 'fiscalYearId' | 'accrualType' | 'accountId' | 'sourceType' | 'status' | 'competenceFrom' | 'competenceTo' | 'search'>>): void {
      patchState(store, patch);
    },

    toggleSelection(itemKey: string, checked: boolean): void {
      const next = new Set(store.selectedKeys());
      if (checked) {
        next.add(itemKey);
      } else {
        next.delete(itemKey);
      }
      patchState(store, { selectedKeys: Array.from(next) });
    },

    toggleSelectAllPending(checked: boolean): void {
      patchState(store, {
        selectedKeys: checked ? store.pendingItems().map((item) => item.item_key) : [],
      });
    },

    async generateClosingEntries(autoReverse: boolean): Promise<GenerateClosingEntriesResult | null> {
      const selected = store.selectedSet();
      const targets =
        selected.size > 0
          ? store.pendingItems().filter((item) => selected.has(item.item_key))
          : store.pendingItems();

      const payload: GenerateClosingEntriesPayload = {
        fiscal_year_id: store.fiscalYearId() || undefined,
        item_keys: targets.map((item) => ({
          source_type: item.source_type,
          source_line_id: item.source_line_id,
        })),
        auto_generate_reversals: autoReverse,
      };

      patchState(store, { closingBusy: true, error: null });
      try {
        const res = await firstValueFrom(api.generateAccrualClosingEntries(payload));
        patchState(store, { closingBusy: false });
        return res?.data ?? null;
      } catch (error) {
        patchState(store, { closingBusy: false, error });
        return null;
      }
    },

    async generateReversals(): Promise<GenerateReversalsResult | null> {
      const selected = store.selectedSet();
      const targets =
        selected.size > 0
          ? store.reversibleItems().filter((item) => selected.has(item.item_key))
          : store.reversibleItems();
      const accrualIds = targets
        .map((item) => item.accrual_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      const payload: GenerateReversalsPayload = {
        fiscal_year_id: store.fiscalYearId() || undefined,
        ...(accrualIds.length > 0 ? { accrual_ids: accrualIds } : {}),
      };

      patchState(store, { reversalBusy: true, error: null });
      try {
        const res = await firstValueFrom(api.generateAccrualReversals(payload));
        patchState(store, { reversalBusy: false });
        return res?.data ?? null;
      } catch (error) {
        patchState(store, { reversalBusy: false, error });
        return null;
      }
    },

    async exportReconciliation(format: 'csv' | 'xlsx' = 'csv'): Promise<{ blob: Blob; filename: string } | null> {
      patchState(store, { exporting: true, error: null });
      try {
        const blob = await firstValueFrom(api.exportAccrualsReconciliation(store.filters(), format));
        const yearLabel = store.summary()?.year_label ?? String(new Date().getFullYear());
        patchState(store, { exporting: false });
        return {
          blob,
          filename: `ratei-risconti-reconciliation-${yearLabel}.${format}`,
        };
      } catch (error) {
        patchState(store, { exporting: false, error });
        return null;
      }
    },
  })),
);
