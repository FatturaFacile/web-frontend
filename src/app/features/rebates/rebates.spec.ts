import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { AccountingApiService, CrmApiService, ProcurementApiService, RebateAccrual, RebateAgreement, RebatePromotion, RebatesApiService, TranslateService } from '@core';
import { ProcurementExtraApiService } from '@core/api/procurement-extra-api.service';
import { RebatesAgreementDetailComponent } from './rebates-agreement-detail.component';
import { RebatesAgreementsComponent } from './rebates-agreements.component';
import { RebatesDashboardComponent } from './rebates-dashboard.component';
import { RebatesPromotionsComponent } from './rebates-promotions.component';
import { apiErrorText, blankToNull, contactLabel, decimalOrNull, loadContacts } from './rebates.util';

const agreement: RebateAgreement = {
  id: 'ag-1',
  code: 'RB-1',
  name: 'Annual rebate',
  direction: 'sales',
  contact_id: 'c-1',
  contact_name: 'Rossi Srl',
  tier_mode: 'retroactive',
  starts_on: '2027-01-01',
  ends_on: '2027-12-31',
  currency: 'EUR',
  status: 'draft',
  notes: null,
  tiers: [{ id: 't-1', threshold_amount: '10000.00', rate_percent: '2.0000' }],
  open_rebate: '0.00',
};

const accrual: RebateAccrual = {
  id: 'ac-1',
  agreement_id: 'ag-1',
  as_of: '2027-03-31',
  base_amount: '20000.00',
  cumulative_rebate: '400.00',
  rebate_amount: '400.00',
  applied_rate_percent: '2.0000',
  status: 'accrued',
  settlement_id: null,
};

const promotion: RebatePromotion = {
  id: 'pr-1',
  code: 'JUN',
  name: 'June sale',
  discount_type: 'percentage',
  discount_value: '10.0000',
  product_id: null,
  contact_id: null,
  min_quantity: null,
  starts_on: '2027-06-01',
  ends_on: '2027-06-30',
  is_active: true,
  state: 'active',
  notes: null,
};

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };
const crmSpy = { getClients: vi.fn(), getSuppliers: vi.fn() };
const accountingSpy = { getAccounts: vi.fn().mockReturnValue(of({ data: [] })) };
const procurementExtraSpy = { listContracts: vi.fn().mockReturnValue(of({ data: [] })) };
const procurementSpy = { getSupplierInvoices: vi.fn().mockReturnValue(of({ data: [] })) };

function configure(api: Record<string, unknown>): void {
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
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'ag-1' }) } } },
      provideNzIcons(icons),
    ],
  });
}

describe('rebates util', () => {
  it('reads the first validation message of a 422', () => {
    expect(apiErrorText(new HttpErrorResponse({ status: 422, error: { errors: { tax_rate: ['Enter the VAT rate'] } } }))).toBe('Enter the VAT rate');
    expect(apiErrorText(new HttpErrorResponse({ status: 500, error: { message: 'Server error' } }))).toBe('Server error');
    expect(apiErrorText(new Error('boom'))).toBeNull();
  });

  it('turns blanks into null and numbers into API strings', () => {
    expect(blankToNull('  ')).toBeNull();
    expect(decimalOrNull(null)).toBeNull();
    expect(decimalOrNull(2.5)).toBe('2.5');
  });

  it('names a contact by company or by person and loads customers or suppliers by direction', () => {
    expect(contactLabel({ company_name: 'Rossi Srl', first_name: null, last_name: null })).toBe('Rossi Srl');
    expect(contactLabel({ company_name: null, first_name: 'Anna', last_name: 'Bianchi' })).toBe('Anna Bianchi');

    crmSpy.getClients.mockReturnValue(of({ data: [{ id: 'c-1' }] }));
    crmSpy.getSuppliers.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    let customers: unknown[] = [];
    let suppliers: unknown[] | null = null;
    loadContacts(crmSpy as unknown as CrmApiService, 'sales').subscribe((rows) => (customers = rows));
    loadContacts(crmSpy as unknown as CrmApiService, 'purchase').subscribe((rows) => (suppliers = rows));

    expect(customers).toHaveLength(1);
    expect(suppliers).toEqual([]);
  });
});

describe('RebatesDashboardComponent', () => {
  it('loads the dashboard', () => {
    const dashboard = { agreements: { total: 2, by_status: { active: 2 } }, accrued_open: { sales: '400.00', purchase: '0.00' }, settled: { sales: '0.00', purchase: '0.00' }, promotions: { active: 1, scheduled: 0, expired: 0 }, ending_agreements: [] };
    const api = { getDashboard: vi.fn().mockReturnValue(of({ data: dashboard })) };
    configure(api);
    const fixture = TestBed.createComponent(RebatesDashboardComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.dashboard()).toEqual(dashboard);
  });
});

describe('RebatesAgreementsComponent', () => {
  const api = { getAgreements: vi.fn(), createAgreement: vi.fn(), updateAgreement: vi.fn(), activateAgreement: vi.fn(), deleteAgreement: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getAgreements.mockReturnValue(of({ data: [agreement] }));
    api.createAgreement.mockReturnValue(of({ data: agreement }));
    api.activateAgreement.mockReturnValue(of({ data: { ...agreement, status: 'active' } }));
    api.deleteAgreement.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { agreement: ['Only a draft agreement can be deleted'] } } })));
    crmSpy.getClients.mockReturnValue(of({ data: [{ id: 'c-1', company_name: 'Rossi Srl', first_name: null, last_name: null }] }));
    crmSpy.getSuppliers.mockReturnValue(of({ data: [] }));
    configure(api);
  });

  it('lists the agreements with the filters', () => {
    const fixture = TestBed.createComponent(RebatesAgreementsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.agreements()).toEqual([agreement]);

    fixture.componentInstance.directionFilter.set('purchase');
    fixture.componentInstance.load();
    expect(api.getAgreements).toHaveBeenLastCalledWith({ direction: 'purchase', status: undefined, per_page: 100 });
  });

  it('creates an agreement with the API payload and its tiers', () => {
    const fixture = TestBed.createComponent(RebatesAgreementsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.patchValue({ code: 'RB-1', name: 'Annual rebate', contact_id: 'c-1', starts_on: '2027-01-01', ends_on: '2027-12-31' });
    component.tiers.at(0).patchValue({ threshold_amount: '10000', rate_percent: '2' });
    component.addTier();
    component.tiers.at(1).patchValue({ threshold_amount: '50000', rate_percent: '4' });
    component.save();

    expect(api.createAgreement).toHaveBeenCalledWith({
      code: 'RB-1',
      name: 'Annual rebate',
      direction: 'sales',
      contact_id: 'c-1',
      tier_mode: 'retroactive',
      starts_on: '2027-01-01',
      ends_on: '2027-12-31',
      currency: 'EUR',
      notes: null,
      rebate_type: 'tiered_volume',
      supplier_contract_id: null,
      fixed_bonus_target: null,
      fixed_bonus_amount: null,
      accrual_frequency: 'quarterly',
      accrual_account_id: null,
      income_account_id: null,
      tiers: [
        { threshold_amount: '10000', rate_percent: '2', flat_amount: null },
        { threshold_amount: '50000', rate_percent: '4', flat_amount: null },
      ],
    });
    expect(messageSpy.success).toHaveBeenCalledWith('REBATES.AGREEMENT_SAVED');
  });

  it('keeps at least one tier, activates and shows the API error of a refused delete', () => {
    const fixture = TestBed.createComponent(RebatesAgreementsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal(agreement);
    expect(component.tiers.length).toBe(1);
    expect(component.form.controls.code.value).toBe('RB-1');

    component.activate(agreement);
    expect(api.activateAgreement).toHaveBeenCalledWith('ag-1');

    component.remove(agreement);
    expect(messageSpy.error).toHaveBeenCalledWith('Only a draft agreement can be deleted');
  });
});

describe('RebatesAgreementDetailComponent', () => {
  const api = { getAgreement: vi.fn(), getAccruals: vi.fn(), getSettlements: vi.fn(), getProgress: vi.fn(), calculateAccrual: vi.fn(), settleAgreement: vi.fn(), closeAgreement: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getAgreement.mockReturnValue(of({ data: { ...agreement, status: 'active' } }));
    api.getAccruals.mockReturnValue(of({ data: [accrual] }));
    api.getSettlements.mockReturnValue(of({ data: [] }));
    api.getProgress.mockReturnValue(of({ data: null }));
    api.calculateAccrual.mockReturnValue(of({ data: { accrual, base_amount: '20000.00', cumulative_rebate: '400.00', previously_accrued: '0.00', delta: '400.00' } }));
    api.settleAgreement.mockReturnValue(of({ data: { id: 'st-1' } }));
    api.closeAgreement.mockReturnValue(of({ data: agreement }));
    configure(api);
  });

  it('loads the agreement, its accruals and settlements and sums the open rebate', () => {
    const fixture = TestBed.createComponent(RebatesAgreementDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getAgreement).toHaveBeenCalledWith('ag-1');
    expect(api.getSettlements).toHaveBeenCalledWith({ agreement_id: 'ag-1', per_page: 100 });
    expect(component.openAmount()).toBe(400);
  });

  it('calculates up to the chosen date, settles with the VAT rate and closes', () => {
    const fixture = TestBed.createComponent(RebatesAgreementDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.asOf.set('2027-06-30');
    component.calculate();
    expect(api.calculateAccrual).toHaveBeenCalledWith('ag-1', { as_of: '2027-06-30' });
    expect(messageSpy.success).toHaveBeenCalledWith('REBATES.CALCULATED');

    component.openSettle();
    component.taxRate.set(22);
    component.settle();
    expect(api.settleAgreement).toHaveBeenCalledWith('ag-1', { tax_rate: '22' });

    component.close();
    expect(api.closeAgreement).toHaveBeenCalledWith('ag-1');
  });

  it('shows the API error of a refused settlement', () => {
    api.settleAgreement.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { tax_rate: ['Enter the VAT rate of the credit note.'] } } })));
    const fixture = TestBed.createComponent(RebatesAgreementDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance.settle();

    expect(messageSpy.error).toHaveBeenCalledWith('Enter the VAT rate of the credit note.');
  });
});

describe('RebatesPromotionsComponent', () => {
  const api = { getPromotions: vi.fn(), createPromotion: vi.fn(), updatePromotion: vi.fn(), deletePromotion: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getPromotions.mockReturnValue(of({ data: [promotion] }));
    api.createPromotion.mockReturnValue(of({ data: promotion }));
    api.deletePromotion.mockReturnValue(of(undefined));
    configure(api);
  });

  it('lists the promotions filtered by state', () => {
    const fixture = TestBed.createComponent(RebatesPromotionsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.promotions()).toEqual([promotion]);

    fixture.componentInstance.stateFilter.set('expired');
    fixture.componentInstance.load();
    expect(api.getPromotions).toHaveBeenLastCalledWith({ state: 'expired', per_page: 100 });
  });

  it('creates a promotion with the API payload', () => {
    const fixture = TestBed.createComponent(RebatesPromotionsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.patchValue({ code: 'JUN', name: 'June sale', discount_value: 10, starts_on: '2027-06-01', ends_on: '2027-06-30' });
    component.save();

    expect(api.createPromotion).toHaveBeenCalledWith({
      code: 'JUN',
      name: 'June sale',
      discount_type: 'percentage',
      discount_value: '10',
      min_quantity: null,
      starts_on: '2027-06-01',
      ends_on: '2027-06-30',
      is_active: true,
      notes: null,
    });
  });

  it('deletes a promotion', () => {
    const fixture = TestBed.createComponent(RebatesPromotionsComponent);
    fixture.detectChanges();

    fixture.componentInstance.remove(promotion);

    expect(api.deletePromotion).toHaveBeenCalledWith('pr-1');
    expect(messageSpy.success).toHaveBeenCalledWith('REBATES.DELETED');
  });
});
