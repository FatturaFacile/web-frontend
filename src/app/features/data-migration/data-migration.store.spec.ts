import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '@core';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataMigrationStore } from './data-migration.store';

describe('DataMigrationStore', () => {
  let httpMock: HttpTestingController;
  let store: InstanceType<typeof DataMigrationStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        DataMigrationStore,
        {
          provide: I18nService,
          useValue: { dictionaryLocale: () => 'it-CH', translate: (k: string) => k },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    store = TestBed.inject(DataMigrationStore);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads connectors, entities, templates, and jobs on init()', async () => {
    const initPromise = store.init();

    const metaReq = httpMock.expectOne(`${environment.apiBaseUrl}/data-migration/metadata`);
    metaReq.flush({
      success: true,
      data: {
        connectors: [
          {
            code: 'Bexio',
            name_key: 'dataMigration.connector.Bexio.name',
            description_key: 'dataMigration.connector.Bexio.description',
            jurisdiction: 'CH',
            default_currency: 'CHF',
            supported_extensions: ['csv', 'xlsx'],
            default_entities: ['Customers', 'OpeningGlBalances'],
            default_transformations: { date_format: 'd.m.Y', decimal_separator: '.', currency_default: 'CHF' },
          },
        ],
        entities: [],
        templates: [],
        supported_locales: ['it-CH', 'de-CH', 'fr-CH', 'en', 'it-IT'],
      },
    });

    const jobsReq = httpMock.expectOne(`${environment.apiBaseUrl}/data-migration/jobs`);
    jobsReq.flush({ success: true, data: [] });

    await initPromise;
    expect(store.connectors()).toHaveLength(1);
    expect(store.selectedSourceSystem()).toBe('Bexio');
    expect(store.canProceedToStep2()).toBe(true);
  });

  it('runs upload -> dry-run -> inline patch -> commit -> 1-click rollback', async () => {
    store.selectConnector('Bexio');
    store.setTargetEntities(['Customers']);

    const file = new File(['company_name;country\nAcme;CH'], 'customers.csv', { type: 'text/csv' });
    const uploadPromise = store.uploadArchive(file);
    httpMock.expectOne(`${environment.apiBaseUrl}/data-migration/jobs`).flush({
      success: true,
      data: {
        id: 'job-1',
        source_system: 'Bexio',
        target_entities: ['Customers'],
        status: 'Uploaded',
        dry_run_passed: false,
        total_rows: 1,
        imported_rows: 0,
        error_rows: 0,
        source_metadata_json: { headers: ['company_name', 'country'], mappings_by_entity: {} },
      },
    });
    expect(await uploadPromise).toBe(true);
    expect(store.currentStep()).toBe(2);

    const dryRunPromise = store.runDryRun(true);
    httpMock.expectOne(`${environment.apiBaseUrl}/data-migration/jobs/job-1/auto-map`).flush({
      success: true,
      data: { id: 'job-1', status: 'Mapped', target_entities: ['Customers'] },
    });
    await Promise.resolve();
    httpMock.expectOne(`${environment.apiBaseUrl}/data-migration/jobs/job-1/dry-run`).flush({
      success: true,
      data: { job: { id: 'job-1', status: 'DryRunValidated', dry_run_passed: true }, summary: {} },
    });
    await Promise.resolve();
    httpMock.expectOne(`${environment.apiBaseUrl}/data-migration/jobs/job-1/dry-run-report`).flush({
      success: true,
      data: {
        job: { id: 'job-1', status: 'DryRunValidated', dry_run_passed: true, target_entities: ['Customers'] },
        summary: { total_rows: 1, valid_rows: 1, error_rows: 0, gl_balance: { has_opening_balances: false } },
        errors: [],
        staging_rows: [{ id: 'row-1', row_index: 1, entity_type: 'Customers' }],
      },
    });
    await dryRunPromise;
    expect(store.canProceedToStep5()).toBe(true);

    const commitPromise = store.commitActiveJob();
    httpMock.expectOne(`${environment.apiBaseUrl}/data-migration/jobs/job-1/commit`).flush({
      success: true,
      data: { job: { id: 'job-1', status: 'Completed', imported_rows: 1 }, imported_rows: 1, manifest_entries: 1 },
    });
    expect(await commitPromise).toBe(true);
    expect(store.activeJob()?.status).toBe('Completed');

    const rollbackPromise = store.rollbackJob('job-1');
    httpMock.expectOne(`${environment.apiBaseUrl}/data-migration/jobs/job-1/rollback`).flush({
      success: true,
      data: { job: { id: 'job-1', status: 'RolledBack', imported_rows: 0 }, reverted_records: 1 },
    });
    expect(await rollbackPromise).toBe(true);
    expect(store.activeJob()?.status).toBe('RolledBack');
  });
});
