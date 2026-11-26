import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnterpriseAuthApiService, SamlProvider, SecurityPolicy, SsoProvider } from '@core';
import { icons } from '../../../../icons-provider';
import { EnterpriseSecurityComponent } from './enterprise-security.component';
import { blankToNull, enterpriseErrorText, formatRoleMapping, parseCertificates, parseRoleMapping } from './enterprise-security.util';
import { SamlProviderFormComponent } from './saml-provider-form.component';
import { ScimTokenCardComponent } from './scim-token-card.component';
import { maxNotBelowBase, SecurityPolicyFormComponent } from './security-policy-form.component';
import { SsoProviderFormComponent } from './sso-provider-form.component';

const envelope = <T>(data: T) => ({ success: true, message: '', data });

const policy: SecurityPolicy = {
  password: { min_length: 12, require_mixed_case: true, require_numbers: true, require_symbols: false, check_breached: true, history_count: 3, max_age_days: null },
  lockout: { max_attempts: 5, minutes: 15, backoff: true, max_minutes: 240 },
  session: { idle_timeout_minutes: null, max_concurrent_sessions: 3 },
  two_factor: { require_for: 'roles', roles: ['admin'] },
  sso_only: false,
  sso_ready: false,
};

const sso: SsoProvider = {
  id: 'p1',
  name: 'Provider',
  issuer: 'https://login.example.test',
  authorization_endpoint: null,
  token_endpoint: null,
  jwks_uri: null,
  redirect_uri: 'https://app.example.test/callback',
  client_id: 'client',
  has_client_secret: true,
  token_endpoint_auth_method: null,
  end_session_endpoint: null,
  post_logout_redirect_uri: null,
  scopes: 'openid email',
  allowed_email_domains: ['example.test'],
  role_claim: 'groups',
  role_mapping: { staff: 'member' },
  default_role: 'member',
  sync_role_on_login: true,
  jit_provisioning: true,
  enabled: true,
  ready: true,
  discovered_at: '2026-11-01T10:00:00Z',
};

const saml: SamlProvider = {
  id: 's1',
  name: 'SAML',
  idp_entity_id: 'https://idp.example.test',
  idp_sso_url: 'https://idp.example.test/sso',
  idp_slo_url: null,
  idp_certificates_count: 1,
  idp_metadata_url: 'https://idp.example.test/metadata',
  metadata_refreshed_at: null,
  email_attribute: null,
  name_attribute: null,
  role_attribute: null,
  role_mapping: null,
  default_role: null,
  sync_role_on_login: false,
  jit_provisioning: false,
  allowed_email_domains: ['example.test'],
  has_sp_signing_key: true,
  enabled: true,
  ready: true,
  sp: { entity_id: 'e', acs_url: 'a', slo_url: 's', metadata_url: 'm' },
};

describe('enterprise security util', () => {
  it('parses and formats the role mapping', () => {
    expect(parseRoleMapping('staff=member\n\nbad line\nadmins = admin')).toEqual({ staff: 'member', admins: 'admin' });
    expect(parseRoleMapping('  ')).toBeNull();
    expect(formatRoleMapping({ staff: 'member' })).toBe('staff=member');
  });

  it('splits certificates on blank lines', () => {
    expect(parseCertificates('A\nB\n\nC')).toEqual(['A\nB', 'C']);
    expect(parseCertificates('')).toBeNull();
  });

  it('turns blank text into null and reads the API error', () => {
    expect(blankToNull('  ')).toBeNull();
    expect(blankToNull(' x ')).toBe('x');
    const error = new HttpErrorResponse({ status: 422, error: { message: 'm', errors: { name: ['Name is required'] } } });
    expect(enterpriseErrorText(error)).toBe('Name is required');
    expect(enterpriseErrorText(new HttpErrorResponse({ status: 409, error: { detail: 'Locked out' } }))).toBe('Locked out');
  });
});

describe('enterprise security components', () => {
  const api = {
    getPolicy: vi.fn(),
    updatePolicy: vi.fn(),
    getSsoProvider: vi.fn(),
    upsertSsoProvider: vi.fn(),
    refreshSsoDiscovery: vi.fn(),
    deleteSsoProvider: vi.fn(),
    getSamlProvider: vi.fn(),
    upsertSamlProvider: vi.fn(),
    refreshSamlMetadata: vi.fn(),
    deleteSamlProvider: vi.fn(),
    getScimToken: vi.fn(),
    rotateScimToken: vi.fn(),
    revokeScimToken: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getPolicy.mockReturnValue(of(envelope(policy)));
    api.getSsoProvider.mockReturnValue(of(envelope(sso)));
    api.getSamlProvider.mockReturnValue(of(envelope(saml)));
    api.getScimToken.mockReturnValue(of(envelope({ configured: false, token_hint: null, created_at: null, last_used_at: null, expires_at: null })));
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: EnterpriseAuthApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
      ],
    });
  });

  it('renders the tabs of the page', () => {
    const fixture = TestBed.createComponent(EnterpriseSecurityComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('nz-tabs')).not.toBeNull();
  });

  it('sends the breached password check and the lockout backoff with the policy', () => {
    api.updatePolicy.mockReturnValue(of(envelope(policy)));
    const fixture = TestBed.createComponent(SecurityPolicyFormComponent);
    fixture.detectChanges();

    const payload = fixture.componentInstance.payload();
    expect(payload.password?.check_breached).toBe(true);
    expect(payload.lockout).toEqual({ max_attempts: 5, minutes: 15, backoff: true, max_minutes: 240 });

    fixture.componentInstance.form.controls.password.controls.check_breached.setValue(false);
    fixture.componentInstance.form.controls.lockout.controls.backoff.setValue(false);
    const changed = fixture.componentInstance.payload();
    expect(changed.password?.check_breached).toBe(false);
    expect(changed.lockout?.backoff).toBe(false);
  });

  it('refuses a progressive lock that ends before the base lock', () => {
    api.updatePolicy.mockReturnValue(of(envelope(policy)));
    const fixture = TestBed.createComponent(SecurityPolicyFormComponent);
    fixture.detectChanges();
    const lockout = fixture.componentInstance.form.controls.lockout;

    lockout.patchValue({ minutes: 60, max_minutes: 30, backoff: true });
    expect(maxNotBelowBase(lockout)).toEqual({ maxBelowBase: true });

    fixture.componentInstance.save();
    expect(api.updatePolicy).not.toHaveBeenCalled();

    lockout.patchValue({ max_minutes: 60 });
    expect(maxNotBelowBase(lockout)).toBeNull();
    lockout.patchValue({ backoff: false, max_minutes: 1 });
    expect(maxNotBelowBase(lockout)).toBeNull();
  });

  it('loads the policy into the form and saves only what the API contract accepts', () => {
    api.updatePolicy.mockReturnValue(of(envelope(policy)));
    const fixture = TestBed.createComponent(SecurityPolicyFormComponent);
    fixture.detectChanges();

    const payload = fixture.componentInstance.payload();
    expect(payload.two_factor).toEqual({ require_for: 'roles', roles: ['admin'] });
    expect(payload.password?.max_age_days).toBeNull();

    fixture.componentInstance.form.controls.two_factor.controls.require_for.setValue('all');
    expect(fixture.componentInstance.payload().two_factor?.roles).toEqual([]);

    fixture.componentInstance.save();
    expect(api.updatePolicy).toHaveBeenCalledTimes(1);
    expect(message.success).toHaveBeenCalled();
  });

  it('never fills the SSO client secret and omits it unless typed', () => {
    api.upsertSsoProvider.mockReturnValue(of(envelope(sso)));
    const fixture = TestBed.createComponent(SsoProviderFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.form.controls.client_secret.value).toBe('');
    expect('client_secret' in component.payload()).toBe(false);
    expect(component.payload().role_mapping).toEqual({ staff: 'member' });

    const typed = 'typed-in-the-test';
    component.form.controls.client_secret.setValue(typed);
    expect(component.payload().client_secret).toBe(typed);

    component.save();
    expect(api.upsertSsoProvider).toHaveBeenCalledTimes(1);
    expect(component.form.controls.client_secret.value).toBe('');
  });

  it('tests the SSO connection through the discovery refresh', () => {
    api.refreshSsoDiscovery.mockReturnValue(of(envelope(sso)));
    const fixture = TestBed.createComponent(SsoProviderFormComponent);
    fixture.detectChanges();

    fixture.componentInstance.testConnection();
    expect(api.refreshSsoDiscovery).toHaveBeenCalledTimes(1);
    expect(message.success).toHaveBeenCalled();
  });

  it('shows the reason when the SSO connection test fails', () => {
    api.refreshSsoDiscovery.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'Issuer unreachable' } })));
    const fixture = TestBed.createComponent(SsoProviderFormComponent);
    fixture.detectChanges();

    fixture.componentInstance.testConnection();
    expect(fixture.componentInstance.errorText()).toBe('Issuer unreachable');
  });

  it('omits the SAML key pair unless one is typed and keeps the provider values', () => {
    api.upsertSamlProvider.mockReturnValue(of(envelope(saml)));
    const fixture = TestBed.createComponent(SamlProviderFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const payload = component.payload();
    expect('sp_private_key' in payload).toBe(false);
    expect(payload.idp_metadata_url).toBe('https://idp.example.test/metadata');
    expect(payload.idp_certificates).toBeNull();

    component.form.controls.sp_private_key.setValue('key-material');
    component.form.controls.sp_certificate.setValue('certificate-material');
    expect(component.payload().sp_private_key).toBe('key-material');

    component.save();
    expect(component.form.controls.sp_private_key.value).toBe('');
  });

  it('refreshes the SAML metadata as the connection test', () => {
    api.refreshSamlMetadata.mockReturnValue(of(envelope(saml)));
    const fixture = TestBed.createComponent(SamlProviderFormComponent);
    fixture.detectChanges();

    fixture.componentInstance.testConnection();
    expect(api.refreshSamlMetadata).toHaveBeenCalledTimes(1);
  });

  it('shows the plain SCIM token once and drops it on dismiss', () => {
    const plain = 'plain-token-from-the-api';
    api.rotateScimToken.mockReturnValue(
      of(envelope({ configured: true, token_hint: 'abcd', created_at: null, last_used_at: null, expires_at: null, token: plain }))
    );
    const fixture = TestBed.createComponent(ScimTokenCardComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.rotate();
    expect(component.plainToken()).toBe(plain);
    expect(component.status()).not.toHaveProperty('token');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('input[readonly]')).not.toBeNull();

    component.dismissToken();
    expect(component.plainToken()).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain(plain);
    expect(JSON.stringify(sessionStorage)).not.toContain(plain);
  });

  it('clears the SCIM token when the token is revoked', () => {
    api.revokeScimToken.mockReturnValue(of(envelope(null)));
    const fixture = TestBed.createComponent(ScimTokenCardComponent);
    fixture.detectChanges();
    fixture.componentInstance.plainToken.set('x');

    fixture.componentInstance.revoke();
    expect(fixture.componentInstance.plainToken()).toBeNull();
    expect(api.getScimToken).toHaveBeenCalledTimes(2);
  });
});
