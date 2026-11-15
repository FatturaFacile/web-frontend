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
});
