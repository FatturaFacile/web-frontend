import { computed, inject } from '@angular/core';
import { I18nService } from '@core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { saveBlob } from '../hr/shared/hr-http.util';
import { DataMigrationApiService } from './data-migration-api.service';
import {
  ColumnMappingEntry,
  ConnectorMetadata,
  EntitySchemaMetadata,
  MigrationDryRunReport,
  MigrationFieldMappingTemplate,
  MigrationJob,
  MigrationSourceSystem,
  MigrationTargetEntity,
  ValueTransformationsConfig,
} from './data-migration.models';

export interface DataMigrationState {
  currentStep: number;
  connectors: ConnectorMetadata[];
  entitySchemas: EntitySchemaMetadata[];
  templates: MigrationFieldMappingTemplate[];
  jobs: MigrationJob[];
  selectedSourceSystem: MigrationSourceSystem | null;
  selectedTargetEntities: MigrationTargetEntity[];
  selectedTemplateId: string | null;
  activeJob: MigrationJob | null;
  columnMappings: Record<string, Record<string, ColumnMappingEntry>>;
  valueTransformations: ValueTransformationsConfig;
  dryRunReport: MigrationDryRunReport | null;
  editingValues: Record<string, string>;
  busy: boolean;
  uploading: boolean;
  validating: boolean;
  committing: boolean;
  rollingBack: boolean;
  errorMessage: string | null;
}

const initialState: DataMigrationState = {
  currentStep: 0,
  connectors: [],
  entitySchemas: [],
  templates: [],
  jobs: [],
  selectedSourceSystem: null,
  selectedTargetEntities: [],
  selectedTemplateId: null,
  activeJob: null,
  columnMappings: {},
  valueTransformations: {
    date_format: 'Y-m-d',
    decimal_separator: '.',
    thousand_separator: '',
    currency_default: 'EUR',
  },
  dryRunReport: null,
  editingValues: {},
  busy: false,
  uploading: false,
  validating: false,
  committing: false,
  rollingBack: false,
  errorMessage: null,
};

export const DataMigrationStore = signalStore(
  withState<DataMigrationState>(initialState),
  withComputed((store) => ({
    activeConnector: computed(() =>
      store.connectors().find((c) => c.code === store.selectedSourceSystem()) ?? null,
    ),
    canProceedToStep2: computed(
      () => store.selectedSourceSystem() !== null && store.selectedTargetEntities().length > 0,
    ),
    canProceedToStep3: computed(() => store.activeJob() !== null),
    canProceedToStep4: computed(() => store.activeJob() !== null),
    canProceedToStep5: computed(
      () =>
        store.activeJob()?.dry_run_passed === true &&
        store.activeJob()?.status === 'DryRunValidated',
    ),
    isDryRunPassed: computed(() => store.activeJob()?.dry_run_passed === true),
    unresolvedErrorsCount: computed(
      () => store.dryRunReport()?.errors.filter((e) => !e.is_resolved).length ?? 0,
    ),
    resolvedErrorsCount: computed(
      () => store.dryRunReport()?.errors.filter((e) => e.is_resolved).length ?? 0,
    ),
    sourceHeaders: computed(() => store.activeJob()?.source_metadata_json?.headers ?? []),
  })),
  withMethods(
    (store, api = inject(DataMigrationApiService), i18n = inject(I18nService)) => ({
      async init(): Promise<void> {
        patchState(store, { busy: true, errorMessage: null });
        try {
          const [metaRes, jobsRes] = await Promise.all([
            firstValueFrom(api.getMetadata()),
            firstValueFrom(api.listJobs()),
          ]);
          const firstConnector = metaRes.data.connectors[0] ?? null;
          patchState(store, {
            connectors: metaRes.data.connectors,
            entitySchemas: metaRes.data.entities,
            templates: metaRes.data.templates,
            jobs: jobsRes.data,
            selectedSourceSystem: store.selectedSourceSystem() ?? firstConnector?.code ?? null,
            selectedTargetEntities:
              store.selectedTargetEntities().length > 0
                ? store.selectedTargetEntities()
                : [...(firstConnector?.default_entities ?? [])],
            busy: false,
          });
        } catch (err: unknown) {
          patchState(store, {
            busy: false,
            errorMessage: err instanceof Error ? err.message : 'ERRORS.GENERIC',
          });
        }
      },

      setStep(step: number): void {
        patchState(store, { currentStep: Math.max(0, Math.min(4, step)) });
      },

      selectConnector(code: MigrationSourceSystem): void {
        const connector = store.connectors().find((c) => c.code === code);
        patchState(store, {
          selectedSourceSystem: code,
          selectedTargetEntities: connector ? [...connector.default_entities] : [],
          selectedTemplateId: null,
          valueTransformations: connector?.default_transformations ?? store.valueTransformations(),
        });
      },

      setTargetEntities(entities: MigrationTargetEntity[]): void {
        patchState(store, { selectedTargetEntities: entities });
      },

      selectTemplate(templateId: string | null): void {
        patchState(store, { selectedTemplateId: templateId });
      },

      async downloadTemplate(
        entityType: MigrationTargetEntity,
        format: 'xlsx' | 'csv',
      ): Promise<void> {
        patchState(store, { busy: true, errorMessage: null });
        try {
          const locale = i18n.dictionaryLocale();
          const blob = await firstValueFrom(api.downloadTemplate(entityType, format, locale));
          saveBlob(blob, `fatturafacile-${entityType.toLowerCase()}-${locale}.${format}`);
          patchState(store, { busy: false });
        } catch (err: unknown) {
          patchState(store, {
            busy: false,
            errorMessage: err instanceof Error ? err.message : 'ERRORS.GENERIC',
          });
        }
      },

      async uploadArchive(file: File): Promise<boolean> {
        const sourceSystem = store.selectedSourceSystem();
        const targetEntities = store.selectedTargetEntities();
        if (!sourceSystem || targetEntities.length === 0) {
          return false;
        }
        patchState(store, { uploading: true, errorMessage: null, dryRunReport: null });
        try {
          const res = await firstValueFrom(
            api.uploadArchive({
              source_system: sourceSystem,
              target_entities: targetEntities,
              file,
              template_id: store.selectedTemplateId(),
            }),
          );
          const job = res.data;
          patchState(store, {
            uploading: false,
            activeJob: job,
            columnMappings: job.source_metadata_json?.mappings_by_entity ?? {},
            valueTransformations:
              job.source_metadata_json?.value_transformations ?? store.valueTransformations(),
            jobs: [job, ...store.jobs().filter((j) => j.id !== job.id)],
            currentStep: 2,
          });
          return true;
        } catch (err: unknown) {
          patchState(store, {
            uploading: false,
            errorMessage: err instanceof Error ? err.message : 'ERRORS.GENERIC',
          });
          return false;
        }
      },

      updateMappingField(
        entity: string,
        field: string,
        sourceColumn: string | null,
        defaultValue?: string | null,
      ): void {
        const current = { ...store.columnMappings() };
        const entityMap = { ...(current[entity] ?? {}) };
        const existing = entityMap[field] ?? {
          source_column: null,
          required: false,
          default_value: null,
          confidence: 1.0,
        };
        entityMap[field] = {
          ...existing,
          source_column: sourceColumn,
          default_value: defaultValue !== undefined ? defaultValue : existing.default_value,
          confidence: sourceColumn ? 1.0 : 0.0,
        };
        current[entity] = entityMap;
        patchState(store, { columnMappings: current });
      },

      updateTransformations(patch: Partial<ValueTransformationsConfig>): void {
        patchState(store, {
          valueTransformations: { ...store.valueTransformations(), ...patch },
        });
      },

      async runAutoMap(applyCurrentOverrides = false): Promise<void> {
        const job = store.activeJob();
        if (!job) return;
        patchState(store, { busy: true, errorMessage: null });
        try {
          const res = await firstValueFrom(
            api.autoMap(job.id, {
              template_id: store.selectedTemplateId(),
              mappings_by_entity: applyCurrentOverrides ? store.columnMappings() : undefined,
              value_transformations: store.valueTransformations(),
            }),
          );
          const updated = res.data;
          patchState(store, {
            busy: false,
            activeJob: updated,
            columnMappings: updated.source_metadata_json?.mappings_by_entity ?? store.columnMappings(),
            valueTransformations:
              updated.source_metadata_json?.value_transformations ?? store.valueTransformations(),
            jobs: store.jobs().map((j) => (j.id === updated.id ? updated : j)),
          });
        } catch (err: unknown) {
          patchState(store, {
            busy: false,
            errorMessage: err instanceof Error ? err.message : 'ERRORS.GENERIC',
          });
        }
      },

      async saveCurrentAsTemplate(name: string, entityType: MigrationTargetEntity): Promise<void> {
        const sourceSystem = store.selectedSourceSystem();
        if (!sourceSystem) return;
        patchState(store, { busy: true, errorMessage: null });
        try {
          const res = await firstValueFrom(
            api.saveTemplate({
              name,
              source_system: sourceSystem,
              entity_type: entityType,
              column_mappings: store.columnMappings()[entityType] ?? {},
              value_transformations: store.valueTransformations(),
            }),
          );
          patchState(store, {
            busy: false,
            templates: [res.data, ...store.templates()],
            selectedTemplateId: res.data.id,
          });
        } catch (err: unknown) {
          patchState(store, {
            busy: false,
            errorMessage: err instanceof Error ? err.message : 'ERRORS.GENERIC',
          });
        }
      },

      async runDryRun(saveMappingFirst = true): Promise<void> {
        const job = store.activeJob();
        if (!job) return;
        patchState(store, { validating: true, errorMessage: null });
        try {
          if (saveMappingFirst) {
            await firstValueFrom(
              api.autoMap(job.id, {
                mappings_by_entity: store.columnMappings(),
                value_transformations: store.valueTransformations(),
              }),
            );
          }
          await firstValueFrom(api.runDryRun(job.id));
          const reportRes = await firstValueFrom(api.getDryRunReport(job.id));
          const updatedJob = reportRes.data.job;

          const drafts: Record<string, string> = {};
          for (const errItem of reportRes.data.errors) {
            drafts[`${errItem.entity_type}:${errItem.row_index}:${errItem.field_name}`] =
              errItem.raw_value ?? '';
          }

          patchState(store, {
            validating: false,
            activeJob: updatedJob,
            dryRunReport: reportRes.data,
            editingValues: drafts,
            jobs: store.jobs().map((j) => (j.id === updatedJob.id ? updatedJob : j)),
            currentStep: 3,
          });
        } catch (err: unknown) {
          patchState(store, {
            validating: false,
            errorMessage: err instanceof Error ? err.message : 'ERRORS.GENERIC',
          });
        }
      },

      setInlineDraft(key: string, value: string): void {
        patchState(store, {
          editingValues: { ...store.editingValues(), [key]: value },
        });
      },

      async patchErrorValue(
        entityType: MigrationTargetEntity,
        rowIndex: number,
        fieldName: string,
        newValue: string,
      ): Promise<void> {
        const job = store.activeJob();
        const report = store.dryRunReport();
        if (!job || !report) return;

        const stagingRow = report.staging_rows.find(
          (r) => r.entity_type === entityType && r.row_index === rowIndex,
        );
        if (!stagingRow) return;

        patchState(store, { busy: true, errorMessage: null });
        try {
          await firstValueFrom(
            api.patchStagingRow(job.id, stagingRow.id, { [fieldName]: newValue }),
          );
          const refreshed = await firstValueFrom(api.getDryRunReport(job.id));
          patchState(store, {
            busy: false,
            dryRunReport: refreshed.data,
            editingValues: {
              ...store.editingValues(),
              [`${entityType}:${rowIndex}:${fieldName}`]: newValue,
            },
          });
        } catch (err: unknown) {
          patchState(store, {
            busy: false,
            errorMessage: err instanceof Error ? err.message : 'ERRORS.GENERIC',
          });
        }
      },

      async commitActiveJob(): Promise<boolean> {
        const job = store.activeJob();
        if (!job) return false;
        patchState(store, { committing: true, errorMessage: null });
        try {
          const res = await firstValueFrom(api.commitJob(job.id));
          const updatedJob = res.data.job;
          patchState(store, {
            committing: false,
            activeJob: updatedJob,
            jobs: store.jobs().map((j) => (j.id === updatedJob.id ? updatedJob : j)),
            currentStep: 4,
          });
          return true;
        } catch (err: unknown) {
          patchState(store, {
            committing: false,
            errorMessage: err instanceof Error ? err.message : 'ERRORS.GENERIC',
          });
          return false;
        }
      },

      async rollbackJob(jobId: string): Promise<boolean> {
        patchState(store, { rollingBack: true, errorMessage: null });
        try {
          const res = await firstValueFrom(api.rollbackJob(jobId));
          const updatedJob = res.data.job;
          patchState(store, {
            rollingBack: false,
            activeJob: store.activeJob()?.id === jobId ? updatedJob : store.activeJob(),
            jobs: store.jobs().map((j) => (j.id === updatedJob.id ? updatedJob : j)),
          });
          return true;
        } catch (err: unknown) {
          patchState(store, {
            rollingBack: false,
            errorMessage: err instanceof Error ? err.message : 'ERRORS.GENERIC',
          });
          return false;
        }
      },

      selectExistingJob(job: MigrationJob): void {
        patchState(store, {
          activeJob: job,
          selectedSourceSystem: job.source_system,
          selectedTargetEntities: [...job.target_entities],
          columnMappings: job.source_metadata_json?.mappings_by_entity ?? {},
          valueTransformations:
            job.source_metadata_json?.value_transformations ?? store.valueTransformations(),
        });
      },
    }),
  ),
);
