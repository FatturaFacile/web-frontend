import { computed, inject } from '@angular/core';
import { AuthStore } from '@core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { FiduciaryPortalApiService } from './fiduciary-portal-api.service';
import {
  DossierPreviewSummary,
  FiduciaryAccountLedgerReport,
  FiduciaryAuditLogEntry,
  FiduciaryClientSummary,
  FiduciaryEntryNote,
  FiduciaryExportRun,
  FiduciaryFiscalPeriod,
  FiduciaryFiscalYear,
  FiduciaryJournalEntry,
  FiduciaryTranscodingMatrix,
  StudioExportFormatCode,
  StudioExportFormatMeta,
  StudioExportValidationResult,
} from './fiduciary-portal.models';

export interface FiduciaryPortalState {
  readonly busy: boolean;
  readonly errorMessage: string | null;
  readonly activeTenantId: string | null;
  readonly activeClient: FiduciaryClientSummary | null;
  readonly clients: readonly FiduciaryClientSummary[];
  readonly fiscalYears: readonly FiduciaryFiscalYear[];
  readonly fiscalPeriods: readonly FiduciaryFiscalPeriod[];
  readonly exportFormats: readonly StudioExportFormatMeta[];
  readonly journals: readonly FiduciaryJournalEntry[];
  readonly journalsTotal: number;
  readonly selectedEntryIds: readonly string[];
  readonly accountLedger: FiduciaryAccountLedgerReport | null;
  readonly transcodingMatrix: FiduciaryTranscodingMatrix | null;
  readonly notes: readonly FiduciaryEntryNote[];
  readonly openNotesCount: number;
  readonly exportRuns: readonly FiduciaryExportRun[];
  readonly exportValidation: StudioExportValidationResult | null;
  readonly dossierPreview: DossierPreviewSummary | null;
  readonly auditLogs: readonly FiduciaryAuditLogEntry[];
  readonly selectedStudioSystem: StudioExportFormatCode;
}

const initialState: FiduciaryPortalState = {
  busy: false,
  errorMessage: null,
  activeTenantId: null,
  activeClient: null,
  clients: [],
  fiscalYears: [],
  fiscalPeriods: [],
  exportFormats: [],
  journals: [],
  journalsTotal: 0,
  selectedEntryIds: [],
  accountLedger: null,
  transcodingMatrix: null,
  notes: [],
  openNotesCount: 0,
  exportRuns: [],
  exportValidation: null,
  dossierPreview: null,
  auditLogs: [],
  selectedStudioSystem: 'abacus_xml',
};

export const FiduciaryPortalStore = signalStore(
  withState(initialState),
  withComputed(({ fiscalPeriods, activeClient }) => ({
    hasFiduciaryLockedPeriods: computed(() =>
      fiscalPeriods().some((p) => p.is_fiduciary_locked),
    ),
    verificationProgress: computed(() => activeClient()?.verification_progress_percent ?? 0),
  })),
  withMethods((store, api = inject(FiduciaryPortalApiService), authStore = inject(AuthStore)) => ({
    async init(): Promise<void> {
      patchState(store, { busy: true, errorMessage: null });
      try {
        const res = await firstValueFrom(api.getOverview());
        const data = res.data;
        const defaultFormat: StudioExportFormatCode =
          data.active_client?.jurisdiction === 'CH' ? 'abacus_xml' : 'teamsystem';
        patchState(store, {
          activeTenantId: data.active_tenant_id,
          activeClient: data.active_client,
          clients: data.clients,
          fiscalYears: data.fiscal_years,
          fiscalPeriods: data.fiscal_periods,
          exportFormats: data.export_formats,
          selectedStudioSystem: defaultFormat,
          busy: false,
        });
        await Promise.all([
          this.loadJournals({}),
          this.loadTranscodings(defaultFormat),
          this.loadNotes(),
          this.loadExportRuns(),
          this.loadDossierPreview(data.fiscal_years[0]?.id ?? null),
          this.loadAuditLogs(),
        ]);
      } catch (err) {
        patchState(store, {
          busy: false,
          errorMessage: err instanceof Error ? err.message : 'Error loading fiduciary workspace',
        });
      }
    },

    async switchClient(tenantId: string): Promise<void> {
      authStore.switchTenant(tenantId);
      await this.init();
    },

    async loadJournals(filters: {
      fiscal_year_id?: string | null;
      fiscal_period_id?: string | null;
      fiduciary_verified?: string | null;
      search?: string | null;
    }): Promise<void> {
      const res = await firstValueFrom(
        api.listJournals({ ...filters, studio_system: store.selectedStudioSystem() }),
      );
      patchState(store, {
        journals: res.data.items,
        journalsTotal: res.data.meta.total,
        selectedEntryIds: [],
      });
    },

    toggleEntrySelection(entryId: string, selected: boolean): void {
      const current = new Set(store.selectedEntryIds());
      if (selected) {
        current.add(entryId);
      } else {
        current.delete(entryId);
      }
      patchState(store, { selectedEntryIds: Array.from(current) });
    },

    async verifyEntries(entryIds: string[], verified: boolean, note?: string | null): Promise<void> {
      if (entryIds.length === 0) return;
      patchState(store, { busy: true });
      try {
        await firstValueFrom(api.verifyJournals({ entry_ids: entryIds, verified, note }));
        await Promise.all([this.loadJournals({}), this.refreshOverview(), this.loadAuditLogs()]);
      } finally {
        patchState(store, { busy: false });
      }
    },

    async loadAccountLedger(accountId: string, from: string, to: string): Promise<void> {
      patchState(store, { busy: true });
      try {
        const res = await firstValueFrom(
          api.getAccountLedger({ account_id: accountId, from, to, studio_system: store.selectedStudioSystem() }),
        );
        patchState(store, { accountLedger: res.data });
      } finally {
        patchState(store, { busy: false });
      }
    },

    async loadTranscodings(studioSystem: StudioExportFormatCode, search = '', unmappedOnly = false): Promise<void> {
      patchState(store, { selectedStudioSystem: studioSystem });
      const res = await firstValueFrom(
        api.getTranscodings({ studio_system: studioSystem, search, unmapped_only: unmappedOnly }),
      );
      patchState(store, { transcodingMatrix: res.data });
    },

    async saveTranscoding(payload: {
      source_account_id: string;
      studio_account_code: string;
      studio_account_name?: string | null;
      studio_vat_code?: string | null;
      studio_cost_center_code?: string | null;
    }): Promise<void> {
      await firstValueFrom(api.saveTranscoding({ ...payload, studio_system: store.selectedStudioSystem() }));
      await Promise.all([this.loadTranscodings(store.selectedStudioSystem()), this.refreshOverview()]);
    },

    async seedDefaultTranscodings(): Promise<void> {
      await firstValueFrom(api.seedDefaultTranscodings(store.selectedStudioSystem()));
      await Promise.all([this.loadTranscodings(store.selectedStudioSystem()), this.refreshOverview()]);
    },

    async deleteTranscoding(id: string): Promise<void> {
      await firstValueFrom(api.deleteTranscoding(id));
      await Promise.all([this.loadTranscodings(store.selectedStudioSystem()), this.refreshOverview()]);
    },

    async lockPeriod(periodId: string, reason: string): Promise<void> {
      await firstValueFrom(api.lockPeriod(periodId, reason));
      await Promise.all([this.refreshPeriods(), this.refreshOverview(), this.loadAuditLogs()]);
    },

    async unlockPeriod(periodId: string, reason: string): Promise<void> {
      await firstValueFrom(api.unlockPeriod(periodId, reason));
      await Promise.all([this.refreshPeriods(), this.refreshOverview(), this.loadAuditLogs()]);
    },

    async loadNotes(journalEntryId?: string, status?: string): Promise<void> {
      const res = await firstValueFrom(api.listNotes({ journal_entry_id: journalEntryId, status }));
      patchState(store, {
        notes: res.data.items,
        openNotesCount: res.data.open_count,
      });
    },

    async createNote(journalEntryId: string, body: string, parentNoteId?: string | null): Promise<void> {
      await firstValueFrom(api.createNote({ journal_entry_id: journalEntryId, body, parent_note_id: parentNoteId }));
      await Promise.all([this.loadNotes(), this.loadJournals({}), this.refreshOverview()]);
    },

    async resolveNote(noteId: string, resolved: boolean, comment?: string | null): Promise<void> {
      await firstValueFrom(api.resolveNote(noteId, resolved, comment));
      await Promise.all([this.loadNotes(), this.loadJournals({}), this.refreshOverview()]);
    },

    async validateExport(payload: {
      format_code: StudioExportFormatCode;
      from_date: string;
      to_date: string;
      fiscal_year_id?: string | null;
      fiscal_period_id?: string | null;
      only_verified?: boolean;
      apply_transcoding?: boolean;
    }): Promise<void> {
      const res = await firstValueFrom(api.validateExport(payload));
      patchState(store, { exportValidation: res.data });
    },

    async generateExport(payload: {
      format_code: StudioExportFormatCode;
      from_date: string;
      to_date: string;
      fiscal_year_id?: string | null;
      fiscal_period_id?: string | null;
      only_verified?: boolean;
      apply_transcoding?: boolean;
      consultant_number?: number;
      client_number?: number;
    }): Promise<FiduciaryExportRun> {
      const res = await firstValueFrom(api.generateExport(payload));
      await Promise.all([this.loadExportRuns(), this.loadAuditLogs()]);
      return res.data;
    },

    async loadExportRuns(): Promise<void> {
      const res = await firstValueFrom(api.listExportRuns());
      patchState(store, { exportRuns: res.data });
    },

    async loadDossierPreview(fiscalYearId?: string | null, fromDate?: string, toDate?: string): Promise<void> {
      const res = await firstValueFrom(api.previewDossier(fiscalYearId, fromDate, toDate));
      patchState(store, { dossierPreview: res.data });
    },

    async loadAuditLogs(): Promise<void> {
      const res = await firstValueFrom(api.listAuditLogs());
      patchState(store, { auditLogs: res.data.items });
    },

    async refreshPeriods(): Promise<void> {
      const res = await firstValueFrom(api.listPeriods());
      patchState(store, { fiscalPeriods: res.data });
    },

    async refreshOverview(): Promise<void> {
      const res = await firstValueFrom(api.getOverview());
      patchState(store, {
        activeClient: res.data.active_client,
        clients: res.data.clients,
        fiscalPeriods: res.data.fiscal_periods,
      });
    },
  })),
);
