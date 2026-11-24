import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { JourneyStep, MarketingCampaign } from '@core';
import { MarketingAutomationStore } from './marketing-automation.store';

const base = `${environment.apiBaseUrl}/marketing-automation`;
const envelope = <T>(data: T) => ({ success: true, message: '', data });
/** Lets the store issue its follow-up request after the first answer. */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const campaign = (overrides: Partial<MarketingCampaign> = {}): MarketingCampaign => ({
  id: 'c1',
  name: 'Primavera',
  status: 'draft',
  channel: 'email_dem',
  trigger_type: 'scheduled_broadcast',
  segment_id: null,
  sender_name: null,
  sender_email: null,
  sender_postal_address: null,
  provider: 'smtp',
  template_mjml_json: {},
  ab_test_split_variant_json: null,
  utm_campaign_code: null,
  attribution_model: 'last_touch',
  attribution_window_days: 30,
  currency: 'CHF',
  campaign_cost: 0,
  coupon_code: null,
  scheduled_at: null,
  started_at: null,
  completed_at: null,
  ...overrides,
});

describe('MarketingAutomationStore', () => {
  let store: InstanceType<typeof MarketingAutomationStore>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), MarketingAutomationStore],
    });
    store = TestBed.inject(MarketingAutomationStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the ROI dashboard', async () => {
    const loading = store.loadDashboard();
    http.expectOne((r) => r.url === `${base}/dashboard`).flush(
      envelope({ currency: 'CHF', totals: { sent_count: 10, calculated_roi_percentage: null, roi_state: 'no_cost' }, campaigns: [] }),
    );
    await loading;

    expect(store.dashboard()?.currency).toBe('CHF');
    expect(store.dashboard()?.totals.roi_state).toBe('no_cost');
    expect(store.loading()).toBe(false);
  });

  it('splits the seeded blueprints into presets, templates and journeys', async () => {
    const loading = store.loadBlueprints();
    http.expectOne((r) => r.url === `${base}/blueprints`).flush(
      envelope([
        { id: '1', kind: 'segment_preset', code: 'champions', texts: {}, payload: {} },
        { id: '2', kind: 'email_template', code: 'newsletter_basic', texts: {}, payload: {} },
        { id: '3', kind: 'journey', code: 'dormant_reactivation', texts: {}, payload: {} },
        { id: '4', kind: 'text', code: 'footer.unsubscribe', texts: {}, payload: {} },
      ]),
    );
    await loading;

    expect(store.presets().map((b) => b.code)).toEqual(['champions']);
    expect(store.templates().map((b) => b.code)).toEqual(['newsletter_basic']);
    expect(store.journeys().map((b) => b.code)).toEqual(['dormant_reactivation']);
  });

  it('previews the audience of unsaved criteria', async () => {
    const preview = store.previewSegment({ exclude_insolvent: true });
    const request = http.expectOne(`${base}/segments/preview`);
    expect(request.request.body).toEqual({ criteria: { exclude_insolvent: true } });
    request.flush(envelope({ eligible_contacts_count: 12, excluded_insolvent_count: 3, excluded_no_consent_count: 5, rfm_breakdown: {} }));
    await preview;

    expect(store.segmentPreview()?.eligible_contacts_count).toBe(12);
    expect(store.segmentPreview()?.excluded_insolvent_count).toBe(3);
  });

  it('saves a segment, evaluates it and loads its RFM matrix', async () => {
    const saving = store.saveSegment({ name: 'Dormienti', criteria: { recency_days_min: 60 } });
    http.expectOne(`${base}/segments`).flush(
      envelope({ id: 's1', name: 'Dormienti', criteria: {}, eligible_contacts_count: 0, excluded_insolvent_count: 0, excluded_no_consent_count: 0, rfm_breakdown: {}, auto_refresh_hourly: false, code: null, description: null, last_evaluated_at: null, created_at: null }),
    );
    expect((await saving)?.id).toBe('s1');
    expect(store.segments()).toHaveLength(1);

    const evaluating = store.evaluateSegment('s1');
    http.expectOne(`${base}/segments/s1/evaluate`).flush(
      envelope({ id: 's1', name: 'Dormienti', criteria: {}, eligible_contacts_count: 8, excluded_insolvent_count: 2, excluded_no_consent_count: 0, rfm_breakdown: { champions: 8 }, auto_refresh_hourly: false, code: null, description: null, last_evaluated_at: '2026-11-24T10:00:00Z', created_at: null }),
    );
    await tick();
    http.expectOne(`${base}/segments/s1/rfm-matrix`).flush(
      envelope({ segment_id: 's1', eligible: 8, excluded_insolvent: 2, excluded_no_consent: 0, last_evaluated_at: null, labels: [], cells: [] }),
    );
    await evaluating;

    expect(store.segments()[0].eligible_contacts_count).toBe(8);
    expect(store.rfmMatrix()?.excluded_insolvent).toBe(2);
  });

  it('keeps the code of a rejected save so the page can show the seeded text', async () => {
    const saving = store.transition('c1', 'activate');
    http.expectOne(`${base}/campaigns/c1/activate`).flush(
      { type: 'x', title: 'sender_identity_required', status: 422, code: 'sender_identity_required' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    expect(await saving).toBeNull();
    expect(store.errorCode()).toBe('marketing.problem.sender_identity_required');
    expect(store.saving()).toBe(false);

    store.clearError();
    expect(store.errorCode()).toBeNull();
  });

  it('shows the validation messages of a rejected campaign', async () => {
    const saving = store.saveCampaign({ name: '' });
    http.expectOne(`${base}/campaigns`).flush(
      { message: 'invalid', errors: { name: ['The name field is required.'] } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await saving;

    expect(store.errorCode()).toBe('marketing.problem.generic');
    expect(store.errorDetails()).toEqual(['The name field is required.']);
  });

  it('creates and updates campaigns in the list and in the selection', async () => {
    const created = store.saveCampaign({ name: 'Primavera' });
    http.expectOne(`${base}/campaigns`).flush(envelope(campaign()));
    await created;
    expect(store.campaigns().map((c) => c.id)).toEqual(['c1']);
    expect(store.selectedCampaign()?.id).toBe('c1');

    const activating = store.transition('c1', 'activate');
    http.expectOne(`${base}/campaigns/c1/activate`).flush(envelope(campaign({ status: 'active' })));
    await activating;

    expect(store.campaigns()[0].status).toBe('active');
    expect(store.selectedCampaign()?.status).toBe('active');
  });

  it('selects a campaign with its journey steps and clears the selection', async () => {
    const selecting = store.selectCampaign('c1');
    http.expectOne(`${base}/campaigns/c1`).flush(
      envelope(campaign({ steps: [{ step_key: 'mail', type: 'send_email', config: {}, next_step_key: null, true_step_key: null, false_step_key: null, is_entry: true, pos_x: 0, pos_y: 0 }] })),
    );
    await selecting;
    expect(store.selectedCampaign()?.steps).toHaveLength(1);

    await store.selectCampaign(null);
    expect(store.selectedCampaign()).toBeNull();
  });

  it('saves the journey nodes and edges of the selected campaign', async () => {
    const steps: JourneyStep[] = [
      { step_key: 'mail', type: 'send_email', config: {}, next_step_key: 'end', true_step_key: null, false_step_key: null, is_entry: true, pos_x: 10, pos_y: 20 },
      { step_key: 'end', type: 'end', config: {}, next_step_key: null, true_step_key: null, false_step_key: null, is_entry: false, pos_x: 10, pos_y: 140 },
    ];
    const saving = store.saveJourney('c1', steps);
    const request = http.expectOne(`${base}/campaigns/c1/journey`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.steps).toHaveLength(2);
    expect(request.request.body.steps[0]).toMatchObject({ step_key: 'mail', next_step_key: 'end', is_entry: true, pos_x: 10 });
    request.flush(envelope(campaign({ steps })));
    await saving;

    expect(store.selectedCampaign()?.steps).toHaveLength(2);
  });

  it('previews the compiled e-mail for a locale and variant', async () => {
    const previewing = store.previewTemplate('de', { subject: { de: 'Hallo' } }, 'B');
    const request = http.expectOne(`${base}/template-preview`);
    expect(request.request.body).toMatchObject({ locale: 'de', variant: 'B' });
    request.flush(envelope({ subject: 'Hallo', preheader: '', mjml: '<mjml/>', html: '<p>Hallo</p>', engine: 'fallback' }));
    await previewing;

    expect(store.preview()?.html).toBe('<p>Hallo</p>');
  });

  it('searches the ERP catalog for the product block', async () => {
    const searching = store.searchProducts('kit');
    const request = http.expectOne((r) => r.url === `${base}/catalog/products`);
    expect(request.request.params.get('q')).toBe('kit');
    request.flush(envelope([{ id: 'p1', sku: 'KIT-1', name: 'Kit', description: null, price: 10, currency: 'CHF', image_url: null }]));
    await searching;

    expect(store.products()).toHaveLength(1);
  });

  it('loads logs and A/B statistics of a campaign together', async () => {
    const loading = store.loadCampaignInsights('c1');
    http.expectOne(`${base}/campaigns/c1/logs`).flush(envelope([]));
    http.expectOne(`${base}/campaigns/c1/ab-stats`).flush(envelope({ criteria: 'open_rate', winner: 'B', variants: [] }));
    await loading;

    expect(store.abStats()?.winner).toBe('B');
    expect(store.stepLogs()).toEqual([]);
  });

  it('loads consents, audit events and the compliance strategies', async () => {
    const loading = store.loadConsents();
    http.expectOne((r) => r.url === `${base}/consents`).flush(envelope([]));
    http.expectOne((r) => r.url === `${base}/consent-events`).flush(envelope([]));
    http.expectOne(`${base}/compliance/strategies`).flush(
      envelope([{ code: 'ch_lcsl_art3_nlpd', jurisdictions: ['CH'], footer_keys: [] }, { code: 'it_gdpr_art130', jurisdictions: ['IT', 'EU'], footer_keys: [] }]),
    );
    await loading;

    expect(store.strategies().map((s) => s.code)).toEqual(['ch_lcsl_art3_nlpd', 'it_gdpr_art130']);
  });

  it('records a consent change and reloads the audit log of the contact', async () => {
    const saving = store.updateConsent('contact-1', { marketing_opt_in: true });
    const put = http.expectOne(`${base}/consents/contact-1`);
    expect(put.request.method).toBe('PUT');
    put.flush(envelope({ contact_id: 'contact-1', marketing_opt_in: true, profiling_opt_in: false, soft_opt_in_eligible: false, double_opt_in_confirmed: false, channel_preferences: {}, locale: 'it', unsubscribed_at: null }));
    await tick();
    const events = http.expectOne((r) => r.url === `${base}/consent-events`);
    expect(events.request.params.get('contact_id')).toBe('contact-1');
    events.flush(envelope([{ id: 'e1', contact_id: 'contact-1', event_type: 'opt_in', lawful_basis: 'consent', strategy_code: 'ch_lcsl_art3_nlpd', source: 'backoffice', ip_address: '127.0.0.1', user_agent: null, occurred_at: '2026-11-24T10:00:00Z' }]));
    await saving;

    expect(store.consents()).toHaveLength(1);
    expect(store.consentEvents()[0].event_type).toBe('opt_in');
  });
});
