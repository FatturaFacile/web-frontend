import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IcPackage, IntercompanyApiService } from '@core';
import { IntercompanyStatementsStore } from './intercompany-statements.store';

const ok = <T>(data: T) => of({ success: true, message: '', data });

const PACKAGE: IcPackage = {
  id: 'p1',
  run_id: 'run-1234567890',
  standard: 'ifrs10',
  checksum: 'abc',
  generated_at: '2026-12-31T10:00:00Z',
  sections: ['balance_sheet', 'income_statement', 'cash_flow'],
};

describe('IntercompanyStatementsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof IntercompanyStatementsStore>;

  beforeEach(() => {
    api = {
      getStatements: vi.fn((_run: string, standard: string) =>
        ok({ run_id: 'r1', standard, currency: 'CHF' }),
      ),
      getShareholdings: vi.fn(() => ok({ currency: 'CHF', rows: [] })),
      getNciSchedule: vi.fn(() =>
        ok({
          currency: 'CHF',
          rows: [],
          total_nci_net_assets: '0.0000',
          total_nci_profit: '0.0000',
        }),
      ),
      getPackages: vi.fn(() => ok([PACKAGE])),
      createPackage: vi.fn(() => ok(PACKAGE)),
      downloadPackage: vi.fn(() => of(new Blob(['x']))),
    };
    TestBed.configureTestingModule({
      providers: [IntercompanyStatementsStore, { provide: IntercompanyApiService, useValue: api }],
    });
    store = TestBed.inject(IntercompanyStatementsStore);
  });

  it('opens with the Swiss GAAP FER 30 statements of the run', async () => {
    await store.load('r1');

    expect(api['getStatements']).toHaveBeenCalledWith('r1', 'fer30');
    expect(store.statements()?.standard).toBe('fer30');
    expect(store.shareholdings()?.currency).toBe('CHF');
    expect(store.nci()).not.toBeNull();
    expect(store.packages()).toHaveLength(1);
  });

  it('switches the standard without reloading the schedules', async () => {
    await store.load('r1');

    await store.loadStatements('r1', 'oic17');

    expect(store.standard()).toBe('oic17');
    expect(store.statements()?.standard).toBe('oic17');
    expect(api['getShareholdings']).toHaveBeenCalledTimes(1);
  });

  it('generates a package for the standard on screen', async () => {
    await store.load('r1', 'ifrs10');

    const result = await store.generate('r1');

    expect(api['createPackage']).toHaveBeenCalledWith('r1', 'ifrs10');
    expect(result.package?.id).toBe('p1');
    expect(store.packages()).toHaveLength(2);
    expect(store.generating()).toBe(false);
  });

  it('downloads a package in the chosen format', async () => {
    const createUrl = vi.fn(() => 'blob:x');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const outcome = await store.download(PACKAGE, 'xlsx');

    expect(api['downloadPackage']).toHaveBeenCalledWith('p1', 'xlsx');
    expect(outcome.ok).toBe(true);
    expect(click).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith('blob:x');
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('changes the statement tab', () => {
    store.selectTab('cash_flow');

    expect(store.tab()).toBe('cash_flow');
  });
});
