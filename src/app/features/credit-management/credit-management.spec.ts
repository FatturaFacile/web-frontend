import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { CollectionCase, CreditDashboard, CreditLimitRequest, CreditManagementApiService, CrmApiService, TranslateService } from '@core';
import { CreditCaseDetailComponent } from './credit-case-detail.component';
import { CreditCasesComponent } from './credit-cases.component';
import { CreditDashboardComponent } from './credit-dashboard.component';
import { CreditLimitsComponent } from './credit-limits.component';
import { CreditScoresComponent } from './credit-scores.component';
import { CreditStrategiesComponent } from './credit-strategies.component';
import { contactName, statusColor } from './credit.util';

const dashboard: CreditDashboard = {
  as_of: '2027-06-30',
  receivables_total: '1000.00',
  overdue_total: '400.00',
  overdue_percentage: '40.00',
  invoiced_last_90_days: '3000.00',
  dso_days: '30.00',
  overdue_by_bucket: [{ key: 'd1_30', amount: '400.00', invoices_count: 2 }],
  customers_over_limit: 1,
  cases: { open_count: 2, outstanding_amount: '400.00', by_status: { open: 2 } },
  promises: { pending_count: 1, pending_amount: '100.00', past_due_count: 0 },
  disputes: { open_count: 0, open_amount: '0.00' },
  pending_limit_requests: 1,
  rating_distribution: [{ rating: 'A', count: 3 }],
  insurance: { active_policies: 1, insured_total: '5000.00', expiring_within_30_days: 0 },
  top_overdue_customers: [{ customer_id: 'c-1', customer_name: 'Acme', overdue_amount: '400.00', max_days_overdue: 20 }],
};

const collectionCase: CollectionCase = {
  id: 'case-1',
  case_number: 'CC-0001',
  customer_id: 'c-1',
  customer_name: 'Acme',
  status: 'open',
  priority: 'normal',
  collector_id: null,
  strategy_id: null,
  current_step_order: 0,
  outstanding_amount: '400.00',
  currency: 'EUR',
  opened_on: '2027-06-01',
  next_action_on: null,
  closed_on: null,
  notes: null,
  invoices: [],
  actions: [],
  promises: [],
  disputes: [],
};

const limitRequest: CreditLimitRequest = {
  id: 'lr-1',
  customer_id: 'c-1',
  customer_name: 'Acme',
  current_limit: '1000.00',
  requested_limit: '5000.00',
  proposed_limit: '3000.00',
  approved_limit: null,
  currency: 'EUR',
  status: 'pending',
  reason: null,
  decided_at: null,
  decision_note: null,
  valid_until: null,
};

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };
const crmSpy = { getClients: vi.fn() };

function configure(api: Record<string, unknown>, extra: unknown[] = []): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CreditManagementApiService, useValue: api },
      { provide: CrmApiService, useValue: crmSpy },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      provideNzIcons(icons),
      ...(extra as never[]),
    ],
  });
}

beforeEach(() => {
  crmSpy.getClients.mockReturnValue(of({ data: [{ id: 'c-1', company_name: 'Acme', first_name: null, last_name: null }] }));
});

describe('credit util', () => {
  it('names a contact by company or by person and colours the statuses', () => {
    expect(contactName({ id: 'c-1', company_name: 'Acme' } as never)).toBe('Acme');
    expect(contactName({ id: 'c-2', company_name: null, first_name: 'Anna', last_name: 'Rossi' } as never)).toBe('Anna Rossi');
    expect(statusColor('disputed')).toBe('red');
    expect(statusColor('unknown')).toBe('default');
  });
});

describe('CreditManagementApiService', () => {
  let service: CreditManagementApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CreditManagementApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CreditManagementApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('calls the endpoints of the module with the API field names', () => {
    service.getCases({ status: 'open', priority: undefined, per_page: 100 }).subscribe();
    const list = httpMock.expectOne((r) => r.url.endsWith('/credit-management/cases') && r.params.get('status') === 'open' && !r.params.has('priority'));
    expect(list.request.method).toBe('GET');
    list.flush({ data: [] });

    service.createScore({ customer_id: 'c-1', manual_inputs: { relationship: 80 }, notes: null }).subscribe();
    const score = httpMock.expectOne((r) => r.url.endsWith('/credit-management/scores'));
    expect(score.request.method).toBe('POST');
    expect(score.request.body).toEqual({ customer_id: 'c-1', manual_inputs: { relationship: 80 }, notes: null });
    score.flush({ data: {} });

    service.rejectLimitRequest('lr-1', { decision_note: 'Too risky' }).subscribe();
    const reject = httpMock.expectOne((r) => r.url.endsWith('/credit-management/limit-requests/lr-1/reject'));
    expect(reject.request.body).toEqual({ decision_note: 'Too risky' });
    reject.flush({ data: {} });

    service.resolvePromise('p-1', { outcome: 'kept', paid_amount: '100', resolved_on: null }).subscribe();
    const promise = httpMock.expectOne((r) => r.url.endsWith('/credit-management/promises/p-1/resolve'));
    expect(promise.request.body).toEqual({ outcome: 'kept', paid_amount: '100', resolved_on: null });
    promise.flush({ data: {} });

    service.getWorklist({ due_only: true }).subscribe();
    const worklist = httpMock.expectOne((r) => r.url.endsWith('/credit-management/worklist') && r.params.get('due_only') === '1');
    worklist.flush({ data: [] });

    httpMock.verify();
  });
});

describe('CreditDashboardComponent', () => {
  const api = { getDashboard: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getDashboard.mockReturnValue(of({ data: dashboard }));
    configure(api);
  });

  it('loads the dashboard', () => {
    const fixture = TestBed.createComponent(CreditDashboardComponent);
    fixture.detectChanges();

    expect(api.getDashboard).toHaveBeenCalled();
    expect(fixture.componentInstance.dashboard()?.dso_days).toBe('30.00');
    expect(fixture.nativeElement.textContent).toContain('Acme');
  });
});

describe('CreditCasesComponent', () => {
  const api = { getCases: vi.fn(), getStrategies: vi.fn(), createCase: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getCases.mockReturnValue(of({ data: [collectionCase] }));
    api.getStrategies.mockReturnValue(of({ data: [{ id: 's-1', name: 'Standard', description: null, is_default: true, is_active: true }] }));
    api.createCase.mockReturnValue(of({ data: collectionCase }));
    configure(api);
  });

  it('filters the cases and opens a case on the overdue invoices of a customer', () => {
    const fixture = TestBed.createComponent(CreditCasesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getCases).toHaveBeenCalledWith({ status: undefined, priority: undefined, per_page: 100 });
    component.status.set('disputed');
    component.load();
    expect(api.getCases).toHaveBeenLastCalledWith({ status: 'disputed', priority: undefined, per_page: 100 });

    component.openModal();
    expect(component.form.controls.strategy_id.value).toBe('s-1');
    component.form.patchValue({ customer_id: 'c-1', notes: ' late ' });
    component.save();

    expect(api.createCase).toHaveBeenCalledWith({ customer_id: 'c-1', invoice_ids: null, strategy_id: 's-1', collector_id: null, priority: 'normal', notes: 'late' });
    expect(messageSpy.success).toHaveBeenCalled();
  });
});

describe('CreditCaseDetailComponent', () => {
  const api = {
    getCase: vi.fn(),
    advanceCase: vi.fn(),
    createPromise: vi.fn(),
    createDispute: vi.fn(),
    closeCase: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getCase.mockReturnValue(of({ data: collectionCase }));
    api.advanceCase.mockReturnValue(of({ data: collectionCase }));
    api.createPromise.mockReturnValue(of({ data: {} }));
    api.createDispute.mockReturnValue(of({ data: {} }));
    api.closeCase.mockReturnValue(of({ data: collectionCase }));
    configure(api, [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'case-1' } } } }]);
  });

  it('runs the next step, records a promise and a dispute and closes the case', () => {
    const fixture = TestBed.createComponent(CreditCaseDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getCase).toHaveBeenCalledWith('case-1');
    component.advance();
    expect(api.advanceCase).toHaveBeenCalledWith('case-1', null);

    component.promiseForm.patchValue({ promised_on: '2027-07-10', promised_amount: 150, notes: '' });
    component.savePromise();
    expect(api.createPromise).toHaveBeenCalledWith({ case_id: 'case-1', promised_amount: '150', promised_on: '2027-07-10', notes: null });

    component.disputeForm.patchValue({ reason_code: 'quality', disputed_amount: 50, description: 'Damaged' });
    component.saveDispute();
    expect(api.createDispute).toHaveBeenCalledWith({ customer_id: 'c-1', case_id: 'case-1', disputed_amount: '50', reason_code: 'quality', description: 'Damaged' });

    component.closeForm.patchValue({ outcome: 'written_off', note: '' });
    component.saveClose();
    expect(api.closeCase).toHaveBeenCalledWith('case-1', { outcome: 'written_off', note: null });
  });
});

describe('CreditLimitsComponent', () => {
  const api = {
    getLimitRequests: vi.fn(),
    getLimitProposal: vi.fn(),
    getExposure: vi.fn(),
    createLimitRequest: vi.fn(),
    approveLimitRequest: vi.fn(),
    rejectLimitRequest: vi.fn(),
    cancelLimitRequest: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getLimitRequests.mockReturnValue(of({ data: [limitRequest] }));
    api.getLimitProposal.mockReturnValue(of({ data: { score_id: 's', rating: 'B', score: '70', risk_level: 'low', quarterly_turnover: '1000', proposed_limit: '3000.00', current_limit: '1000.00' } }));
    api.getExposure.mockReturnValue(of({ data: { exposure: '500.00', credit_limit: '1000.00' } }));
    api.createLimitRequest.mockReturnValue(of({ data: limitRequest }));
    api.approveLimitRequest.mockReturnValue(of({ data: limitRequest }));
    api.rejectLimitRequest.mockReturnValue(of({ data: limitRequest }));
    configure(api);
  });

  it('shows the proposal of the customer and sends an optional requested limit', () => {
    const fixture = TestBed.createComponent(CreditLimitsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openRequest();
    component.requestForm.controls.customer_id.setValue('c-1');
    expect(api.getLimitProposal).toHaveBeenCalledWith('c-1');
    expect(component.proposal()?.proposed_limit).toBe('3000.00');
    expect(component.exposure()?.exposure).toBe('500.00');

    component.saveRequest();
    expect(api.createLimitRequest).toHaveBeenCalledWith({ customer_id: 'c-1', requested_limit: null, currency: 'EUR', reason: null, valid_until: null });
  });

  it('approves with the proposed limit and requires a note to reject', () => {
    const fixture = TestBed.createComponent(CreditLimitsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openDecision(limitRequest, 'approve');
    expect(component.decisionForm.controls.approved_limit.value).toBe(3000);
    component.saveDecision();
    expect(api.approveLimitRequest).toHaveBeenCalledWith('lr-1', { approved_limit: '3000', decision_note: null, valid_until: null });

    component.openDecision(limitRequest, 'reject');
    component.saveDecision();
    expect(api.rejectLimitRequest).not.toHaveBeenCalled();
    expect(messageSpy.error).toHaveBeenCalled();

    component.decisionForm.patchValue({ decision_note: 'Too risky' });
    component.saveDecision();
    expect(api.rejectLimitRequest).toHaveBeenCalledWith('lr-1', { decision_note: 'Too risky' });
  });
});

describe('CreditScoresComponent', () => {
  const api = { getScores: vi.fn(), getFactors: vi.fn(), createScore: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getScores.mockReturnValue(of({ data: [] }));
    api.getFactors.mockReturnValue(
      of({
        data: [
          { id: 'f-1', code: 'overdue', name: 'Overdue', source: 'overdue_ratio', weight: '60', is_active: true, sort_order: 0 },
          { id: 'f-2', code: 'relationship', name: 'Relationship', source: 'manual', weight: '40', is_active: true, sort_order: 1 },
          { id: 'f-3', code: 'old', name: 'Old', source: 'manual', weight: '10', is_active: false, sort_order: 2 },
        ],
      }),
    );
    api.createScore.mockReturnValue(of({ data: {} }));
    configure(api);
  });

  it('asks only the active manual factors and sends them as manual inputs', () => {
    const fixture = TestBed.createComponent(CreditScoresComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.manualFactors().map((factor) => factor.code)).toEqual(['relationship']);
    component.openModal();
    component.form.patchValue({ customer_id: 'c-1', notes: '' });
    component.form.controls.manual.controls['relationship'].setValue(80);
    component.save();

    expect(api.createScore).toHaveBeenCalledWith({ customer_id: 'c-1', manual_inputs: { relationship: 80 }, notes: null });
  });
});

describe('CreditStrategiesComponent', () => {
  const api = { getStrategies: vi.fn(), getStrategy: vi.fn(), createStrategy: vi.fn(), updateStrategy: vi.fn(), deleteStrategy: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getStrategies.mockReturnValue(of({ data: [] }));
    api.createStrategy.mockReturnValue(of({ data: {} }));
    configure(api);
  });

  it('builds the ordered steps of a new strategy', () => {
    const fixture = TestBed.createComponent(CreditStrategiesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.patchValue({ name: 'Standard', description: '' });
    component.steps.at(0).patchValue({ name: 'Reminder', days_after_due: 7, channel: 'email', template_key: '', fee_amount: null });
    component.addStep();
    component.steps.at(1).patchValue({ name: 'Formal notice', days_after_due: 30, channel: 'registered_letter', fee_amount: 15, escalates: true });
    component.save();

    expect(api.createStrategy).toHaveBeenCalledWith({
      name: 'Standard',
      description: null,
      is_default: false,
      is_active: true,
      steps: [
        { name: 'Reminder', days_after_due: 7, channel: 'email', template_key: null, fee_amount: null, escalates: false },
        { name: 'Formal notice', days_after_due: 30, channel: 'registered_letter', template_key: null, fee_amount: '15', escalates: true },
      ],
    });
  });
});
