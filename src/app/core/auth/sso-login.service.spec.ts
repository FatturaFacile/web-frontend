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

  function create(): { service: SsoLoginService; navigated: string[] } {
    TestBed.configureTestingModule({ providers: [{ provide: AuthApiService, useValue: { startSso } }] });
    const service = TestBed.inject(SsoLoginService);
    const navigated: string[] = [];
    vi.spyOn(service as unknown as { navigate: (url: string) => void }, 'navigate').mockImplementation(
      (url) => void navigated.push(url),
    );
    return { service, navigated };
  }

  beforeEach(() => {
    startSso.mockReset();
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
});
