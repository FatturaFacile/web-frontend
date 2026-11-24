import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiService, AuthStore, SsoLoginService } from '@core';
import { TEST_PASSWORD } from '../../../../../testing/credentials';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const login = vi.fn();
  const twoFactorChallenge = vi.fn();
  const storeLogin = vi.fn();
  let returnUrl: string | null = null;

  function create() {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthApiService, useValue: { login, twoFactorChallenge } },
        { provide: SsoLoginService, useValue: { signInWithEmail: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => returnUrl } } },
        },
      ],
    });
    TestBed.overrideProvider(AuthStore, {
      useValue: { login: storeLogin, setLocale: vi.fn() },
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    return { component: fixture.componentInstance, navigate };
  }

  beforeEach(() => {
    login.mockReset();
    twoFactorChallenge.mockReset();
    storeLogin.mockReset();
    returnUrl = null;
  });

  it('does not call the API while the form is invalid', () => {
    const { component } = create();
    component['loginForm'].setValue({ email: 'nope', password: '', remember: false });

    component['onSubmit']();

    expect(login).not.toHaveBeenCalled();
    expect(component['loginForm'].controls.email.touched).toBe(true);
  });

  it('signs in and goes to the return url when it is a relative path', () => {
    login.mockReturnValue(of({ data: { tenant_id: 't-1', user: null } }));
    returnUrl = '/sales/invoices';
    const { component, navigate } = create();
    component['loginForm'].setValue({
      email: 'anna@acme.example',
      password: TEST_PASSWORD,
      remember: true,
    });

    component['onSubmit']();

    expect(login).toHaveBeenCalledWith({
      email: 'anna@acme.example',
      password: TEST_PASSWORD,
      remember: true,
      tenant_id: '',
    });
    expect(storeLogin).toHaveBeenCalledWith('t-1', null);
    expect(navigate).toHaveBeenCalledWith('/sales/invoices');
  });

  it('ignores an absolute or protocol-relative return url', () => {
    login.mockReturnValue(of({ data: { tenant_id: 't-1' } }));
    returnUrl = '//evil.example';
    const { component, navigate } = create();
    component['loginForm'].setValue({
      email: 'anna@acme.example',
      password: TEST_PASSWORD,
      remember: false,
    });

    component['onSubmit']();

    expect(navigate).toHaveBeenCalledWith(expect.not.stringContaining('evil.example'));
  });

  it('asks for the second factor when the API requires it', () => {
    login.mockReturnValue(of({ data: { two_factor_required: true, challenge_token: 'tok' } }));
    const { component } = create();
    component['loginForm'].setValue({
      email: 'anna@acme.example',
      password: TEST_PASSWORD,
      remember: false,
    });

    component['onSubmit']();

    expect(component['isChallengeStep']()).toBe(true);
    expect(component['challengeToken']()).toBe('tok');
    expect(storeLogin).not.toHaveBeenCalled();
  });

  it('shows the API message on 401', () => {
    login.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, error: { message: 'Bad login' } })),
    );
    const { component } = create();
    component['loginForm'].setValue({
      email: 'anna@acme.example',
      password: TEST_PASSWORD,
      remember: false,
    });

    component['onSubmit']();

    expect(component['errorMessage']()).toBe('Bad login');
    expect(component['isSubmitting']()).toBe(false);
  });

  it('does not submit an empty second-factor code', () => {
    const { component } = create();
    component['isChallengeStep'].set(true);

    component['onChallengeSubmit']();

    expect(twoFactorChallenge).not.toHaveBeenCalled();
    expect(component['errorMessage']()).not.toBeNull();
  });

  it('completes the sign-in with a valid second-factor code', () => {
    twoFactorChallenge.mockReturnValue(of({ data: { tenant_id: 't-2' } }));
    const { component, navigate } = create();
    component['challengeToken'].set('tok');
    component['challengeForm'].controls.code.setValue(' 123456 ');

    component['onChallengeSubmit']();

    expect(twoFactorChallenge).toHaveBeenCalledWith({
      challenge_token: 'tok',
      code: '123456',
      recovery_code: undefined,
    });
    expect(storeLogin).toHaveBeenCalledWith('t-2', null);
    expect(navigate).toHaveBeenCalled();
  });
});
