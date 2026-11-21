import { computed, inject } from '@angular/core';
import { PurchaseRequisitionApiService } from '@data-access/procurement/purchase-requisition-api.service';
import {
  BudgetPreviewRequest,
  CostCenterOption,
  PrBudgetCheckSnapshot,
  PrListTab,
  ProjectOption,
  PurchaseRequisitionDetail,
  PurchaseRequisitionListFilters,
  PurchaseRequisitionStatus,
  PurchaseRequisitionSummary,
  PurchaseRequisitionUrgency,
  RequesterOption,
  SupplierOption,
} from '@domain/procurement/purchase-requisition.models';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { catchError, finalize, forkJoin, map, Observable, of, tap } from 'rxjs';
import { extractApiErrorMessage } from './pr-status.helpers';

export interface PrFiltersState {
  status: PurchaseRequisitionStatus | null;
  cost_center_id: string | null;
  project_id: string | null;
  urgency: PurchaseRequisitionUrgency | null;
  requester_id: string | null;
  date_from: string | null;
  date_to: string | null;
  search: string;
}

export interface PurchaseRequisitionState {
  items: PurchaseRequisitionSummary[];
  total: number;
  page: number;
  perPage: number;
  activeTab: PrListTab;
  pendingApprovalCount: number;
  filters: PrFiltersState;
  selectedRequisition: PurchaseRequisitionDetail | null;
  budgetPreview: PrBudgetCheckSnapshot | null;
  budgetPreviewError: string | null;
  costCenters: CostCenterOption[];
  projects: ProjectOption[];
  requesters: RequesterOption[];
  suppliers: SupplierOption[];
  lookupsLoaded: boolean;
  loadingList: boolean;
  loadingDetail: boolean;
  loadingBudget: boolean;
  busy: boolean;
  error: string | null;
}

const initialFilters: PrFiltersState = {
  status: null,
  cost_center_id: null,
  project_id: null,
  urgency: null,
  requester_id: null,
  date_from: null,
  date_to: null,
  search: '',
};

const initialState: PurchaseRequisitionState = {
  items: [],
  total: 0,
  page: 1,
  perPage: 25,
  activeTab: 'mine',
  pendingApprovalCount: 0,
  filters: initialFilters,
  selectedRequisition: null,
  budgetPreview: null,
  budgetPreviewError: null,
  costCenters: [],
  projects: [],
  requesters: [],
  suppliers: [],
  lookupsLoaded: false,
  loadingList: false,
  loadingDetail: false,
  loadingBudget: false,
  busy: false,
  error: null,
};

/**
 * Signal-based feature store for Mod 044 Purchase Requisitions (RDA / PR).
 */
export const PurchaseRequisitionStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ filters, pendingApprovalCount, budgetPreview, items }) => ({
    hasPendingApprovals: computed(() => pendingApprovalCount() > 0),
    hasActiveFilters: computed(() => {
      const f = filters();
      return Boolean(
        f.status ||
          f.cost_center_id ||
          f.project_id ||
          f.urgency ||
          f.requester_id ||
          f.date_from ||
          f.date_to ||
          f.search.trim(),
      );
    }),
    isBudgetHardBlocked: computed(() => {
      const preview = budgetPreview();
      return Boolean(preview && (preview.status === 'hard_block' || preview.is_hard_blocked));
    }),
    isBudgetWarning: computed(() => {
      const preview = budgetPreview();
      return Boolean(
        preview &&
          (preview.status === 'warning' || preview.is_warning) &&
          preview.status !== 'hard_block' &&
          !preview.is_hard_blocked,
      );
    }),
    budgetBlockedCount: computed(
      () => items().filter((item) => item.status === 'budget_exceeded_blocked').length,
    ),
  })),
  withMethods((store, api = inject(PurchaseRequisitionApiService)) => ({
    setTab(tab: PrListTab): void {
      patchState(store, { activeTab: tab, page: 1 });
    },

    setFilters(partial: Partial<PrFiltersState>): void {
      patchState(store, {
        filters: { ...store.filters(), ...partial },
        page: 1,
      });
    },

    resetFilters(): void {
      patchState(store, { filters: initialFilters, page: 1 });
    },

    loadList(overrides?: {
      page?: number;
      per_page?: number;
      currentUserId?: string | null;
    }): Observable<PurchaseRequisitionSummary[]> {
      patchState(store, { loadingList: true, error: null });
      const f = store.filters();
      const tab = store.activeTab();
      const page = overrides?.page ?? store.page();
      const perPage = overrides?.per_page ?? store.perPage();

      const query: PurchaseRequisitionListFilters = {
        status: f.status,
        cost_center_id: f.cost_center_id,
        project_id: f.project_id,
        urgency: f.urgency,
        requester_id: tab === 'mine' ? (overrides?.currentUserId ?? f.requester_id) : f.requester_id,
        date_from: f.date_from,
        date_to: f.date_to,
        search: f.search.trim() || null,
        scope: tab === 'mine' ? 'mine' : tab === 'department' ? 'department' : undefined,
        page,
        per_page: perPage,
      };

      const request$ =
        tab === 'pending_approval' ? api.listPendingApprovals(query) : api.list(query);

      return request$.pipe(
        tap((res) => {
          const rows = res.data ?? [];
          const total = res.meta?.total ?? rows.length;
          patchState(store, {
            items: rows,
            total,
            page: res.meta?.current_page ?? page,
            perPage: res.meta?.per_page ?? perPage,
            ...(tab === 'pending_approval' ? { pendingApprovalCount: total } : {}),
          });
        }),
        map((res) => res.data ?? []),
        catchError((err: unknown) => {
          patchState(store, {
            items: [],
            error: extractApiErrorMessage(err) || String(err),
          });
          return of([]);
        }),
        finalize(() => patchState(store, { loadingList: false })),
      );
    },

    loadPendingApprovalCount(): Observable<number> {
      return api.listPendingApprovals({ page: 1, per_page: 1 }).pipe(
        map((res) => res.meta?.total ?? (res.data ?? []).length),
        tap((count) => patchState(store, { pendingApprovalCount: count })),
        catchError(() => of(store.pendingApprovalCount())),
      );
    },

    loadDetail(id: string): Observable<PurchaseRequisitionDetail | null> {
      patchState(store, { loadingDetail: true, error: null });
      return api.getById(id).pipe(
        map((res) => res.data),
        tap((detail) => patchState(store, { selectedRequisition: detail })),
        catchError((err: unknown) => {
          patchState(store, {
            selectedRequisition: null,
            error: extractApiErrorMessage(err) || String(err),
          });
          return of(null);
        }),
        finalize(() => patchState(store, { loadingDetail: false })),
      );
    },

    setSelectedRequisition(detail: PurchaseRequisitionDetail | null): void {
      patchState(store, { selectedRequisition: detail });
    },

    clearSelected(): void {
      patchState(store, { selectedRequisition: null });
    },

    loadBudgetPreview(payload: BudgetPreviewRequest): Observable<PrBudgetCheckSnapshot | null> {
      patchState(store, { loadingBudget: true, budgetPreviewError: null });
      return api.budgetPreview(payload).pipe(
        map((res) => res.data),
        tap((snapshot) => patchState(store, { budgetPreview: snapshot })),
        catchError((err: unknown) => {
          patchState(store, {
            budgetPreview: null,
            budgetPreviewError: extractApiErrorMessage(err) || null,
          });
          return of(null);
        }),
        finalize(() => patchState(store, { loadingBudget: false })),
      );
    },

    setBudgetPreviewSnapshot(snapshot: PrBudgetCheckSnapshot | null): void {
      patchState(store, { budgetPreview: snapshot, budgetPreviewError: null });
    },

    clearBudgetPreview(): void {
      patchState(store, { budgetPreview: null, budgetPreviewError: null });
    },

    loadLookups(force = false): Observable<void> {
      if (store.lookupsLoaded() && !force) {
        return of(undefined);
      }

      return forkJoin({
        costCenters: api.listCostCenters().pipe(catchError(() => of([] as CostCenterOption[]))),
        projects: api.listProjects().pipe(catchError(() => of([] as ProjectOption[]))),
        requesters: api.listRequesters().pipe(catchError(() => of([] as RequesterOption[]))),
        suppliers: api.listQualifiedSuppliers().pipe(catchError(() => of([] as SupplierOption[]))),
      }).pipe(
        tap(({ costCenters, projects, requesters, suppliers }) => {
          patchState(store, {
            costCenters,
            projects,
            requesters,
            suppliers,
            lookupsLoaded: true,
          });
        }),
        map(() => undefined),
      );
    },

    setBusy(busy: boolean): void {
      patchState(store, { busy });
    },
  })),
);
