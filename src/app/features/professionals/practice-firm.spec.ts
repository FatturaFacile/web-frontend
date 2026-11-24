import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../icons-provider';
import { CrmApiService, PracticeApiService, PracticeConflictCheck, PracticeFeeProposal, PracticeTrustTransaction, ProfessionalsApiService, TranslateService } from '@core';
import { PracticeConflictsComponent } from './practice-conflicts.component';
import { PracticeExpensesComponent } from './practice-expenses.component';
import { PracticeProposalsComponent } from './practice-proposals.component';
import { PracticeTrustComponent } from './practice-trust.component';
import { apiErrorText, clientName, decimalOrNull } from './practice-firm.util';

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };
const crmSpy = { getContacts: vi.fn() };
const professionalsSpy = { getCases: vi.fn() };

const client = { id: 'c-1', company_name: 'Alfa Holding SA', first_name: null, last_name: null };

function configure(api: Record<string, unknown>): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: PracticeApiService, useValue: api },
      { provide: CrmApiService, useValue: crmSpy },
      { provide: ProfessionalsApiService, useValue: professionalsSpy },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      provideNzIcons(icons),
    ],
  });
}

const deposit: PracticeTrustTransaction = {
  id: 'tx-1',
  client_id: 'c-1',
  client,
  legal_case_id: null,
  type: 'deposit',
  occurred_on: '2027-06-26',
  amount: '1000.00',
  signed_amount: '1000.00',
  balance_after: '1000.00',
  reference: null,
  description: null,
  reverses_id: null,
};

const proposal: PracticeFeeProposal = {
  id: 'fp-1',
  number: 'FP-2027-0001',
  client_id: 'c-1',
  client,
  title: 'Lease review',
  scope: null,
  fee_type: 'fixed',
  hourly_rate: null,
  estimated_hours: null,
  fixed_fee: '2800.00',
  estimated_total: '2800.00',
  valid_until: null,
  status: 'sent',
  legal_case_id: null,
  decision_notes: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  crmSpy.getContacts.mockReturnValue(of({ data: [client] }));
  professionalsSpy.getCases.mockReturnValue(of({ data: [{ id: 'm-1', client_id: 'c-1', case_number: 'F-1', title: 'Dispute' }] }));
});

describe('practice firm util', () => {
  it('reads the detail of a business rule error and the first validation message', () => {
    expect(apiErrorText(new HttpErrorResponse({ status: 422, error: { detail: 'The client funds balance is only 10.00' } }))).toBe('The client funds balance is only 10.00');
    expect(apiErrorText(new HttpErrorResponse({ status: 422, error: { errors: { amount: ['Invalid amount'] } } }))).toBe('Invalid amount');
    expect(apiErrorText(new Error('boom'))).toBeNull();
  });

  it('names clients and formats decimals', () => {
    expect(clientName(client)).toBe('Alfa Holding SA');
    expect(clientName({ first_name: 'Anna', last_name: 'Rossi' })).toBe('Anna Rossi');
    expect(decimalOrNull(12.5)).toBe('12.5');
    expect(decimalOrNull(null)).toBeNull();
  });
});

describe('PracticeTrustComponent', () => {
  const api = { getTrustBalances: vi.fn(), getTrustLedger: vi.fn(), postTrustTransaction: vi.fn(), reverseTrustTransaction: vi.fn() };

  beforeEach(() => {
    api.getTrustBalances.mockReturnValue(of({ data: [{ client_id: 'c-1', client_name: 'Alfa Holding SA', total: '1000.00', matters: [] }] }));
    api.getTrustLedger.mockReturnValue(of({ data: [deposit] }));
    api.postTrustTransaction.mockReturnValue(of({ data: deposit }));
    api.reverseTrustTransaction.mockReturnValue(of({ data: deposit }));
    configure(api);
  });

  it('loads balances and rows, and posts the form as the API payload', () => {
    const fixture = TestBed.createComponent(PracticeTrustComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.balances()[0].total).toBe('1000.00');
    expect(component.rows()).toHaveLength(1);

    component.openModal();
    component.form.patchValue({ type: 'withdrawal', client_id: 'c-1', amount: 250.5, reference: ' R-1 ', occurred_on: '2027-06-27' });
    component.save();
    expect(api.postTrustTransaction).toHaveBeenCalledWith({
      type: 'withdrawal',
      client_id: 'c-1',
      legal_case_id: null,
      occurred_on: '2027-06-27',
      amount: '250.5',
      reference: 'R-1',
      description: null,
    });
  });

  it('shows the reason of a refused withdrawal', () => {
    const fixture = TestBed.createComponent(PracticeTrustComponent);
    fixture.detectChanges();
    api.postTrustTransaction.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'The client funds balance is only 0.00' } })));
    fixture.componentInstance.form.patchValue({ client_id: 'c-1', amount: 5 });
    fixture.componentInstance.save();
    expect(messageSpy.error).toHaveBeenCalledWith('The client funds balance is only 0.00');
  });
});

describe('PracticeProposalsComponent', () => {
  const api = {
    getFeeProposals: vi.fn(),
    createFeeProposal: vi.fn(),
    updateFeeProposal: vi.fn(),
    sendFeeProposal: vi.fn(),
    declineFeeProposal: vi.fn(),
    acceptFeeProposal: vi.fn(),
    runConflictCheck: vi.fn(),
  };
  const conflict: PracticeConflictCheck = { id: 'cc-1', subject_name: 'Alfa Holding SA', subject_role: 'client', contact_id: 'c-1', result: 'conflict', matches: [] };

  beforeEach(() => {
    api.getFeeProposals.mockReturnValue(of({ data: [proposal] }));
    api.createFeeProposal.mockReturnValue(of({ data: proposal }));
    api.acceptFeeProposal.mockReturnValue(of({ data: { ...proposal, status: 'accepted' } }));
    api.runConflictCheck.mockReturnValue(of({ data: conflict }));
    configure(api);
  });

  it('creates an hourly proposal with the amounts the API requires and none of the fixed fee', () => {
    const fixture = TestBed.createComponent(PracticeProposalsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.patchValue({ client_id: 'c-1', title: 'Audit', fee_type: 'hourly', hourly_rate: 250, estimated_hours: 12.5, fixed_fee: 99 });
    component.save();
    expect(api.createFeeProposal).toHaveBeenCalledWith({
      client_id: 'c-1',
      title: 'Audit',
      scope: null,
      fee_type: 'hourly',
      hourly_rate: '250',
      estimated_hours: '12.5',
      fixed_fee: null,
      valid_until: null,
    });
  });

  it('runs the conflicts check before accepting and needs a reason when a conflict is found', () => {
    const fixture = TestBed.createComponent(PracticeProposalsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.startAccept(proposal);
    expect(api.runConflictCheck).toHaveBeenCalledWith({ name: 'Alfa Holding SA', role: 'client', contact_id: 'c-1' });
    expect(component.canConfirm()).toBe(false);

    component.overrideReason.set('Partner approved after review');
    expect(component.canConfirm()).toBe(true);
    component.confirmAccept();
    expect(api.acceptFeeProposal).toHaveBeenCalledWith('fp-1', { conflict_check_id: 'cc-1', override_reason: 'Partner approved after review' });
  });
});

describe('PracticeConflictsComponent', () => {
  const api = { runConflictCheck: vi.fn(), getConflictChecks: vi.fn(), getCaseParties: vi.fn(), createCaseParty: vi.fn(), deleteCaseParty: vi.fn() };

  beforeEach(() => {
    api.getConflictChecks.mockReturnValue(of({ data: [] }));
    api.getCaseParties.mockReturnValue(of({ data: [] }));
    api.runConflictCheck.mockReturnValue(of({ data: { id: 'cc-2', subject_name: 'Gamma', subject_role: 'client', contact_id: null, result: 'review', matches: [] } }));
    api.createCaseParty.mockReturnValue(of({ data: {} }));
    configure(api);
  });

  it('runs a check and records a party on a matter', () => {
    const fixture = TestBed.createComponent(PracticeConflictsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.checkForm.patchValue({ name: 'Gamma', role: 'client' });
    component.runCheck();
    expect(api.runConflictCheck).toHaveBeenCalledWith({ name: 'Gamma', role: 'client' });
    expect(component.latest()?.result).toBe('review');

    component.partyForm.patchValue({ legal_case_id: 'm-1', name: 'Gamma Trading SA', role: 'opposing_party' });
    component.saveParty();
    expect(api.createCaseParty).toHaveBeenCalledWith({ legal_case_id: 'm-1', name: 'Gamma Trading SA', role: 'opposing_party', notes: null });
  });
});

describe('PracticeExpensesComponent', () => {
  const api = { getExpenses: vi.fn(), createExpense: vi.fn(), updateExpense: vi.fn(), deleteExpense: vi.fn() };

  beforeEach(() => {
    api.getExpenses.mockReturnValue(of({ data: [] }));
    api.createExpense.mockReturnValue(of({ data: {} }));
    configure(api);
  });

  it('records an expense on a matter with the amount as a decimal string', () => {
    const fixture = TestBed.createComponent(PracticeExpensesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.patchValue({ legal_case_id: 'm-1', expense_date: '2027-06-20', category: 'court_fee', description: 'Filing fee', amount: 85.5 });
    component.save();
    expect(api.createExpense).toHaveBeenCalledWith({
      legal_case_id: 'm-1',
      expense_date: '2027-06-20',
      category: 'court_fee',
      description: 'Filing fee',
      amount: '85.5',
      is_billable: true,
    });
  });
});
