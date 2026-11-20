import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from '@core/auth/auth.store';
import { I18nService } from '@core/i18n/i18n.service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Mission, Track } from './academy.models';
import { AcademyStore } from './academy.store';
import { academyLocale, parseMarkdown } from './academy.utils';

const base = '/api/v1/academy';

function mission(patch: Partial<Mission> = {}): Mission {
  return {
    id: 1,
    code: 'M1',
    sequence: 1,
    difficulty: 'beginner',
    title: 'First invoice',
    description: '',
    xp_reward: 50,
    badge_code: null,
    requires_sandbox: true,
    status: 'not_started',
    tour_steps: [],
    ...patch,
  };
}

function track(missions: Mission[] = [mission()]): Track {
  return {
    id: 10,
    code: 'T1',
    difficulty: 'beginner',
    title: 'Basics',
    description: '',
    missions_total: missions.length,
    missions_completed: 0,
    completion_percent: 0,
    xp_earned: 0,
    certificate_code: null,
    missions,
  };
}

const envelope = <T>(data: T) => ({ success: true, message: '', data });

describe('AcademyStore', () => {
  let store: AcademyStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: { currentLanguage: signal('it') } },
        { provide: AuthStore, useValue: { activeJurisdiction: signal('CH') } },
      ],
    });
    store = TestBed.inject(AcademyStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the contextual help of a route with the resolved locale and exposes field tooltips', () => {
    store.loadContextualHelp('/invoices/new').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/contextual-help`);
    expect(req.request.params.get('route')).toBe('/invoices/new');
    expect(req.request.params.get('locale')).toBe('it-CH');
    req.flush(
      envelope({
        id: 1,
        route_pattern: '/invoices/new',
        locale: 'it-IT',
        title: 'Nuova fattura',
        body_markdown: 'ciao',
        field_tooltips: { customer: 'Il cliente' },
      }),
    );
    expect(store.help()?.title).toBe('Nuova fattura');
    expect(store.fieldTooltips()['customer']).toBe('Il cliente');
  });

  it('treats a 404 as "no help for this page" and clears the previous help', () => {
    store.help.set({
      id: 1,
      route_pattern: '/x',
      locale: 'en',
      title: 't',
      body_markdown: '',
      field_tooltips: { a: 'b' },
    });
    store.loadContextualHelp('/none').subscribe();
    http
      .expectOne((r) => r.url === `${base}/contextual-help`)
      .flush({ message: 'nope' }, { status: 404, statusText: 'Not Found' });
    expect(store.help()).toBeNull();
    expect(store.fieldTooltips()).toEqual({});
  });

  it('requests the help of a route only once', () => {
    store.ensureContextualHelp('/a');
    http.expectOne((r) => r.url === `${base}/contextual-help`).flush(envelope(null));
    store.ensureContextualHelp('/a');
    http.expectNone((r) => r.url === `${base}/contextual-help`);
  });

  it('loads tracks and sums completed missions', () => {
    store.loadTracks().subscribe();
    expect(store.loading()).toBe(true);
    const t = { ...track(), missions_completed: 2 };
    http.expectOne(`${base}/tracks`).flush(envelope([t]));
    expect(store.loading()).toBe(false);
    expect(store.tracks()).toHaveLength(1);
    expect(store.missionsCompleted()).toBe(2);
  });

  it('marks a mission as started and keeps its tour steps', () => {
    store.tracks.set([track()]);
    const steps = [{ route: '/invoices/new', selector: '#customer', placement: 'bottom' as const, text: 'Pick' }];
    store.startMission(1).subscribe();
    expect(store.busy()).toBe(true);
    http
      .expectOne(`${base}/missions/1/start`)
      .flush(envelope(mission({ status: 'started', tour_steps: steps })), { status: 201, statusText: 'Created' });
    expect(store.busy()).toBe(false);
    expect(store.tracks()[0].missions[0].status).toBe('started');
    expect(store.tracks()[0].missions[0].tour_steps).toEqual(steps);
  });

  it('surfaces the 422 of a mission that needs a sandbox tenant and releases busy', () => {
    store.tracks.set([track()]);
    let status = 0;
    store.startMission(1).subscribe({ error: (e) => (status = e.status) });
    http.expectOne(`${base}/missions/1/start`).flush({ message: 'sandbox' }, { status: 422, statusText: 'Unprocessable' });
    expect(status).toBe(422);
    expect(store.busy()).toBe(false);
    expect(store.tracks()[0].missions[0].status).toBe('not_started');
  });

  it('adds the awarded xp and refreshes the tracks when a poll reports completion', () => {
    store.tracks.set([track([mission({ status: 'started' })])]);
    store.progress.set({ total_xp: 100, badges: [], tracks: [] });
    store.verifyStep(1).subscribe();
    http
      .expectOne(`${base}/missions/1/verify-step`)
      .flush(envelope({ status: 'completed', completed: true, xp_awarded: 50, badge_code: 'first' }));
    expect(store.totalXp()).toBe(150);
    expect(store.tracks()[0].missions[0].status).toBe('completed');
    http.expectOne(`${base}/tracks`).flush(envelope([track([mission({ status: 'completed' })])]));
  });

  it('does not award xp while the poll is still pending', () => {
    store.tracks.set([track([mission({ status: 'started' })])]);
    store.progress.set({ total_xp: 100, badges: [], tracks: [] });
    store.verifyStep(1).subscribe();
    http
      .expectOne(`${base}/missions/1/verify-step`)
      .flush(envelope({ status: 'started', completed: false, xp_awarded: 0, badge_code: null }));
    expect(store.totalXp()).toBe(100);
    http.expectNone(`${base}/tracks`);
  });

  it('downloads the certificate as a blob with the locale', () => {
    let blob: Blob | undefined;
    store.certificate(10).subscribe((b) => (blob = b));
    const req = http.expectOne((r) => r.url === `${base}/tracks/10/certificate`);
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('locale')).toBe('it-CH');
    req.flush(new Blob(['%PDF']));
    expect(blob?.size).toBeGreaterThan(0);
  });

  it('creates and joins cohorts and loads the teacher dashboard', () => {
    store.createCohort({ name: 'A', track_ids: [10], due_date: '2026-12-31' }).subscribe();
    const create = http.expectOne(`${base}/classroom/cohorts`);
    expect(create.request.body).toEqual({ name: 'A', track_ids: [10], due_date: '2026-12-31' });
    create.flush(envelope({ id: 5, name: 'A' }));

    store.joinCohort('ABC123').subscribe();
    const join = http.expectOne(`${base}/classroom/join`);
    expect(join.request.body).toEqual({ join_code: 'ABC123' });
    join.flush(envelope({ id: 5, name: 'A' }));

    store.loadDashboard(5).subscribe();
    http
      .expectOne(`${base}/classroom/cohorts/5/dashboard`)
      .flush(envelope({ cohort: { id: 5, name: 'A' }, assignments: [], students: [] }));
    expect(store.dashboard()?.cohort.name).toBe('A');
  });
});

describe('academy utils', () => {
  it('maps language and jurisdiction to an API locale', () => {
    expect(academyLocale('it', 'CH')).toBe('it-CH');
    expect(academyLocale('de', 'CH')).toBe('de-CH');
    expect(academyLocale('fr', 'CH')).toBe('fr-CH');
    expect(academyLocale('it', 'IT')).toBe('it-IT');
    expect(academyLocale('de', 'IT')).toBe('de');
    expect(academyLocale('en', 'CH')).toBe('en');
  });

  it('parses paragraphs, headings and lists without producing HTML', () => {
    const blocks = parseMarkdown('# Title\n\nHello <b>x</b>\nworld\n\n- a\n- b');
    expect(blocks).toEqual([
      { type: 'heading', lines: ['Title'] },
      { type: 'paragraph', lines: ['Hello <b>x</b>', 'world'] },
      { type: 'list', lines: ['a', 'b'] },
    ]);
  });
});
