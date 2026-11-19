import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PrivacyGovernanceApiService } from './privacy-governance-api.service';

describe('PrivacyGovernanceApiService', () => {
  let api: PrivacyGovernanceApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(PrivacyGovernanceApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('filters the RoPA and drops empty filters', () => {
    api.getRopa({ legal_basis: 'consent', cross_border: 1, is_active: '' }).subscribe();
    const request = http.expectOne((r) => r.url.endsWith('/privacy/ropa'));
    expect(request.request.params.get('legal_basis')).toBe('consent');
    expect(request.request.params.get('cross_border')).toBe('1');
    expect(request.request.params.has('is_active')).toBe(false);
    request.flush({ data: [] });
  });

  it('seeds the defaults and exports the RoPA as a blob', () => {
    api.seedDefaults().subscribe();
    const seed = http.expectOne((r) => r.url.endsWith('/privacy/ropa/seed-defaults'));
    expect(seed.request.method).toBe('POST');
    seed.flush({
      data: { ropa_created: 1, ropa_existing: 0, rules_created: 2, rules_existing: 0 },
    });

    api.exportRopa('xlsx').subscribe();
    const exported = http.expectOne((r) => r.url.endsWith('/privacy/ropa/export'));
    expect(exported.request.params.get('format')).toBe('xlsx');
    expect(exported.request.responseType).toBe('blob');
    exported.flush(new Blob(['x']));
  });

  it('runs the erasure as a dry run only when asked', () => {
    api.executeErasure('d-1', true).subscribe();
    const dry = http.expectOne((r) => r.url.endsWith('/privacy/dsar/d-1/execute-erasure'));
    expect(dry.request.params.get('dry_run')).toBe('true');
    dry.flush({ data: {} });

    api.executeErasure('d-1', false).subscribe();
    const real = http.expectOne((r) => r.url.endsWith('/privacy/dsar/d-1/execute-erasure'));
    expect(real.request.params.has('dry_run')).toBe(false);
    real.flush({ data: {} });
  });

  it('downloads the portability package as a blob and verifies the identity', () => {
    api.downloadPackage('d-1').subscribe();
    const pkg = http.expectOne((r) => r.url.endsWith('/privacy/dsar/d-1/download-package'));
    expect(pkg.request.responseType).toBe('blob');
    pkg.flush(new Blob(['zip']));

    api.verifyIdentity('d-1', 'id_document').subscribe();
    const verify = http.expectOne((r) => r.url.endsWith('/privacy/dsar/d-1/verify-identity'));
    expect(verify.request.body).toEqual({ method: 'id_document' });
    verify.flush({ data: {} });
  });

  it('reads the dossier, the countdowns and the retention rules, and runs the purge', () => {
    api.getNotificationDossier('b-1').subscribe();
    http
      .expectOne((r) => r.url.endsWith('/privacy/breaches/b-1/notification-dossier'))
      .flush({ data: { facts: {}, authorities: [] } });

    api.getActiveCountdowns().subscribe();
    http.expectOne((r) => r.url.endsWith('/privacy/breaches/active-countdown')).flush({ data: [] });

    api.getRetentionRules().subscribe();
    http
      .expectOne((r) => r.url.endsWith('/privacy/retention-rules'))
      .flush({ data: [], recent_runs: [] });

    api.runRetentionNow(true).subscribe();
    const run = http.expectOne((r) => r.url.endsWith('/privacy/retention-rules/run-now'));
    expect(run.request.params.get('dry_run')).toBe('1');
    run.flush({ data: {} });

    api.updateRetentionRule('r-1', { retention_days: 400 }).subscribe();
    const update = http.expectOne((r) => r.url.endsWith('/privacy/retention-rules/r-1'));
    expect(update.request.method).toBe('PUT');
    update.flush({ data: {} });
  });
});
