import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../icons-provider';
import { ForecastChartComponent } from '../ai-forecasting/forecast-chart.component';
import { AiCognitiveApiService } from './ai-cognitive-api.service';
import {
  anomalyFixture,
  dashboardFixture,
  settingsFixture,
  suggestionFixture,
} from './ai-cognitive.testing';
import { AiInsightsPageComponent } from './ai-insights-page.component';
import { AiSettingsPageComponent } from './ai-settings-page.component';
import { AiWorkbenchPageComponent } from './ai-workbench-page.component';

const ok = <T>(data: T, meta?: unknown) => of({ success: true, message: '', data, meta });
const meta = (open: Record<string, number>) => ({
  current_page: 1,
  per_page: 25,
  total: Object.values(open).reduce((a, b) => a + b, 0),
  last_page: 1,
  open_by_kind: open,
});

const byId = (fixture: ComponentFixture<unknown>, id: string): HTMLElement | null =>
  (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
const all = (fixture: ComponentFixture<unknown>, selector: string): HTMLElement[] =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(selector));

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function type(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** ECharts needs a canvas, which jsdom does not have: the page is tested against the option it passes to the chart. */
@Component({ selector: 'app-forecast-chart', template: '<span data-testid="chart-stub"></span>' })
class ChartStubComponent {
  readonly option = input<unknown>(null);
  readonly label = input<string>('');
  readonly testId = input<string>('');
}

function configure(
  api: Record<string, ReturnType<typeof vi.fn>>,
  query: Record<string, string> = {},
): void {
  TestBed.configureTestingModule({
    providers: [
      provideNzIcons(icons),
      provideNzI18n(en_US),
      provideNzDateFnsAdapter(),
      provideRouter([]),
      { provide: AiCognitiveApiService, useValue: api },
      { provide: NzMessageService, useValue: { success: vi.fn(), info: vi.fn(), error: vi.fn() } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
      },
    ],
  });
}

describe('Cognitive Review Workbench page', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let fixture: ComponentFixture<AiWorkbenchPageComponent>;
  const quote = suggestionFixture();
  const anomaly = anomalyFixture();

  async function create(query: Record<string, string> = {}): Promise<void> {
    configure(api, query);
    fixture = TestBed.createComponent(AiWorkbenchPageComponent);
    await settle(fixture);
  }

  beforeEach(() => {
    api = {
      queue: vi.fn(() => ok([quote, anomaly], meta({ sales_quote: 1, anomaly: 1 }))),
      suggestion: vi.fn(() => ok(suggestionFixture({ id: 'linked', status: 'approved' }))),
      approve: vi.fn(() => ok({ ...quote, status: 'approved' })),
      reject: vi.fn(() => ok({ ...quote, status: 'rejected' })),
    };
  });

  it('lists the queue with the open count of every kind as a filter chip', async () => {
    await create();

    expect(byId(fixture, 'chip-all')?.textContent).toContain('(2)');
    expect(byId(fixture, 'chip-sales_quote')?.textContent).toContain('(1)');
    expect(byId(fixture, 'chip-contact')?.textContent).toContain('(0)');
    expect(all(fixture, '.queue-item')).toHaveLength(2);
    expect(byId(fixture, 'no-selection')).not.toBeNull();
  });

  it('reloads the queue for the chosen kind', async () => {
    await create();
    byId(fixture, 'chip-anomaly')?.click();
    await settle(fixture);

    expect(api['queue']).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'anomaly', status: null }),
    );
    expect(byId(fixture, 'chip-anomaly')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the source text on the left and the proposed action with its confidence badges on the right', async () => {
    await create();
    byId(fixture, `item-${quote.id}`)?.click();
    await settle(fixture);

    expect(byId(fixture, 'source-text')?.textContent).toContain('two office chairs');
    expect(byId(fixture, 'reasoning')?.textContent).toContain('The customer names two chairs.');
    expect(byId(fixture, 'overall-confidence')?.textContent?.trim()).toBe('50%');
    expect(byId(fixture, 'overall-confidence')?.getAttribute('data-band')).toBe('low');
    expect(byId(fixture, 'provenance')?.textContent?.replace(/\s+/g, ' ')).toContain(
      'ollama / llama3.3',
    );
    expect((byId(fixture, 'field-currency') as HTMLInputElement).value).toBe('CHF');
    expect((byId(fixture, 'cell-items-0-description') as HTMLInputElement).value).toBe(
      'Office chair',
    );
    expect(all(fixture, '.pill[data-band="high"]').length).toBeGreaterThan(0);
  });

  it('approves as proposed when nothing was changed', async () => {
    await create();
    byId(fixture, `item-${quote.id}`)?.click();
    await settle(fixture);

    expect(byId(fixture, 'approve')?.textContent).toContain('AI_COG.APPROVE');
    expect(byId(fixture, 'approve')?.textContent).not.toContain('EDIT_AND_APPROVE');

    byId(fixture, 'approve')?.click();
    await settle(fixture);

    expect(api['approve']).toHaveBeenCalledWith('s-1', null, null);
  });

  it('turns the button into Edit and Approve when a field is corrected, and sends the corrected payload', async () => {
    await create();
    byId(fixture, `item-${quote.id}`)?.click();
    await settle(fixture);

    // Each edit is followed by change detection, as in the browser: the editor works on the payload it was last given.
    type(byId(fixture, 'field-notes') as HTMLInputElement, 'Customer confirmed by phone');
    await settle(fixture);
    type(byId(fixture, 'cell-items-0-quantity') as HTMLInputElement, '3');
    await settle(fixture);

    expect(byId(fixture, 'approve')?.textContent).toContain('AI_COG.EDIT_AND_APPROVE');
    expect(byId(fixture, 'reset')).not.toBeNull();

    byId(fixture, 'approve')?.click();
    await settle(fixture);

    const [id, payload] = api['approve']!.mock.calls[0] as [string, Record<string, unknown>];

    expect(id).toBe('s-1');
    expect(payload['notes']).toBe('Customer confirmed by phone');
    expect((payload['items'] as { quantity: number }[])[0]?.quantity).toBe(3);
  });

  it('asks for a reason before it rejects', async () => {
    await create();
    byId(fixture, `item-${quote.id}`)?.click();
    await settle(fixture);
    byId(fixture, 'reject-open')?.click();
    await settle(fixture);

    const confirm = byId(fixture, 'reject-confirm') as HTMLButtonElement;

    expect(confirm.disabled).toBe(true);

    type(byId(fixture, 'reject-reason') as HTMLTextAreaElement, 'Not a customer');
    await settle(fixture);

    expect(confirm.disabled).toBe(false);

    confirm.click();
    await settle(fixture);

    expect(api['reject']).toHaveBeenCalledWith('s-1', 'Not a customer');
  });

  it('offers to acknowledge or dismiss an alert instead of approving or rejecting it, and shows it read-only', async () => {
    await create();
    byId(fixture, `item-${anomaly.id}`)?.click();
    await settle(fixture);

    expect(byId(fixture, 'approve')?.textContent).toContain('AI_COG.ACKNOWLEDGE');
    expect(byId(fixture, 'reject-open')?.textContent).toContain('AI_COG.DISMISS');
    expect((byId(fixture, 'field-rule') as HTMLInputElement).readOnly).toBe(true);
    expect(byId(fixture, 'cell-items-0-quantity')).toBeNull();
    expect(byId(fixture, 'block-details')?.textContent).toContain('CH56');
    expect(byId(fixture, 'action-link')).not.toBeNull();
  });

  it('opens the suggestion named in the address, even when it is already decided', async () => {
    await create({ suggestion: 'linked' });

    expect(api['suggestion']).toHaveBeenCalledWith('linked');
    expect(byId(fixture, 'workbench')).not.toBeNull();
    expect(byId(fixture, 'approve')).toBeNull();
  });
});

describe('Predictive Insights and Anomaly Center page', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let fixture: ComponentFixture<AiInsightsPageComponent>;

  async function create(dashboard = dashboardFixture()): Promise<void> {
    api = {
      dashboard: vi.fn(() => ok(dashboard)),
      generateInsights: vi.fn(() => ok({ cash_flow: 1 })),
      approve: vi.fn(() => ok(suggestionFixture({ status: 'approved' }))),
      reject: vi.fn(() => ok(suggestionFixture({ status: 'rejected' }))),
    };
    configure(api);
    TestBed.overrideComponent(AiInsightsPageComponent, {
      remove: { imports: [ForecastChartComponent] },
      add: { imports: [ChartStubComponent] },
    });
    fixture = TestBed.createComponent(AiInsightsPageComponent);
    await settle(fixture);
  }

  it('shows the figures, the cash flow chart, the customers by risk and the alerts', async () => {
    await create();

    expect(byId(fixture, 'stat-critical')?.textContent).toContain('2');
    expect(byId(fixture, 'stat-recommendations')?.textContent).toContain('1');
    expect(byId(fixture, 'stat-anomalies')?.textContent).toContain('1');
    expect(byId(fixture, 'chart-stub')).not.toBeNull();
    expect(byId(fixture, 'negative-warning')?.textContent).toContain('AI_COG.NEGATIVE_FROM');
    expect(byId(fixture, 'risk-c-1')?.textContent).toContain('Muster AG');
    expect(byId(fixture, 'insight-r-1')?.textContent).toContain(
      'The customer pays on average 34 days late.',
    );
    expect(byId(fixture, 'insight-a-1')).not.toBeNull();
    expect(byId(fixture, 'open-r-1')).not.toBeNull();
  });

  it('says so when there is no forecast yet', async () => {
    await create(dashboardFixture({ cash_flow: null }));

    expect(byId(fixture, 'no-forecast')).not.toBeNull();
    expect(byId(fixture, 'negative-warning')).toBeNull();
    expect(byId(fixture, 'stat-lowest')?.textContent).toContain('–');
  });

  it('reloads for the other horizon', async () => {
    await create();
    byId(fixture, 'horizon-365')?.click();
    await settle(fixture);

    expect(api['dashboard']).toHaveBeenLastCalledWith(365);
  });

  it('acknowledges or dismisses an item in one click and removes it from the page', async () => {
    await create();
    byId(fixture, 'ack-r-1')?.click();
    await settle(fixture);

    expect(api['approve']).toHaveBeenCalledWith('r-1', null, null);
    expect(byId(fixture, 'insight-r-1')).toBeNull();

    byId(fixture, 'dismiss-a-1')?.click();
    await settle(fixture);

    expect(api['reject']).toHaveBeenCalledWith('a-1', expect.any(String));
    expect(byId(fixture, 'insight-a-1')).toBeNull();
  });

  it('runs the analysis on demand and reloads', async () => {
    await create();
    byId(fixture, 'generate')?.click();
    await settle(fixture);

    expect(api['generateInsights']).toHaveBeenCalled();
    expect(api['dashboard']).toHaveBeenCalledTimes(2);
  });
});

describe('AI settings page', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let fixture: ComponentFixture<AiSettingsPageComponent>;

  async function create(settings = settingsFixture()): Promise<void> {
    api = {
      settings: vi.fn(() => ok(settings)),
      usageAudit: vi.fn(() =>
        ok({
          period: { from: '2026-03-01', to: '2026-03-31' },
          usage: {
            by_provider: [
              {
                provider: 'openai',
                calls: 3,
                total_tokens: 4500,
                cost_usd: 0.0123,
                cache_hits: 0,
                failures: 1,
              },
            ],
            total_tokens: 4500,
            total_cost_usd: 0.0123,
          },
          chain: null,
        }),
      ),
      saveProvider: vi.fn(() => ok({ ...settings.providers[0]!, model: 'gpt-4o-mini' })),
      saveRule: vi.fn((rule: object) => ok(rule)),
    };
    configure(api);
    fixture = TestBed.createComponent(AiSettingsPageComponent);
    await settle(fixture);
    await settle(fixture);
  }

  it('shows a card for each supported provider, local first, and explains that external providers are off', async () => {
    await create();

    expect(
      all(fixture, '[data-testid^="provider-"]').map((card) => card.dataset['testid']),
    ).toEqual([
      'provider-ollama',
      'provider-openai',
      'provider-anthropic',
      'provider-gemini',
      'provider-azure_openai',
    ]);
    expect(byId(fixture, 'external-alert')).not.toBeNull();
    expect(byId(fixture, 'blocked-alert')).not.toBeNull();
    expect(byId(fixture, 'key-stored')).not.toBeNull();
  });

  it('shows no warning once external providers are allowed', async () => {
    await create(settingsFixture({ external_providers_allowed: true }));

    expect(byId(fixture, 'external-alert')).toBeNull();
    expect(byId(fixture, 'blocked-alert')).toBeNull();
  });

  it('saves a provider with an empty key so that the stored key is kept', async () => {
    await create();
    byId(fixture, 'save-provider-openai')?.click();
    await settle(fixture);

    const [provider, form] = api['saveProvider']!.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];

    expect(provider).toBe('openai');
    expect(form['api_key']).toBeNull();
    expect(form['model']).toBe('gpt-4o');
    expect(form['monthly_token_budget']).toBe(100000);
    expect(form['max_data_classification']).toBe('internal');
  });

  it('judges the sample result against the policy of each workflow', async () => {
    await create();

    // 96% and 800 against 95% and 1,000: approved automatically. The alert workflow never approves on its own.
    expect(byId(fixture, 'outcome-extraction_sales_quote')?.textContent).toContain(
      'AI_COG.OUTCOME_AUTO',
    );
    expect(byId(fixture, 'outcome-anomaly_guard')?.textContent).toContain('AI_COG.OUTCOME_REVIEW');
  });

  it('saves a rule with its policy', async () => {
    await create();
    byId(fixture, 'save-rule-extraction_sales_quote')?.click();
    await settle(fixture);

    expect(api['saveRule']).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow: 'extraction_sales_quote',
        auto_approve_enabled: true,
        auto_approve_min_confidence: 0.95,
        max_auto_amount: 1000,
        data_classification: 'confidential_pii',
      }),
    );
  });

  it('shows the usage of the month and verifies the audit chain on request', async () => {
    await create();

    expect(byId(fixture, 'usage')?.textContent).toContain('openai: 3');
    expect(byId(fixture, 'chain-result')).toBeNull();

    api['usageAudit']!.mockReturnValue(
      ok({
        period: { from: '2026-03-01', to: '2026-03-31' },
        usage: { by_provider: [], total_tokens: 0, total_cost_usd: 0 },
        chain: { valid: true, checked: 12, broken_at: null },
      }),
    );
    byId(fixture, 'verify-chain')?.click();
    await settle(fixture);

    expect(api['usageAudit']).toHaveBeenLastCalledWith(true);
    expect(byId(fixture, 'chain-result')?.textContent).toContain('AI_COG.CHAIN_VALID');
    expect(byId(fixture, 'chain-result')?.textContent).toContain('12');
  });
});
