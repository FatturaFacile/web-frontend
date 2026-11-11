import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { AuthApiService } from '../api/auth-api.service';
import { SsoLoginService, SsoRedirectError } from './sso-login.service';

const TENANT = '0b5d3d7e-8f0e-4c53-9a63-6f1d3f6c2a11';
const CODE = 'A'.repeat(32) + 'b'.repeat(32);

describe('SsoLoginService', () => {
  const startSso = vi.fn();
  const discoverSso = vi.fn();

  function create(): { service: SsoLoginService; navigated: string[] } {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthApiService, useValue: { startSso, discoverSso } }],
    });
    const service = TestBed.inject(SsoLoginService);
    const navigated: string[] = [];
    vi.spyOn(service as unknown as { navigate: (url: string) => void }, 'navigate').mockImplementation(
      (url) => void navigated.push(url),
    );
    return { service, navigated };
  }

  beforeEach(() => {
    startSso.mockReset();
    discoverSso.mockReset();
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/auth/sso/complete');
  });

  afterEach(() => window.history.replaceState(null, '', '/'));

  it('sends the browser to the identity provider and remembers a same-app return path', () => {
    startSso.mockReturnValue(of('https://idp.example.com/authorize?x=1'));
    const { service, navigated } = create();

    service.start('saml', TENANT, '/sales/invoices').subscribe();

    expect(startSso).toHaveBeenCalledWith('saml', TENANT);
    expect(navigated).toEqual(['https://idp.example.com/authorize?x=1']);
    expect(service.takeReturnUrl()).toBe('/sales/invoices');
    expect(service.takeReturnUrl()).toBeNull();
  });

  it('never keeps an external return path', () => {
    startSso.mockReturnValue(of('https://idp.example.com/a'));
    const { service } = create();

    service.start('oidc', TENANT, '//evil.example.com').subscribe();

    expect(service.takeReturnUrl()).toBeNull();
  });

  it.each(['http://idp.example.com/a', 'javascript:alert(1)', ''])(
    'refuses the unsafe redirect %j',
    (url) => {
      startSso.mockReturnValue(of(url));
      const { service, navigated } = create();
      const error = vi.fn();

      service.start('oidc', TENANT).subscribe({ error });

      expect(error.mock.calls[0][0]).toBeInstanceOf(SsoRedirectError);
      expect(navigated).toEqual([]);
    },
  );

  it('propagates the API error', () => {
    const failure = new HttpErrorResponse({ status: 404 });
    startSso.mockReturnValue(throwError(() => failure));
    const error = vi.fn();

    create().service.start('oidc', TENANT).subscribe({ error });

    expect(error).toHaveBeenCalledWith(failure);
  });

  it('reads the code from the fragment and removes the fragment from the address bar', () => {
    window.history.replaceState(null, '', `/auth/sso/complete#code=${CODE}`);

    expect(create().service.consumeSignInCode()).toBe(CODE);
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/auth/sso/complete');
  });

  it('never reads the code from the query string', () => {
    window.history.replaceState(null, '', `/auth/sso/complete?code=${CODE}`);

    expect(create().service.consumeSignInCode()).toBeNull();
  });

  it('drops a malformed fragment and returns no code', () => {
    window.history.replaceState(null, '', '/auth/sso/complete#code=short');

    expect(create().service.consumeSignInCode()).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('starts the discovered protocol for the discovered tenant', () => {
    discoverSso.mockReturnValue(of({ available: true, protocol: 'saml', tenant_id: TENANT }));
    startSso.mockReturnValue(of('https://idp.example.com/saml'));
    const { service, navigated } = create();
    let leaving: boolean | undefined;

    service.signInWithEmail(' anna@acme.example ', '/sales/orders').subscribe((v) => (leaving = v));

    expect(discoverSso).toHaveBeenCalledWith('anna@acme.example');
    expect(startSso).toHaveBeenCalledWith('saml', TENANT);
    expect(navigated).toEqual(['https://idp.example.com/saml']);
    expect(leaving).toBe(true);
  });

  it('does nothing when the address has no single sign-on', () => {
    discoverSso.mockReturnValue(of({ available: false, protocol: null, tenant_id: null }));
    const { service, navigated } = create();
    let leaving: boolean | undefined;

    service.signInWithEmail('anna@acme.example').subscribe((v) => (leaving = v));

    expect(startSso).not.toHaveBeenCalled();
    expect(navigated).toEqual([]);
    expect(leaving).toBe(false);
  });

  it('reads the OpenID Connect code and state and removes them from the address bar', () => {
    window.history.replaceState(null, '', '/auth/sso/complete?code=abc&state=xyz');

    expect(create().service.consumeOidcParams()).toEqual({ code: 'abc', state: 'xyz' });
    expect(window.location.search).toBe('');
  });

  it('strips an identity provider error answer and returns nothing', () => {
    window.history.replaceState(null, '', '/auth/sso/complete?error=access_denied&state=xyz');

    expect(create().service.consumeOidcParams()).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('follows the identity provider logout only to a safe URL', () => {
    const { service, navigated } = create();

    expect(service.followIdpLogout(null)).toBe(false);
    expect(service.followIdpLogout('http://idp.example.com/logout')).toBe(false);
    expect(service.followIdpLogout('https://idp.example.com/logout')).toBe(true);
    expect(navigated).toEqual(['https://idp.example.com/logout']);
  });
});
