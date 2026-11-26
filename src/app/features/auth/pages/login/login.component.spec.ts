import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiService, AuthStore, getTrustedDeviceToken, SsoLoginService, storeTrustedDeviceToken } from '@core';
import { TEST_PASSWORD } from '../../../../../testing/credentials';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const login = vi.fn();
  const twoFactorChallenge = vi.fn();
  const storeLogin = vi.fn();
  const setTwoFactorSetupRequired = vi.fn();
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
      useValue: { login: storeLogin, setLocale: vi.fn(), setTwoFactorSetupRequired },
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
    setTwoFactorSetupRequired.mockReset();
    window.localStorage.clear();
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

  it('keeps the factors the API offers for the challenge step', () => {
    login.mockReturnValue(
      of({
        data: {
          two_factor_required: true,
          challenge_token: 'tok',
          methods: ['email', 'recovery_code'],
          default_method: 'email',
          email_code_sent: true,
          trusted_devices_enabled: true,
        },
      }),
    );
    const { component } = create();
    component['loginForm'].setValue({ email: 'anna@acme.example', password: TEST_PASSWORD, remember: false });

    component['onSubmit']();

    expect(component['challengeMethods']()).toEqual(['email', 'recovery_code']);
    expect(component['challengeDefaultMethod']()).toBe('email');
    expect(component['challengeEmailSent']()).toBe(true);
    expect(component['challengeTrustedDevices']()).toBe(true);
  });

  it('sends the remembered device token of the account and forgets it when the challenge is still required', () => {
    storeTrustedDeviceToken('anna@acme.example', 't'.repeat(64));
    login.mockReturnValue(of({ data: { two_factor_required: true, challenge_token: 'tok' } }));
    const { component } = create();
    component['loginForm'].setValue({ email: 'anna@acme.example', password: TEST_PASSWORD, remember: false });

    component['onSubmit']();

    expect(login).toHaveBeenCalledWith(expect.objectContaining({ trusted_device_token: 't'.repeat(64) }));
    expect(getTrustedDeviceToken('anna@acme.example')).toBeNull();
  });

  it('does not send a device token when none is remembered', () => {
    login.mockReturnValue(of({ data: { tenant_id: 't-1' } }));
    const { component } = create();
    component['loginForm'].setValue({ email: 'nobody@acme.example', password: TEST_PASSWORD, remember: false });

    component['onSubmit']();

    expect(login.mock.calls[0][0]).not.toHaveProperty('trusted_device_token');
  });

  it('completes the sign-in when the challenge succeeds', () => {
    const { component, navigate } = create();
    component['isChallengeStep'].set(true);

    component['onChallengeSucceeded']({ tenant_id: 't-2' });

    expect(storeLogin).toHaveBeenCalledWith('t-2', null);
    expect(navigate).toHaveBeenCalled();
  });

  it('goes back to the password step with the message when the challenge restarts', () => {
    const { component } = create();
    component['isChallengeStep'].set(true);
    component['challengeToken'].set('tok');

    component['onChallengeRestart']('expired');

    expect(component['isChallengeStep']()).toBe(false);
    expect(component['challengeToken']()).toBe('');
    expect(component['errorMessage']()).toBe('expired');
  });

  it('flags the mandatory second factor enrolment after the login', () => {
    login.mockReturnValue(of({ data: { tenant_id: 't-1', two_factor_setup_required: true } }));
    const { component, navigate } = create();
    component['loginForm'].setValue({ email: 'anna@acme.example', password: TEST_PASSWORD, remember: false });

    component['onSubmit']();

    expect(setTwoFactorSetupRequired).toHaveBeenCalledWith(true);
    expect(navigate).toHaveBeenCalled();
  });

  it('shows the lock message on a locked account', () => {
    login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 423 })));
    const { component } = create();
    component['loginForm'].setValue({ email: 'anna@acme.example', password: TEST_PASSWORD, remember: false });

    component['onSubmit']();

    expect(component['errorMessage']()).not.toBeNull();
  });
});
