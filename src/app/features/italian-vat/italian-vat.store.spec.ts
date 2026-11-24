import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnualVat, ItalianVatApiService, LipeCommunication, PlafondRow } from '@core';
import { ItalianVatStore } from './italian-vat.store';

const envelope = <T>(data: T) => ({ success: true, message: '', data });

const declaration = (overrides: Partial<PlafondRow> = {}): PlafondRow => ({
  id: 'd1',
  contact_id: 'c1',
  contact_name: 'Export Srl',
  protocol_number: '12345678901234567',
  valid_from: '2026-01-01',
  valid_to: '2026-12-31',
  plafond: '100.00',
  consumed: '10.00',
  residual: '90.00',
  usage_percentage: '10.00',
  status: 'active',
  alert: 'ok',
  days_to_expiry: 10,
  ...overrides,
});

const annual = (overrides: Partial<AnnualVat> = {}): AnnualVat => ({
  id: 'a1',
  year: 2025,
  status: 'calculated',
  periods: [],
  total_output_vat: '0.00',
  total_input_vat: '0.00',
  pro_rata_percentage: 100,
  pro_rata_adjustment: '0.00',
  prior_year_credit: '0.00',
  interest_total: '0.00',
  paid_total: '0.00',
  annual_debit: '0.00',
  annual_credit: '0.00',
  ledger_balance: '0.00',
  difference: '0.00',
  is_reconciled: true,
  diagnostics: null,
  finalized_at: null,
  ...overrides,
});

describe('ItalianVatStore', () => {
  const api = {
    getSections: vi.fn(),
    getRegister: vi.fn(),
    getPrints: vi.fn(),
    getProRata: vi.fn(),
    printRegister: vi.fn(),
    previewVentilation: vi.fn(),
    registerVentilation: vi.fn(),
    getGoodsMovements: vi.fn(),
    getGoodsBalances: vi.fn(),
    createGoodsMovement: vi.fn(),
    getPlafondMonitor: vi.fn(),
    checkPlafond: vi.fn(),
    revokeDeclaration: vi.fn(),
    getLipeList: vi.fn(),
    generateLipe: vi.fn(),
    reconcileLipe: vi.fn(),
    signLipe: vi.fn(),
    markLipeReady: vi.fn(),
    getAnnualVat: vi.fn(),
    calculateAnnualVat: vi.fn(),
    finalizeAnnualVat: vi.fn(),
    getCertifications: vi.fn(),
    validateCertifications: vi.fn(),
    getF24: vi.fn(),
    getF24Reconciliation: vi.fn(),
    buildCertifications: vi.fn(),
    issueCertifications: vi.fn(),
    syncF24: vi.fn(),
    payF24: vi.fn(),
  };
  let store: InstanceType<typeof ItalianVatStore>;

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    TestBed.configureTestingModule({
      providers: [ItalianVatStore, { provide: ItalianVatApiService, useValue: api }],
    });
    store = TestBed.inject(ItalianVatStore);
  });

  it('loads a register with its prints and detects the locked entries', async () => {
    api.getRegister.mockReturnValue(
      of(
        envelope({
          section: {},
          entries: [{ id: 'e1', is_locked: true }],
          by_rate: [],
          by_nature: [],
          totals: {},
        }),
      ),
    );
    api.getPrints.mockReturnValue(of(envelope([{ id: 'p1' }])));
    await store.loadRegister('s1', { from: '2026-01-01', to: '2026-03-31' });
    expect(api.getPrints).toHaveBeenCalledWith({ section_id: 's1' });
    expect(store.prints()).toHaveLength(1);
    expect(store.registerLocked()).toBe(true);
  });

  it('prints definitively up to the end of the range and reloads the register', async () => {
    api.printRegister.mockReturnValue(of(envelope({ id: 'p1' })));
    api.getRegister.mockReturnValue(
      of(envelope({ section: {}, entries: [], by_rate: [], by_nature: [], totals: {} })),
    );
    api.getPrints.mockReturnValue(of(envelope([])));
    expect(await store.printRegister('s1', 2026, { from: '2026-01-01', to: '2026-03-31' })).toBe(
      true,
    );
    expect(api.printRegister).toHaveBeenCalledWith('s1', { year: 2026, period_to: '2026-03-31' });
    expect(api.getRegister).toHaveBeenCalledTimes(1);
  });

  it('keeps the problem when the print is refused and does not reload', async () => {
    const problem = new HttpErrorResponse({
      status: 409,
      error: { invalid_params: [{ code: 'print_protocol_gap', params: {} }] },
    });
    api.printRegister.mockReturnValue(throwError(() => problem));
    expect(await store.printRegister('s1', 2026, { from: '2026-01-01', to: '2026-03-31' })).toBe(
      false,
    );
    expect(store.error()).toBe(problem);
    expect(api.getRegister).not.toHaveBeenCalled();
    expect(store.saving()).toBe(false);
  });

  it('clears the ventilation preview once the takings are registered', async () => {
    const request = {
      entry_date: '2026-01-02',
      gross_takings: '100.00',
      purchase_basis: [{ rate: '22', amount: '50.00' }],
    };
    api.previewVentilation.mockReturnValue(
      of(envelope({ lines: [], total_taxable: '82.00', total_vat: '18.00' })),
    );
    await store.previewVentilation(request);
    expect(store.ventilation()?.total_vat).toBe('18.00');
    api.registerVentilation.mockReturnValue(of(envelope({ entries: [] })));
    expect(await store.registerVentilation(request)).toBe(true);
    expect(store.ventilation()).toBeNull();
  });

  it('loads movements and balances of the goods register together', async () => {
    api.getGoodsMovements.mockReturnValue(of(envelope([{ id: 'm1' }])));
    api.getGoodsBalances.mockReturnValue(
      of(
        envelope([
          {
            contact_id: 'c1',
            description: 'Wine',
            unit: 'kg',
            held_quantity: '3.00',
            held_value: '30.00',
          },
        ]),
      ),
    );
    await store.loadGoods({ from: '2026-01-01', to: '2026-12-31' }, '2026-12-31');
    expect(store.movements()).toHaveLength(1);
    expect(store.balances()[0]?.held_quantity).toBe('3.00');
  });

  it('lists the declarations that block VAT-free invoicing', async () => {
    api.getPlafondMonitor.mockReturnValue(
      of(
        envelope({
          year: 2026,
          as_of: '2026-06-01',
          declarations: [
            declaration(),
            declaration({ id: 'd2', status: 'revoked' }),
            declaration({ id: 'd3', status: 'exhausted' }),
          ],
          totals: { plafond: '300.00', consumed: '30.00', residual: '270.00' },
        }),
      ),
    );
    await store.loadPlafond(2026);
    expect(store.blockedDeclarations().map((d) => d.id)).toEqual(['d2', 'd3']);
  });

  it('revokes a declaration and reloads the monitor', async () => {
    api.revokeDeclaration.mockReturnValue(
      of(envelope({ id: 'd1', revoked_at: '2026-06-01T00:00:00Z' })),
    );
    api.getPlafondMonitor.mockReturnValue(
      of(
        envelope({
          year: 2026,
          as_of: '',
          declarations: [],
          totals: { plafond: '0', consumed: '0', residual: '0' },
        }),
      ),
    );
    expect(await store.revokeDeclaration('d1', 2026, null)).toBe(true);
    expect(api.getPlafondMonitor).toHaveBeenCalledWith(2026);
  });

  it('keeps the assessment of the plafond guard', async () => {
    api.checkPlafond.mockReturnValue(
      of(
        envelope({
          covered: false,
          error_code: 'plafond_exceeded',
          residual: '5.00',
          requested: '10.00',
        }),
      ),
    );
    await store.checkPlafond({ contact_id: 'c1', date: '2026-06-01', amount: 10 });
    expect(store.assessment()?.covered).toBe(false);
    expect(store.assessment()?.error_code).toBe('plafond_exceeded');
  });

  it('replaces a LIPE communication in place after each step of the flow', async () => {
    const draft = {
      id: 'l1',
      status: 'validated',
      reconciliation_status: 'balanced',
    } as LipeCommunication;
    api.getLipeList.mockReturnValue(
      of(envelope([draft, { id: 'l2', status: 'draft', reconciliation_status: 'balanced' }])),
    );
    await store.loadLipe(2026);
    api.signLipe.mockReturnValue(of(envelope({ ...draft, status: 'signed' })));
    expect(await store.signLipe('l1', 'sig', 'cert')).toBe(true);
    expect(store.lipe().map((l) => l.status)).toEqual(['signed', 'draft']);
    api.markLipeReady.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422 })));
    expect(await store.markLipeReady('l1')).toBe(false);
    expect(store.lipe()[0]?.status).toBe('signed');
  });

  it('treats a missing annual VAT as not calculated, not as an error', async () => {
    api.getAnnualVat.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    await store.loadAnnual(2025);
    expect(store.annual()).toBeNull();
    expect(store.error()).toBeNull();
    api.getAnnualVat.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await store.loadAnnual(2025);
    expect(store.error()).toBeInstanceOf(HttpErrorResponse);
  });

  it('calculates the annual VAT and only allows finalising a reconciled, open year', async () => {
    api.calculateAnnualVat.mockReturnValue(of(envelope(annual({ is_reconciled: false }))));
    await store.calculateAnnual(2025);
    expect(store.annualFinalizable()).toBe(false);
    api.calculateAnnualVat.mockReturnValue(of(envelope(annual())));
    await store.calculateAnnual(2025);
    expect(store.annualFinalizable()).toBe(true);
    api.finalizeAnnualVat.mockReturnValue(
      of(envelope(annual({ finalized_at: '2026-02-01T00:00:00Z' }))),
    );
    await store.finalizeAnnual(2025);
    expect(store.annualFinalizable()).toBe(false);
  });

  it('loads certifications with their validation and F24 reconciliation', async () => {
    api.getCertifications.mockReturnValue(
      of(envelope([{ id: 'c1', status: 'validated', validation_errors: null }])),
    );
    api.validateCertifications.mockReturnValue(of(envelope({ valid: true, errors: [] })));
    api.getF24.mockReturnValue(
      of(envelope([{ id: 'f1', amount_due: '100.00', amount_paid: '0.00', status: 'due' }])),
    );
    api.getF24Reconciliation.mockReturnValue(
      of(
        envelope({
          year: 2025,
          certified_withheld: '100.00',
          f24_due: '100.00',
          f24_paid: '0.00',
          due_difference: '0.00',
        }),
      ),
    );
    await store.loadCertifications(2025);
    expect(store.cuIssuable()).toBe(true);
    expect(store.cuValidation()?.valid).toBe(true);
    expect(store.f24Unpaid()).toHaveLength(1);
    expect(store.f24Reconciliation()?.f24_paid).toBe('0.00');
  });

  it('reloads the certifications after building and after a payment', async () => {
    api.buildCertifications.mockReturnValue(of(envelope([])));
    api.payF24.mockReturnValue(of(envelope({ id: 'f1' })));
    api.getCertifications.mockReturnValue(of(envelope([])));
    api.validateCertifications.mockReturnValue(of(envelope({ valid: true, errors: [] })));
    api.getF24.mockReturnValue(of(envelope([])));
    api.getF24Reconciliation.mockReturnValue(of(envelope({})));
    expect(await store.buildCertifications(2025)).toBe(true);
    expect(await store.payF24('f1', { amount: 10, paid_at: '2026-01-16' }, 2025)).toBe(true);
    expect(api.getCertifications).toHaveBeenCalledTimes(2);
  });
});
