import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { CrmExtensionApiService, CrmQuoteConfiguration, I18nService, PermissionsService, TranslateService } from '@core';
import { AutomationComponent } from './automation/automation.component';
import { CpqComponent } from './cpq/cpq.component';
import { PartnersComponent } from './partners/partners.component';
import { TerritoriesComponent } from './territories/territories.component';

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const i18nSpy = { translate: vi.fn().mockImplementation((key: string) => key), instant: vi.fn().mockImplementation((key: string) => key) };
const permissionsSpy = { canWrite: vi.fn().mockReturnValue(true), canRead: vi.fn().mockReturnValue(true) };

const quote: CrmQuoteConfiguration = {
  id: 'q-1',
  opportunity_id: null,
  product_configuration_id: null,
  partner_id: null,
  name: 'Big order',
  quantity: '60.000',
  unit_price: '100.0000',
  currency: 'EUR',
  rule_discount_percent: '15.00',
  extra_discount_percent: '5.00',
  discount_percent: '20.00',
  net_total: '4800.00',
  status: 'pending_approval',
  required_approver_role: 'sales_manager',
  decision_reason: null,
};

/* The templates read protected members; the specs reach them through bracket access (`component['save']()`). */
function configure(api: Record<string, unknown>): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CrmExtensionApiService, useValue: api },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: I18nService, useValue: i18nSpy },
      { provide: TranslateService, useValue: i18nSpy },
      { provide: PermissionsService, useValue: permissionsSpy },
      provideNzIcons(icons),
    ],
  });
}

describe('TerritoriesComponent', () => {
  const api = { getTerritories: vi.fn(), getSalesQuotas: vi.fn(), createTerritory: vi.fn(), deleteTerritory: vi.fn(), assignTerritories: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getTerritories.mockReturnValue(of({ data: [] }));
    api.getSalesQuotas.mockReturnValue(of({ data: [] }));
    api.createTerritory.mockReturnValue(of({ data: {} }));
    api.assignTerritories.mockReturnValue(of({ data: { assigned: 2, unmatched: 1, kept_manual: 0 } }));
    configure(api);
  });

  it('creates a territory with the two-letter countries the API accepts', () => {
    const fixture = TestBed.createComponent(TerritoriesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component['code'] = ' ch ';
    component['name'] = 'Switzerland';
    component['countries'] = 'ch, it; germany DE';
    component['priority'] = 10;
    component['save']();

    expect(api.createTerritory).toHaveBeenCalledWith({ code: 'ch', name: 'Switzerland', priority: 10, criteria: { countries: ['CH', 'IT', 'DE'] } });
  });

  it('runs the assignment rules and reports the counts', () => {
    const fixture = TestBed.createComponent(TerritoriesComponent);
    fixture.detectChanges();

    fixture.componentInstance['runAssignment']();

    expect(api.assignTerritories).toHaveBeenCalled();
    expect(i18nSpy.translate).toHaveBeenCalledWith('CRMEXT.TERRITORIES.RULES_DONE', { assigned: 2, unmatched: 1 });
  });
});

describe('CpqComponent', () => {
  const api = {
    getQuoteConfigurations: vi.fn(),
    getPricingRules: vi.fn(),
    getDiscountThresholds: vi.fn(),
    previewQuoteConfiguration: vi.fn(),
    createQuoteConfiguration: vi.fn(),
    submitQuoteConfiguration: vi.fn(),
    approveQuoteConfiguration: vi.fn(),
    rejectQuoteConfiguration: vi.fn(),
    createPricingRule: vi.fn(),
    deletePricingRule: vi.fn(),
    createDiscountThreshold: vi.fn(),
    deleteDiscountThreshold: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getQuoteConfigurations.mockReturnValue(of({ data: [quote] }));
    api.getPricingRules.mockReturnValue(of({ data: [] }));
    api.getDiscountThresholds.mockReturnValue(of({ data: [] }));
    api.previewQuoteConfiguration.mockReturnValue(of({ data: { discount_percent: '20.00', net_total: '4800.00', required_approver_role: 'sales_manager' } }));
    api.createQuoteConfiguration.mockReturnValue(of({ data: quote }));
    api.approveQuoteConfiguration.mockReturnValue(of({ data: quote }));
    api.rejectQuoteConfiguration.mockReturnValue(of({ data: quote }));
    api.createDiscountThreshold.mockReturnValue(of({ data: {} }));
    configure(api);
  });

  it('shows the price the API computes and never sends a discount of its own', () => {
    const fixture = TestBed.createComponent(CpqComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component['quoteName'] = 'Big order';
    component['quoteQuantity'] = 60;
    component['quoteUnitPrice'] = 100;
    component['quoteExtraDiscount'] = 5;
    component['preview']();

    expect(api.previewQuoteConfiguration).toHaveBeenCalledWith({ name: 'Big order', quantity: 60, unit_price: 100, extra_discount_percent: 5 });
    component['saveQuote']();
    expect(api.createQuoteConfiguration).toHaveBeenCalledWith({ name: 'Big order', quantity: 60, unit_price: 100, extra_discount_percent: 5 });
  });

  it('approves a pending quote and rejects another with a reason', () => {
    const fixture = TestBed.createComponent(CpqComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component['approveQuote'](quote);
    expect(api.approveQuoteConfiguration).toHaveBeenCalledWith('q-1');

    component['askReject'](quote);
    component['reason'] = 'Too deep';
    component['reject']();
    expect(api.rejectQuoteConfiguration).toHaveBeenCalledWith('q-1', 'Too deep');
  });

  it('adds a discount threshold with its approver role', () => {
    const fixture = TestBed.createComponent(CpqComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component['thresholdFrom'] = 30;
    component['thresholdRole'] = 'admin';
    component['addThreshold']();

    expect(api.createDiscountThreshold).toHaveBeenCalledWith({ from_discount_percent: 30, approver_role: 'admin' });
  });
});

describe('PartnersComponent', () => {
  const api = {
    getPartners: vi.fn(),
    getDealRegistrations: vi.fn(),
    getMdfFunds: vi.fn(),
    getMdfClaims: vi.fn(),
    createPartner: vi.fn(),
    evaluatePartnerTiers: vi.fn(),
    approveDealRegistration: vi.fn(),
    rejectDealRegistration: vi.fn(),
    rejectMdfClaim: vi.fn(),
    markDealRegistrationWon: vi.fn(),
    approveMdfClaim: vi.fn(),
    payMdfClaim: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    for (const name of ['getPartners', 'getDealRegistrations', 'getMdfFunds', 'getMdfClaims']) {
      (api as Record<string, ReturnType<typeof vi.fn>>)[name].mockReturnValue(of({ data: [] }));
    }
    api.createPartner.mockReturnValue(of({ data: {} }));
    api.rejectDealRegistration.mockReturnValue(of({ data: {} }));
    api.rejectMdfClaim.mockReturnValue(of({ data: {} }));
    configure(api);
  });

  it('creates an active partner of the chosen type', () => {
    const fixture = TestBed.createComponent(PartnersComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component['partnerName'] = ' Alpine Resellers ';
    component['partnerType'] = 'distributor';
    component['partnerEmail'] = '';
    component['savePartner']();

    expect(api.createPartner).toHaveBeenCalledWith({ name: 'Alpine Resellers', partner_type: 'distributor', status: 'active', contact_email: null });
  });

  it('rejects a deal registration or an MDF claim with the typed reason', () => {
    const fixture = TestBed.createComponent(PartnersComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component['askReason']({ kind: 'deal', id: 'd-1' });
    component['reason'] = ' Already covered ';
    component['reject']();
    expect(api.rejectDealRegistration).toHaveBeenCalledWith('d-1', 'Already covered');

    component['askReason']({ kind: 'claim', id: 'c-1' });
    component['reason'] = 'Exhausted';
    component['reject']();
    expect(api.rejectMdfClaim).toHaveBeenCalledWith('c-1', 'Exhausted');
  });
});

describe('AutomationComponent', () => {
  const api = {
    getAutomationSequences: vi.fn(),
    createAutomationSequence: vi.fn(),
    deleteAutomationSequence: vi.fn(),
    getAutomationEnrollments: vi.fn(),
    getAutomationStepLogs: vi.fn(),
    exitAutomationEnrollment: vi.fn(),
    runAutomation: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getAutomationSequences.mockReturnValue(of({ data: [] }));
    api.createAutomationSequence.mockReturnValue(of({ data: {} }));
    api.runAutomation.mockReturnValue(of({ data: { handled: 4 } }));
    configure(api);
  });

  it('only sends an email subject and body for email steps, as the FormRequest requires', () => {
    const fixture = TestBed.createComponent(AutomationComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component['openModal']();
    component['name'] = 'Welcome nurture';
    expect(component['valid']()).toBe(false);

    component['steps'] = [
      { step_type: 'email', delay_days: 0, subject: 'Welcome', body: 'Hello' },
      { step_type: 'wait', delay_days: 2, subject: 'ignored', body: 'ignored' },
    ];
    expect(component['valid']()).toBe(true);
    component['save']();

    expect(api.createAutomationSequence).toHaveBeenCalledWith({
      name: 'Welcome nurture',
      entity: 'leads',
      trigger_type: 'manual',
      exit_conditions: ['lead_converted', 'consent_withdrawn'],
      steps: [
        { step_type: 'email', delay_days: 0, subject: 'Welcome', body: 'Hello' },
        { step_type: 'wait', delay_days: 2, subject: null, body: null },
      ],
    });
  });

  it('runs the due steps and reports how many enrolments were handled', () => {
    const fixture = TestBed.createComponent(AutomationComponent);
    fixture.detectChanges();

    fixture.componentInstance['runDue']();

    expect(i18nSpy.translate).toHaveBeenCalledWith('CRMEXT.AUTOMATION.RUN_DONE', { handled: 4 });
  });
});
