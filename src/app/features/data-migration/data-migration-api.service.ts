import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ColumnMappingEntry,
  DataMigrationMetadataResponse,
  MigrationDryRunReport,
  MigrationDryRunSummary,
  MigrationFieldMappingTemplate,
  MigrationJob,
  MigrationSourceSystem,
  MigrationStagingRow,
  MigrationTargetEntity,
  ValueTransformationsConfig,
} from './data-migration.models';

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class DataMigrationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/data-migration`;

  getMetadata(): Observable<ApiEnvelope<DataMigrationMetadataResponse>> {
    return this.http.get<ApiEnvelope<DataMigrationMetadataResponse>>(`${this.baseUrl}/metadata`);
  }

  listTemplates(
    sourceSystem?: MigrationSourceSystem,
    entityType?: MigrationTargetEntity,
  ): Observable<ApiEnvelope<MigrationFieldMappingTemplate[]>> {
    let params = new HttpParams();
    if (sourceSystem) params = params.set('source_system', sourceSystem);
    if (entityType) params = params.set('entity_type', entityType);
    return this.http.get<ApiEnvelope<MigrationFieldMappingTemplate[]>>(
      `${this.baseUrl}/templates`,
      { params },
    );
  }

  saveTemplate(payload: {
    name: string;
    source_system: MigrationSourceSystem;
    entity_type: MigrationTargetEntity;
    column_mappings: Record<string, ColumnMappingEntry>;
    value_transformations?: ValueTransformationsConfig;
  }): Observable<ApiEnvelope<MigrationFieldMappingTemplate>> {
    return this.http.post<ApiEnvelope<MigrationFieldMappingTemplate>>(
      `${this.baseUrl}/templates`,
      payload,
    );
  }

  downloadTemplate(
    entityType: MigrationTargetEntity,
    format: 'xlsx' | 'csv',
    locale: string,
  ): Observable<Blob> {
    const params = new HttpParams()
      .set('entity_type', entityType)
      .set('format', format)
      .set('locale', locale);
    return this.http.get(`${this.baseUrl}/templates/download`, {
      params,
      responseType: 'blob',
    });
  }

  listJobs(): Observable<ApiEnvelope<MigrationJob[]>> {
    return this.http.get<ApiEnvelope<MigrationJob[]>>(`${this.baseUrl}/jobs`);
  }

  uploadArchive(payload: {
    source_system: MigrationSourceSystem;
    target_entities: MigrationTargetEntity[];
    file: File;
    legal_entity_id?: string | null;
    template_id?: string | null;
  }): Observable<ApiEnvelope<MigrationJob>> {
    const form = new FormData();
    form.append('source_system', payload.source_system);
    payload.target_entities.forEach((entity) => form.append('target_entities[]', entity));
    form.append('file', payload.file);
    if (payload.legal_entity_id) {
      form.append('legal_entity_id', payload.legal_entity_id);
    }
    if (payload.template_id) {
      form.append('template_id', payload.template_id);
    }
    return this.http.post<ApiEnvelope<MigrationJob>>(`${this.baseUrl}/jobs`, form);
  }

  getJob(jobId: string): Observable<ApiEnvelope<MigrationJob>> {
    return this.http.get<ApiEnvelope<MigrationJob>>(`${this.baseUrl}/jobs/${jobId}`);
  }

  autoMap(
    jobId: string,
    payload: {
      template_id?: string | null;
      mappings_by_entity?: Record<string, Record<string, ColumnMappingEntry>>;
      value_transformations?: ValueTransformationsConfig;
    },
  ): Observable<ApiEnvelope<MigrationJob>> {
    return this.http.post<ApiEnvelope<MigrationJob>>(
      `${this.baseUrl}/jobs/${jobId}/auto-map`,
      payload,
    );
  }

  runDryRun(
    jobId: string,
  ): Observable<ApiEnvelope<{ job: MigrationJob; summary: MigrationDryRunSummary }>> {
    return this.http.post<ApiEnvelope<{ job: MigrationJob; summary: MigrationDryRunSummary }>>(
      `${this.baseUrl}/jobs/${jobId}/dry-run`,
      {},
    );
  }

  getDryRunReport(jobId: string): Observable<ApiEnvelope<MigrationDryRunReport>> {
    return this.http.get<ApiEnvelope<MigrationDryRunReport>>(
      `${this.baseUrl}/jobs/${jobId}/dry-run-report`,
    );
  }

  patchStagingRow(
    jobId: string,
    rowId: string,
    values: Record<string, unknown>,
  ): Observable<ApiEnvelope<MigrationStagingRow>> {
    return this.http.patch<ApiEnvelope<MigrationStagingRow>>(
      `${this.baseUrl}/jobs/${jobId}/staging-rows/${rowId}`,
      { values },
    );
  }

  commitJob(
    jobId: string,
  ): Observable<
    ApiEnvelope<{ job: MigrationJob; imported_rows: number; manifest_entries: number }>
  > {
    return this.http.post<
      ApiEnvelope<{ job: MigrationJob; imported_rows: number; manifest_entries: number }>
    >(`${this.baseUrl}/jobs/${jobId}/commit`, {});
  }

  rollbackJob(
    jobId: string,
  ): Observable<ApiEnvelope<{ job: MigrationJob; reverted_records: number }>> {
    return this.http.post<ApiEnvelope<{ job: MigrationJob; reverted_records: number }>>(
      `${this.baseUrl}/jobs/${jobId}/rollback`,
      {},
    );
  }
}
