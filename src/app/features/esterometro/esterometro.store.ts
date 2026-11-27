import { Injectable, computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { EsterometroApiService } from '../../core/api/esterometro-api.service';
import {
  EsterometroDashboard,
  SelfInvoice,
  SelfInvoiceClassificationRule,
  SelfInvoiceDocumentType,
  SelfInvoiceSetting,
  SelfInvoiceStatus,
} from '../../core/models/esterometro.model';

export interface EsterometroState {
  dashboard: EsterometroDashboard | null;
  selfInvoices: SelfInvoice[];
  selectedSelfInvoice: SelfInvoice | null;
  rules: SelfInvoiceClassificationRule[];
  settings: SelfInvoiceSetting | null;
  selectedIds: string[];
  filterDocType: SelfInvoiceDocumentType | null;
  filterStatus: SelfInvoiceStatus | null;
  searchQuery: string;
  loading: boolean;
  submitting: boolean;
  error: string | null;
}

const initialState: EsterometroState = {
  dashboard: null,
  selfInvoices: [],
  selectedSelfInvoice: null,
  rules: [],
  settings: null,
  selectedIds: [],
  filterDocType: null,
  filterStatus: null,
  searchQuery: '',
  loading: false,
  submitting: false,
  error: null,
};

@Injectable()
export class EsterometroStore extends signalStore(
  withState(initialState),
  withComputed((store) => ({
    hasOverdue: computed(() => (store.dashboard()?.counts.overdue ?? 0) > 0),
    selectedCount: computed(() => store.selectedIds().length),
  })),
  withMethods((store, api = inject(EsterometroApiService)) => ({
    async loadAll(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const [dashRes, listRes, rulesRes, settingsRes] = await Promise.all([
          firstValueFrom(api.getDashboard()),
          firstValueFrom(
            api.listSelfInvoices({
              document_type: store.filterDocType(),
              status: store.filterStatus(),
              search: store.searchQuery() || null,
              per_page: 50,
            }),
          ),
          firstValueFrom(api.listRules()),
          firstValueFrom(api.getSettings()),
        ]);

        patchState(store, {
          dashboard: dashRes.data,
          selfInvoices: listRes.data,
          rules: rulesRes.data,
          settings: settingsRes.data,
          loading: false,
        });
      } catch (err: unknown) {
        patchState(store, {
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load Esterometro data.',
        });
      }
    },

    async refreshList(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const [dashRes, listRes] = await Promise.all([
          firstValueFrom(api.getDashboard()),
          firstValueFrom(
            api.listSelfInvoices({
              document_type: store.filterDocType(),
              status: store.filterStatus(),
              search: store.searchQuery() || null,
              per_page: 50,
            }),
          ),
        ]);
        patchState(store, {
          dashboard: dashRes.data,
          selfInvoices: listRes.data,
          loading: false,
        });
      } catch (err: unknown) {
        patchState(store, {
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to refresh list.',
        });
      }
    },

    async selectSelfInvoice(id: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const res = await firstValueFrom(api.getSelfInvoice(id));
        patchState(store, { selectedSelfInvoice: res.data, loading: false });
      } catch (err: unknown) {
        patchState(store, {
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load self-invoice.',
        });
      }
    },

    clearSelected(): void {
      patchState(store, { selectedSelfInvoice: null });
    },

    setFilters(filters: {
      documentType?: SelfInvoiceDocumentType | null;
      status?: SelfInvoiceStatus | null;
      search?: string;
    }): void {
      patchState(store, {
        filterDocType:
          filters.documentType !== undefined ? filters.documentType : store.filterDocType(),
        filterStatus: filters.status !== undefined ? filters.status : store.filterStatus(),
        searchQuery: filters.search !== undefined ? filters.search : store.searchQuery(),
      });
    },

    toggleSelection(id: string, checked: boolean): void {
      const current = new Set(store.selectedIds());
      if (checked) {
        current.add(id);
      } else {
        current.delete(id);
      }
      patchState(store, { selectedIds: Array.from(current) });
    },

    clearSelection(): void {
      patchState(store, { selectedIds: [] });
    },

    async validateXml(id: string): Promise<SelfInvoice | null> {
      patchState(store, { submitting: true, error: null });
      try {
        const res = await firstValueFrom(api.validateXml(id, true));
        patchState(store, { selectedSelfInvoice: res.data, submitting: false });
        return res.data;
      } catch (err: unknown) {
        patchState(store, {
          submitting: false,
          error: err instanceof Error ? err.message : 'Validation failed.',
        });
        return null;
      }
    },

    async sendToSdi(id: string): Promise<SelfInvoice | null> {
      patchState(store, { submitting: true, error: null });
      try {
        const res = await firstValueFrom(api.sendToSdi(id));
        patchState(store, { selectedSelfInvoice: res.data, submitting: false });
        return res.data;
      } catch (err: unknown) {
        patchState(store, {
          submitting: false,
          error: err instanceof Error ? err.message : 'SDI send failed.',
        });
        return null;
      }
    },

    async batchSendSelected(): Promise<{ sentCount: number; failedCount: number } | null> {
      const ids = store.selectedIds();
      if (ids.length === 0) return null;
      patchState(store, { submitting: true, error: null });
      try {
        const res = await firstValueFrom(api.batchSendToSdi(ids));
        patchState(store, { selectedIds: [], submitting: false });
        return {
          sentCount: res.data.sent_ids.length,
          failedCount: res.data.failed.length,
        };
      } catch (err: unknown) {
        patchState(store, {
          submitting: false,
          error: err instanceof Error ? err.message : 'Batch send failed.',
        });
        return null;
      }
    },

    async saveSettings(payload: Partial<SelfInvoiceSetting>): Promise<boolean> {
      patchState(store, { submitting: true, error: null });
      try {
        const res = await firstValueFrom(api.updateSettings(payload));
        patchState(store, { settings: res.data, submitting: false });
        return true;
      } catch (err: unknown) {
        patchState(store, {
          submitting: false,
          error: err instanceof Error ? err.message : 'Failed to save settings.',
        });
        return false;
      }
    },
  })),
) {}
