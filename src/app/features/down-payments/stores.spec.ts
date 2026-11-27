import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DownPaymentsApiService } from '@core';
import {
  dpChain,
  dpInstallment,
  dpPlanPreview,
  dpSettlement,
} from '../../../testing/down-payments-fixtures';
import { ChainStore } from './chain.store';
import { ChainsStore } from './chains.store';

const envelope = <T>(data: T, meta?: object) => of({ success: true, message: '', data, meta });
const problem = (code: string, status = 422) =>
  throwError(
    () =>
      new HttpErrorResponse({
        status,
        error: { code, detail: 'Refused', params: { contract_gross: '1220.00' } },
      }),
  );

describe('down payments stores', () => {
  const api = {
    getLookups: vi.fn(),
    listChains: vi.fn(),
    getChain: vi.fn(),
    previewPlan: vi.fn(),
    createFromSource: vi.fn(),
    cancelChain: vi.fn(),
    emitInstallment: vi.fn(),
    confirmProformaPayment: vi.fn(),
    previewFinalSettlement: vi.fn(),
    generateFinalSettlement: vi.fn(),
    previewCreditNote: vi.fn(),
    issueCreditNote: vi.fn(),
    confirmDepositPayment: vi.fn(),
    previewDepositResolution: vi.fn(),
    resolveDeposit: vi.fn(),
  };

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    TestBed.configureTestingModule({
      providers: [ChainStore, ChainsStore, { provide: DownPaymentsApiService, useValue: api }],
    });
  });

  describe('ChainsStore', () => {
    it('loads the chains with the filters and totals the page per currency', async () => {
      api.listChains.mockReturnValue(
        envelope(
          [
            dpChain({
              id: 'a',
              total_contract_gross: '1220.00',
              total_advance_invoiced_gross: '366.00',
              total_earnest_deposits_held: '100.00',
              residual_order_gross: '754.00',
            }),
            dpChain({
              id: 'b',
              total_contract_gross: '780.00',
              total_advance_invoiced_gross: '0.00',
              total_security_deposits_held: '50.00',
              residual_order_gross: '780.00',
            }),
            dpChain({
              id: 'c',
              currency: 'CHF',
              jurisdiction: 'CH',
              total_contract_gross: '500.00',
            }),
          ],
          { total: 3, current_page: 1 },
        ),
      );
      const store = TestBed.inject(ChainsStore);

      await store.load({ country: 'IT', per_page: 25 });

      expect(api.listChains).toHaveBeenCalledWith({ country: 'IT', per_page: 25 });
      expect(store.chains()).toHaveLength(3);
      expect(store.meta()?.total).toBe(3);
      const eur = store.totals().find((total) => total.currency === 'EUR');
      expect(eur).toMatchObject({
        count: 2,
        contract: '2000.00',
        advances: '366.00',
        deposits: '150.00',
        residual: '1534.00',
      });
      expect(store.totals().find((total) => total.currency === 'CHF')?.count).toBe(1);
    });

    it('keeps the key of the refusal when the load fails', async () => {
      api.listChains.mockReturnValue(problem('generic', 500));
      const store = TestBed.inject(ChainsStore);

      await store.load();

      expect(store.error()).toBe('down_payments.error.generic');
      expect(store.loading()).toBe(false);
    });
  });

  describe('ChainStore', () => {
    it('loads one chain', async () => {
      api.getChain.mockReturnValue(envelope(dpChain()));
      const store = TestBed.inject(ChainStore);

      await store.load('c1');

      expect(api.getChain).toHaveBeenCalledWith('c1');
      expect(store.chain()?.chain_number).toBe('DPC-2026-1');
      expect(store.missing()).toBe(false);
    });

    it('finds the live chain of a source, skipping the cancelled ones', async () => {
      api.listChains.mockReturnValue(
        envelope([dpChain({ id: 'old', status: 'cancelled' }), dpChain({ id: 'live' })]),
      );
      api.getChain.mockReturnValue(envelope(dpChain({ id: 'live' })));
      const store = TestBed.inject(ChainStore);

      await store.loadBySource('quote', 'q1');

      expect(api.listChains).toHaveBeenCalledWith({
        source_type: 'quote',
        source_id: 'q1',
        per_page: 5,
      });
      expect(api.getChain).toHaveBeenCalledWith('live');
      expect(store.chain()?.id).toBe('live');
    });

    it('marks the source as without chain when there is none', async () => {
      api.listChains.mockReturnValue(envelope([]));
      const store = TestBed.inject(ChainStore);

      await store.loadBySource('sales_order', 'so9');

      expect(store.chain()).toBeNull();
      expect(store.missing()).toBe(true);
    });

    it('previews the plan and keeps the refusal of an exceeding plan', async () => {
      api.previewPlan.mockReturnValueOnce(envelope(dpPlanPreview()));
      const store = TestBed.inject(ChainStore);
      const payload = { source_type: 'sales_order' as const, source_id: 'so1', template: '50_50' };

      expect((await store.previewPlan(payload)).ok).toBe(true);
      expect(store.plan()?.planned_gross).toBe('1220.00');

      api.previewPlan.mockReturnValueOnce(problem('plan_exceeds_contract'));
      const outcome = await store.previewPlan(payload);

      expect(outcome.ok).toBe(false);
      expect(outcome.errorKey).toBe('down_payments.error.plan_exceeds_contract');
      expect(outcome.params).toEqual({ contract_gross: '1220.00' });
      expect(store.plan()).toBeNull();
    });

    it('opens the chain and emits its first installment when asked', async () => {
      const created = dpChain({
        id: 'new',
        installments: [dpInstallment({ id: 'i1' }), dpInstallment({ id: 'i2', sequence: 2 })],
      });
      const emitted = dpChain({
        id: 'new',
        installments: [dpInstallment({ id: 'i1', status: 'invoiced' })],
      });
      api.createFromSource.mockReturnValue(envelope(created));
      api.emitInstallment.mockReturnValue(
        envelope({
          instrument: 'advance_invoice_immediate',
          link_id: 'l1',
          document_id: 'x',
          deposit_id: null,
          chain: emitted,
        }),
      );
      const store = TestBed.inject(ChainStore);

      const outcome = await store.create(
        { source_type: 'sales_order', source_id: 'so1', template: '50_50' },
        true,
      );

      expect(outcome.ok).toBe(true);
      expect(api.emitInstallment).toHaveBeenCalledWith('new', 'i1', {});
      expect(store.chain()?.installments[0].status).toBe('invoiced');
    });

    it('keeps the opened chain when its first installment cannot be emitted', async () => {
      api.createFromSource.mockReturnValue(
        envelope(dpChain({ id: 'new', installments: [dpInstallment({ id: 'i1' })] })),
      );
      api.emitInstallment.mockReturnValue(problem('advance_exceeds_residual'));
      const store = TestBed.inject(ChainStore);

      const outcome = await store.create(
        { source_type: 'sales_order', source_id: 'so1', template: '50_50' },
        true,
      );

      expect(outcome.ok).toBe(true);
      expect(outcome.emitFailure?.code).toBe('advance_exceeds_residual');
      expect(store.chain()?.id).toBe('new');
    });

    it('does not open a chain the API refuses', async () => {
      api.createFromSource.mockReturnValue(problem('chain_exists_for_source', 409));
      const store = TestBed.inject(ChainStore);

      const outcome = await store.create(
        { source_type: 'quote', source_id: 'q1', template: '50_50' },
        false,
      );

      expect(outcome.ok).toBe(false);
      expect(outcome.chain).toBeNull();
      expect(store.chain()).toBeNull();
    });

    it('takes the chain every action answers with', async () => {
      api.getChain.mockReturnValue(envelope(dpChain()));
      const store = TestBed.inject(ChainStore);
      await store.load('c1');

      api.emitInstallment.mockReturnValue(
        envelope({
          instrument: 'advance_invoice_immediate',
          link_id: 'l2',
          document_id: 'x',
          deposit_id: null,
          chain: dpChain({ status: 'partially_settled' }),
        }),
      );
      await store.emit('i2', { date: '2026-12-01' });
      expect(api.emitInstallment).toHaveBeenCalledWith('c1', 'i2', { date: '2026-12-01' });
      expect(store.chain()?.status).toBe('partially_settled');

      api.confirmProformaPayment.mockReturnValue(envelope(dpChain({ status: 'active' })));
      await store.confirmProforma('l1', { paid_at: '2026-12-05' });
      expect(api.confirmProformaPayment).toHaveBeenCalledWith('c1', 'l1', {
        paid_at: '2026-12-05',
      });
      expect(store.chain()?.status).toBe('active');

      api.cancelChain.mockReturnValue(envelope(dpChain({ status: 'cancelled' })));
      await store.cancel();
      expect(store.chain()?.status).toBe('cancelled');
    });

    it('reads the chain again after the payment of a deposit', async () => {
      api.getChain.mockReturnValue(envelope(dpChain()));
      api.confirmDepositPayment.mockReturnValue(envelope({}));
      const store = TestBed.inject(ChainStore);
      await store.load('c1');
      api.getChain.mockClear();

      const outcome = await store.confirmDeposit('d1', {
        paid_at: '2026-12-05',
        payment_account: 'cash',
      });

      expect(outcome.ok).toBe(true);
      expect(api.confirmDepositPayment).toHaveBeenCalledWith('c1', 'd1', {
        paid_at: '2026-12-05',
        payment_account: 'cash',
      });
      expect(api.getChain).toHaveBeenCalledWith('c1');
    });

    it('previews the resolution of a deposit and resolves it', async () => {
      api.getChain.mockReturnValue(envelope(dpChain()));
      const store = TestBed.inject(ChainStore);
      await store.load('c1');
      const impact = {
        resolution: 'forfeit_breach',
        vat_applies: false,
        lines: [],
        penalty_amount: '0.00',
      };
      api.previewDepositResolution.mockReturnValue(envelope(impact));

      await store.previewResolution('d1', { resolution: 'forfeit_breach' });
      expect(api.previewDepositResolution).toHaveBeenCalledWith('c1', 'd1', {
        resolution: 'forfeit_breach',
      });
      expect(store.resolution()?.vat_applies).toBe(false);

      api.resolveDeposit.mockReturnValue(envelope(dpChain({ status: 'forfeited' })));
      const outcome = await store.resolve('d1', { resolution: 'forfeit_breach' });
      expect(outcome.ok).toBe(true);
      expect(store.chain()?.status).toBe('forfeited');
      expect(store.resolution()).toBeNull();
    });

    it('shows the refusal of the settlement preview while a pro-forma is open', async () => {
      api.getChain.mockReturnValue(envelope(dpChain()));
      const store = TestBed.inject(ChainStore);
      await store.load('c1');
      api.previewFinalSettlement.mockReturnValue(problem('open_proformas'));

      const outcome = await store.previewSettlement();

      expect(outcome.code).toBe('open_proformas');
      expect(store.settlement()).toBeNull();
    });

    it('previews and generates the final settlement', async () => {
      api.getChain.mockReturnValue(envelope(dpChain()));
      const store = TestBed.inject(ChainStore);
      await store.load('c1');
      api.previewFinalSettlement.mockReturnValue(envelope(dpSettlement()));

      await store.previewSettlement();
      expect(store.settlement()?.totals.final_gross).toBe('744.00');

      api.generateFinalSettlement.mockReturnValue(
        envelope({
          invoice_id: 'f1',
          invoice_number: 'F-1',
          chain: dpChain({ status: 'settled', final_invoice_id: 'f1' }),
        }),
      );
      const outcome = await store.generateSettlement({
        document_type: 'TD01',
        impute_deposit_ids: ['d1'],
      });

      expect(api.generateFinalSettlement).toHaveBeenCalledWith('c1', {
        document_type: 'TD01',
        impute_deposit_ids: ['d1'],
      });
      expect(outcome.invoiceNumber).toBe('F-1');
      expect(store.chain()?.status).toBe('settled');
      expect(store.settlement()).toBeNull();
    });

    it('previews and issues the credit note of an advance', async () => {
      api.getChain.mockReturnValue(envelope(dpChain()));
      const store = TestBed.inject(ChainStore);
      await store.load('c1');
      api.previewCreditNote.mockReturnValue(
        envelope({
          slices: [],
          credited_gross: '122.00',
          residual_before_gross: '854.00',
          residual_after_gross: '976.00',
        }),
      );

      await store.previewCreditNote('l1', { mode: 'amount', amount: '122.00' });
      expect(api.previewCreditNote).toHaveBeenCalledWith('c1', 'l1', {
        mode: 'amount',
        amount: '122.00',
      });
      expect(store.creditNote()?.residual_after_gross).toBe('976.00');

      api.issueCreditNote.mockReturnValue(
        envelope({
          credit_note_id: 'n1',
          credit_note_number: 'NC-1',
          chain: dpChain({ residual_order_gross: '976.00' }),
        }),
      );
      const outcome = await store.issueCreditNote('l1', {
        mode: 'amount',
        amount: '122.00',
        reason: 'Reduced',
      });

      expect(outcome.ok).toBe(true);
      expect(store.chain()?.residual_order_gross).toBe('976.00');
      expect(store.creditNote()).toBeNull();
    });
  });
});
