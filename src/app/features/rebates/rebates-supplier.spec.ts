import { HttpErrorResponse } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  AccountingApiService,
  CrmApiService,
  ProcurementApiService,
  RebateAccrualRun,
  RebateAgreement,
  RebateContribution,
  RebateProgress,
  RebateSettlementProposal,
  RebatesApiService,
  SupplierInvoice,
  TranslateService,
} from '@core';
import { ProcurementExtraApiService } from '@core/api/procurement-extra-api.service';
import { BlanketBalanceComponent } from '../procurement/blanket-balance.component';
import { RebatesAccrualRunsComponent } from './rebates-accrual-runs.component';
import { RebatesAgreementDetailComponent } from './rebates-agreement-detail.component';
import { RebatesAgreementsComponent } from './rebates-agreements.component';
import { RebatesSettlementProposalsComponent } from './rebates-settlement-proposals.component';
import {
  barPercent,
  canReverseRun,
  clampPercent,
  describeBonusProgress,
  describeTierProgress,
  distinctThresholdsValidator,
  hasDistinctThresholds,
  invoiceOpenBalance,
  journalPreview,
  planContributionSync,
  proposalAllowedActions,
  requiredFieldsFor,
  tierUpperBounds,
  toContractOption,
} from './rebates.util';

const agreement: RebateAgreement = {
  id: 'ag-1',
  code: 'PF-1',
  name: 'Supplier rebate',
  direction: 'purchase',
  contact_id: 'sup-1',
  contact_name: 'Acme Spa',
  tier_mode: 'retroactive',
  starts_on: '2027-01-01',
  ends_on: '2027-12-31',
  currency: 'EUR',
  status: 'active',
  notes: null,
  rebate_type: 'tiered_volume',
  accrual_account_id: 'acc-1',
  income_account_id: 'inc-1',
  version: 4,
  tiers: [{ id: 't-1', threshold_amount: '10000.00', rate_percent: '2.0000', flat_amount: null }],
  contributions: [],
  open_rebate: '0.00',
};

const run: RebateAccrualRun = {
  id: 'run-1',
  agreement_id: 'ag-1',
  period_start: '2027-01-01',
  period_end: '2027-03-31',
  status: 'posted',
  base_amount: '20000.00',
  cumulative_rebate: '400.00',
  delta_amount: '400.00',
  journal_entry_id: null,
  reversal_journal_entry_id: null,
  reversed_at: null,
  reversal_reason: null,
  lines: [{ passive_invoice_id: 'pi-1', invoice_number: 'F-1', document_type: 'TD01', invoice_date: '2027-02-01', net_amount: '20000.00' }],
};

function proposal(overrides: Partial<RebateSettlementProposal> = {}): RebateSettlementProposal {
  return {
    id: 'sp-1',
    agreement_id: 'ag-1',
    amount: '400.00',
    gross_amount: '400.00',
    tax_rate: null,
    tax_amount: '0.00',
    currency: 'EUR',
    status: 'draft',
    execution_mode: 'credit_note_request',
    document_id: null,
    passive_invoice_id: null,
    set_off_amount: null,
    journal_entry_id: null,
    submitted_at: null,
    approved_by: null,
    approved_at: null,
    version: 3,
    lines: [],
    ...overrides,
  };
}

const progress: RebateProgress = {
  agreement_id: 'ag-1',
  rebate_type: 'tiered_volume',
  tier_mode: 'retroactive',
  currency: 'EUR',
  as_of: '2027-06-30',
  qualifying_volume: '20000.00',
  earned_rebate: '400.00',
  accrued_rebate: '400.00',
  settled_rebate: '0.00',
  tier: {
    current_tier: { threshold_amount: '10000.00', rate_percent: '2.0000', flat_amount: null },
    next_tier: { threshold_amount: '50000.00', rate_percent: '4.0000', flat_amount: null },
    accrued_rebate: '400.00',
    distance_to_next: '30000.00',
    progress_percent: '25.00',
    projected_rebate_at_next: '2000.00',
    projected_gain: '1600.00',
  },
  bonus: null,
  contributions: { planned: '0.00', accrued: '0.00', settled: '0.00' },
  tiers: [],
};

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };
const crmSpy = { getClients: vi.fn(), getSuppliers: vi.fn() };
const accountingSpy = { getAccounts: vi.fn() };
const procurementExtraSpy = { listContracts: vi.fn() };
const procurementSpy = { getSupplierInvoices: vi.fn(), getContractBalance: vi.fn() };

function configure(api: Record<string, unknown>, routeId = 'ag-1'): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: RebatesApiService, useValue: api },
      { provide: CrmApiService, useValue: crmSpy },
      { provide: AccountingApiService, useValue: accountingSpy },
      { provide: ProcurementExtraApiService, useValue: procurementExtraSpy },
      { provide: ProcurementApiService, useValue: procurementSpy },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: routeId }) } } },
      provideNzIcons(icons),
    ],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  translateSpy.instant.mockImplementation((key: string) => key);
  crmSpy.getClients.mockReturnValue(of({ data: [] }));
  crmSpy.getSuppliers.mockReturnValue(of({ data: [{ id: 'sup-1', company_name: 'Acme Spa', first_name: null, last_name: null }] }));
  accountingSpy.getAccounts.mockReturnValue(of({ data: [{ id: 'acc-1', account_code: '1450', name: 'Accrued income' }] }));
  procurementExtraSpy.listContracts.mockReturnValue(of({ data: [{ id: 'ct-1', contract_number: 'BL-1', title: 'Blanket' }] }));
  procurementSpy.getSupplierInvoices.mockReturnValue(of({ data: [] }));
});

describe('supplier rebate helpers', () => {
  it('describes where the spend stands on the scale', () => {
    const view = describeTierProgress(progress.tier);
    expect(view).toEqual({ state: 'in_tier', currentRate: '2.0000', nextRate: '4.0000', nextThreshold: '50000.00', distance: 30000, percent: 25, projectedGain: 1600 });
    expect(describeTierProgress(null)).toBeNull();
  });

  it('tells the no-tier, in-tier and top-tier states apart and fills the bar on the top tier', () => {
    const below = describeTierProgress({ ...progress.tier!, current_tier: null, progress_percent: '-5.00' });
    expect(below?.state).toBe('no_tier');
    expect(below?.percent).toBe(0);

    const top = describeTierProgress({ ...progress.tier!, next_tier: null, distance_to_next: null, projected_gain: null, progress_percent: '100.00' });
    expect(top).toMatchObject({ state: 'top_tier', distance: null, percent: 100, projectedGain: null, nextThreshold: null });
  });

  it('describes the fixed bonus progress and never shows a negative distance', () => {
    expect(describeBonusProgress({ target: '50000.00', bonus: '1500.00', reached: false, distance_to_target: '30000.00', progress_percent: '40.00' })).toEqual({ reached: false, percent: 40, distance: 30000, bonus: 1500 });
    expect(describeBonusProgress({ target: '50000.00', bonus: '1500.00', reached: true, distance_to_target: '-200.00', progress_percent: '104.00' })).toEqual({ reached: true, percent: 100, distance: 0, bonus: 1500 });
    expect(describeBonusProgress(null)).toBeNull();
  });

  it('keeps percentages and bar shares inside 0-100', () => {
    expect(clampPercent('140')).toBe(100);
    expect(clampPercent('abc')).toBe(0);
    expect(barPercent('250', '1000')).toBe(25);
    expect(barPercent('2000', '1000')).toBe(100);
    expect(barPercent('10', null)).toBeNull();
  });

  it('checks the tier thresholds are distinct and derives the read-only upper bounds', () => {
    expect(hasDistinctThresholds(['1000', '5000', ''])).toBe(true);
    expect(hasDistinctThresholds(['1000', '1000.00'])).toBe(false);
    expect(distinctThresholdsValidator(new FormControl([{ threshold_amount: '10' }, { threshold_amount: '10' }]))).toEqual({ distinctThresholds: true });
    expect(distinctThresholdsValidator(new FormControl([{ threshold_amount: '10' }, { threshold_amount: '20' }]))).toBeNull();

    expect(tierUpperBounds(['5000', '1000', '', '20000'])).toEqual([20000, 5000, null, null]);
  });

  it('lists the fields a rebate type requires', () => {
    expect(requiredFieldsFor('fixed_bonus')).toEqual(['fixed_bonus_target', 'fixed_bonus_amount']);
    expect(requiredFieldsFor('tiered_volume')).toEqual([]);
  });

  it('allows the settlement actions of each status', () => {
    expect(proposalAllowedActions('draft')).toEqual(['submit', 'cancel']);
    expect(proposalAllowedActions('pending_approval')).toEqual(['approve', 'cancel']);
    expect(proposalAllowedActions('approved')).toEqual(['execute', 'cancel']);
    expect(proposalAllowedActions('settled')).toEqual([]);
    expect(proposalAllowedActions('cancelled')).toEqual([]);
  });

  it('reverses only posted runs and previews the journal even when it is not posted', () => {
    expect(canReverseRun({ status: 'posted' })).toBe(true);
    expect(canReverseRun({ status: 'reversed' })).toBe(false);

    const preview = journalPreview(agreement, run);
    expect(preview.posted).toBe(false);
    expect(preview.lines).toEqual([
      { side: 'debit', accountId: 'acc-1', amount: 400 },
      { side: 'credit', accountId: 'inc-1', amount: 400 },
    ]);
    expect(journalPreview({}, { ...run, journal_entry_id: 'je-1' })).toMatchObject({ posted: true, lines: [{ accountId: null }, { accountId: null }] });
  });

  it('computes the open balance of a supplier invoice', () => {
    expect(invoiceOpenBalance({ total_amount: '1000.00', total_paid: '250.00' })).toBe(750);
    expect(invoiceOpenBalance({ total_amount: '100.00', total_paid: null })).toBe(100);
    expect(invoiceOpenBalance({ total_amount: '100.00', total_paid: '130.00' })).toBe(0);
  });

  it('plans the contribution calls: new rows are created, edited ones updated, removed planned ones deleted', () => {
    const original: RebateContribution[] = [
      { id: 'c-1', agreement_id: 'ag-1', kind: 'marketing', description: 'Catalogue', amount: '500.00', due_on: '2027-09-30', status: 'planned' },
      { id: 'c-2', agreement_id: 'ag-1', kind: 'listing', description: 'Listing', amount: '300.00', due_on: '2027-06-30', status: 'planned' },
      { id: 'c-3', agreement_id: 'ag-1', kind: 'listing', description: 'Old', amount: '100.00', due_on: '2027-01-31', status: 'settled' },
    ];
    const plan = planContributionSync(original, [
      { id: 'c-1', kind: 'marketing', description: 'Catalogue', amount: '500', due_on: '2027-09-30' },
      { id: null, kind: 'co_marketing', description: ' Flyer ', amount: '200', due_on: '2027-10-31' },
      { id: 'c-3', kind: 'listing', description: 'Old', amount: '120', due_on: '2027-01-31' },
    ]);

    expect(plan.create).toEqual([{ kind: 'co_marketing', description: 'Flyer', amount: '200', due_on: '2027-10-31' }]);
    expect(plan.update).toEqual([{ id: 'c-3', payload: { kind: 'listing', description: 'Old', amount: '120', due_on: '2027-01-31' } }]);
    expect(plan.remove).toEqual(['c-2']);
  });

  it('turns a generic contract row into a select option', () => {
    expect(toContractOption({ id: 'ct-1', contract_number: 'BL-1', title: 'Blanket' })).toEqual({ id: 'ct-1', label: 'BL-1 - Blanket' });
    expect(toContractOption({ id: 'ct-2' })).toEqual({ id: 'ct-2', label: 'ct-2' });
    expect(toContractOption({ contract_number: 'x' })).toBeNull();
  });
});

describe('RebatesAgreementsComponent supplier form', () => {
  const api = { getAgreements: vi.fn(), createAgreement: vi.fn(), updateAgreement: vi.fn(), createContribution: vi.fn(), updateContribution: vi.fn(), deleteContribution: vi.fn() };

  function open() {
    const fixture = TestBed.createComponent(RebatesAgreementsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openModal();
    component.form.controls.direction.setValue('purchase');
    component.form.patchValue({ code: 'PF-1', name: 'Supplier rebate', contact_id: 'sup-1', starts_on: '2027-01-01', ends_on: '2027-12-31' });
    return component;
  }

  beforeEach(() => {
    api.getAgreements.mockReturnValue(of({ data: [] }));
    api.createAgreement.mockReturnValue(of({ data: { ...agreement, id: 'ag-9' } }));
    api.updateAgreement.mockReturnValue(of({ data: agreement }));
    api.createContribution.mockReturnValue(of({ data: {} }));
    api.updateContribution.mockReturnValue(of({ data: {} }));
    api.deleteContribution.mockReturnValue(of(undefined));
    configure(api);
  });

  it('opens the supplier programs entry filtered on purchase agreements', () => {
    TestBed.resetTestingModule();
    configure(api);
    TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { paramMap: convertToParamMap({}), data: { direction: 'purchase' } } } });
    const fixture = TestBed.createComponent(RebatesAgreementsComponent);
    fixture.detectChanges();

    expect(api.getAgreements).toHaveBeenCalledWith({ direction: 'purchase', status: undefined, per_page: 100 });
  });

  it('requires distinct tier thresholds for a tiered volume rebate', () => {
    const component = open();
    component.tiers.at(0).patchValue({ threshold_amount: '10000', rate_percent: '2' });
    expect(component.form.valid).toBe(true);

    component.addTier();
    component.tiers.at(1).patchValue({ threshold_amount: '10000', rate_percent: '4' });
    expect(component.tiers.hasError('distinctThresholds')).toBe(true);
    expect(component.form.invalid).toBe(true);

    component.tiers.at(1).patchValue({ threshold_amount: '50000' });
    expect(component.form.valid).toBe(true);
  });

  it('shows the open-ended bound of the highest tier and the next threshold on the others', () => {
    const component = open();
    component.tiers.at(0).patchValue({ threshold_amount: '10000', rate_percent: '2' });
    component.addTier();
    component.tiers.at(1).patchValue({ threshold_amount: '50000', rate_percent: '4' });

    expect(component.upperBoundText(0)).toBe('50000');
    expect(component.upperBoundText(1)).toBe('SUPPLIER_REBATES.OPEN_ENDED');
  });

  it('requires the target and the bonus for a fixed bonus and sends no tiers', () => {
    const component = open();
    component.form.controls.rebate_type.setValue('fixed_bonus');
    expect(component.showsTiers()).toBe(false);
    expect(component.form.invalid).toBe(true);

    component.form.patchValue({ fixed_bonus_target: '50000', fixed_bonus_amount: '1500', supplier_contract_id: 'ct-1' });
    expect(component.form.valid).toBe(true);

    component.save();
    expect(api.createAgreement).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'purchase', rebate_type: 'fixed_bonus', fixed_bonus_target: '50000', fixed_bonus_amount: '1500', supplier_contract_id: 'ct-1', tiers: [] }),
    );
  });

  it('requires at least one contribution for a marketing contribution agreement and creates it after the agreement', () => {
    const component = open();
    component.form.controls.rebate_type.setValue('marketing_contribution');
    expect(component.form.hasError('contributionsRequired')).toBe(true);

    component.addContribution();
    component.contributions.at(0).patchValue({ kind: 'listing', description: 'Listing fee', amount: '500', due_on: '2027-09-30' });
    expect(component.form.valid).toBe(true);

    component.save();
    expect(api.createAgreement).toHaveBeenCalledWith(expect.objectContaining({ rebate_type: 'marketing_contribution', tiers: [] }));
    expect(api.createContribution).toHaveBeenCalledWith('ag-9', { kind: 'listing', description: 'Listing fee', amount: '500', due_on: '2027-09-30' });
    expect(messageSpy.success).toHaveBeenCalledWith('REBATES.AGREEMENT_SAVED');
  });

  it('rejects a contribution without an amount', () => {
    const component = open();
    component.form.controls.rebate_type.setValue('marketing_contribution');
    component.addContribution();
    component.contributions.at(0).patchValue({ description: 'Listing fee', amount: '' });

    expect(component.form.invalid).toBe(true);
  });

  it('sends only the descriptive and ledger fields of an active agreement and syncs its contributions', () => {
    const contribution: RebateContribution = { id: 'c-1', agreement_id: 'ag-1', kind: 'marketing', description: 'Catalogue', amount: '500.00', due_on: '2027-09-30', status: 'planned' };
    const fixture = TestBed.createComponent(RebatesAgreementsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal({ ...agreement, contributions: [contribution] });
    component.removeContribution(0);
    component.save();

    expect(api.updateAgreement).toHaveBeenCalledWith('ag-1', {
      name: 'Supplier rebate',
      ends_on: '2027-12-31',
      notes: null,
      accrual_frequency: 'quarterly',
      accrual_account_id: 'acc-1',
      income_account_id: 'inc-1',
      version: 4,
    });
    expect(api.deleteContribution).toHaveBeenCalledWith('c-1');
  });

  it('shows the API error when a save is refused', () => {
    api.createAgreement.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { tiers: ['The tiers are not valid'] } } })));
    const component = open();
    component.tiers.at(0).patchValue({ threshold_amount: '10000', rate_percent: '2' });

    component.save();

    expect(messageSpy.error).toHaveBeenCalledWith('The tiers are not valid');
  });
});

describe('RebatesAgreementDetailComponent cockpit', () => {
  const api = { getAgreement: vi.fn(), getAccruals: vi.fn(), getSettlements: vi.fn(), getProgress: vi.fn(), getAccrualRuns: vi.fn(), getSettlementProposals: vi.fn() };

  beforeEach(() => {
    api.getAgreement.mockReturnValue(of({ data: agreement }));
    api.getAccruals.mockReturnValue(of({ data: [] }));
    api.getSettlements.mockReturnValue(of({ data: [] }));
    api.getProgress.mockReturnValue(of({ data: progress }));
    api.getAccrualRuns.mockReturnValue(of({ data: [run] }));
    api.getSettlementProposals.mockReturnValue(of({ data: [proposal()] }));
    configure(api);
  });

  it('loads the live progress and reloads it when the date changes', () => {
    const fixture = TestBed.createComponent(RebatesAgreementDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getProgress).toHaveBeenCalledWith('ag-1', component.asOf());
    expect(component.progress()).toEqual(progress);

    component.asOf.set('2027-09-30');
    component.loadProgress();
    expect(api.getProgress).toHaveBeenLastCalledWith('ag-1', '2027-09-30');
  });

  it('shows the accrual runs and the settlement proposals of a supplier agreement', () => {
    const fixture = TestBed.createComponent(RebatesAgreementDetailComponent);
    fixture.detectChanges();

    expect(api.getAccrualRuns).toHaveBeenCalledWith('ag-1');
    expect(api.getSettlementProposals).toHaveBeenCalledWith({ agreement_id: 'ag-1', per_page: 100 });
  });

  it('does not load the supplier sections for a sales agreement', () => {
    api.getAgreement.mockReturnValue(of({ data: { ...agreement, direction: 'sales' } }));
    const fixture = TestBed.createComponent(RebatesAgreementDetailComponent);
    fixture.detectChanges();

    expect(api.getAccrualRuns).not.toHaveBeenCalled();
    expect(api.getSettlementProposals).not.toHaveBeenCalled();
  });
});

describe('RebatesAccrualRunsComponent', () => {
  const api = { getAccrualRuns: vi.fn(), createAccrualRun: vi.fn(), reverseAccrualRun: vi.fn() };

  function create() {
    const fixture = TestBed.createComponent(RebatesAccrualRunsComponent);
    fixture.componentRef.setInput('agreement', agreement);
    fixture.componentRef.setInput('accounts', [{ id: 'acc-1', account_code: '1450', name: 'Accrued income' }]);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    api.getAccrualRuns.mockReturnValue(of({ data: [run] }));
    api.createAccrualRun.mockReturnValue(of({ data: run }));
    api.reverseAccrualRun.mockReturnValue(of({ data: { ...run, status: 'reversed' } }));
    configure(api);
  });

  it('runs the accrual up to the chosen date and tells the cockpit', () => {
    const component = create();
    const changed = vi.fn();
    component.changed.subscribe(changed);

    component.periodEnd.set('2027-03-31');
    component.run();

    expect(api.createAccrualRun).toHaveBeenCalledWith('ag-1', { period_end: '2027-03-31' });
    expect(messageSpy.success).toHaveBeenCalledWith('SUPPLIER_REBATES.RUN_POSTED');
    expect(changed).toHaveBeenCalled();
    expect(component.running()).toBe(false);
  });

  it('reverses a run only with a reason', () => {
    const component = create();
    expect(component.runs()).toEqual([run]);

    component.openReverse(run);
    component.reverse();
    expect(api.reverseAccrualRun).not.toHaveBeenCalled();

    component.reason.set('Wrong period');
    component.reverse();
    expect(api.reverseAccrualRun).toHaveBeenCalledWith('run-1', 'Wrong period');
    expect(component.reverseTarget()).toBeNull();
  });

  it('previews the journal with the account names and flags a run that is not posted', () => {
    const component = create();
    const journal = component.journalOf(run);

    expect(journal.posted).toBe(false);
    expect(component.accountLabel('acc-1')).toBe('1450 - Accrued income');
    expect(component.accountLabel('unknown')).toBe('unknown');
    expect(component.accountLabel(null)).toBe('-');
  });

  it('shows the API error of a refused run', () => {
    api.createAccrualRun.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'Agreement not active' } })));
    const component = create();

    component.run();

    expect(messageSpy.error).toHaveBeenCalledWith('Agreement not active');
    expect(component.running()).toBe(false);
  });
});

describe('RebatesSettlementProposalsComponent', () => {
  const api = { getSettlementProposals: vi.fn(), createSettlementProposal: vi.fn(), transitionSettlementProposal: vi.fn() };
  const invoices: Partial<SupplierInvoice>[] = [
    { id: 'pi-1', invoice_number: 'F-1', currency: 'EUR', total_amount: '1000.00', total_paid: '200.00' },
    { id: 'pi-2', invoice_number: 'F-2', currency: 'EUR', total_amount: '100.00', total_paid: '100.00' },
  ];

  function create() {
    const fixture = TestBed.createComponent(RebatesSettlementProposalsComponent);
    fixture.componentRef.setInput('agreement', agreement);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    api.getSettlementProposals.mockReturnValue(of({ data: [proposal()] }));
    api.createSettlementProposal.mockReturnValue(of({ data: proposal() }));
    api.transitionSettlementProposal.mockReturnValue(of({ data: proposal({ status: 'pending_approval' }) }));
    procurementSpy.getSupplierInvoices.mockReturnValue(of({ data: invoices }));
    configure(api);
  });

  it('offers the actions of the status', () => {
    const component = create();

    expect(component.actionsOf(proposal())).toEqual(['submit', 'cancel']);
    expect(component.actionsOf(proposal({ status: 'approved' }))).toEqual(['execute', 'cancel']);
    expect(component.actionsOf(proposal({ status: 'settled' }))).toEqual([]);
  });

  it('submits and approves with the version of the proposal and tells the cockpit', () => {
    const component = create();
    const changed = vi.fn();
    component.changed.subscribe(changed);

    component.transition(proposal(), 'submit');
    expect(api.transitionSettlementProposal).toHaveBeenCalledWith('sp-1', 'submit', { version: 3 });

    component.transition(proposal({ status: 'pending_approval', version: 4 }), 'approve');
    expect(api.transitionSettlementProposal).toHaveBeenLastCalledWith('sp-1', 'approve', { version: 4 });
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('reloads the proposals and shows the error of a refused transition', () => {
    api.transitionSettlementProposal.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { version: ['The proposal changed in the meantime'] } } })));
    const component = create();
    api.getSettlementProposals.mockClear();

    component.transition(proposal(), 'cancel');

    expect(messageSpy.error).toHaveBeenCalledWith('The proposal changed in the meantime');
    expect(api.getSettlementProposals).toHaveBeenCalledTimes(1);
  });

  it('proposes a credit note request with the VAT rate', () => {
    const component = create();

    component.openPropose();
    component.taxRate.set(22);
    component.notes.set('  Year-end  ');
    component.propose();

    expect(api.createSettlementProposal).toHaveBeenCalledWith('ag-1', { execution_mode: 'credit_note_request', tax_rate: '22', passive_invoice_id: null, notes: 'Year-end' });
    expect(component.proposeVisible()).toBe(false);
  });

  it('needs an open supplier invoice for an AP set-off and offers only the invoices with an open balance', () => {
    const component = create();

    component.openPropose();
    expect(procurementSpy.getSupplierInvoices).toHaveBeenCalledWith({ supplier_id: 'sup-1', per_page: 100 });
    expect(component.openInvoices().map((invoice) => invoice.id)).toEqual(['pi-1']);

    component.mode.set('ap_set_off');
    expect(component.canPropose()).toBe(false);
    component.propose();
    expect(api.createSettlementProposal).not.toHaveBeenCalled();

    component.invoiceId.set('pi-1');
    expect(component.canPropose()).toBe(true);
    component.propose();
    expect(api.createSettlementProposal).toHaveBeenCalledWith('ag-1', { execution_mode: 'ap_set_off', tax_rate: null, passive_invoice_id: 'pi-1', notes: null });
  });

  it('executes an AP set-off with the optional ledger accounts', () => {
    const component = create();
    const approved = proposal({ id: 'sp-2', status: 'approved', execution_mode: 'ap_set_off', passive_invoice_id: 'pi-1', version: 6 });

    component.openExecute(approved);
    component.executedOn.set('2027-07-01');
    component.payablesAccountId.set('acc-1');
    component.execute();

    expect(api.transitionSettlementProposal).toHaveBeenCalledWith('sp-2', 'execute', { version: 6, executed_on: '2027-07-01', payables_account_id: 'acc-1', vat_account_id: null });
    expect(messageSpy.success).toHaveBeenCalledWith('SUPPLIER_REBATES.EXECUTED');
    expect(component.executeTarget()).toBeNull();
  });

  it('sends no ledger accounts when a credit note request is executed', () => {
    const component = create();
    component.openExecute(proposal({ status: 'approved' }));
    component.payablesAccountId.set('acc-1');
    component.executedOn.set('2027-07-01');

    component.execute();

    expect(api.transitionSettlementProposal).toHaveBeenCalledWith('sp-1', 'execute', { version: 3, executed_on: '2027-07-01', payables_account_id: null, vat_account_id: null });
  });
});

describe('BlanketBalanceComponent', () => {
  const balance = {
    contract_id: 'ct-1',
    currency: 'EUR',
    status: 'active',
    ceiling_amount: '10000.00',
    minimum_spend_amount: '4000.00',
    ordered_amount: '8000.00',
    received_amount: '4000.00',
    invoiced_amount: '2000.00',
    remaining_ceiling: '2000.00',
    ceiling_used_percent: '80.00',
    minimum_shortfall: '0.00',
    minimum_reached_percent: '200.00',
    alert_threshold_percent: '80.00',
    lines: [{ line_id: 'l-1', description: 'Bolts', unit_price: '2.00', committed_quantity: '5000', released_quantity: '4000', remaining_quantity: '1000', ordered_amount: '8000.00' }],
    alerts: [{ code: 'ceiling_near' as const, severity: 'warning' }],
  };

  beforeEach(() => {
    procurementSpy.getContractBalance.mockReturnValue(of({ data: balance }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ProcurementApiService, useValue: procurementSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'ct-1' }) } } },
        provideNzIcons(icons),
      ],
    });
  });

  it('loads the balance of the contract and draws the bars against the ceiling', () => {
    const fixture = TestBed.createComponent(BlanketBalanceComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(procurementSpy.getContractBalance).toHaveBeenCalledWith('ct-1');
    expect(component.balance()).toEqual(balance);
    expect(component.ceilingPercent()).toBe(80);
    expect(component.minimumPercent()).toBe(100);
    expect(component.ceilingExceeded()).toBe(false);
    expect(component.percentOf('4000.00')).toBe(40);
    expect(component.alertColor('ceiling_near')).toBe('orange');
  });

  it('draws the bars against the largest amount when the contract has no ceiling and flags an exceeded ceiling', () => {
    procurementSpy.getContractBalance.mockReturnValue(
      of({ data: { ...balance, ceiling_amount: null, remaining_ceiling: null, alerts: [{ code: 'ceiling_exceeded', severity: 'critical' }] } }),
    );
    const fixture = TestBed.createComponent(BlanketBalanceComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.ceilingPercent()).toBe(0);
    expect(component.percentOf('4000.00')).toBe(50);
    expect(component.ceilingExceeded()).toBe(true);
  });

  it('shows the API error when the balance cannot be loaded', () => {
    procurementSpy.getContractBalance.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const fixture = TestBed.createComponent(BlanketBalanceComponent);
    fixture.detectChanges();

    expect(messageSpy.error).toHaveBeenCalledWith('SUPPLIER_REBATES.LOAD_ERROR');
  });
});
