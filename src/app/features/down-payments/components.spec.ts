import { Provider, signal, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DpChainDetail,
  DpCreditNotePreview,
  DpLookups,
  DpPlanPreview,
  DpResolutionPreview,
  DpSettlementPreview,
  PermissionsService,
  TranslateService,
} from '@core';
import {
  dpChain,
  dpDeposit,
  dpInstallment,
  dpLink,
  dpPlanPreview,
  dpSettlement,
} from '../../../testing/down-payments-fixtures';
import { AdvanceCreditNoteModalComponent } from './advance-credit-note-modal.component';
import { ChainStore } from './chain.store';
import { DepositResolutionModalComponent } from './deposit-resolution-modal.component';
import { DownPaymentChainComponent } from './down-payment-chain.component';
import { DownPaymentWizardModalComponent } from './down-payment-wizard-modal.component';
import { DP_OK, DpOutcome } from './down-payments.util';
import { FinalSettlementPreviewDrawerComponent } from './final-settlement-preview-drawer.component';

const failed: DpOutcome = {
  ok: false,
  errorKey: 'down_payments.error.plan_exceeds_contract',
  code: 'plan_exceeds_contract',
  detail: null,
  params: { contract_gross: '1220.00' },
  errors: {},
};

/** The store the components talk to: every action is a spy, the signals the templates read are plain signals. */
function fakeStore() {
  return {
    chain: signal<DpChainDetail | null>(null),
    missing: signal(false),
    loading: signal(false),
    error: signal<string | null>(null),
    lookups: signal<DpLookups | null>(null),
    plan: signal<DpPlanPreview | null>(null),
    settlement: signal<DpSettlementPreview | null>(null),
    resolution: signal<DpResolutionPreview | null>(null),
    creditNote: signal<DpCreditNotePreview | null>(null),
    saving: signal(false),
    previewing: signal(false),
    load: vi.fn(),
    loadBySource: vi.fn(),
    reload: vi.fn(),
    loadLookups: vi.fn(),
    clearPlan: vi.fn(),
    clearSettlement: vi.fn(),
    clearResolution: vi.fn(),
    clearCreditNote: vi.fn(),
    previewPlan: vi.fn(),
    create: vi.fn(),
    cancel: vi.fn(),
    emit: vi.fn(),
    confirmProforma: vi.fn(),
    confirmDeposit: vi.fn(),
    previewResolution: vi.fn(),
    resolve: vi.fn(),
    previewSettlement: vi.fn(),
    generateSettlement: vi.fn(),
    previewCreditNote: vi.fn(),
    issueCreditNote: vi.fn(),
  };
}

describe('down payments components', () => {
  let store: ReturnType<typeof fakeStore>;
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const permissions = { canRead: vi.fn(() => true), canWrite: vi.fn(() => true) };

  async function open<T>(
    component: Type<T>,
    inputs: Record<string, unknown>,
    providers: Provider[] = [],
  ): Promise<ComponentFixture<T>> {
    TestBed.overrideComponent(component, {
      set: { template: '<div></div>', imports: [], providers },
    });
    const fixture = TestBed.createComponent(component);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    store = fakeStore();
    store.loadLookups.mockResolvedValue(undefined);
    // The credit note modal previews by itself after a short pause: the default answer keeps that timer harmless
    store.previewCreditNote.mockResolvedValue(DP_OK);
    TestBed.configureTestingModule({
      providers: [
        { provide: ChainStore, useValue: store },
        { provide: NzMessageService, useValue: message },
        { provide: PermissionsService, useValue: permissions },
        {
          provide: TranslateService,
          useValue: {
            currentLanguage: signal('en'),
            translate: (key: string) => key,
            instant: (key: string) => key,
          },
        },
      ],
    });
  });

  describe('DownPaymentWizardModalComponent', () => {
    const lookups: DpLookups = {
      presets: {
        '30_40_30': [
          {
            trigger_type: 'on_order_confirmation',
            calculation_mode: 'percentage',
            percentage: '30',
            instrument_type: 'advance_invoice_immediate',
          },
          {
            trigger_type: 'on_material_delivery',
            calculation_mode: 'percentage',
            percentage: '40',
            instrument_type: 'advance_invoice_immediate',
          },
          {
            trigger_type: 'on_commissioning',
            calculation_mode: 'percentage',
            percentage: '30',
            instrument_type: 'advance_invoice_immediate',
          },
        ],
        caparra_balance: [
          {
            trigger_type: 'on_order_confirmation',
            calculation_mode: 'percentage',
            percentage: '10',
            instrument_type: 'earnest_money_deposit',
          },
        ],
      },
    };

    const openWizard = () =>
      open(DownPaymentWizardModalComponent, {
        visible: true,
        sourceType: 'sales_order',
        sourceId: 'so1',
        sourceLabel: 'SO-1',
      });

    it('loads the presets when it opens and lists them with their percentages', async () => {
      store.lookups.set(lookups);
      const fixture = await openWizard();

      expect(store.loadLookups).toHaveBeenCalled();
      expect(fixture.componentInstance['presetKeys']()).toEqual(['30_40_30', 'caparra_balance']);
      expect(fixture.componentInstance['presetSummary']('30_40_30')).toBe('30% · 40% · 30%');
    });

    it('needs a choice before it can preview, and previews the template of a preset', async () => {
      store.previewPlan.mockResolvedValue(DP_OK);
      const fixture = await openWizard();
      const wizard = fixture.componentInstance;
      expect(wizard['planReady']()).toBe(false);

      wizard['choosePreset']('50_50');
      expect(wizard['planReady']()).toBe(true);
      await wizard['goToPreview']();

      expect(store.previewPlan).toHaveBeenCalledWith({
        source_type: 'sales_order',
        source_id: 'so1',
        template: '50_50',
      });
      expect(wizard['step']()).toBe(1);
    });

    it('builds the installments of a custom plan and refuses invalid milestones', async () => {
      store.previewPlan.mockResolvedValue(DP_OK);
      const fixture = await openWizard();
      const wizard = fixture.componentInstance;

      wizard['chooseCustom']();
      expect(wizard['planReady']()).toBe(false);
      const [first] = wizard['rows']();
      wizard['patchRow'](first.key, {
        value: 40,
        label: 'Deposit',
        instrument: 'earnest_money_deposit',
      });
      wizard['addRow']();
      const second = wizard['rows']()[1];
      wizard['patchRow'](second.key, {
        mode: 'fixed_gross',
        value: 250,
        trigger: 'on_material_delivery',
      });
      expect(wizard['planReady']()).toBe(true);
      await wizard['goToPreview']();

      expect(store.previewPlan).toHaveBeenCalledWith({
        source_type: 'sales_order',
        source_id: 'so1',
        installments: [
          {
            trigger_type: 'on_order_confirmation',
            calculation_mode: 'percentage',
            instrument_type: 'earnest_money_deposit',
            milestone_label: 'Deposit',
            percentage: '40',
          },
          {
            trigger_type: 'on_material_delivery',
            calculation_mode: 'fixed_gross',
            instrument_type: 'advance_invoice_immediate',
            amount: '250.00',
          },
        ],
      });
    });

    it('seeds the custom plan from the preset that was selected', async () => {
      store.lookups.set(lookups);
      const fixture = await openWizard();
      const wizard = fixture.componentInstance;

      wizard['choosePreset']('30_40_30');
      wizard['chooseCustom']();

      expect(wizard['rows']().map((row) => [row.trigger, row.value])).toEqual([
        ['on_order_confirmation', 30],
        ['on_material_delivery', 40],
        ['on_commissioning', 30],
      ]);
    });

    it('stays on the first step and shows the refusal when the plan exceeds the contract', async () => {
      store.previewPlan.mockResolvedValue(failed);
      const fixture = await openWizard();
      const wizard = fixture.componentInstance;
      wizard['choosePreset']('50_50');

      await wizard['goToPreview']();

      expect(wizard['step']()).toBe(0);
      expect(wizard['feedback']()?.code).toBe('plan_exceeds_contract');
    });

    it('verifies the slices to the cent and warns about a drift', async () => {
      const fixture = await openWizard();
      const wizard = fixture.componentInstance;

      store.plan.set(dpPlanPreview());
      expect(wizard['allExact']()).toBe(true);
      expect(wizard['hasDrift']()).toBe(false);

      const drifted = dpPlanPreview({ rounding_drift: '0.01' });
      drifted.installments[0].vat_breakdown[0].vat = '110.01';
      store.plan.set(drifted);
      expect(wizard['allExact']()).toBe(false);
      expect(wizard['hasDrift']()).toBe(true);
    });

    it('opens the chain, emitting the first installment on request, and closes', async () => {
      store.plan.set(dpPlanPreview());
      store.create.mockResolvedValue({ ...DP_OK, chain: dpChain(), emitFailure: null });
      const fixture = await openWizard();
      const wizard = fixture.componentInstance;
      const created = vi.fn();
      const closed = vi.fn();
      fixture.componentInstance.created.subscribe(created);
      fixture.componentInstance.closed.subscribe(closed);
      wizard['choosePreset']('50_50');
      store.plan.set(dpPlanPreview());
      expect(wizard['firstIsEmittable']()).toBe(true);
      wizard['emitFirst'].set(true);
      wizard['notes'].set(' Agreed by phone ');

      await wizard['create']();

      expect(store.create).toHaveBeenCalledWith(
        {
          source_type: 'sales_order',
          source_id: 'so1',
          template: '50_50',
          notes: 'Agreed by phone',
        },
        true,
      );
      expect(message.success).toHaveBeenCalledWith('down_payments.message.createdEmitted');
      expect(created).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
      expect(closed).toHaveBeenCalled();
    });

    it('warns when the chain is open but the first installment could not be emitted', async () => {
      store.create.mockResolvedValue({ ...DP_OK, chain: dpChain(), emitFailure: failed });
      const fixture = await openWizard();
      fixture.componentInstance['choosePreset']('50_50');

      await fixture.componentInstance['create']();

      expect(message.warning).toHaveBeenCalledWith('down_payments.message.createdEmitFailed');
    });

    it('keeps the wizard open when the API refuses the chain', async () => {
      store.create.mockResolvedValue({ ...failed, chain: null, emitFailure: null });
      const fixture = await openWizard();
      const closed = vi.fn();
      fixture.componentInstance.closed.subscribe(closed);
      fixture.componentInstance['choosePreset']('50_50');

      await fixture.componentInstance['create']();

      expect(closed).not.toHaveBeenCalled();
      expect(fixture.componentInstance['feedback']()?.code).toBe('plan_exceeds_contract');
    });
  });

  describe('DepositResolutionModalComponent', () => {
    const openDeposit = (deposit = dpDeposit({ status: 'held_active' })) => {
      store.chain.set(dpChain({ deposits: [deposit] }));
      return open(DepositResolutionModalComponent, { deposit, visible: true });
    };

    it('shows the receipt flags and offers the payment of an unpaid receipt', async () => {
      const fixture = await openDeposit(dpDeposit());

      expect(fixture.componentInstance['unpaid']()).toBe(true);
      expect(fixture.componentInstance['held']()).toBe(false);
    });

    it('confirms the payment with the day, the account and the reference', async () => {
      store.confirmDeposit.mockResolvedValue(DP_OK);
      const fixture = await openDeposit(dpDeposit());
      const modal = fixture.componentInstance;
      modal['paidAt'].set(new Date(2026, 11, 5));
      modal['account'].set('cash');
      modal['reference'].set(' TRN-1 ');

      await modal['confirmPayment']();

      expect(store.confirmDeposit).toHaveBeenCalledWith('d1', {
        paid_at: '2026-12-05',
        payment_account: 'cash',
        reference: 'TRN-1',
      });
      expect(message.success).toHaveBeenCalledWith('down_payments.message.depositCollected');
    });

    it('previews the accounting impact of each way the deposit ends', async () => {
      store.previewResolution.mockResolvedValue(DP_OK);
      const fixture = await openDeposit();
      const modal = fixture.componentInstance;

      modal['choose']('impute_to_price');
      expect(store.previewResolution).toHaveBeenLastCalledWith('d1', {
        resolution: 'impute_to_price',
      });

      modal['choose']('forfeit_breach');
      expect(store.previewResolution).toHaveBeenLastCalledWith('d1', {
        resolution: 'forfeit_breach',
      });

      modal['choose']('refund');
      expect(store.previewResolution).toHaveBeenLastCalledWith('d1', {
        resolution: 'refund',
        refund_mode: 'single',
        payment_account: 'bank',
      });

      modal['setRefundMode']('double');
      expect(store.previewResolution).toHaveBeenLastCalledWith('d1', {
        resolution: 'refund',
        refund_mode: 'double',
        payment_account: 'bank',
      });
    });

    it('refunds a security deposit only in single mode', async () => {
      store.previewResolution.mockResolvedValue(DP_OK);
      const fixture = await openDeposit(
        dpDeposit({ status: 'held_active', deposit_type: 'security_deposit_cauzionale' }),
      );
      const modal = fixture.componentInstance;
      modal['refundMode'].set('double');

      modal['choose']('refund');

      expect(modal['earnest']()).toBe(false);
      expect(store.previewResolution).toHaveBeenLastCalledWith(
        'd1',
        expect.objectContaining({ refund_mode: 'single' }),
      );
    });

    it('resolves the deposit with the notes and closes', async () => {
      store.previewResolution.mockResolvedValue(DP_OK);
      store.resolve.mockResolvedValue(DP_OK);
      const fixture = await openDeposit();
      const modal = fixture.componentInstance;
      const closed = vi.fn();
      modal.closed.subscribe(closed);
      modal['choose']('forfeit_breach');
      modal['notes'].set(' Customer withdrew ');
      modal['date'].set(new Date(2026, 11, 20));

      await modal['resolve']();

      expect(store.resolve).toHaveBeenCalledWith('d1', {
        resolution: 'forfeit_breach',
        date: '2026-12-20',
        notes: 'Customer withdrew',
      });
      expect(message.success).toHaveBeenCalledWith('down_payments.message.depositResolved');
      expect(closed).toHaveBeenCalled();
    });

    it('shows the refusal and stays open when the resolution is refused', async () => {
      store.previewResolution.mockResolvedValue(DP_OK);
      store.resolve.mockResolvedValue({
        ...failed,
        errorKey: 'down_payments.error.double_refund_only_for_earnest_money',
        code: 'double_refund_only_for_earnest_money',
      });
      const fixture = await openDeposit();
      const modal = fixture.componentInstance;
      const closed = vi.fn();
      modal.closed.subscribe(closed);
      modal['choose']('refund');

      await modal['resolve']();

      expect(closed).not.toHaveBeenCalled();
      expect(modal['feedback']()?.code).toBe('double_refund_only_for_earnest_money');
    });

    it('does not resolve before a way is picked', async () => {
      const fixture = await openDeposit();

      await fixture.componentInstance['resolve']();

      expect(store.resolve).not.toHaveBeenCalled();
    });
  });

  describe('FinalSettlementPreviewDrawerComponent', () => {
    const openDrawer = (outcome: DpOutcome = DP_OK) => {
      store.previewSettlement.mockResolvedValue(outcome);
      return open(FinalSettlementPreviewDrawerComponent, { visible: true });
    };

    it('loads the preview when it opens', async () => {
      await openDrawer();

      expect(store.clearSettlement).toHaveBeenCalled();
      expect(store.previewSettlement).toHaveBeenCalled();
    });

    it('groups the negative deductions by VAT rate, highest rate first, with the subtotals', async () => {
      store.settlement.set(dpSettlement());
      const fixture = await openDrawer();

      const groups = fixture.componentInstance['groups']();

      expect(groups.map((group) => group.vatRate)).toEqual(['22.00', '10.00']);
      expect(groups[0]).toMatchObject({ net: '300.00', vat: '66.00', gross: '366.00' });
      expect(groups[1].rows[0].advance_invoice_number).toBe('AC-2026-2');
    });

    it('can generate when nothing blocks the settlement', async () => {
      store.settlement.set(dpSettlement());
      const fixture = await openDrawer();

      expect(fixture.componentInstance['canGenerate']()).toBe(true);
    });

    it('blocks the settlement on an open pro-forma', async () => {
      store.settlement.set(dpSettlement({ blockers: [{ code: 'open_proforma', id: 'l9' }] }));
      const fixture = await openDrawer();

      expect(fixture.componentInstance['canGenerate']()).toBe(false);
    });

    it('treats the refusal of the preview as the blocker of the open pro-formas', async () => {
      const fixture = await openDrawer({
        ...failed,
        errorKey: 'down_payments.error.open_proformas',
        code: 'open_proformas',
      });

      expect(fixture.componentInstance['openProformas']()).toBe(true);
      expect(fixture.componentInstance['canGenerate']()).toBe(false);
    });

    it('unblocks held earnest money once it is imputed to the price in this invoice', async () => {
      store.chain.set(dpChain({ deposits: [dpDeposit({ id: 'd1', status: 'held_active' })] }));
      store.settlement.set(dpSettlement({ blockers: [{ code: 'held_earnest_money', id: 'd1' }] }));
      const fixture = await openDrawer();
      const drawer = fixture.componentInstance;

      expect(drawer['canGenerate']()).toBe(false);
      drawer['toggleImpute']('d1', true);
      expect(drawer['canGenerate']()).toBe(true);
      drawer['toggleImpute']('d1', false);
      expect(drawer['canGenerate']()).toBe(false);
    });

    it('generates the invoice with the type, the dates and the imputed deposits, then closes', async () => {
      store.chain.set(dpChain({ deposits: [dpDeposit({ id: 'd1', status: 'held_active' })] }));
      store.settlement.set(dpSettlement({ blockers: [{ code: 'held_earnest_money', id: 'd1' }] }));
      store.generateSettlement.mockResolvedValue({ ...DP_OK, invoiceNumber: 'F-1' });
      const fixture = await openDrawer();
      const drawer = fixture.componentInstance;
      const settled = vi.fn();
      const closed = vi.fn();
      drawer.settled.subscribe(settled);
      drawer.closed.subscribe(closed);
      drawer['documentType'].set('TD24');
      drawer['date'].set(new Date(2026, 11, 31));
      drawer['toggleImpute']('d1', true);

      await drawer['generate']();

      expect(store.generateSettlement).toHaveBeenCalledWith({
        document_type: 'TD24',
        date: '2026-12-31',
        impute_deposit_ids: ['d1'],
      });
      expect(settled).toHaveBeenCalledWith('F-1');
      expect(closed).toHaveBeenCalled();
      expect(message.success).toHaveBeenCalledWith('down_payments.message.settled');
    });

    it('shows the refusal and stays open when the invoice cannot be generated', async () => {
      store.settlement.set(dpSettlement());
      store.generateSettlement.mockResolvedValue({ ...failed, invoiceNumber: null });
      const fixture = await openDrawer();
      const closed = vi.fn();
      fixture.componentInstance.closed.subscribe(closed);

      await fixture.componentInstance['generate']();

      expect(closed).not.toHaveBeenCalled();
      expect(fixture.componentInstance['feedback']()).not.toBeNull();
    });
  });

  describe('AdvanceCreditNoteModalComponent', () => {
    const openCredit = () => {
      store.chain.set(dpChain());
      return open(AdvanceCreditNoteModalComponent, { link: dpLink(), visible: true });
    };

    it('starts with the whole open amount of the advance', async () => {
      const fixture = await openCredit();
      const modal = fixture.componentInstance;

      expect(modal.previewPayload()).toEqual({ mode: 'total' });
      expect(modal['creditable']()).toBe('366.00');
      expect(modal['lines']().map((row) => [row.vatRate, row.open])).toEqual([['22.00', '300.00']]);
    });

    it('needs an amount before it previews the credit by amount', async () => {
      const fixture = await openCredit();
      const modal = fixture.componentInstance;

      modal['setMode']('amount');
      expect(modal.previewPayload()).toBeNull();

      modal['amount'].set(122);
      expect(modal.previewPayload()).toEqual({ mode: 'amount', amount: '122.00' });
    });

    it('previews the credit per VAT line, only for the lines with a net amount', async () => {
      const fixture = await openCredit();
      const modal = fixture.componentInstance;

      modal['setMode']('lines');
      expect(modal.previewPayload()).toBeNull();

      modal['setLine']('22.00', 100);
      expect(modal.previewPayload()).toEqual({
        mode: 'lines',
        lines: [{ vat_rate: '22.00', net: '100.00' }],
      });
    });

    it('recalculates through the API and keeps the refusal', async () => {
      store.previewCreditNote
        .mockResolvedValueOnce(DP_OK)
        .mockResolvedValueOnce({
          ...failed,
          errorKey: 'down_payments.error.credit_exceeds_advance',
          code: 'credit_exceeds_advance',
        });
      const fixture = await openCredit();
      const modal = fixture.componentInstance;

      await modal.refresh({ mode: 'total' });
      expect(store.previewCreditNote).toHaveBeenCalledWith('l1', { mode: 'total' });
      expect(modal['feedback']()).toBeNull();

      await modal.refresh({ mode: 'amount', amount: '9999.00' });
      expect(modal['feedback']()?.code).toBe('credit_exceeds_advance');
    });

    it('issues the credit note with the date and the reason, then closes', async () => {
      store.issueCreditNote.mockResolvedValue(DP_OK);
      const fixture = await openCredit();
      const modal = fixture.componentInstance;
      const closed = vi.fn();
      modal.closed.subscribe(closed);
      modal['setMode']('amount');
      modal['amount'].set(122);
      modal['date'].set(new Date(2026, 11, 15));
      modal['reason'].set(' Order reduced ');

      await modal['issue']();

      expect(store.issueCreditNote).toHaveBeenCalledWith('l1', {
        mode: 'amount',
        amount: '122.00',
        date: '2026-12-15',
        reason: 'Order reduced',
      });
      expect(message.success).toHaveBeenCalledWith('down_payments.message.creditNoteIssued');
      expect(closed).toHaveBeenCalled();
    });

    it('does not issue a credit note without an amount', async () => {
      const fixture = await openCredit();
      fixture.componentInstance['setMode']('amount');

      await fixture.componentInstance['issue']();

      expect(store.issueCreditNote).not.toHaveBeenCalled();
    });
  });

  describe('DownPaymentChainComponent', () => {
    const openChain = (inputs: Record<string, unknown>) =>
      open(DownPaymentChainComponent, inputs, [{ provide: ChainStore, useValue: store }]);

    it('loads the chain of the route by id', async () => {
      await openChain({ chainId: 'c1' });

      expect(store.load).toHaveBeenCalledWith('c1');
      expect(store.loadBySource).not.toHaveBeenCalled();
    });

    it('looks the chain up by source when it is embedded in an order or a quote', async () => {
      await openChain({ sourceType: 'quote', sourceId: 'q1' });

      expect(store.loadBySource).toHaveBeenCalledWith('quote', 'q1');
    });

    it('loads nothing without the permission to read the module', async () => {
      permissions.canRead.mockReturnValueOnce(false);

      await openChain({ chainId: 'c1' });

      expect(store.load).not.toHaveBeenCalled();
    });

    it('splits the contract into deposits, advances and residual for the progress bar', async () => {
      store.chain.set(
        dpChain({
          total_contract_gross: '1000.00',
          total_earnest_deposits_held: '100.00',
          total_advance_invoiced_gross: '300.00',
          total_credited_advances_gross: '0.00',
          residual_order_gross: '600.00',
        }),
      );
      const fixture = await openChain({ chainId: 'c1' });

      const progress = fixture.componentInstance['progress']();

      expect([
        progress.depositsPercent,
        progress.advancesPercent,
        progress.residualPercent,
      ]).toEqual([10, 30, 60]);
      expect(fixture.componentInstance['depositsHeld']()).toBe('100.00');
      expect(fixture.componentInstance['netAdvances']()).toBe('300.00');
    });

    it('builds the timeline from the links and deposits of the chain', async () => {
      store.chain.set(dpChain({ deposits: [dpDeposit({ issue_date: '2026-12-01' })] }));
      const fixture = await openChain({ chainId: 'c1' });

      expect(fixture.componentInstance['timeline']().map((item) => item.kind)).toEqual([
        'source',
        'deposit',
        'link',
      ]);
    });

    it('lays the multi-VAT matrix out as net, VAT and gross per rate with the totals of all the rates', async () => {
      store.chain.set(
        dpChain({
          vat_matrix: [
            dpChain().vat_matrix[0],
            {
              ...dpChain().vat_matrix[0],
              vat_rate: '10.00',
              contract_net: '200.00',
              contract_vat: '20.00',
              contract_gross: '220.00',
            },
          ],
        }),
      );
      const fixture = await openChain({ chainId: 'c1' });

      const lines = fixture.componentInstance['matrix']();

      expect(lines.map((line) => line.key)).toEqual([
        '22.00-net',
        '22.00-vat',
        '22.00-gross',
        '10.00-net',
        '10.00-vat',
        '10.00-gross',
        'total-net',
        'total-vat',
        'total-gross',
      ]);
      expect(lines.find((line) => line.key === '10.00-gross')?.contract).toBe('220.00');
      expect(lines.find((line) => line.key === 'total-gross')?.contract).toBe('1440.00');
    });

    it('emits an installment and reports it', async () => {
      store.emit.mockResolvedValue(DP_OK);
      store.chain.set(dpChain());
      const fixture = await openChain({ chainId: 'c1' });

      await fixture.componentInstance['emit'](dpInstallment({ id: 'i2' }));

      expect(store.emit).toHaveBeenCalledWith('i2');
      expect(message.success).toHaveBeenCalledWith('down_payments.message.emitted');
    });

    it('shows the refusal of an emission', async () => {
      store.emit.mockResolvedValue({
        ...failed,
        errorKey: 'down_payments.error.advance_exceeds_residual',
        code: 'advance_exceeds_residual',
      });
      store.chain.set(dpChain());
      const fixture = await openChain({ chainId: 'c1' });

      await fixture.componentInstance['emit'](dpInstallment({ id: 'i2' }));

      expect(fixture.componentInstance['feedback']()?.code).toBe('advance_exceeds_residual');
      expect(message.success).not.toHaveBeenCalled();
    });

    it('converts an open pro-forma with the payment day and closes the form', async () => {
      store.confirmProforma.mockResolvedValue(DP_OK);
      store.chain.set(dpChain());
      const fixture = await openChain({ chainId: 'c1' });
      const component = fixture.componentInstance;
      const proforma = dpLink({ id: 'l7', link_type: 'proforma_advance_request', status: 'open' });
      component['openProforma'](proforma);
      component['paidAt'].set(new Date(2026, 11, 9));
      component['reference'].set('TRN-9');

      await component['confirmProforma']();

      expect(store.confirmProforma).toHaveBeenCalledWith('l7', {
        paid_at: '2026-12-09',
        payment_account: 'bank',
        reference: 'TRN-9',
      });
      expect(component['proformaLink']()).toBeNull();
    });

    it('offers the cancellation only while nothing was emitted', async () => {
      store.chain.set(dpChain({ links: [], deposits: [], installments: [dpInstallment()] }));
      const fixture = await openChain({ chainId: 'c1' });
      expect(fixture.componentInstance['cancellable']()).toBe(true);

      store.chain.set(dpChain());
      expect(fixture.componentInstance['cancellable']()).toBe(false);
    });

    it('opens the deposit receipt and the credit note of the row that was picked', async () => {
      store.chain.set(dpChain({ deposits: [dpDeposit({ id: 'd1' })] }));
      const fixture = await openChain({ chainId: 'c1' });
      const component = fixture.componentInstance;

      component['depositId'].set('d1');
      component['creditLinkId'].set('l1');

      expect(component['selectedDeposit']()?.id).toBe('d1');
      expect(component['selectedLink']()?.id).toBe('l1');
    });
  });
});
