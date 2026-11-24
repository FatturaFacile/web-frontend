import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@env';
import { CatalogApiService, I18nService, PermissionsService } from '@core';
import { icons } from '../../icons-provider';
import { ConsentComplianceComponent } from './consent-compliance.component';
import { EmailDesignerComponent } from './email-designer.component';
import { JourneyBuilderComponent } from './journey-builder.component';
import { MarketingAutomationStore } from './marketing-automation.store';
import { MarketingCampaignsComponent } from './marketing-campaigns.component';
import { MarketingDashboardComponent } from './marketing-dashboard.component';
import { RfmSegmentsComponent } from './rfm-segments.component';

const base = `${environment.apiBaseUrl}/marketing-automation`;
const envelope = <T>(data: T) => ({ success: true, message: '', data });

const campaign = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  name: 'Primavera',
  status: 'draft',
  channel: 'multi_channel_journey',
  trigger_type: 'customer_dormant_60_days',
  segment_id: null,
  sender_name: 'Org SA',
  sender_email: 'info@example.ch',
  sender_postal_address: 'Via Test 1',
  provider: 'smtp',
  template_mjml_json: { subject: { it: 'Ciao' }, blocks: [] },
  ab_test_split_variant_json: null,
  utm_campaign_code: null,
  attribution_model: 'last_touch',
  attribution_window_days: 30,
  currency: 'CHF',
  campaign_cost: 100,
  coupon_code: null,
  scheduled_at: null,
  started_at: null,
  completed_at: null,
  steps: [],
  metric: null,
  ...overrides,
});

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('Mod 155 Marketing Automation pages', () => {
  let http: HttpTestingController;
  const message = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  beforeEach(() => {
    message.success.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(icons),
        MarketingAutomationStore,
        { provide: LOCALE_ID, useValue: 'it-CH' },
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: { translate: (key: string) => key, currentLanguage: () => 'it' } },
        { provide: PermissionsService, useValue: { canAccess: () => true, canWrite: () => true } },
        { provide: CatalogApiService, useValue: { getCategories: () => of(envelope([{ id: 'cat1', name: 'Macchinari' }])) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('dashboard', () => {
    it('shows the KPIs and the table of campaigns, and never invents an ROI without cost', async () => {
      const fixture = TestBed.createComponent(MarketingDashboardComponent);
      fixture.detectChanges();

      const totals = {
        sent_count: 1000, delivered_count: 980, unique_opens_count: 400, unique_clicks_count: 120, unsubscribes_count: 5,
        hard_bounces_count: 2, soft_bounces_count: 1, spam_complaints_count: 0, attributed_quotes_count: 4, attributed_quotes_value: 8000,
        attributed_sales_orders_count: 2, attributed_net_revenue_amount: 5000, attributed_invoiced_amount: 4000, attributed_collected_amount: 1500,
        attributed_gross_margin_amount: 2000, campaign_cost: 0, calculated_roi_percentage: null, roi_state: 'no_cost',
      };
      http.expectOne((r) => r.url === `${base}/dashboard`).flush(
        envelope({ currency: 'CHF', totals, campaigns: [{ ...totals, campaign_id: 'c1', name: 'Primavera', status: 'active', channel: 'email_dem', trigger_type: 'scheduled_broadcast' }] }),
      );
      await fixture.whenStable();
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('[data-kpi="sent"]')?.textContent).toContain('1');
      expect(el.querySelector('[data-kpi="orders"]')?.textContent?.trim()).toBe('2');
      expect(el.querySelector('[data-kpi="roi"]')?.textContent).toContain('marketing.roi.no_cost');
      expect(el.textContent).toContain('Primavera');
      expect(el.querySelectorAll('.kpi-card').length).toBe(13);
    });

    it('shows a seeded text when there are no campaigns', async () => {
      const fixture = TestBed.createComponent(MarketingDashboardComponent);
      fixture.detectChanges();
      http.expectOne((r) => r.url === `${base}/dashboard`).flush(
        envelope({ currency: 'EUR', totals: { sent_count: 0, calculated_roi_percentage: null, roi_state: 'no_cost' }, campaigns: [] }),
      );
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('marketing.dashboard.empty');
    });
  });

  describe('RFM segments', () => {
    it('fills the builder from a seeded preset and previews the audience with the insolvency exclusion', async () => {
      const fixture = TestBed.createComponent(RfmSegmentsComponent);
      fixture.detectChanges();

      http.expectOne((r) => r.url === `${base}/blueprints`).flush(
        envelope([{ id: '1', kind: 'segment_preset', code: 'dormant_60_no_arrears', texts: { it: { name: 'Clienti Dormienti 60gg Senza Insoluti', description: 'Nessun ordine da 60 giorni' } }, payload: { criteria: { recency_days_min: 60, exclude_insolvent: true }, auto_refresh_hourly: true } }]),
      );
      http.expectOne((r) => r.url === `${base}/segments`).flush(envelope([]));
      await fixture.whenStable();

      const component = fixture.componentInstance as unknown as {
        applyPreset(code: string): void;
        preview(): Promise<void>;
        form(): { name: string; recencyMin: number | null; excludeInsolvent: boolean; autoRefresh: boolean };
      };
      component.applyPreset('dormant_60_no_arrears');

      expect(component.form()).toMatchObject({ name: 'Clienti Dormienti 60gg Senza Insoluti', recencyMin: 60, excludeInsolvent: true, autoRefresh: true });

      const previewing = component.preview();
      const request = http.expectOne(`${base}/segments/preview`);
      expect(request.request.body).toEqual({ criteria: { recency_days_min: 60, exclude_insolvent: true } });
      request.flush(envelope({ eligible_contacts_count: 12, excluded_insolvent_count: 3, excluded_no_consent_count: 1, rfm_breakdown: {} }));
      await previewing;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="segment-preview"]')?.textContent).toContain('12');
    });

    it('draws the RFM matrix of an evaluated segment and toggles a label into the filter', async () => {
      const fixture = TestBed.createComponent(RfmSegmentsComponent);
      fixture.detectChanges();
      http.expectOne((r) => r.url === `${base}/blueprints`).flush(envelope([]));
      http.expectOne((r) => r.url === `${base}/segments`).flush(
        envelope([{ id: 's1', code: null, name: 'Attivi', description: null, criteria: {}, auto_refresh_hourly: false, eligible_contacts_count: 3, excluded_insolvent_count: 2, excluded_no_consent_count: 0, rfm_breakdown: {}, last_evaluated_at: null, created_at: null }]),
      );
      await fixture.whenStable();
      fixture.detectChanges();

      const component = fixture.componentInstance as unknown as {
        open(segment: unknown): void;
        toggleLabel(label: string): void;
        form(): { rfmLabels: string[] };
      };
      component.open(fixture.nativeElement ? { id: 's1', name: 'Attivi', description: null, criteria: {}, auto_refresh_hourly: false } : null);
      http.expectOne(`${base}/segments/s1/rfm-matrix`).flush(
        envelope({
          segment_id: 's1', eligible: 3, excluded_insolvent: 2, excluded_no_consent: 0, last_evaluated_at: null,
          labels: [{ label: 'champions', count: 2 }, { label: 'lost', count: 1 }],
          cells: [{ r: 5, f: 5, count: 2, monetary: 900 }, { r: 1, f: 1, count: 1, monetary: 10 }],
        }),
      );
      await fixture.whenStable();
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('[data-testid="matrix-insolvent"]')?.textContent?.trim()).toBe('2');
      expect(el.querySelectorAll('table[aria-label="marketing.matrix.heatmap"] tbody tr')).toHaveLength(5);
      expect(el.querySelectorAll('button[aria-pressed]').length).toBe(2);

      component.toggleLabel('champions');
      http.expectOne(`${base}/segments/preview`).flush(envelope({ eligible_contacts_count: 2, excluded_insolvent_count: 2, excluded_no_consent_count: 0, rfm_breakdown: {} }));
      await fixture.whenStable();

      expect(component.form().rfmLabels).toEqual(['champions']);
    });
  });

  describe('campaigns', () => {
    it('lists the campaigns with the actions their status allows and changes the status', async () => {
      const fixture = TestBed.createComponent(MarketingCampaignsComponent);
      fixture.detectChanges();
      http.expectOne((r) => r.url === `${base}/segments`).flush(envelope([]));
      http.expectOne((r) => r.url === `${base}/campaigns`).flush(envelope([campaign()]));
      await fixture.whenStable();
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Primavera');
      expect(el.textContent).toContain('marketing.action.activate');
      expect(el.textContent).not.toContain('marketing.action.pause');

      const component = fixture.componentInstance as unknown as { move(c: unknown, action: string): Promise<void> };
      const moving = component.move(campaign(), 'activate');
      http.expectOne(`${base}/campaigns/c1/activate`).flush(envelope(campaign({ status: 'active' })));
      await moving;
      fixture.detectChanges();

      expect(message.success).toHaveBeenCalledWith('marketing.campaigns.status_changed');
      expect(el.textContent).toContain('marketing.action.pause');
    });

    it('shows the seeded text of the problem when the campaign cannot be activated', async () => {
      const fixture = TestBed.createComponent(MarketingCampaignsComponent);
      fixture.detectChanges();
      http.expectOne((r) => r.url === `${base}/segments`).flush(envelope([]));
      http.expectOne((r) => r.url === `${base}/campaigns`).flush(envelope([campaign({ sender_postal_address: null })]));
      await fixture.whenStable();

      const component = fixture.componentInstance as unknown as { move(c: unknown, action: string): Promise<void> };
      const moving = component.move(campaign(), 'activate');
      http.expectOne(`${base}/campaigns/c1/activate`).flush({ code: 'sender_identity_required', status: 422 }, { status: 422, statusText: 'Unprocessable' });
      await moving;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('marketing.problem.sender_identity_required');
    });
  });

  describe('e-mail designer', () => {
    async function openDesigner() {
      const fixture = TestBed.createComponent(EmailDesignerComponent);
      fixture.detectChanges();
      http.expectOne((r) => r.url === `${base}/campaigns`).flush(envelope([campaign()]));
      http.expectOne((r) => r.url === `${base}/blueprints`).flush(
        envelope([{ id: 't1', kind: 'email_template', code: 'newsletter_basic', texts: { it: { name: 'Newsletter base' } }, payload: { template: { subject: { it: 'Le novità' }, blocks: [{ id: 'h1', type: 'heading', props: { text: { it: 'Ciao', de: 'Hallo', fr: 'Salut', en: 'Hi' } } }] } } }]),
      );
      await tick();
      const component = fixture.componentInstance as unknown as {
        pickCampaign(id: string): Promise<void>;
        applyDrop(payload: unknown, index: number): void;
        applyTemplate(code: string): void;
        blocks(): { type: string; props: Record<string, unknown> }[];
        selectedIndex(): number | null;
        importProduct(product: unknown): void;
        save(): Promise<void>;
        addVariant(): void;
        abValid(): boolean;
        setPercent(index: number, percent: number): void;
        warnings(): string[];
        locale: { set(value: string): void };
      };
      const picking = component.pickCampaign('c1');
      http.expectOne(`${base}/campaigns/c1`).flush(envelope(campaign()));
      await picking;
      fixture.detectChanges();
      return { fixture, component };
    }

    it('adds blocks from the palette by drop and reorders them', async () => {
      const { fixture, component } = await openDesigner();

      component.applyDrop({ kind: 'palette', type: 'heading' }, 0);
      component.applyDrop({ kind: 'palette', type: 'button' }, 1);
      component.applyDrop({ kind: 'palette', type: 'text' }, 2);
      expect(component.blocks().map((b) => b.type)).toEqual(['heading', 'button', 'text']);

      component.applyDrop({ kind: 'block', index: 2 }, 0);
      expect(component.blocks().map((b) => b.type)).toEqual(['text', 'heading', 'button']);

      component.applyDrop({ kind: 'block', index: 0 }, 3);
      expect(component.blocks().map((b) => b.type)).toEqual(['heading', 'button', 'text']);

      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('[data-testid="designer-canvas"] [role="listitem"]')).toHaveLength(3);
    });

    it('imports image, description and price of an ERP catalog product dropped on the canvas', async () => {
      const { component } = await openDesigner();
      const product = { id: 'p1', sku: 'KIT-1', name: 'Kit ricambi', description: 'Guarnizioni', price: 249.9, currency: 'CHF', image_url: 'https://cdn.example.ch/kit.png' };

      component.applyDrop({ kind: 'product', product }, 0);

      const block = component.blocks()[0];
      expect(block.type).toBe('product');
      expect(block.props['price']).toBe(249.9);
      expect(block.props['image_url']).toBe('https://cdn.example.ch/kit.png');
      expect((block.props['name'] as Record<string, string>)['it']).toBe('Kit ricambi');

      // With the product block selected, a second import fills that block instead of adding another one.
      component.importProduct({ ...product, id: 'p2', name: 'Kit B', price: 10 });
      expect(component.blocks()).toHaveLength(1);
      expect(component.blocks()[0].props['product_id']).toBe('p2');
    });

    it('starts from a seeded template without changing the blueprint, and warns about missing languages', async () => {
      const { component } = await openDesigner();

      component.applyTemplate('newsletter_basic');
      expect(component.blocks()).toHaveLength(1);
      expect(component.warnings()).toEqual([]);

      component.applyDrop({ kind: 'palette', type: 'text' }, 1);
      expect(component.warnings()).toEqual(['it', 'de', 'fr', 'en']);
    });

    it('refuses to save an A/B split that does not add up to 100 % and saves a valid one', async () => {
      const { component } = await openDesigner();

      component.addVariant();
      expect(component.abValid()).toBe(true);
      component.setPercent(0, 70);
      expect(component.abValid()).toBe(false);
      component.setPercent(0, 50);

      const saving = component.save();
      const request = http.expectOne(`${base}/campaigns/c1`);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body.ab_test_split_variant_json).toEqual({ variants: [{ key: 'A', percent: 50 }, { key: 'B', percent: 50 }], winner_criteria: 'open_rate' });
      expect(request.request.body.template_mjml_json.compiled).toBeUndefined();
      request.flush(envelope(campaign()));
      await saving;

      expect(message.success).toHaveBeenCalledWith('marketing.designer.saved');
    });
  });

  describe('journey builder', () => {
    const steps = [
      { step_key: 'mail', type: 'send_email', config: { label: { it: 'Invia email' } }, next_step_key: 'wait', true_step_key: null, false_step_key: null, is_entry: true, pos_x: 40, pos_y: 40 },
      { step_key: 'wait', type: 'wait', config: { days: 3 }, next_step_key: 'check', true_step_key: null, false_step_key: null, is_entry: false, pos_x: 40, pos_y: 160 },
      { step_key: 'check', type: 'condition', config: { type: 'clicked_not_ordered' }, next_step_key: null, true_step_key: 'task', false_step_key: 'end', is_entry: false, pos_x: 40, pos_y: 280 },
      { step_key: 'task', type: 'crm_task', config: { subject: { it: 'Chiama' } }, next_step_key: 'end', true_step_key: null, false_step_key: null, is_entry: false, pos_x: 300, pos_y: 400 },
      { step_key: 'end', type: 'end', config: {}, next_step_key: null, true_step_key: null, false_step_key: null, is_entry: false, pos_x: 40, pos_y: 520 },
    ];

    async function openJourney(withSteps = steps) {
      const fixture = TestBed.createComponent(JourneyBuilderComponent);
      fixture.detectChanges();
      http.expectOne((r) => r.url === `${base}/campaigns`).flush(envelope([campaign()]));
      http.expectOne((r) => r.url === `${base}/blueprints`).flush(
        envelope([{ id: 'j1', kind: 'journey', code: 'dormant_reactivation', texts: { it: { name: 'Riattivazione 60gg' } }, payload: { steps: [{ step_key: 'mail', type: 'send_email', is_entry: true, next_step_key: 'end', labels: { it: 'Email' } }, { step_key: 'end', type: 'end', labels: { it: 'Fine' } }] } }]),
      );
      await tick();
      const component = fixture.componentInstance as unknown as {
        pickCampaign(id: string): Promise<void>;
        steps(): { step_key: string; pos_x: number }[];
        addStep(type: string, position?: { x: number; y: number }): void;
        deleteStep(key: string): void;
        link(from: string, kind: string, to: string | null): void;
        applyBlueprint(code: string): void;
        blocking(): string[];
        save(): Promise<void>;
        dropOnCanvas(event: unknown): void;
      };
      const picking = component.pickCampaign('c1');
      http.expectOne(`${base}/campaigns/c1`).flush(envelope(campaign({ steps: withSteps })));
      await picking;
      fixture.detectChanges();
      return { fixture, component };
    }

    it('draws a card per step and an edge per link', async () => {
      const { fixture } = await openJourney();
      const el: HTMLElement = fixture.nativeElement;

      expect(el.querySelectorAll('[data-testid="journey-canvas"] [role="button"]')).toHaveLength(5);
      expect(el.querySelectorAll('[data-testid="journey-canvas"] svg path[marker-end]')).toHaveLength(5);
      expect(el.textContent).toContain('Invia email');
      expect(el.querySelector('[data-testid="journey-issues"]')).toBeNull();
    });

    it('adds a step from the palette and reports a step that is not connected', async () => {
      const { fixture, component } = await openJourney();

      component.addStep('send_sms', { x: 600, y: 40 });
      fixture.detectChanges();

      expect(component.steps().map((s) => s.step_key)).toContain('send_sms_1');
      const issues = fixture.nativeElement.querySelector('[data-testid="journey-issues"]')?.textContent ?? '';
      expect(issues).toContain('marketing.journey_issue.unreachable');
      expect(issues).toContain('send_sms_1');
      expect(component.blocking()).toEqual([]);
    });

    it('removes a step with the edges that pointed at it and blocks the save when a branch is missing', async () => {
      const { component } = await openJourney();

      component.deleteStep('end');
      expect(component.steps().find((s) => s.step_key === 'check')?.['false_step_key' as never]).toBeNull();
      expect(component.blocking()).toContain('condition_branches');

      const request = vi.fn();
      void component.save().then(request);
      http.expectNone(`${base}/campaigns/c1/journey`);
    });

    it('saves the nodes and edges of a valid journey', async () => {
      const { component } = await openJourney();

      const saving = component.save();
      const request = http.expectOne(`${base}/campaigns/c1/journey`);
      expect(request.request.body.steps).toHaveLength(5);
      expect(request.request.body.steps[2]).toMatchObject({ step_key: 'check', type: 'condition', true_step_key: 'task', false_step_key: 'end' });
      request.flush(envelope(campaign({ steps })));
      await saving;

      expect(message.success).toHaveBeenCalledWith('marketing.journey.saved');
    });

    it('starts from a seeded journey blueprint and copies its node labels', async () => {
      const { fixture, component } = await openJourney([]);

      component.applyBlueprint('dormant_reactivation');
      fixture.detectChanges();

      expect(component.steps().map((s) => s.step_key)).toEqual(['mail', 'end']);
      expect(fixture.nativeElement.textContent).toContain('Email');
      expect(component.blocking()).toEqual([]);
    });
  });

  describe('consent and compliance', () => {
    it('shows the strategy of each jurisdiction, the consent states and the audit log', async () => {
      const fixture = TestBed.createComponent(ConsentComplianceComponent);
      fixture.detectChanges();

      http.expectOne((r) => r.url === `${base}/consents`).flush(
        envelope([{ contact_id: '11111111-1111-4111-8111-111111111111', marketing_opt_in: true, profiling_opt_in: false, soft_opt_in_eligible: false, double_opt_in_confirmed: true, channel_preferences: { whatsapp: false }, locale: 'de', unsubscribed_at: null }]),
      );
      http.expectOne((r) => r.url === `${base}/consent-events`).flush(
        envelope([{ id: 'e1', contact_id: '11111111-1111-4111-8111-111111111111', event_type: 'opt_in', lawful_basis: 'consent', strategy_code: 'it_gdpr_art130', source: 'web_form', ip_address: '10.0.0.1', user_agent: 'x', occurred_at: '2026-11-24T10:00:00Z' }]),
      );
      http.expectOne(`${base}/compliance/strategies`).flush(
        envelope([{ code: 'ch_lcsl_art3_nlpd', jurisdictions: ['CH'], footer_keys: [] }, { code: 'it_gdpr_art130', jurisdictions: ['IT', 'EU'], footer_keys: [] }]),
      );
      await fixture.whenStable();
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelectorAll('.strategy-card')).toHaveLength(2);
      expect(el.textContent).toContain('marketing.strategy.ch_lcsl_art3_nlpd.summary');
      expect(el.textContent).toContain('marketing.event.opt_in');
      expect(el.textContent).toContain('marketing.basis.consent');
      expect(el.textContent).toContain('10.0.0.1');
    });

    it('saves a consent only for a valid contact id and records it with the chosen channels', async () => {
      const fixture = TestBed.createComponent(ConsentComplianceComponent);
      fixture.detectChanges();
      http.expectOne((r) => r.url === `${base}/consents`).flush(envelope([]));
      http.expectOne((r) => r.url === `${base}/consent-events`).flush(envelope([]));
      http.expectOne(`${base}/compliance/strategies`).flush(envelope([]));
      await fixture.whenStable();

      const component = fixture.componentInstance as unknown as {
        contactId: { set(value: string): void };
        marketing: { set(value: boolean): void };
        setChannel(channel: string, on: boolean): void;
        validContact(): boolean;
        save(): Promise<void>;
      };
      component.contactId.set('not-a-uuid');
      expect(component.validContact()).toBe(false);

      component.contactId.set('22222222-2222-4222-8222-222222222222');
      component.marketing.set(true);
      component.setChannel('whatsapp', false);
      expect(component.validContact()).toBe(true);

      const saving = component.save();
      const put = http.expectOne(`${base}/consents/22222222-2222-4222-8222-222222222222`);
      expect(put.request.body).toMatchObject({ marketing_opt_in: true, channel_preferences: { email: true, whatsapp: false, sms: true }, source: 'backoffice' });
      put.flush(envelope({ contact_id: '22222222-2222-4222-8222-222222222222', marketing_opt_in: true, profiling_opt_in: false, soft_opt_in_eligible: false, double_opt_in_confirmed: false, channel_preferences: { whatsapp: false }, locale: 'it', unsubscribed_at: null }));
      await tick();
      http.expectOne((r) => r.url === `${base}/consent-events`).flush(envelope([]));
      await saving;

      expect(message.success).toHaveBeenCalledWith('marketing.consent.saved');
    });
  });
});
