import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { EnterpriseAuthApiService } from './enterprise-auth-api.service';

describe('EnterpriseAuthApiService', () => {
  let service: EnterpriseAuthApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/settings/security`;
  const ok = { success: true, message: '', data: null };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), EnterpriseAuthApiService],
    });
    service = TestBed.inject(EnterpriseAuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('reads and updates the security policy', () => {
    service.getPolicy().subscribe();
    httpMock.expectOne(`${base}/policy`).flush(ok);

    service.updatePolicy({ lockout: { max_attempts: 5 }, sso_only: false }).subscribe();
    const req = httpMock.expectOne(`${base}/policy`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ lockout: { max_attempts: 5 }, sso_only: false });
    req.flush(ok);
  });

  it('manages the OpenID Connect provider', () => {
    service.getSsoProvider().subscribe();
    httpMock.expectOne(`${base}/sso`).flush(ok);

    service
      .upsertSsoProvider({
        name: 'Provider',
        issuer: 'https://login.example.test',
        redirect_uri: 'https://app.example.test/callback',
        client_id: 'client',
        allowed_email_domains: ['example.test'],
      })
      .subscribe();
    const put = httpMock.expectOne(`${base}/sso`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.client_secret).toBeUndefined();
    put.flush(ok);

    service.refreshSsoDiscovery().subscribe();
    const discovery = httpMock.expectOne(`${base}/sso/discovery`);
    expect(discovery.request.method).toBe('POST');
    discovery.flush(ok);

    service.deleteSsoProvider().subscribe();
    expect(httpMock.expectOne(`${base}/sso`).request.method).toBe('DELETE');
  });

  it('manages the SAML provider', () => {
    service.getSamlProvider().subscribe();
    httpMock.expectOne(`${base}/saml`).flush(ok);

    service.upsertSamlProvider({ name: 'Provider', allowed_email_domains: ['example.test'] }).subscribe();
    const put = httpMock.expectOne(`${base}/saml`);
    expect(put.request.method).toBe('PUT');
    put.flush(ok);

    service.refreshSamlMetadata().subscribe();
    const metadata = httpMock.expectOne(`${base}/saml/metadata`);
    expect(metadata.request.method).toBe('POST');
    metadata.flush(ok);

    service.deleteSamlProvider().subscribe();
    expect(httpMock.expectOne(`${base}/saml`).request.method).toBe('DELETE');
  });

  it('reads, rotates and revokes the SCIM token', () => {
    service.getScimToken().subscribe();
    httpMock.expectOne(`${base}/scim`).flush(ok);

    service.rotateScimToken({ expires_in_days: 90 }).subscribe();
    const rotate = httpMock.expectOne(`${base}/scim/token`);
    expect(rotate.request.method).toBe('POST');
    expect(rotate.request.body).toEqual({ expires_in_days: 90 });
    rotate.flush(ok);

    service.revokeScimToken().subscribe();
    expect(httpMock.expectOne(`${base}/scim/token`).request.method).toBe('DELETE');
  });

  it('manages the SCIM group mappings', () => {
    service.getScimGroupMappings().subscribe();
    expect(httpMock.expectOne(`${base}/scim/group-mappings`).request.method).toBe('GET');

    service.upsertScimGroupMapping({ group_name: 'Finance', role: 'accountant' }).subscribe();
    const put = httpMock.expectOne(`${base}/scim/group-mappings`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ group_name: 'Finance', role: 'accountant' });
    put.flush(ok);

    service.deleteScimGroupMapping('m1').subscribe();
    expect(httpMock.expectOne(`${base}/scim/group-mappings/m1`).request.method).toBe('DELETE');
  });

  it('reads the SCIM logs with the filters and the page, dropping the empty ones', () => {
    service.getScimLogs({ resource: 'user', status: 'failure', operation: undefined, page: 2, per_page: 10 }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${base}/scim/logs`);
    expect(req.request.params.get('resource')).toBe('user');
    expect(req.request.params.get('status')).toBe('failure');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.has('operation')).toBe(false);
    req.flush(ok);
  });

  it('reads the security audit with the filters, joining the event types', () => {
    service
      .getSecurityAudit({
        from: '2026-11-01',
        to: '2026-11-30',
        subject_user_id: 'u1',
        event_type: ['login_failed', 'login_succeeded'],
        status: 'failure',
        auth_method: 'passkey',
        page: 3,
        per_page: 50,
      })
      .subscribe();

    const req = httpMock.expectOne((r) => r.url === `${base}/audit`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('event_type')).toBe('login_failed,login_succeeded');
    expect(req.request.params.get('from')).toBe('2026-11-01');
    expect(req.request.params.get('auth_method')).toBe('passkey');
    expect(req.request.params.get('per_page')).toBe('50');
    req.flush(ok);
  });

  it('omits an empty event type list from the audit query', () => {
    service.getSecurityAudit({ event_type: [] }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${base}/audit`);
    expect(req.request.params.has('event_type')).toBe(false);
    req.flush(ok);
  });

  it('reads the audit event types', () => {
    service.getSecurityAuditEventTypes().subscribe();

    expect(httpMock.expectOne(`${base}/audit/event-types`).request.method).toBe('GET');
  });

  it('unlocks a member', () => {
    service.unlockUser('u1').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/settings/users/u1/unlock`);
    expect(req.request.method).toBe('POST');
    req.flush(ok);
  });
});
