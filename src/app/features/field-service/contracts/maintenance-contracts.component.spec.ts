import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import type { FsmMaintenanceContract } from '@core';
import { ClientApiService, FsmApiService, I18nService, PermissionsService } from '@core';
import { icons } from '../../../icons-provider';
import { buildFrequencyRule, EMPTY_RULE_FORM, ruleToForm, summariseRule } from './contract-rule.utils';
import { MaintenanceContractsComponent } from './maintenance-contracts.component';

interface Harness {
  form: { patchValue(value: object): void; controls: { rule: { patchValue(value: object): void } } };
  openCreate(): void;
  openEdit(contract: FsmMaintenanceContract): void;
  save(): void;
  runPreventive(): void;
  runResult: () => { created: string[] } | null;
}

const contract: FsmMaintenanceContract = {
  id: 'k1',
  customer_id: 'c1',
  contract_number: 'MC-1',
  title: 'HVAC maintenance',
  start_date: '2026-01-01',
  end_date: null,
  status: 'active',
  coverage_type: 'parts_and_labor',
  preventive_frequency_rule: { calendar: { every: 6, unit: 'month' }, meter: { operating_hours: 500, cycles: 10000, lead_percent: 10 }, lead_days: 14 },
  included_visits_per_year: 4,
  used_visits_current_year: 1,
  callout_fee_amount: '50.00',
  hourly_labor_rate: '80.00',
  recurring_billing_subscription_id: null,
  currency: 'EUR',
  notes: null,
  equipment_passport_ids: ['e1', 'e2'],
};

describe('contract rule helpers', () => {
  it('builds the rule only from the filled triggers', () => {
    expect(buildFrequencyRule(EMPTY_RULE_FORM)).toBeNull();
    expect(buildFrequencyRule({ ...EMPTY_RULE_FORM, lead_days: 5 })).toBeNull();
    expect(buildFrequencyRule({ ...EMPTY_RULE_FORM, calendar_every: 3, calendar_unit: 'week' })).toEqual({ calendar: { every: 3, unit: 'week' } });
    expect(buildFrequencyRule({ ...EMPTY_RULE_FORM, meter_hours: 250, meter_lead_percent: 10, lead_days: 7 })).toEqual({
      meter: { operating_hours: 250, lead_percent: 10 },
      lead_days: 7,
    });
  });

  it('round-trips a full rule through the form', () => {
    const rule = contract.preventive_frequency_rule;
    expect(buildFrequencyRule(ruleToForm(rule))).toEqual(rule);
    expect(ruleToForm(null)).toEqual(EMPTY_RULE_FORM);
  });

  it('summarises calendar and meter triggers', () => {
    const t = (key: string): string => key;
    expect(summariseRule(contract, t)).toBe('6 FSM.CONTRACTS.UNIT_MONTH, 500 FSM.CONTRACTS.HOURS_SHORT, 10000 FSM.CONTRACTS.CYCLES_SHORT');
    expect(summariseRule({ preventive_frequency_rule: null }, t)).toBe('');
  });
});

describe('MaintenanceContractsComponent', () => {
  let fixture: ComponentFixture<MaintenanceContractsComponent>;
  let harness: Harness;
  const api = { listContracts: vi.fn(), listEquipment: vi.fn(), createContract: vi.fn(), updateContract: vi.fn(), runPreventive: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.listContracts.mockReturnValue(of({ data: [contract] }));
    api.listEquipment.mockReturnValue(of({ data: [] }));
    api.createContract.mockReturnValue(of({ data: contract }));
    api.updateContract.mockReturnValue(of({ data: contract }));
    api.runPreventive.mockReturnValue(of({ data: { evaluated_assets: 3, created: ['w1', 'w2'], skipped_existing: 1 } }));

    await TestBed.configureTestingModule({
      imports: [MaintenanceContractsComponent],
      providers: [
        provideNzIcons(icons),
        { provide: FsmApiService, useValue: api },
        { provide: ClientApiService, useValue: { list: () => of({ data: [] }) } },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: I18nService, useValue: { currentLanguage: () => 'it', translate: (key: string) => key } },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MaintenanceContractsComponent);
    harness = fixture.componentInstance as unknown as Harness;
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('lists the contracts with their rule, visits and equipment count', () => {
    const text = el().querySelector('[data-testid="contracts-table"]')?.textContent ?? '';
    expect(text).toContain('MC-1');
    expect(text).toContain('1 / 4');
    expect(text).toContain('FSM.CONTRACTS.UNIT_MONTH');
  });

  it('does not save an incomplete contract', () => {
    harness.openCreate();
    harness.save();
    expect(api.createContract).not.toHaveBeenCalled();
  });

  it('creates a contract with coverage, preventive rule, visits, call-out fee and equipment', () => {
    harness.openCreate();
    harness.form.patchValue({
      customer_id: 'c1',
      contract_number: 'MC-2',
      title: 'New contract',
      start_date: new Date(2026, 2, 1),
      coverage_type: 'full_comprehensive',
      included_visits_per_year: 2,
      callout_fee_amount: 45,
      equipment_passport_ids: ['e1'],
    });
    harness.form.controls.rule.patchValue({ calendar_every: 6, calendar_unit: 'month', meter_hours: 500 });

    harness.save();

    expect(api.createContract).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: 'c1',
        contract_number: 'MC-2',
        start_date: '2026-03-01',
        end_date: null,
        coverage_type: 'full_comprehensive',
        preventive_frequency_rule: { calendar: { every: 6, unit: 'month' }, meter: { operating_hours: 500 } },
        included_visits_per_year: 2,
        callout_fee_amount: 45,
        equipment_passport_ids: ['e1'],
      }),
    );
    expect(message.success).toHaveBeenCalled();
  });

  it('edits an existing contract through the update endpoint', () => {
    harness.openEdit(contract);
    harness.form.patchValue({ title: 'Renamed' });
    harness.save();
    expect(api.updateContract).toHaveBeenCalledWith('k1', expect.objectContaining({ title: 'Renamed', preventive_frequency_rule: contract.preventive_frequency_rule, equipment_passport_ids: ['e1', 'e2'] }));
  });

  it('triggers the preventive generation and reports how many work orders were created', () => {
    harness.runPreventive();
    fixture.detectChanges();
    expect(api.runPreventive).toHaveBeenCalledTimes(1);
    expect(harness.runResult()?.created).toEqual(['w1', 'w2']);
    expect(el().querySelector('[data-testid="run-result"]')).not.toBeNull();
  });
});
