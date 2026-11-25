import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatutoryFinancialsApiService } from '@core';
import { dossier, lookups, summary, wrap } from './statutory-financials.testing';
import { WorkspaceStore } from './workspace.store';

describe('WorkspaceStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof WorkspaceStore>;

  beforeEach(() => {
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      getDossier: vi.fn(() => of(wrap(dossier('d-1')))),
      generate: vi.fn(() => of(wrap(dossier('d-1', { status: 'reclassified' })))),
      generateCashFlow: vi.fn(() => of(wrap(dossier('d-1', { cash_flow_method: 'direct' })))),
      transitionDossier: vi.fn(() => of(wrap(summary('d-1', { status: 'locked' })))),
    };
    TestBed.configureTestingModule({
      providers: [WorkspaceStore, { provide: StatutoryFinancialsApiService, useValue: api }],
    });
    store = TestBed.inject(WorkspaceStore);
  });

  it('loads the lookups and the dossier and derives the standard, the jurisdiction and the scale', async () => {
    await store.load('d-1', 'de');

    expect(api['getLookups']).toHaveBeenCalledWith('de');
    expect(store.dossier()?.id).toBe('d-1');
    expect(store.standardLookup()?.cash_flow_label).toBe('OIC 10');
    expect(store.jurisdiction()).toBe('IT');
    expect(store.scale()).toBe(0);
    expect(store.editable()).toBe(true);
    expect(store.labels()['report.balance_sheet']?.title).toBe('Stato patrimoniale');
  });

  it('takes the scale from the rounding mode until the statements are generated', async () => {
    api['getDossier']?.mockReturnValue(
      of(
        wrap(dossier('d-1', { quadrature: null, rounding_to_unit_mode: 'IntegerUnits_Euro_Chf' })),
      ),
    );
    await store.load('d-1');
    expect(store.scale()).toBe(0);
  });

  it('keeps the error key when the dossier cannot be read', async () => {
    api['getDossier']?.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'generic' } })),
    );

    await store.load('d-9');

    expect(store.error()).toBe('statutoryFinancials.error.generic');
    expect(store.loading()).toBe(false);
  });

  it('replaces the dossier with the one the generation answers', async () => {
    await store.load('d-1');

    const outcome = await store.generate();

    expect(api['generate']).toHaveBeenCalledWith('d-1');
    expect(outcome.ok).toBe(true);
    expect(store.status()).toBe('reclassified');
    expect(store.busy()).toBe(false);
  });

  it('generates the cash flow with the chosen method', async () => {
    await store.load('d-1');

    await store.generateCashFlow('direct');

    expect(api['generateCashFlow']).toHaveBeenCalledWith('d-1', 'direct');
    expect(store.dossier()?.cash_flow_method).toBe('direct');
  });

  it('answers the refusal of the generation and keeps the dossier', async () => {
    await store.load('d-1');
    api['generate']?.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'dossier_locked' } })),
    );

    const outcome = await store.generate();

    expect(outcome).toMatchObject({
      ok: false,
      errorKey: 'statutoryFinancials.error.dossier_locked',
    });
    expect(store.dossier()?.status).toBe('draft');
    expect(store.busy()).toBe(false);
  });

  it('moves the lifecycle and reads the dossier again', async () => {
    await store.load('d-1');
    api['getDossier']?.mockReturnValue(of(wrap(dossier('d-1', { status: 'locked' }))));

    const outcome = await store.transition('locked');

    expect(api['transitionDossier']).toHaveBeenCalledWith('d-1', 'locked', undefined);
    expect(outcome.ok).toBe(true);
    expect(store.locked()).toBe(true);
    expect(store.editable()).toBe(false);
    expect(store.actions().find((action) => action.name === 'reopen')?.enabled).toBe(true);
  });

  it('sends the filing reference', async () => {
    await store.load('d-1');

    await store.transition('filed', 'REA-1');

    expect(api['transitionDossier']).toHaveBeenCalledWith('d-1', 'filed', 'REA-1');
  });

  it('answers a refused transition with its error key', async () => {
    await store.load('d-1');
    api['transitionDossier']?.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { code: 'filing_requires_valid_xbrl' } }),
      ),
    );

    const outcome = await store.transition('filed', 'REA-1');

    expect(outcome.errorKey).toBe('statutoryFinancials.error.filing_requires_valid_xbrl');
  });

  it('refreshes quietly without the spinner', async () => {
    await store.load('d-1');
    api['getDossier']?.mockClear();

    await store.refresh();

    expect(api['getDossier']).toHaveBeenCalledWith('d-1');
    expect(store.loading()).toBe(false);
  });
});
