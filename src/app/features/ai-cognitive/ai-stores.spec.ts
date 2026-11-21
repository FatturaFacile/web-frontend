import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiCognitiveApiService } from './ai-cognitive-api.service';
import {
  anomalyFixture,
  bandsFixture,
  dashboardFixture,
  settingsFixture,
  suggestionFixture,
} from './ai-cognitive.testing';
import { AiInsightsStore } from './ai-insights.store';
import { AiSettingsStore } from './ai-settings.store';
import { AiWorkbenchStore } from './ai-workbench.store';

const ok = <T>(data: T, meta?: unknown) => of({ success: true, message: '', data, meta });

const meta = {
  current_page: 1,
  per_page: 25,
  total: 2,
  last_page: 1,
  open_by_kind: { sales_quote: 1, contact: 1 },
};

describe('AiWorkbenchStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: AiWorkbenchStore;
  const first = suggestionFixture();
  const second = suggestionFixture({
    id: 's-2',
    kind: 'contact',
    proposed_payload: { company_name: 'Neu AG' },
    amount: null,
  });

  beforeEach(() => {
    api = {
      queue: vi.fn(() => ok([first, second], meta)),
      suggestion: vi.fn(() => ok(suggestionFixture({ id: 's-9', status: 'rejected' }))),
      approve: vi.fn(() => ok({ ...first, status: 'approved' })),
      reject: vi.fn(() => ok({ ...first, status: 'rejected' })),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AiCognitiveApiService, useValue: api }],
    });
    store = TestBed.inject(AiWorkbenchStore);
  });

  it('loads the queue with its filters and counts the open items by kind', () => {
    store.setKindFilter('sales_quote');
    store.setPriorityFilter('high');
    store.loadQueue(2).subscribe();

    expect(api['queue']).toHaveBeenCalledWith({
      status: null,
      kind: 'sales_quote',
      priority: 'high',
      page: 2,
      perPage: 25,
    });
    expect(store.items()).toHaveLength(2);
    expect(store.openTotal()).toBe(2);
    expect(store.loading()).toBe(false);
  });

  it('opens a suggestion with its proposal as the payload to correct', () => {
    store.loadQueue().subscribe();
    store.select('s-1');

    expect(store.selected()?.id).toBe('s-1');
    expect(store.draft()).toEqual(first.proposed_payload);
    expect(store.edited()).toBe(false);
    expect(store.canDecide()).toBe(true);
  });

  it('approves as proposed when nothing was changed', () => {
    store.loadQueue().subscribe();
    store.select('s-1');
    store.approve().subscribe();

    expect(api['approve']).toHaveBeenCalledWith('s-1', null, null);
  });

  it('sends the corrected payload (Edit and Approve) only when the reviewer changed it', () => {
    store.loadQueue().subscribe();
    store.select('s-1');
    store.setDraft({ ...first.proposed_payload, contact_id: 'c-1' });

    expect(store.edited()).toBe(true);

    store.approve('Found the customer by phone').subscribe();

    expect(api['approve']).toHaveBeenCalledWith(
      's-1',
      { ...first.proposed_payload, contact_id: 'c-1' },
      'Found the customer by phone',
    );
  });

  it('takes the decided item out of the queue, lowers its counter and opens the next one', () => {
    store.loadQueue().subscribe();
    store.select('s-1');
    store.approve().subscribe();

    expect(store.items().map((item) => item.id)).toEqual(['s-2']);
    expect(store.meta()?.open_by_kind.sales_quote).toBe(0);
    expect(store.meta()?.total).toBe(1);
    expect(store.selectedId()).toBe('s-2');
    expect(store.draft()).toEqual({ company_name: 'Neu AG' });
    expect(store.busy()).toBe(false);
  });

  it('rejects with the reason and clears the selection when the queue is empty', () => {
    api['queue'] = vi.fn(() =>
      ok([first], { ...meta, total: 1, open_by_kind: { sales_quote: 1 } }),
    );
    store.loadQueue().subscribe();
    store.select('s-1');
    store.reject('Not a customer').subscribe();

    expect(api['reject']).toHaveBeenCalledWith('s-1', 'Not a customer');
    expect(store.selectedId()).toBeNull();
    expect(store.draft()).toBeNull();
  });

  it('opens a suggestion that is not in the loaded page by its id, and it cannot be decided when it is closed', () => {
    store.open('s-9').subscribe();

    expect(api['suggestion']).toHaveBeenCalledWith('s-9');
    expect(store.selected()?.id).toBe('s-9');
    expect(store.canDecide()).toBe(false);
  });

  it('refuses to decide without a selection and resets the draft to the proposal', () => {
    expect(() => store.reject('x')).toThrow();

    store.loadQueue().subscribe();
    store.select('s-1');
    store.setDraft({ changed: true });
    store.resetDraft();

    expect(store.draft()).toEqual(first.proposed_payload);
  });
});

describe('AiInsightsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: AiInsightsStore;

  beforeEach(() => {
    api = {
      dashboard: vi.fn(() => ok(dashboardFixture())),
      generateInsights: vi.fn(() => ok({ cash_flow: 1, anomalies: 1 })),
      approve: vi.fn(() => ok(suggestionFixture({ status: 'approved' }))),
      reject: vi.fn(() => ok(suggestionFixture({ status: 'rejected' }))),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AiCognitiveApiService, useValue: api }],
    });
    store = TestBed.inject(AiInsightsStore);
  });

  it('loads the dashboard for the chosen horizon', () => {
    store.setHorizon(365);
    store.load().subscribe();

    expect(api['dashboard']).toHaveBeenCalledWith(365);
    expect(store.recommendations()).toHaveLength(1);
    expect(store.anomalies()).toHaveLength(1);
    expect(store.paymentRisk()).toHaveLength(1);
  });

  it('counts the urgent items and finds the lowest balance and the first negative day of the pessimistic scenario', () => {
    store.load().subscribe();

    expect(store.criticalCount()).toBe(2);
    expect(store.lowestBalance()).toBe(1200);
    expect(store.firstNegativeDate()).toBe('2026-03-07');
  });

  it('finds no negative day when the pessimistic balance stays above zero, and nothing without a forecast', () => {
    api['dashboard'] = vi.fn(() =>
      ok(dashboardFixture({ cash_flow: bandsFixture({ p10: [5000, 4000, 3000] }) })),
    );
    store.load().subscribe();

    expect(store.firstNegativeDate()).toBeNull();

    api['dashboard'] = vi.fn(() => ok(dashboardFixture({ cash_flow: null })));
    store.load().subscribe();

    expect(store.lowestBalance()).toBeNull();
    expect(store.firstNegativeDate()).toBeNull();
  });

  it('runs the analysis and reloads the lists', () => {
    store.generate().subscribe();

    expect(api['generateInsights']).toHaveBeenCalled();
    expect(api['dashboard']).toHaveBeenCalled();
    expect(store.generating()).toBe(false);
  });

  it('removes an acknowledged or dismissed item from the lists', () => {
    store.load().subscribe();
    store.acknowledge(store.recommendations()[0]!).subscribe();

    expect(api['approve']).toHaveBeenCalledWith('r-1', null, null);
    expect(store.recommendations()).toHaveLength(0);

    store.dismiss(anomalyFixture(), 'false positive').subscribe();

    expect(api['reject']).toHaveBeenCalledWith('a-1', 'false positive');
    expect(store.anomalies()).toHaveLength(0);
    expect(store.busyId()).toBeNull();
  });
});

describe('AiSettingsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: AiSettingsStore;

  const form = {
    is_enabled: true,
    is_default: true,
    endpoint: null,
    model: 'claude-sonnet-5-5',
    light_model: null,
    embedding_model: null,
    api_key: null,
    extra: {},
    max_data_classification: 'internal' as const,
    pii_masking_enabled: true,
    monthly_token_budget: null,
    rate_limit_per_minute: null,
  };

  beforeEach(() => {
    api = {
      settings: vi.fn(() => ok(settingsFixture())),
      usageAudit: vi.fn(() =>
        ok({
          period: { from: '2026-03-01', to: '2026-03-31' },
          usage: { by_provider: [], total_tokens: 0, total_cost_usd: 0 },
          chain: { valid: true, checked: 4, broken_at: null },
        }),
      ),
      saveProvider: vi.fn(() =>
        ok({
          ...settingsFixture().providers[0]!,
          provider: 'anthropic',
          is_default: true,
          model: form.model,
        }),
      ),
      saveRule: vi.fn((rule: { workflow: string }) =>
        ok({ ...rule, auto_approve_min_confidence: 0.97 }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AiCognitiveApiService, useValue: api }],
    });
    store = TestBed.inject(AiSettingsStore);
    store.load().subscribe();
  });

  it('knows whether external providers are allowed and which enabled hosted providers are blocked', () => {
    expect(store.externalAllowed()).toBe(false);
    expect(store.blockedProviders()).toEqual(['openai']);
    expect(store.providers()).toHaveLength(5);
    expect(store.providerSetting('openai')?.has_api_key).toBe(true);
    expect(store.providerSetting('gemini')).toBeNull();
  });

  it('blocks nothing once external providers are allowed', () => {
    api['settings'] = vi.fn(() => ok(settingsFixture({ external_providers_allowed: true })));
    store.load().subscribe();

    expect(store.blockedProviders()).toEqual([]);
  });

  it('replaces the saved provider and clears the default flag of the others', () => {
    store.saveProvider('anthropic', form).subscribe();

    expect(api['saveProvider']).toHaveBeenCalledWith('anthropic', form);
    expect(store.providerSetting('anthropic')?.model).toBe('claude-sonnet-5-5');
    expect(store.providerSetting('openai')?.is_default).toBe(false);
    expect(store.savingKey()).toBeNull();
  });

  it('replaces the saved rule in place', () => {
    const rule = store.rules()[1]!;
    store.saveRule({ ...rule, auto_approve_enabled: true }).subscribe();

    expect(store.rules()[1]?.auto_approve_min_confidence).toBe(0.97);
    expect(store.rules()[1]?.configured).toBe(true);
    expect(store.rules()).toHaveLength(2);
  });

  it('loads the usage of the month and, on request, the verified audit chain', () => {
    store.loadUsage(true).subscribe();

    expect(api['usageAudit']).toHaveBeenCalledWith(true);
    expect(store.usage()?.chain?.valid).toBe(true);
  });
});
