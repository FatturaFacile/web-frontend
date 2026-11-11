import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { AUTH_PROBLEM, AuthApiService, AuthStore, SsoLoginService } from '@core';
import { SsoCompleteComponent } from './sso-complete.component';

const CODE = 'c'.repeat(64);

describe('SsoCompleteComponent', () => {
  const exchangeSsoCode = vi.fn();
  const twoFactorChallenge = vi.fn();
  const consumeSignInCode = vi.fn();
  const consumeOidcParams = vi.fn();
  const completeOidcSso = vi.fn();
  const takeReturnUrl = vi.fn();
  const login = vi.fn();

  function create() {
    TestBed.configureTestingModule({
      imports: [SsoCompleteComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthApiService, useValue: { exchangeSsoCode, completeOidcSso, twoFactorChallenge } },
        { provide: SsoLoginService, useValue: { consumeSignInCode, consumeOidcParams, takeReturnUrl } },
      ],
    });
    vi.spyOn(TestBed.inject(AuthStore), 'login').mockImplementation(login);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(SsoCompleteComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance, fixture, navigate };
  }

  function failure(code: number, type?: string) {
    return throwError(() => new HttpErrorResponse({ status: code, error: { type } }));
  }

  beforeEach(() => {
    [exchangeSsoCode, completeOidcSso, twoFactorChallenge, consumeSignInCode, consumeOidcParams, takeReturnUrl, login].forEach((m) =>
      m.mockReset(),
    );
    consumeSignInCode.mockReturnValue(CODE);
    consumeOidcParams.mockReturnValue(null);
    takeReturnUrl.mockReturnValue(null);
    window.localStorage.clear();
  });

  afterEach(() => window.localStorage.clear());

  it('exchanges the code, signs in like the password login and goes to the return path', () => {
    takeReturnUrl.mockReturnValue('/sales/orders');
    const user = { id: 'u1' };
    exchangeSsoCode.mockReturnValue(
      of({ data: { user, active_tenant: { id: 'tenant-1' }, tenant_id: 'tenant-1' } }),
    );

    const { navigate } = create();

    expect(exchangeSsoCode).toHaveBeenCalledWith(CODE);
    expect(login).toHaveBeenCalledWith('tenant-1', user);
    expect(window.localStorage.getItem('ff_active_tenant_id')).toBe('tenant-1');
    expect(navigate).toHaveBeenCalledWith('/sales/orders', { replaceUrl: true });
  });

  it('completes an OpenID Connect return with the callback and signs in', () => {
    consumeSignInCode.mockReturnValue(null);
    consumeOidcParams.mockReturnValue({ code: 'abc', state: 'xyz' });
    completeOidcSso.mockReturnValue(of({ data: { tenant_id: 'tenant-1', user: { id: 'u1' } } }));

    const { navigate } = create();

    expect(completeOidcSso).toHaveBeenCalledWith('abc', 'xyz');
    expect(exchangeSsoCode).not.toHaveBeenCalled();
    expect(login).toHaveBeenCalledWith('tenant-1', { id: 'u1' });
    expect(navigate).toHaveBeenCalledWith('/sales/invoices', { replaceUrl: true });
  });

  it('fails an OpenID Connect return that the API refuses', () => {
    consumeSignInCode.mockReturnValue(null);
    consumeOidcParams.mockReturnValue({ code: 'abc', state: 'xyz' });
    completeOidcSso.mockReturnValue(failure(401));

    const { component } = create();

    expect(component['state']()).toBe('failed');
    expect(login).not.toHaveBeenCalled();
  });

  it('never stores a token', () => {
    exchangeSsoCode.mockReturnValue(
      of({ data: { tenant_id: 'tenant-1', token: 'opaque-value', access_token: 'opaque-value' } }),
    );

    create();

    const stored = Object.keys(window.localStorage).map((k) => `${k}=${window.localStorage.getItem(k)}`);
    expect(stored.join(' ')).not.toContain('opaque-value');
  });

  it('shows a link to the login and does not call the API without a code', () => {
    consumeSignInCode.mockReturnValue(null);

    const { component, fixture } = create();

    expect(exchangeSsoCode).not.toHaveBeenCalled();
    expect(component['state']()).toBe('failed');
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/login"]')).not.toBeNull();
  });

  it('reports a code that is invalid, expired or used', () => {
    exchangeSsoCode.mockReturnValue(failure(401));

    const { component, fixture } = create();

    expect(component['state']()).toBe('failed');
    expect(component['errorMessage']()).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/login"]')).not.toBeNull();
  });

  it('reports a request without a cookie session separately from a bad code', () => {
    exchangeSsoCode.mockReturnValue(failure(401));
    const bad = create().component['errorMessage']();
    TestBed.resetTestingModule();
    exchangeSsoCode.mockReturnValue(failure(400));
    const noSession = create().component['errorMessage']();

    expect(noSession).not.toBe(bad);
  });

  it('asks for the second factor when the API requires it, then signs in', () => {
    exchangeSsoCode.mockReturnValue(
      of({ data: { two_factor_required: true, challenge_token: 'challenge-1' } }),
    );
    twoFactorChallenge.mockReturnValue(of({ data: { tenant_id: 'tenant-2', user: { id: 'u2' } } }));

    const { component, navigate } = create();

    expect(component['state']()).toBe('challenge');
    expect(login).not.toHaveBeenCalled();

    component['challengeForm'].setValue({ code: ' 123456 ', recoveryCode: '' });
    component['onChallengeSubmit']();

    expect(twoFactorChallenge).toHaveBeenCalledWith({
      challenge_token: 'challenge-1',
      code: '123456',
      recovery_code: undefined,
    });
    expect(login).toHaveBeenCalledWith('tenant-2', { id: 'u2' });
    expect(navigate).toHaveBeenCalledWith('/sales/invoices', { replaceUrl: true });
  });

  it('keeps the challenge open on a wrong code and fails on an expired challenge', () => {
    exchangeSsoCode.mockReturnValue(
      of({ data: { two_factor_required: true, challenge_token: 'challenge-1' } }),
    );
    const { component } = create();
    component['challengeForm'].setValue({ code: '000000', recoveryCode: '' });

    twoFactorChallenge.mockReturnValue(failure(422, AUTH_PROBLEM.TwoFactorCodeInvalid));
    component['onChallengeSubmit']();
    expect(component['state']()).toBe('challenge');
    expect(component['errorMessage']()).toBeTruthy();

    twoFactorChallenge.mockReturnValue(failure(401, AUTH_PROBLEM.TwoFactorChallengeInvalid));
    component['onChallengeSubmit']();
    expect(component['state']()).toBe('failed');
  });

  it('opens the two-factor setup when the policy requires it', () => {
    exchangeSsoCode.mockReturnValue(of({ data: { tenant_id: 't', two_factor_setup_required: true } }));

    const { component, navigate } = create();

    expect(component['showTwoFactorSetup']()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
});
