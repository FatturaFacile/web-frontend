import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from '@core';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FiduciaryPortalStore } from './fiduciary-portal.store';

describe('FiduciaryPortalStore', () => {
  let httpMock: HttpTestingController;
  let store: InstanceType<typeof FiduciaryPortalStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        FiduciaryPortalStore,
        {
          provide: AuthStore,
          useValue: { selectTenant: vi.fn() },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    store = TestBed.inject(FiduciaryPortalStore);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('initializes overview, journals, transcodings, notes, exports, dossier preview, and audit logs', async () => {
    const initPromise = store.init();

    httpMock.expectOne(`${environment.apiBaseUrl}/fiduciary-portal/overview`).flush({
      success: true,
      data: {
        active_tenant_id: 't-ch-1',
        active_client: {
          tenant_id: 't-ch-1',
          name: 'Helvetia SA',
          legal_name: 'Helvetia SA',
          jurisdiction: 'CH',
          country: 'CH',
          currency: 'CHF',
          vat_number: null,
          uid_number: 'CHE-114.892.451',
          role: 'external_fiduciary',
          periods_total: 12,
          periods_fiduciary_locked: 1,
          periods_closed: 0,
          periods_open: 11,
          latest_locked_period: '2026-01',
          posted_entries_count: 10,
          verified_entries_count: 8,
          unverified_entries_count: 2,
          verification_progress_percent: 80,
          open_notes_count: 1,
          resolved_notes_count: 0,
          postable_accounts_count: 20,
          unmapped_accounts_count: 2,
          export_runs_count: 1,
          last_export_at: null,
        },
        clients: [],
        fiscal_years: [{ id: 'fy-1', year_code: '2026', start_date: '2026-01-01', end_date: '2026-12-31', status: 'open' }],
        fiscal_periods: [{ id: 'fp-1', fiscal_year_id: 'fy-1', period_number: 1, period_name: '2026-01', start_date: '2026-01-01', end_date: '2026-01-31', status: 'locked_by_fiduciary', is_fiduciary_locked: true, fiduciary_locked_at: '2026-02-01T10:00:00Z', fiduciary_lock_reason: 'Closed Jan' }],
        export_formats: [],
      },
    });

    await Promise.resolve();

    httpMock.expectOne(`${environment.apiBaseUrl}/fiduciary-portal/journals?studio_system=abacus_xml`).flush({
      success: true,
      data: { items: [], meta: { current_page: 1, last_page: 1, per_page: 25, total: 0 } },
    });
    httpMock.expectOne(`${environment.apiBaseUrl}/fiduciary-portal/transcodings?studio_system=abacus_xml`).flush({
      success: true,
      data: { studio_system: 'abacus_xml', total_accounts: 0, mapped_accounts: 0, unmapped_postable_accounts: 0, rows: [] },
    });
    httpMock.expectOne(`${environment.apiBaseUrl}/fiduciary-portal/notes`).flush({
      success: true,
      data: { open_count: 1, resolved_count: 0, items: [] },
    });
    httpMock.expectOne(`${environment.apiBaseUrl}/fiduciary-portal/exports`).flush({
      success: true,
      data: [],
    });
    httpMock.expectOne(`${environment.apiBaseUrl}/fiduciary-portal/dossier/preview?fiscal_year_id=fy-1`).flush({
      success: true,
      data: { fiscal_year_id: 'fy-1', year_code: '2026', from_date: '2026-01-01', to_date: '2026-12-31', datasets: { journal_entries: 10 } },
    });
    httpMock.expectOne(`${environment.apiBaseUrl}/fiduciary-portal/audit-logs`).flush({
      success: true,
      data: { items: [], meta: { current_page: 1, last_page: 1, per_page: 30, total: 0 } },
    });

    await initPromise;
    expect(store.activeTenantId()).toBe('t-ch-1');
    expect(store.hasFiduciaryLockedPeriods()).toBe(true);
    expect(store.verificationProgress()).toBe(80);
    expect(store.openNotesCount()).toBe(1);
  });
});
