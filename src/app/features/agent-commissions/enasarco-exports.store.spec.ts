import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCommissionsApiService } from '@core';
import { enasarcoRow } from './agent-commissions.testing';
import { EnasarcoStore } from './enasarco.store';
import { ExportsStore } from './exports.store';

describe('EnasarcoStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof EnasarcoStore>;

  beforeEach(() => {
    api = {
      getEnasarcoOverview: vi.fn(() =>
        of({
          success: true,
          message: 'OK',
          data: [
            enasarcoRow('a-1'),
            enasarcoRow('a-2', { massimale_reached: true, massimale_remaining: '0.00' }),
            enasarcoRow('a-3', { minimale_reached: false, minimale_shortfall: '120.00' }),
            enasarcoRow('a-4', { massimale: null, minimale: null, minimale_reached: false }),
          ],
          meta: { year: 2026 },
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [EnasarcoStore, { provide: AgentCommissionsApiService, useValue: api }],
    });
    store = TestBed.inject(EnasarcoStore);
  });

  it('loads the position of the current year', async () => {
    await store.init();

    expect(api['getEnasarcoOverview']).toHaveBeenCalledWith(new Date().getFullYear());
    expect(store.rows()).toHaveLength(4);
    expect(store.loading()).toBe(false);
  });

  it('counts the agents that reached the ceiling and the ones short of the floor', async () => {
    await store.init();

    expect(store.reachedCount()).toBe(1);
    // An agent without a floor is not short of it.
    expect(store.shortfallCount()).toBe(1);
  });

  it('reloads for the year picked', async () => {
    await store.setYear(2025);

    expect(store.year()).toBe(2025);
    expect(api['getEnasarcoOverview']).toHaveBeenLastCalledWith(2025);
  });

  it('reports a failed load', async () => {
    api['getEnasarcoOverview'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: {} })),
    );

    await store.init();

    expect(store.error()).toBe('agentCommissions.error.generic');
    expect(store.loading()).toBe(false);
  });
});

describe('ExportsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof ExportsStore>;

  beforeEach(() => {
    api = {
      exportCu: vi.fn(() => of(new Blob(['cu']))),
      exportEnasarco: vi.fn(() => of(new Blob(['enasarco']))),
    };
    TestBed.configureTestingModule({
      providers: [ExportsStore, { provide: AgentCommissionsApiService, useValue: api }],
    });
    store = TestBed.inject(ExportsStore);
  });

  it('downloads the CU data of the year with the file name of the API', async () => {
    store.setYear(2025);

    const file = await store.exportCu();

    expect(api['exportCu']).toHaveBeenCalledWith(2025);
    expect(file.ok).toBe(true);
    expect(file.blob).toBeInstanceOf(Blob);
    expect(file.filename).toBe('cu-agents-2025.csv');
    expect(store.exporting()).toBeNull();
  });

  it('downloads the Enasarco trace of a quarter, or of the whole year', async () => {
    store.setYear(2026);
    store.setQuarter(2);

    const quarter = await store.exportEnasarco();
    expect(api['exportEnasarco']).toHaveBeenLastCalledWith(2026, 2);
    expect(quarter.filename).toBe('enasarco-2026-q2.csv');

    store.setQuarter(null);
    const year = await store.exportEnasarco();
    expect(api['exportEnasarco']).toHaveBeenLastCalledWith(2026, null);
    expect(year.filename).toBe('enasarco-2026.csv');
  });

  it('shows the loading state of the export that is running', async () => {
    let seen: string | null = null;
    api['exportCu'].mockImplementation(() => {
      seen = store.exporting();
      return of(new Blob(['cu']));
    });

    await store.exportCu();

    expect(seen).toBe('cu');
  });

  it('keeps the translated refusal of a failed export, read from the Blob of the answer', async () => {
    api['exportCu'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: new Blob([JSON.stringify({ code: 'generic' })], { type: 'application/json' }),
          }),
      ),
    );

    const file = await store.exportCu();

    expect(file.ok).toBe(false);
    expect(file.blob).toBeNull();
    expect(store.error()).toBe('agentCommissions.error.generic');
    expect(store.exporting()).toBeNull();
  });
});
