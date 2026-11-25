import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatutoryFinancialsApiService } from '@core';
import { dossier, eligibility, lookups, summary, wrap } from './statutory-financials.testing';
import { WizardStore } from './wizard.store';

describe('WizardStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof WizardStore>;

  beforeEach(() => {
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      getDossier: vi.fn(() => of(wrap(dossier('d-1')))),
      createDossier: vi.fn(() => of(wrap(summary('d-new')))),
      updateDossier: vi.fn((id: string) =>
        of(wrap(summary(id, { accounting_standard: 'IT_OIC_Abbreviato' }))),
      ),
      getEligibility: vi.fn(() => of(wrap(eligibility()))),
    };
    TestBed.configureTestingModule({
      providers: [WizardStore, { provide: StatutoryFinancialsApiService, useValue: api }],
    });
    store = TestBed.inject(WizardStore);
  });

  it('loads the lookups only when creating', async () => {
    await store.init(null, 'en');

    expect(store.fiscalYears()).toHaveLength(2);
    expect(store.standards()).toHaveLength(2);
    expect(store.roundingModes()).toHaveLength(2);
    expect(api['getDossier']).not.toHaveBeenCalled();
    expect(store.dossier()).toBeNull();
  });

  it('loads the dossier to edit', async () => {
    await store.init('d-1');

    expect(api['getDossier']).toHaveBeenCalledWith('d-1');
    expect(store.existing()?.id).toBe('d-1');
    expect(store.dossier()?.id).toBe('d-1');
  });

  it('keeps the error key when the lookups cannot be read', async () => {
    api['getLookups']?.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'generic' } })),
    );

    await store.init(null);

    expect(store.error()).toBe('statutoryFinancials.error.generic');
  });

  it('creates the dossier the first time and updates it afterwards', async () => {
    const first = await store.save({
      fiscal_year_id: 'fy-2025',
      accounting_standard: 'IT_OIC_Ordinario',
    });

    expect(first.ok).toBe(true);
    expect(api['createDossier']).toHaveBeenCalledTimes(1);
    expect(store.dossier()?.id).toBe('d-new');

    await store.save({ title: 'Renamed' });

    expect(api['createDossier']).toHaveBeenCalledTimes(1);
    expect(api['updateDossier']).toHaveBeenCalledWith('d-new', { title: 'Renamed' });
  });

  it('answers the refusal of a save with its error key', async () => {
    api['createDossier']?.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { code: 'comparative_year_same' } }),
      ),
    );

    const outcome = await store.save({ fiscal_year_id: 'fy-2025' });

    expect(outcome).toMatchObject({
      ok: false,
      errorKey: 'statutoryFinancials.error.comparative_year_same',
    });
    expect(store.saving()).toBe(false);
  });

  it('runs the threshold check on the saved dossier', async () => {
    await store.save({ fiscal_year_id: 'fy-2025' });

    await store.checkEligibility('IT_OIC_Ordinario');

    expect(api['getEligibility']).toHaveBeenCalledWith('d-new', 'IT_OIC_Ordinario');
    expect(store.eligibility()?.recommended_standard).toBe('IT_OIC_Abbreviato');
    expect(store.checking()).toBe(false);
  });

  it('does nothing when there is no dossier to check yet', async () => {
    const outcome = await store.checkEligibility();

    expect(outcome.ok).toBe(true);
    expect(api['getEligibility']).not.toHaveBeenCalled();
  });

  it('switches to the recommended standard with a PUT and checks again', async () => {
    await store.save({ fiscal_year_id: 'fy-2025' });
    await store.checkEligibility('IT_OIC_Ordinario');

    const outcome = await store.switchToRecommended();

    expect(outcome.ok).toBe(true);
    expect(api['updateDossier']).toHaveBeenCalledWith('d-new', {
      accounting_standard: 'IT_OIC_Abbreviato',
    });
    expect(api['getEligibility']).toHaveBeenLastCalledWith('d-new', 'IT_OIC_Abbreviato');
    expect(store.dossier()?.accounting_standard).toBe('IT_OIC_Abbreviato');
  });
});
