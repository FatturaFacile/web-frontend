import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CrisisMonitoringApiService } from './crisis-monitoring-api.service';

describe('CrisisMonitoringApiService', () => {
  let service: CrisisMonitoringApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/crisis-monitoring`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CrisisMonitoringApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CrisisMonitoringApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the dashboard and computes the snapshots', () => {
    service.getDashboard('2026-11-28').subscribe();
    const read = http.expectOne((req) => req.url === `${base}/dashboard`);
    expect(read.request.params.get('as_of')).toBe('2026-11-28');
    read.flush({ data: {} });

    service.compute().subscribe();
    const compute = http.expectOne(`${base}/compute`);
    expect(compute.request.method).toBe('POST');
    compute.flush({ data: {} });
  });

  it('asks the timeline and the requirement with their parameters', () => {
    service.getTimeline(6, 'operating').subscribe();
    const timeline = http.expectOne((req) => req.url === `${base}/timeline`);
    expect(timeline.request.params.get('horizon')).toBe('6');
    expect(timeline.request.params.get('approach')).toBe('operating');
    timeline.flush({ data: {} });

    service
      .getRequirement({ horizon_months: 12, interest_rate: '4', basis: 'liquidation' })
      .subscribe();
    const required = http.expectOne((req) => req.url === `${base}/rangruecktritt/required`);
    expect(required.request.params.get('basis')).toBe('liquidation');
    expect(required.request.params.get('horizon_months')).toBe('12');
    required.flush({ data: {} });
  });

  it('posts the stress levers', () => {
    const input = {
      revenue_drop_percent: 10,
      dso_delay_days: 15,
      interest_rate_bps: 100,
      one_off_outflow_amount: 5000,
    };
    service.stressTest(input).subscribe();
    const request = http.expectOne(`${base}/stress-test`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({ data: {} });
  });

  it('downloads the PDFs as blobs', () => {
    service.downloadDossier('de').subscribe();
    const dossier = http.expectOne((req) => req.url === `${base}/dossier/pdf`);
    expect(dossier.request.responseType).toBe('blob');
    expect(dossier.request.params.get('locale')).toBe('de');
    dossier.flush(new Blob(['x']));

    service.downloadAgreement('loan-1', 'fr').subscribe();
    const agreement = http.expectOne(
      (req) => req.url === `${base}/subordinated-loans/loan-1/agreement/pdf`,
    );
    expect(agreement.request.responseType).toBe('blob');
    agreement.flush(new Blob(['x']));
  });

  it('maintains the profile and the loans', () => {
    service.updateProfile({ employees_count: 3 }).subscribe();
    const profile = http.expectOne(`${base}/profile`);
    expect(profile.request.method).toBe('PUT');
    profile.flush({ data: {} });

    service.deleteLoan('loan-1').subscribe();
    const removal = http.expectOne(`${base}/subordinated-loans/loan-1`);
    expect(removal.request.method).toBe('DELETE');
    removal.flush({ data: null });
  });
});
