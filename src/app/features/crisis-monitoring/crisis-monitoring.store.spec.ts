import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrisisMonitoringApiService } from '@core';
import {
  dashboard,
  loans,
  metadata,
  profile,
  requirement,
  stressResult,
} from './crisis-monitoring.fixtures';
import { CrisisMonitoringStore } from './crisis-monitoring.store';

describe('CrisisMonitoringStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      getDashboard: vi.fn(() => of({ data: dashboard })),
      compute: vi.fn(() => of({ data: { ...dashboard, overall_status: 'red' } })),
      getRequirement: vi.fn(() => of({ data: requirement })),
      stressTest: vi.fn(() => of({ data: stressResult })),
      downloadDossier: vi.fn(() => of(new Blob(['pdf']))),
      getProfile: vi.fn(() => of({ data: profile })),
      updateProfile: vi.fn(() => of({ data: { ...profile, employees_count: 20 } })),
      getMetadata: vi.fn(() => of({ data: metadata })),
      listLoans: vi.fn(() => of({ data: loans })),
      createLoan: vi.fn(() => of({ data: loans[0] })),
      updateLoan: vi.fn(() => of({ data: loans[0] })),
      deleteLoan: vi.fn(() => of({ data: null })),
      downloadAgreement: vi.fn(() => of(new Blob(['pdf']))),
    };
    TestBed.configureTestingModule({
      providers: [CrisisMonitoringStore, { provide: CrisisMonitoringApiService, useValue: api }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the workspace and follows the jurisdiction of the API', async () => {
    const store = TestBed.inject(CrisisMonitoringStore);
    await store.init();

    expect(store.dashboard()?.overall_status).toBe('yellow');
    expect(store.view()).toBe('IT');
    expect(store.loans()).toHaveLength(1);
    expect(store.metadata()?.dscr_bands.red_below).toBe('1.00');
    expect(store.selectedDscr()?.value).toBe('1.30');

    store.setJurisdictionView('CH');
    store.setHorizon('m12');
    store.setApproach('operating');

    expect(store.view()).toBe('CH');
    expect(store.selectedDscr()?.applicable).toBe(false);
  });

  it('reports a failed load with a key', async () => {
    api['getDashboard'].mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const store = TestBed.inject(CrisisMonitoringStore);
    await store.refresh();

    expect(store.error()).toBe('crisis.error.load');
    expect(store.loading()).toBe(false);
  });

  it('recomputes the snapshots', async () => {
    const store = TestBed.inject(CrisisMonitoringStore);
    const outcome = await store.compute();

    expect(outcome.ok).toBe(true);
    expect(store.dashboard()?.overall_status).toBe('red');
    expect(store.computing()).toBe(false);
  });

  it('sends only the changed profile keys', async () => {
    const store = TestBed.inject(CrisisMonitoringStore);
    await store.init();
    const outcome = await store.saveProfile({ ...profile, employees_count: 20 });

    expect(outcome.ok).toBe(true);
    expect(api['updateProfile']).toHaveBeenCalledWith({ employees_count: 20 });
    expect(store.profile()?.employees_count).toBe(20);
  });

  it('creates, updates and deletes loans, refreshing the lists', async () => {
    const store = TestBed.inject(CrisisMonitoringStore);
    const payload = { ...loans[0] };

    await store.saveLoan(null, payload);
    expect(api['createLoan']).toHaveBeenCalled();

    await store.saveLoan('loan-1', payload);
    expect(api['updateLoan']).toHaveBeenCalledWith('loan-1', payload);

    await store.deleteLoan('loan-1');
    expect(api['deleteLoan']).toHaveBeenCalledWith('loan-1');
    expect(api['listLoans']).toHaveBeenCalledTimes(3);
  });

  it('returns the failure of a mutation', async () => {
    api['deleteLoan'].mockReturnValueOnce(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { message: 'crisisApi.locked' } }),
      ),
    );
    const store = TestBed.inject(CrisisMonitoringStore);
    const outcome = await store.deleteLoan('loan-1');

    expect(outcome).toEqual({ ok: false, error: 'crisisApi.locked' });
    expect(store.saving()).toBe(false);
  });

  it('calculates the required subordination', async () => {
    const store = TestBed.inject(CrisisMonitoringStore);
    await store.calculateRequirement(12, '4', 'liquidation');

    expect(api['getRequirement']).toHaveBeenCalledWith({
      horizon_months: 12,
      interest_rate: '4',
      basis: 'liquidation',
    });
    expect(store.requirement()?.court_notification_required).toBe(true);
  });

  it('debounces the stress test and skips it for the neutral levers', async () => {
    const store = TestBed.inject(CrisisMonitoringStore);

    store.setStress({ revenue_drop_percent: 10 });
    store.setStress({ revenue_drop_percent: 20 });
    expect(api['stressTest']).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(api['stressTest']).toHaveBeenCalledTimes(1);
    expect(api['stressTest']).toHaveBeenCalledWith(
      expect.objectContaining({ revenue_drop_percent: 20 }),
    );
    expect(store.stressResult()?.deltas.dscr_treasury_m6).toBe('-0.60');

    store.setStress({ revenue_drop_percent: 0 });
    await vi.advanceTimersByTimeAsync(500);
    expect(api['stressTest']).toHaveBeenCalledTimes(1);
    expect(store.stressResult()).toBeNull();
  });

  it('downloads the dossier and the agreement with their file names', async () => {
    const store = TestBed.inject(CrisisMonitoringStore);
    await store.refresh();

    const dossier = await store.downloadDossier('it');
    const agreement = await store.downloadAgreement(loans[0], 'de');

    expect(dossier.filename).toBe('crisis-board-dossier-2026-11-28-it.pdf');
    expect(dossier.blob).toBeInstanceOf(Blob);
    expect(agreement.filename).toBe('rangruecktritt-mario-rossi-de.pdf');
  });
});
