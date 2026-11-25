import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { catchError, forkJoin, of } from 'rxjs';
import { GeneralLedgerApiService } from '../../../core/api/general-ledger-api.service';
import type {
  AccountBreadcrumb,
  AccountMapping,
  AccountMappingPayload,
  AccountMappingTreeGroup,
  ChartAccountDetail,
  ChartAccountPayload,
  ChartAccountTemplate,
  ChartAccountTreeMeta,
  ChartAccountTreeNode,
  VatCodeOption,
} from '../../../core/models/general-ledger.model';

export interface CostCenterOption {
  id: string;
  code: string;
  name: string;
}

export interface GlAccountsState {
  accounts: ChartAccountDetail[];
  tree: ChartAccountTreeNode[];
  treeMeta: ChartAccountTreeMeta | null;
  templates: ChartAccountTemplate[];
  templateUiCopy: Record<string, string>;
  mappings: AccountMapping[];
  incomingMappings: AccountMapping[];
  mappingTree: AccountMappingTreeGroup[];
  selectedNode: ChartAccountTreeNode | null;
  selectedDetail: ChartAccountDetail | null;
  selectedBreadcrumbs: AccountBreadcrumb[];
  selectedHasPostings: boolean;
  vatCodes: VatCodeOption[];
  costCenters: CostCenterOption[];
  loading: boolean;
  treeLoading: boolean;
  mappingsLoading: boolean;
  saving: boolean;
  provisioning: boolean;
  exporting: boolean;
  searchFilter: string;
  templateFilter: string;
  typeFilter: string;
  activeFilter: string;
  error: string | null;
}

const initialState: GlAccountsState = {
  accounts: [],
  tree: [],
  treeMeta: null,
  templates: [],
  templateUiCopy: {},
  mappings: [],
  incomingMappings: [],
  mappingTree: [],
  selectedNode: null,
  selectedDetail: null,
  selectedBreadcrumbs: [],
  selectedHasPostings: false,
  vatCodes: [],
  costCenters: [],
  loading: false,
  treeLoading: false,
  mappingsLoading: false,
  saving: false,
  provisioning: false,
  exporting: false,
  searchFilter: '',
  templateFilter: '',
  typeFilter: '',
  activeFilter: '',
  error: null,
};

export const GlAccountsStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    uiCopy: computed<Record<string, string>>(() => ({
      ...store.templateUiCopy(),
      ...(store.treeMeta()?.ui_copy ?? {}),
    })),
    availableStandards: computed<string[]>(() => {
      const fromMeta = store.treeMeta()?.standards ?? [];
      const fromTemplates = store.templates().map((t) => t.standard ?? t.key);
      return Array.from(new Set([...fromMeta, ...fromTemplates].filter(Boolean)));
    }),
  })),
  withMethods((store) => {
    const api = inject(GeneralLedgerApiService);

    const loadAll = (): void => {
      patchState(store, { loading: true, treeLoading: true, mappingsLoading: true, error: null });

      const filterParams = {
        search: store.searchFilter() || undefined,
        template_code: store.templateFilter() || undefined,
        type: store.typeFilter() || undefined,
        active: store.activeFilter() || undefined,
      };

      forkJoin({
        accounts: api.getAccountList({ ...filterParams, per_page: 250 }).pipe(catchError(() => of({ data: [] as ChartAccountDetail[] }))),
        tree: api.getAccountsTree(filterParams).pipe(catchError(() => of({ data: [] as ChartAccountTreeNode[], meta: null }))),
        templates: api.getAccountTemplates().pipe(catchError(() => of({ data: [] as ChartAccountTemplate[] }))),
        mappings: api.getAccountMappings().pipe(catchError(() => of({ data: [] as AccountMapping[], incoming: [] as AccountMapping[], tree: [] as AccountMappingTreeGroup[] }))),
        vatCodes: api.getVatCodesLookup().pipe(catchError(() => of({ data: [] as VatCodeOption[] }))),
        costCenters: api.getCostCenters({ per_page: 200 }).pipe(catchError(() => of({ data: [] as CostCenterOption[] }))),
      }).subscribe({
        next: (res) => {
          const templatesRes = res.templates as { data: ChartAccountTemplate[]; ui_copy?: Record<string, string> };
          patchState(store, {
            accounts: res.accounts.data ?? [],
            tree: res.tree.data ?? [],
            treeMeta: res.tree.meta ?? null,
            templates: templatesRes.data ?? [],
            templateUiCopy: templatesRes.ui_copy ?? {},
            mappings: res.mappings.data ?? [],
            incomingMappings: res.mappings.incoming ?? [],
            mappingTree: res.mappings.tree ?? [],
            vatCodes: res.vatCodes.data ?? [],
            costCenters: res.costCenters.data ?? [],
            loading: false,
            treeLoading: false,
            mappingsLoading: false,
          });
        },
        error: () => {
          patchState(store, { loading: false, treeLoading: false, mappingsLoading: false });
        },
      });
    };

    const loadTreeAndList = (): void => {
      patchState(store, { loading: true, treeLoading: true });
      const filterParams = {
        search: store.searchFilter() || undefined,
        template_code: store.templateFilter() || undefined,
        type: store.typeFilter() || undefined,
        active: store.activeFilter() || undefined,
      };

      forkJoin({
        accounts: api.getAccountList({ ...filterParams, per_page: 250 }).pipe(catchError(() => of({ data: [] as ChartAccountDetail[] }))),
        tree: api.getAccountsTree(filterParams).pipe(catchError(() => of({ data: [] as ChartAccountTreeNode[], meta: null }))),
      }).subscribe({
        next: (res) => {
          patchState(store, {
            accounts: res.accounts.data ?? [],
            tree: res.tree.data ?? [],
            treeMeta: res.tree.meta ?? store.treeMeta(),
            loading: false,
            treeLoading: false,
          });
        },
        error: () => {
          patchState(store, { loading: false, treeLoading: false });
        },
      });
    };

    const loadMappings = (filters?: { source_account_id?: string; source_standard?: string; target_standard?: string }): void => {
      patchState(store, { mappingsLoading: true });
      api.getAccountMappings(filters).subscribe({
        next: (res) => {
          patchState(store, {
            mappings: res.data ?? [],
            incomingMappings: res.incoming ?? [],
            mappingTree: res.tree ?? [],
            mappingsLoading: false,
          });
        },
        error: () => {
          patchState(store, { mappingsLoading: false });
        },
      });
    };

    const selectAccount = (node: ChartAccountTreeNode | null): void => {
      if (!node) {
        patchState(store, {
          selectedNode: null,
          selectedDetail: null,
          selectedBreadcrumbs: [],
          selectedHasPostings: false,
        });
        return;
      }

      patchState(store, { selectedNode: node });
      api.getAccountDetail(node.id).subscribe({
        next: (res) => {
          patchState(store, {
            selectedDetail: res.data,
            selectedBreadcrumbs: res.meta?.breadcrumbs ?? [],
            selectedHasPostings: res.meta?.has_postings ?? node.has_postings,
          });
        },
      });
    };

    const setFilters = (partial: Partial<Pick<GlAccountsState, 'searchFilter' | 'templateFilter' | 'typeFilter' | 'activeFilter'>>): void => {
      patchState(store, partial);
      loadTreeAndList();
    };

    return {
      loadAll,
      loadTreeAndList,
      loadMappings,
      selectAccount,
      setFilters,
      saveAccount: (editingId: string | null, payload: ChartAccountPayload, onDone: () => void, onError: (msg: string) => void): void => {
        patchState(store, { saving: true });
        const req$ = editingId ? api.updateAccount(editingId, payload) : api.createAccount(payload);
        req$.subscribe({
          next: () => {
            patchState(store, { saving: false });
            loadTreeAndList();
            onDone();
          },
          error: (err) => {
            patchState(store, { saving: false });
            onError(err?.error?.message ?? 'Error');
          },
        });
      },
      moveAccount: (id: string, parentAccountId: string | null, onDone: () => void, onError: (msg: string) => void): void => {
        patchState(store, { saving: true });
        api.moveAccount(id, parentAccountId).subscribe({
          next: () => {
            patchState(store, { saving: false });
            loadTreeAndList();
            onDone();
          },
          error: (err) => {
            patchState(store, { saving: false });
            onError(err?.error?.message ?? 'Error');
          },
        });
      },
      deleteAccount: (id: string, onDone: () => void, onError: (msg: string) => void): void => {
        api.deleteAccount(id).subscribe({
          next: () => {
            if (store.selectedNode()?.id === id) {
              selectAccount(null);
            }
            loadTreeAndList();
            onDone();
          },
          error: (err) => {
            onError(err?.error?.message ?? 'Error');
          },
        });
      },
      provisionTemplate: (templateKey: string, includeDefaultMappings: boolean, onDone: (res: { template?: string; created: number; skipped: number; mappings_created?: number }) => void, onError: (msg: string) => void): void => {
        patchState(store, { provisioning: true });
        api.provisionAccountTemplate(templateKey, { include_default_mappings: includeDefaultMappings }).subscribe({
          next: (res) => {
            patchState(store, { provisioning: false });
            loadAll();
            onDone(res.data);
          },
          error: (err) => {
            patchState(store, { provisioning: false });
            onError(err?.error?.message ?? 'Error');
          },
        });
      },
      saveMapping: (editingId: string | null, payload: AccountMappingPayload, onDone: () => void, onError: (msg: string) => void): void => {
        patchState(store, { saving: true });
        const req$ = editingId ? api.updateAccountMapping(editingId, payload) : api.createAccountMapping(payload);
        req$.subscribe({
          next: () => {
            patchState(store, { saving: false });
            loadMappings();
            onDone();
          },
          error: (err) => {
            patchState(store, { saving: false });
            onError(err?.error?.message ?? 'Error');
          },
        });
      },
      deleteMapping: (id: string, onDone: () => void, onError: (msg: string) => void): void => {
        api.deleteAccountMapping(id).subscribe({
          next: () => {
            loadMappings();
            onDone();
          },
          error: (err) => onError(err?.error?.message ?? 'Error'),
        });
      },
      seedDefaultMappings: (sourceStandard: string | undefined, onDone: (created: number) => void, onError: (msg: string) => void): void => {
        patchState(store, { provisioning: true });
        api.seedDefaultAccountMappings(sourceStandard).subscribe({
          next: (res) => {
            patchState(store, { provisioning: false });
            loadMappings();
            onDone(res.data.created);
          },
          error: (err) => {
            patchState(store, { provisioning: false });
            onError(err?.error?.message ?? 'Error');
          },
        });
      },
      exportCoa: (format: 'xlsx' | 'csv' | 'xml', onError: (msg: string) => void): void => {
        patchState(store, { exporting: true });
        api.exportAccounts(format, {
          template_code: store.templateFilter() || undefined,
          active: store.activeFilter() || undefined,
        }).subscribe({
          next: (blob) => {
            patchState(store, { exporting: false });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `chart-of-accounts.${format}`;
            anchor.click();
            URL.revokeObjectURL(url);
          },
          error: (err) => {
            patchState(store, { exporting: false });
            onError(err?.error?.message ?? 'Export error');
          },
        });
      },
    };
  }),
);
