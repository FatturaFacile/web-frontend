import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { LOCALLY_HANDLED_ERROR_STATUSES } from '../http/error-handling.context';
import { RecruitingApiService } from './recruiting-api.service';

const API = 'https://api.fatturafacile.eu/api/v1';
const BASE = `${API}/hr/recruiting`;

describe('RecruitingApiService', () => {
  let service: RecruitingApiService;
  let http: HttpTestingController;
  const originalApiBaseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    environment.apiBaseUrl = API;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RecruitingApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('lists job openings with filters and pagination', () => {
    service
      .listJobOpenings({
        status: 'published',
        department_id: 'd1',
        search: '',
        page: 2,
        per_page: 25,
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === `${BASE}/job-openings`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('published');
    expect(req.request.params.get('department_id')).toBe('d1');
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ data: [], meta: { current_page: 2, last_page: 2, per_page: 25, total: 26 } });
  });

  it('creates, updates, publishes and closes job openings', () => {
    const payload = {
      position_id: 'p1',
      location_site: 'Lugano',
      employment_type: 'full_time' as const,
      published_languages: ['it-CH' as const],
      translations: {
        'it-CH': { title: 'Contabile', description: 'D', requirements: '', benefits: '' },
      },
    };
    service.createJobOpening(payload).subscribe();
    const create = http.expectOne(`${BASE}/job-openings`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(payload);
    expect(create.request.context.get(LOCALLY_HANDLED_ERROR_STATUSES)).toEqual([409, 422]);
    create.flush({ data: {} });

    service.updateJobOpening('o1', { location_site: 'Chiasso' }).subscribe();
    const update = http.expectOne(`${BASE}/job-openings/o1`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ location_site: 'Chiasso' });
    update.flush({ data: {} });

    service.publishJobOpening('o1', true).subscribe();
    const publish = http.expectOne(`${BASE}/job-openings/o1/publish`);
    expect(publish.request.method).toBe('POST');
    expect(publish.request.body).toEqual({ internal_only: true });
    publish.flush({ data: {} });

    service.closeJobOpening('o1', { outcome: 'filled' }).subscribe();
    const close = http.expectOne(`${BASE}/job-openings/o1/close`);
    expect(close.request.body).toEqual({ outcome: 'filled' });
    close.flush({ data: {} });
  });

  it('loads the board with an optional search', () => {
    service.getBoard('o1', 'anna').subscribe();
    const req = http.expectOne((r) => r.url === `${BASE}/job-openings/o1/board`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('search')).toBe('anna');
    req.flush({ data: { job_opening: {}, stages: [] } });
  });

  it('moves an application with stage, position and rejection data', () => {
    service
      .moveApplication('a1', {
        stage: 'rejected',
        board_position: 0,
        rejection_reason_code: 'not_qualified',
        rejection_note: null,
        send_email: false,
      })
      .subscribe();
    const req = http.expectOne(`${BASE}/applications/a1/move`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      stage: 'rejected',
      board_position: 0,
      rejection_reason_code: 'not_qualified',
      rejection_note: null,
      send_email: false,
    });
    req.flush({ data: {} });
  });

  it('sends manual intake as multipart form data', () => {
    const cv = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' });
    service
      .createApplication({
        job_opening_id: 'o1',
        first_name: 'Anna',
        last_name: 'Bianchi',
        email: 'anna@example.com',
        retention_months: 12,
        cv,
      })
      .subscribe();
    const req = http.expectOne(`${BASE}/applications`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('job_opening_id')).toBe('o1');
    expect(body.get('retention_months')).toBe('12');
    expect((body.get('cv') as File).name).toBe('cv.pdf');
    expect(body.has('phone')).toBe(false);
    req.flush({ data: {} });
  });

  it('downloads the CV as a blob and handles 404 locally', () => {
    service.getCv('a1').subscribe();
    const req = http.expectOne(`${BASE}/applications/a1/cv`);
    expect(req.request.responseType).toBe('blob');
    expect(req.request.context.get(LOCALLY_HANDLED_ERROR_STATUSES)).toEqual([404]);
    req.flush(new Blob(['x']));
  });

  it('covers application actions, scorecards, offers and hire', () => {
    service.updateApplication('a1', { notes: 'n' }).subscribe();
    const patch = http.expectOne(`${BASE}/applications/a1`);
    expect(patch.request.method).toBe('PATCH');
    patch.flush({ data: {} });

    service.reparseCv('a1').subscribe();
    expect(http.expectOne(`${BASE}/applications/a1/reparse-cv`).request.body).toEqual({});

    service.extendConsent('a1', 6).subscribe();
    expect(http.expectOne(`${BASE}/applications/a1/extend-consent`).request.body).toEqual({
      months: 6,
    });

    service.anonymize('a1').subscribe();
    expect(http.expectOne(`${BASE}/applications/a1/anonymize`).request.method).toBe('POST');

    service.listScorecards('a1').subscribe();
    expect(http.expectOne(`${BASE}/applications/a1/scorecards`).request.method).toBe('GET');

    service
      .submitScorecard('a1', {
        stage: 'technical_interview',
        criteria_scores: [{ criterion: 'Tech', score: 4, comment: null }],
        recommendation: 'hire',
      })
      .subscribe();
    const sc = http.expectOne(
      (r) => r.method === 'POST' && r.url === `${BASE}/applications/a1/scorecards`,
    );
    expect(sc.request.body.recommendation).toBe('hire');

    service.getOffer('a1').subscribe();
    expect(
      http.expectOne((r) => r.method === 'GET' && r.url === `${BASE}/applications/a1/offer`),
    ).toBeTruthy();

    service
      .createOffer('a1', { proposed_salary: 90000, start_date: '2027-01-01', send: true })
      .subscribe();
    const offer = http.expectOne(
      (r) => r.method === 'POST' && r.url === `${BASE}/applications/a1/offer`,
    );
    expect(offer.request.body).toEqual({
      proposed_salary: 90000,
      start_date: '2027-01-01',
      send: true,
    });

    service.markOfferSigned('of1').subscribe();
    expect(http.expectOne(`${BASE}/offers/of1/mark-signed`).request.body).toEqual({});

    service.declineOffer('of1', 'too far').subscribe();
    expect(http.expectOne(`${BASE}/offers/of1/decline`).request.body).toEqual({ note: 'too far' });

    service.hire('a1', { start_onboarding: true }).subscribe();
    const hire = http.expectOne(`${BASE}/applications/a1/hire`);
    expect(hire.request.method).toBe('POST');
    expect(hire.request.body).toEqual({ start_onboarding: true });
  });

  it('reads and writes email templates and settings', () => {
    service.listEmailTemplates({ stage: 'applied' }).subscribe();
    const list = http.expectOne((r) => r.url === `${BASE}/email-templates`);
    expect(list.request.params.get('stage')).toBe('applied');
    list.flush({ data: [] });

    service
      .updateEmailTemplate('applied', 'it-CH', { subject: 's', body: 'b', is_enabled: true })
      .subscribe();
    const put = http.expectOne(`${BASE}/email-templates/applied/it-CH`);
    expect(put.request.method).toBe('PUT');
    put.flush({ data: {} });

    service.getSettings().subscribe();
    http.expectOne((r) => r.method === 'GET' && r.url === `${BASE}/settings`).flush({ data: {} });

    service.updateSettings({ retention: { default_months: 12 } }).subscribe();
    const settings = http.expectOne((r) => r.method === 'PUT' && r.url === `${BASE}/settings`);
    expect(settings.request.body).toEqual({ retention: { default_months: 12 } });
    settings.flush({ data: {} });
  });

  it('loads HR positions for the opening editor', () => {
    service.listPositions().subscribe();
    const req = http.expectOne((r) => r.url === `${API}/hr/positions`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [] });
  });
});
