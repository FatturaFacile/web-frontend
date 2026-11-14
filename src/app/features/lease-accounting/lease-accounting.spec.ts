import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService, LeaseAccountingApiService, LeaseContract, LeaseMaturityReport, LeaseScheduleLine, LeaseScheduleVersion, PermissionsService } from '@core';
import { icons } from '../../icons-provider';
import { LeaseDetailComponent } from './lease-detail.component';
import { LeaseFormComponent } from './lease-form.component';
import { LeaseMaturityReportComponent } from './lease-maturity-report.component';
import { LeaseRemeasureComponent } from './lease-remeasure.component';

const version = (overrides: Partial<LeaseScheduleVersion> = {}): LeaseScheduleVersion => ({
  id: 'v1',
  lease_contract_id: 'l1',
  version_number: 1,
  reason: 'initial',
  effective_date: '2027-01-01',
  start_period_number: 1,
  end_period_number: 12,
  discount_rate_percent: '6.000000',
  payment_amount: '1000.00',
  liability_before: '0.00',
  liability_after: '11618.93',
  rou_before: '0.00',
  rou_after: '11618.93',
  liability_adjustment: '11618.93',
  rou_adjustment: '11618.93',
  result_amount: '0.00',
  total_undiscounted: '12000.00',
  status: 'current',
  ...overrides,
});

const lease = (overrides: Partial<LeaseContract> = {}): LeaseContract => ({
  id: 'l1',
  number: 'LS-2027-0001',
  title: 'Sede di Milano',
  lessor_name: 'Immobiliare Rossi Srl',
  asset_class: 'real_estate',
  accounting_standard: 'ifrs16',
  currency: 'EUR',
  commencement_date: '2027-01-01',
  term_months: 12,
  payment_amount: '1000.00',
  payment_frequency: 'monthly',
  payment_timing: 'arrears',
  escalation_type: 'none',
  escalation_rate_percent: '0.000000',
  incremental_borrowing_rate_percent: '6.000000',
  initial_direct_costs: '0.00',
  incentives_received: '0.00',
  purchase_option_reasonably_certain: false,
  extension_reasonably_certain: false,
  exemption: 'none',
  status: 'active',
  current_version_number: 1,
  effective_term_months: 12,
  versions: [version()],
  ...overrides,
});

const line = (periodNumber: number, status: LeaseScheduleLine['status']): LeaseScheduleLine => ({
  period_number: periodNumber,
  period_start: `2027-${String(periodNumber).padStart(2, '0')}-01`,
  period_end: `2027-${String(periodNumber).padStart(2, '0')}-28`,
  opening_liability: '10000.00',
  payment: '1000.00',
  interest: '50.00',
  principal: '950.00',
  closing_liability: '9050.00',
  rou_opening: '9500.00',
  depreciation: '950.00',
  rou_closing: '8550.00',
  status,
});

const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const i18n = { translate: vi.fn((key: string) => key), currentLanguage: signal('en') };
const permissions = { canWrite: vi.fn(() => true), canRead: vi.fn(() => true) };

function configure(api: Record<string, unknown>) {
  return TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideNzIcons(icons),
      { provide: LeaseAccountingApiService, useValue: api },
      { provide: NzMessageService, useValue: message },
      { provide: I18nService, useValue: i18n },
      { provide: PermissionsService, useValue: permissions },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'l1' }) } } },
    ],
  }).compileComponents();
}

describe('LeaseDetailComponent', () => {
  const api = {
    getContract: vi.fn(),
    getSchedule: vi.fn(),
    previewContract: vi.fn(),
    activateContract: vi.fn(),
    cancelContract: vi.fn(),
    postPeriods: vi.fn(),
    deleteContract: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    permissions.canWrite.mockReturnValue(true);
    api.getContract.mockReturnValue(of({ data: lease() }));
    api.getSchedule.mockReturnValue(of({ data: [line(1, 'posted'), line(2, 'scheduled'), line(3, 'scheduled')] }));
    await configure(api);
  });

  it('loads the lease and its schedule, and reads the outstanding balances off the first period not posted', () => {
    const fixture = TestBed.createComponent(LeaseDetailComponent);
    fixture.detectChanges();

    expect(api.getContract).toHaveBeenCalledWith('l1');
    expect(api.getSchedule).toHaveBeenCalledWith('l1');
    expect(fixture.componentInstance['currentVersion']()?.version_number).toBe(1);
    expect(fixture.componentInstance['outstandingLiability']()).toBe('10000.00');
    expect(fixture.nativeElement.textContent).toContain('LS-2027-0001');
  });

  it('offers remeasure and post for an active lease and activation for a draft', () => {
    const active = TestBed.createComponent(LeaseDetailComponent);
    active.detectChanges();
    const activeText = active.nativeElement.textContent as string;
    expect(activeText).toContain('LEASES.REMEASURE');
    expect(activeText).toContain('LEASES.POST_PERIODS');
    expect(activeText).not.toContain('LEASES.ACTIVATE');

    api.getContract.mockReturnValue(of({ data: lease({ status: 'draft', current_version_number: 0, versions: [] }) }));
    const draft = TestBed.createComponent(LeaseDetailComponent);
    draft.detectChanges();
    const draftText = draft.nativeElement.textContent as string;
    expect(draftText).toContain('LEASES.ACTIVATE');
    expect(draftText).toContain('LEASES.PREVIEW');
    expect(draftText).not.toContain('LEASES.POST_PERIODS');
  });

  it('shows no action to a role that cannot write', () => {
    permissions.canWrite.mockReturnValue(false);
    const fixture = TestBed.createComponent(LeaseDetailComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('LEASES.REMEASURE');
  });

  it('posts the periods through the chosen date and reloads', () => {
    api.postPeriods.mockReturnValue(of({ data: [{ id: 'p1' }, { id: 'p2' }] }));
    const fixture = TestBed.createComponent(LeaseDetailComponent);
    fixture.detectChanges();
    fixture.componentInstance['throughDate'] = '2027-03-31';

    fixture.componentInstance['postPeriods']();

    expect(api.postPeriods).toHaveBeenCalledWith('l1', '2027-03-31');
    expect(message.success).toHaveBeenCalled();
    expect(api.getContract).toHaveBeenCalledTimes(2);
  });

  it('shows the first error of the API when the posting is refused', () => {
    api.postPeriods.mockReturnValue(throwError(() => ({ error: { errors: { posting: ['No fiscal period contains the date'] } } })));
    const fixture = TestBed.createComponent(LeaseDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance['postPeriods']();

    expect(message.error).toHaveBeenCalledWith('No fiscal period contains the date');
  });

  it('activates a draft with the recognition journal by default', () => {
    api.getContract.mockReturnValue(of({ data: lease({ status: 'draft', current_version_number: 0, versions: [] }) }));
    api.activateContract.mockReturnValue(of({ data: lease() }));
    const fixture = TestBed.createComponent(LeaseDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance['activate']();

    expect(api.activateContract).toHaveBeenCalledWith('l1', { post_recognition: true });
  });
});

describe('LeaseRemeasureComponent', () => {
  const api = { remeasureContract: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await configure(api);
  });

  function create() {
    const fixture = TestBed.createComponent(LeaseRemeasureComponent);
    fixture.componentRef.setInput('lease', lease());
    fixture.componentRef.setInput('schedule', [line(1, 'posted'), line(2, 'scheduled'), line(3, 'scheduled')]);
    fixture.detectChanges();
    return fixture;
  }

  it('offers only the period starts that are not posted', () => {
    expect(create().componentInstance['periodStarts']()).toEqual(['2027-02-01', '2027-03-01']);
  });

  it('requires the new payment for an index change and the revised rate for a modification', () => {
    const component = create().componentInstance;
    const form = component['form'];

    form.patchValue({ reason: 'index_change', effective_date: '2027-02-01' });
    expect(form.controls.new_payment_amount.hasError('required')).toBe(true);
    expect(form.controls.new_discount_rate_percent.hasError('required')).toBe(false);

    form.patchValue({ reason: 'modification', new_payment_amount: '900.00' });
    expect(form.controls.new_payment_amount.valid).toBe(true);
    expect(form.controls.new_discount_rate_percent.hasError('required')).toBe(true);
    expect(form.invalid).toBe(true);
  });

  it('sends an index change without rate or term, as strings', () => {
    api.remeasureContract.mockReturnValue(of({ data: version({ version_number: 2, reason: 'index_change' }) }));
    const fixture = create();
    const component = fixture.componentInstance;
    let emitted: LeaseScheduleVersion | undefined;
    component.remeasured.subscribe((value) => (emitted = value));
    component['form'].patchValue({ reason: 'index_change', effective_date: '2027-02-01', new_payment_amount: '1050.00', remaining_term_months: 5 });

    component['save']();

    expect(api.remeasureContract).toHaveBeenCalledWith('l1', {
      effective_date: '2027-02-01',
      reason: 'index_change',
      new_payment_amount: '1050.00',
      remaining_term_months: null,
      new_discount_rate_percent: null,
      post_journal: true,
      notes: null,
    });
    expect(emitted?.version_number).toBe(2);
  });

  it('reports a failed remeasurement', () => {
    api.remeasureContract.mockReturnValue(throwError(() => Object.assign(new Error('422'), { status: 422 })));
    const component = create().componentInstance;
    component['form'].patchValue({ reason: 'index_change', effective_date: '2027-02-01', new_payment_amount: '1050.00' });

    component['save']();

    expect(message.error).toHaveBeenCalled();
  });
});

describe('LeaseFormComponent', () => {
  const api = { createContract: vi.fn(), updateContract: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await configure(api);
  });

  function valid() {
    const fixture = TestBed.createComponent(LeaseFormComponent);
    fixture.detectChanges();
    const form = fixture.componentInstance['form'];
    form.patchValue({
      title: 'Sede di Milano',
      lessor_name: 'Immobiliare Rossi Srl',
      commencement_date: '2027-01-01',
      term_months: 12,
      payment_amount: '1000.00',
      incremental_borrowing_rate_percent: '6.000000',
    });
    return { fixture, form };
  }

  it('is valid with the required terms', () => {
    expect(valid().form.valid).toBe(true);
  });

  it('refuses a term that is not a whole number of payment periods, as the API does', () => {
    const { form } = valid();

    form.patchValue({ payment_frequency: 'quarterly', term_months: 13 });
    expect(form.controls.term_months.hasError('termMultiple')).toBe(true);

    form.patchValue({ extension_reasonably_certain: true, extension_months: 2 });
    expect(form.controls.term_months.hasError('termMultiple')).toBe(false);
  });

  it('requires the option price and the useful life when the purchase option is reasonably certain', () => {
    const { form } = valid();

    form.patchValue({ purchase_option_reasonably_certain: true });
    expect(form.controls.purchase_option_price.hasError('required')).toBe(true);
    expect(form.controls.useful_life_months.hasError('required')).toBe(true);

    form.patchValue({ purchase_option_price: '5000.00', useful_life_months: 60 });
    expect(form.valid).toBe(true);
  });

  it('requires the value of the asset for the low-value exemption and refuses malformed amounts', () => {
    const { form } = valid();

    form.patchValue({ exemption: 'low_value' });
    expect(form.controls.underlying_asset_value.hasError('required')).toBe(true);

    form.patchValue({ payment_amount: '10,5' });
    expect(form.controls.payment_amount.hasError('pattern')).toBe(true);
  });

  it('creates the lease with the fields of the FormRequest and no float', () => {
    api.createContract.mockReturnValue(of({ data: lease() }));
    const { fixture } = valid();

    fixture.componentInstance['save']();

    expect(api.createContract).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sede di Milano',
        lessor_name: 'Immobiliare Rossi Srl',
        currency: 'EUR',
        term_months: 12,
        payment_amount: '1000.00',
        payment_frequency: 'monthly',
        payment_timing: 'arrears',
        incremental_borrowing_rate_percent: '6.000000',
        escalation_rate_percent: null,
        purchase_option_price: null,
        underlying_asset_value: null,
      }),
    );
  });
});

describe('LeaseMaturityReportComponent', () => {
  const report: LeaseMaturityReport = {
    as_of: '2027-12-31',
    currencies: [
      {
        currency: 'EUR',
        leases: [
          {
            contract_id: 'l1',
            number: 'LS-2027-0001',
            title: 'Sede',
            lessor_name: 'Immobiliare Rossi Srl',
            asset_class: 'real_estate',
            accounting_standard: 'ifrs16',
            currency: 'EUR',
            within_one_year: '12000.00',
            one_to_five_years: '36000.00',
            over_five_years: '0.00',
            total_undiscounted: '48000.00',
            total_discounted: '43000.00',
            unearned_interest: '5000.00',
            current_liability: '11000.00',
            non_current_liability: '32000.00',
            rou_carrying_amount: '41000.00',
          },
        ],
        totals: {
          within_one_year: '12000.00',
          one_to_five_years: '36000.00',
          over_five_years: '0.00',
          total_undiscounted: '48000.00',
          total_discounted: '43000.00',
          unearned_interest: '5000.00',
          current_liability: '11000.00',
          non_current_liability: '32000.00',
          rou_carrying_amount: '41000.00',
        },
        exempt_commitments: { within_one_year: '2500.00', one_to_five_years: '0.00', over_five_years: '0.00' },
      },
    ],
  };
  const api = { getMaturityReport: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getMaturityReport.mockReturnValue(of({ data: report }));
    await configure(api);
  });

  it('loads the report at the chosen date and shows one section per currency with its totals', () => {
    const fixture = TestBed.createComponent(LeaseMaturityReportComponent);
    fixture.detectChanges();

    expect(api.getMaturityReport).toHaveBeenCalledWith(expect.objectContaining({ as_of: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
    expect(fixture.componentInstance['sections']()).toHaveLength(1);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('EUR');
    expect(text).toContain('LS-2027-0001');
    expect(text).toContain('LEASES.EXEMPT_COMMITMENTS');
  });

  it('reloads for another currency', () => {
    const fixture = TestBed.createComponent(LeaseMaturityReportComponent);
    fixture.detectChanges();
    fixture.componentInstance['currency'] = 'CHF';

    fixture.componentInstance['load']();

    expect(api.getMaturityReport).toHaveBeenLastCalledWith(expect.objectContaining({ currency: 'CHF' }));
  });
});
