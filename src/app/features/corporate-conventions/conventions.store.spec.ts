import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CorporateConventionsApiService } from '@core';
import { convention, lookups, page, wrap } from './corporate-conventions.testing';
import { emptyConvention } from './corporate-conventions.util';
import { ConventionsStore } from './conventions.store';

describe('ConventionsStore', () => {
  const api = {
    getLookups: vi.fn(),
    listConventions: vi.fn(),
    getConvention: vi.fn(),
    getIdentifierStats: vi.fn(),
    createConvention: vi.fn(),
    updateConvention: vi.fn(),
    transitionConvention: vi.fn(),
    deleteConvention: vi.fn(),
    importIdentifiers: vi.fn(),
    uploadContract: vi.fn(),
    uploadLogo: vi.fn(),
  };
  let store: InstanceType<typeof ConventionsStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getLookups.mockReturnValue(of(wrap(lookups)));
    api.listConventions.mockReturnValue(of(page([convention('1'), convention('2')], 2)));
    api.getIdentifierStats.mockReturnValue(of(wrap({ total: 10, used: 3 })));
    TestBed.configureTestingModule({
      providers: [ConventionsStore, { provide: CorporateConventionsApiService, useValue: api }],
    });
    store = TestBed.inject(ConventionsStore);
  });

  it('loads the lookups and the first page on init', async () => {
    await store.init();

    expect(store.partnerTypes()).toEqual(['CORPORATE', 'CRAL']);
    expect(store.priceLists()).toHaveLength(1);
    expect(store.conventions()).toHaveLength(2);
    expect(store.total()).toBe(2);
    expect(api.listConventions).toHaveBeenCalledWith({ per_page: 25, page: 1 });
  });

  it('applies filters from the first page', async () => {
    await store.init();
    await store.setPage(3);
    await store.setFilters({ country_code: 'CH', status: 'ACTIVE' });

    expect(api.listConventions).toHaveBeenLastCalledWith({
      per_page: 25,
      page: 1,
      country_code: 'CH',
      status: 'ACTIVE',
    });
  });

  it('opens a convention with its matrix and the size of the employer list', async () => {
    api.getConvention.mockReturnValue(of(wrap(convention('1'))));

    const outcome = await store.open('1');

    expect(outcome.ok).toBe(true);
    expect(store.detail()?.id).toBe('1');
    expect(store.identifierStats()).toEqual({ total: 10, used: 3 });
    store.closeDetail();
    expect(store.detail()).toBeNull();
  });

  it('keeps the created convention open and reloads the list', async () => {
    api.createConvention.mockReturnValue(of(wrap(convention('9'))));
    await store.init();

    const outcome = await store.create(emptyConvention());

    expect(outcome.ok).toBe(true);
    expect(store.detail()?.id).toBe('9');
    expect(api.listConventions).toHaveBeenCalledTimes(2);
    expect(store.saving()).toBe(false);
  });

  it('reports a refused activation with its translation key and parameters', async () => {
    api.transitionConvention.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              code: 'convention_verification_data_missing',
              params: { method: 'WORK_EMAIL_OTP' },
            },
          }),
      ),
    );

    const refused = await store.transition('1', 'ACTIVE');

    expect(refused.ok).toBe(false);
    expect(refused.errorKey).toBe(
      'corporateConventions.error.convention_verification_data_missing',
    );
    expect(refused.params).toEqual({ method: 'WORK_EMAIL_OTP' });
    expect(store.saving()).toBe(false);
  });

  it('previews the hashing of the employer list without storing and refreshes the counters after a real import', async () => {
    api.importIdentifiers.mockReturnValue(
      of(
        wrap({
          received: 3,
          imported: 2,
          duplicates: 1,
          invalid: 0,
          preview: [{ hint: '***001', sha256: 'a'.repeat(64) }],
        }),
      ),
    );

    await store.importIdentifiers('1', ['A001', 'A002', 'A001'], true);
    expect(api.importIdentifiers).toHaveBeenLastCalledWith('1', ['A001', 'A002', 'A001'], true);
    expect(store.importPreview()?.imported).toBe(2);
    expect(api.getIdentifierStats).not.toHaveBeenCalled();

    await store.importIdentifiers('1', ['A001', 'A002'], false);
    expect(api.getIdentifierStats).toHaveBeenCalledWith('1');
    expect(store.identifierStats()).toEqual({ total: 10, used: 3 });
  });

  it('stores the contract and the logo on the open convention', async () => {
    api.uploadContract.mockReturnValue(of(wrap(convention('1', { has_contract_document: true }))));
    api.uploadLogo.mockReturnValue(
      of(wrap(convention('1', { has_contract_document: true, has_logo: true }))),
    );
    await store.init();

    await store.uploadContract(
      '1',
      new File(['%PDF'], 'contract.pdf', { type: 'application/pdf' }),
    );
    expect(store.detail()?.has_contract_document).toBe(true);
    await store.uploadLogo('1', new File(['x'], 'logo.png', { type: 'image/png' }));
    expect(store.detail()?.has_logo).toBe(true);
  });
});
