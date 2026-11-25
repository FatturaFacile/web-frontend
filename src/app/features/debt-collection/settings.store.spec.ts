import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DcPolicyPayload, DebtCollectionApiService } from '@core';
import { wrap } from './debt-collection.testing';
import { SettingsStore } from './settings.store';

const policy: DcPolicyPayload = {
  name: 'Standard CH',
  jurisdiction: 'CH',
  currency: null,
  customer_id: null,
  is_default: true,
  is_active: true,
  min_overdue_amount: '10.00',
  interest_basis: 'actual_365',
  contractual_rate_percent: null,
  levels: [
    {
      level: 1,
      min_days_overdue: 10,
      wait_days: 0,
      deadline_days: 10,
      fee_amount: '0.00',
      charge_interest: false,
      channels: ['email'],
      legal_warning: false,
      is_active: true,
    },
  ],
};

describe('SettingsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof SettingsStore>;

  beforeEach(() => {
    api = {
      listPolicies: vi.fn(() => of(wrap([{ id: 'p-1', ...policy }]))),
      listInterestRates: vi.fn(() => of(wrap([]))),
      listTemplates: vi.fn(() => of(wrap([]))),
      listEnforcementOffices: vi.fn(() => of(wrap([]))),
      createPolicy: vi.fn(() => of(wrap({ id: 'p-2', ...policy }))),
      updatePolicy: vi.fn(() => of(wrap({ id: 'p-1', ...policy }))),
      deletePolicy: vi.fn(() => of(wrap(null))),
      createInterestRate: vi.fn(() => of(wrap({}))),
      updateTemplate: vi.fn(() => of(wrap({}))),
      createEnforcementOffice: vi.fn(() => of(wrap({}))),
    };
    TestBed.configureTestingModule({
      providers: [SettingsStore, { provide: DebtCollectionApiService, useValue: api }],
    });
    store = TestBed.inject(SettingsStore);
  });

  it('loads policies, rates, templates and offices together', async () => {
    await store.load();

    expect(store.policies()).toHaveLength(1);
    expect(api['listInterestRates']).toHaveBeenCalledWith(undefined);
    expect(api['listTemplates']).toHaveBeenCalledWith({});
    expect(api['listEnforcementOffices']).toHaveBeenCalledOnce();
    expect(store.loading()).toBe(false);
  });

  it('creates a policy without an id and updates one with an id, then re-reads the list', async () => {
    await store.savePolicy(null, policy);
    await store.savePolicy('p-1', policy);

    expect(api['createPolicy']).toHaveBeenCalledWith(policy);
    expect(api['updatePolicy']).toHaveBeenCalledWith('p-1', policy);
    expect(api['listPolicies']).toHaveBeenCalledTimes(2);
  });

  it('deletes a policy', async () => {
    const outcome = await store.deletePolicy('p-1');

    expect(outcome.ok).toBe(true);
    expect(api['deletePolicy']).toHaveBeenCalledWith('p-1');
  });

  it('filters the interest rates by jurisdiction', async () => {
    await store.setRateJurisdiction('IT');

    expect(api['listInterestRates']).toHaveBeenCalledWith('IT');
    expect(store.rateJurisdiction()).toBe('IT');
  });

  it('filters the templates by code and language', async () => {
    await store.setTemplateFilter({ code: 'reminder_1' });
    await store.setTemplateFilter({ locale: 'de' });

    expect(api['listTemplates']).toHaveBeenLastCalledWith({ code: 'reminder_1', locale: 'de' });
  });

  it('saves a template and an enforcement office', async () => {
    await store.saveTemplate('t-1', 'Subject', 'Body {{customer}}');
    await store.saveOffice(null, {
      name: 'Betreibungsamt Zürich',
      postal_code_from: '8000',
      postal_code_to: '8099',
      address: 'Strasse 1',
      postal_code: '8001',
      city: 'Zürich',
      canton: 'ZH',
      email: null,
    });

    expect(api['updateTemplate']).toHaveBeenCalledWith('t-1', {
      subject: 'Subject',
      body: 'Body {{customer}}',
    });
    expect(api['createEnforcementOffice']).toHaveBeenCalledOnce();
  });
});
