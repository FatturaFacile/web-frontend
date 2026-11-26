import { HttpErrorResponse, HttpHeaders, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_PROBLEM,
  AuthApiService,
  getTrustedDeviceToken,
  LoginResult,
  PasskeyUnavailableError,
  TwoFactorMethod,
  WebAuthnService,
} from '@core';
import { icons } from '../../../../icons-provider';
import { retryAfterSeconds, TwoFactorChallengeComponent } from './two-factor-challenge.component';

describe('TwoFactorChallengeComponent', () => {
  const twoFactorChallenge = vi.fn();
  const sendTwoFactorEmailCode = vi.fn();
  const twoFactorWebauthnOptions = vi.fn();
  const webauthnGet = vi.fn();
  const webauthnSupported = vi.fn();

  function create(inputs: Partial<{
    methods: TwoFactorMethod[] | null;
    defaultMethod: TwoFactorMethod | null;
    emailCodeSent: boolean;
    trustedDevicesEnabled: boolean;
    email: string;
  }> = {}) {
    TestBed.configureTestingModule({
      imports: [TwoFactorChallengeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        { provide: AuthApiService, useValue: { twoFactorChallenge, sendTwoFactorEmailCode, twoFactorWebauthnOptions } },
        { provide: WebAuthnService, useValue: { isSupported: webauthnSupported, get: webauthnGet } },
      ],
    });
    const fixture = TestBed.createComponent(TwoFactorChallengeComponent);
    fixture.componentRef.setInput('challengeToken', 'tok');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    const succeeded = vi.fn();
    const restart = vi.fn();
    fixture.componentInstance.succeeded.subscribe(succeeded);
    fixture.componentInstance.restart.subscribe(restart);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, succeeded, restart };
  }

  function fail(status: number, error: unknown = null, headers?: Record<string, string>) {
    return throwError(() => new HttpErrorResponse({ status, error, headers: new HttpHeaders(headers) }));
  }

  const text = (fixture: ComponentFixture<unknown>, selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(selector);

  beforeEach(() => {
    [twoFactorChallenge, sendTwoFactorEmailCode, twoFactorWebauthnOptions, webauthnGet, webauthnSupported].forEach((m) => m.mockReset());
    webauthnSupported.mockReturnValue(true);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('starts with the authenticator code and offers the recovery code as another method', () => {
    const { component, fixture } = create();

    expect(component['method']()).toBe('totp');
    expect(component['otherMethods']()).toEqual(['recovery_code']);
    expect(text(fixture, '[data-testid="switch-recovery_code"]')).not.toBeNull();
  });

  it('starts with the default method of the API and lists the others in a fixed order', () => {
    const { component } = create({ methods: ['recovery_code', 'webauthn', 'email', 'totp'], defaultMethod: 'webauthn' });

    expect(component['method']()).toBe('webauthn');
    expect(component['otherMethods']()).toEqual(['totp', 'email', 'recovery_code']);
  });

  it('ignores a default method the API did not offer', () => {
    const { component } = create({ methods: ['email', 'recovery_code'], defaultMethod: 'totp' });

    expect(component['method']()).toBe('email');
  });

  it('does not submit an empty code', () => {
    const { component } = create();

    component['submit']();

    expect(twoFactorChallenge).not.toHaveBeenCalled();
    expect(component['errorMessage']()).not.toBeNull();
  });

  it('answers with the authenticator code and signs in', () => {
    const data: LoginResult = { tenant_id: 't-1' };
    twoFactorChallenge.mockReturnValue(of({ data }));
    const { component, succeeded } = create();
    component['form'].controls.code.setValue(' 123456 ');

    component['submit']();

    expect(twoFactorChallenge).toHaveBeenCalledWith({ challenge_token: 'tok', code: '123456' });
    expect(succeeded).toHaveBeenCalledWith(data);
  });

  it('answers with a recovery code', () => {
    twoFactorChallenge.mockReturnValue(of({ data: {} }));
    const { component } = create();
    component['selectMethod']('recovery_code');
    component['form'].controls.recoveryCode.setValue(' abcd-efgh ');

    component['submit']();

    expect(twoFactorChallenge).toHaveBeenCalledWith({ challenge_token: 'tok', recovery_code: 'abcd-efgh' });
  });

  it('switching the method clears the typed codes and the error', () => {
    const { component } = create({ methods: ['totp', 'email', 'recovery_code'] });
    component['form'].controls.code.setValue('123');
    component['errorMessage'].set('x');

    component['selectMethod']('email');

    expect(component['method']()).toBe('email');
    expect(component['form'].controls.code.value).toBe('');
    expect(component['errorMessage']()).toBeNull();
  });

  describe('email code', () => {
    it('shows the auto-sent state and the resend countdown when the API already emailed a code', () => {
      vi.useFakeTimers();
      const { component, fixture } = create({ methods: ['email', 'recovery_code'], emailCodeSent: true, email: 'anna@acme.example' });
      fixture.detectChanges();

      expect(component['method']()).toBe('email');
      expect(text(fixture, '[data-testid="email-sent"]')).not.toBeNull();
      expect(text(fixture, '[data-testid="resend-wait"]')).not.toBeNull();
      expect(text(fixture, '[data-testid="send-email-code"]')).toBeNull();

      vi.advanceTimersByTime(60_000);
      fixture.detectChanges();

      expect(component['resendIn']()).toBe(0);
      expect(text(fixture, '[data-testid="resend-email-code"]')).not.toBeNull();
    });

    it('asks to send the code when none was sent yet, then counts down to the next one', () => {
      vi.useFakeTimers();
      sendTwoFactorEmailCode.mockReturnValue(of({ data: { expires_in: 600, resend_available_in: 30 } }));
      const { component, fixture } = create({ methods: ['totp', 'email'] });
      component['selectMethod']('email');
      fixture.detectChanges();
      expect(text(fixture, '[data-testid="send-email-code"]')).not.toBeNull();

      component['sendEmailCode']();
      fixture.detectChanges();

      expect(sendTwoFactorEmailCode).toHaveBeenCalledWith('tok');
      expect(component['emailDispatched']()).toBe(true);
      expect(component['resendIn']()).toBe(30);

      // A second request during the countdown is ignored.
      component['sendEmailCode']();
      expect(sendTwoFactorEmailCode).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(30_000);
      expect(component['resendIn']()).toBe(0);
    });

    it('answers with the emailed code', () => {
      twoFactorChallenge.mockReturnValue(of({ data: {} }));
      const { component } = create({ methods: ['email'], emailCodeSent: true });
      component['form'].controls.code.setValue('654321');

      component['submit']();

      expect(twoFactorChallenge).toHaveBeenCalledWith({ challenge_token: 'tok', email_code: '654321' });
    });

    it('shows the wait advertised by Retry-After when the code is asked too soon', () => {
      vi.useFakeTimers();
      sendTwoFactorEmailCode.mockReturnValue(fail(429, null, { 'Retry-After': '42' }));
      const { component } = create({ methods: ['totp', 'email'] });
      component['selectMethod']('email');

      component['sendEmailCode']();

      expect(component['resendIn']()).toBe(42);
      expect(component['errorMessage']()).not.toBeNull();
    });

    it('reads the Retry-After header as a number of seconds', () => {
      expect(retryAfterSeconds(new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': '15' }) }))).toBe(15);
      expect(retryAfterSeconds(new HttpErrorResponse({ status: 429 }))).toBeNull();
      expect(retryAfterSeconds(new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': 'soon' }) }))).toBeNull();
    });
  });

  describe('remember this device', () => {
    it('is offered only when the API allows it', () => {
      const { fixture } = create({ trustedDevicesEnabled: false });
      expect(text(fixture, '[data-testid="remember-device"]')).toBeNull();

      TestBed.resetTestingModule();
      const enabled = create({ trustedDevicesEnabled: true });
      expect(text(enabled.fixture, '[data-testid="remember-device"]')).not.toBeNull();
    });

    it('asks to remember the device with its name and keeps the returned token for the account', () => {
      const token = 'd'.repeat(64);
      twoFactorChallenge.mockReturnValue(
        of({ data: { user: { id: 'u1', name: 'Anna', email: 'Anna@Acme.example' }, trusted_device_token: token } }),
      );
      const { component, succeeded } = create({ trustedDevicesEnabled: true, email: 'anna@acme.example' });
      component['form'].patchValue({ code: '123456', remember: true, deviceName: ' Work laptop ' });

      component['submit']();

      expect(twoFactorChallenge).toHaveBeenCalledWith({
        challenge_token: 'tok',
        code: '123456',
        remember_device: true,
        device_name: 'Work laptop',
      });
      expect(getTrustedDeviceToken('anna@acme.example')).toBe(token);
      expect(succeeded).toHaveBeenCalledTimes(1);
    });

    it('does not ask to remember the device when the box is not ticked or the feature is off', () => {
      twoFactorChallenge.mockReturnValue(of({ data: {} }));
      const { component } = create({ trustedDevicesEnabled: true });
      component['form'].patchValue({ code: '123456', remember: false });
      component['submit']();
      expect(twoFactorChallenge.mock.calls[0][0]).not.toHaveProperty('remember_device');

      TestBed.resetTestingModule();
      twoFactorChallenge.mockClear();
      const off = create({ trustedDevicesEnabled: false });
      off.component['form'].patchValue({ code: '123456', remember: true });
      off.component['submit']();
      expect(twoFactorChallenge.mock.calls[0][0]).not.toHaveProperty('remember_device');
    });
  });

  describe('security key', () => {
    it('answers with the signed assertion of the security key', async () => {
      twoFactorWebauthnOptions.mockReturnValue(of({ data: { ceremony_id: 'cer-1', options: { challenge: 'abc' } } }));
      webauthnGet.mockResolvedValue({ id: 'cred' });
      twoFactorChallenge.mockReturnValue(of({ data: { tenant_id: 't-1' } }));
      const { component, succeeded } = create({ methods: ['webauthn', 'recovery_code'], defaultMethod: 'webauthn' });

      await component['useSecurityKey']();

      expect(twoFactorWebauthnOptions).toHaveBeenCalledWith('tok');
      expect(webauthnGet).toHaveBeenCalledWith({ challenge: 'abc' });
      expect(twoFactorChallenge).toHaveBeenCalledWith({
        challenge_token: 'tok',
        webauthn: { ceremony_id: 'cer-1', credential: { id: 'cred' } },
      });
      expect(succeeded).toHaveBeenCalledWith({ tenant_id: 't-1' });
      expect(component['isWaitingForKey']()).toBe(false);
    });

    it('reports a cancelled prompt and lets the user try again', async () => {
      twoFactorWebauthnOptions.mockReturnValue(of({ data: { ceremony_id: 'cer-1', options: {} } }));
      webauthnGet.mockRejectedValue(new PasskeyUnavailableError('cancelled'));
      const { component, succeeded } = create({ methods: ['webauthn'], defaultMethod: 'webauthn' });

      await component['useSecurityKey']();

      expect(component['errorMessage']()).not.toBeNull();
      expect(twoFactorChallenge).not.toHaveBeenCalled();
      expect(succeeded).not.toHaveBeenCalled();
      expect(component['isWaitingForKey']()).toBe(false);
    });

    it('reports a browser without security key support', async () => {
      webauthnSupported.mockReturnValue(false);
      const { component } = create({ methods: ['webauthn'], defaultMethod: 'webauthn' });

      await component['useSecurityKey']();

      expect(twoFactorWebauthnOptions).not.toHaveBeenCalled();
      expect(component['errorMessage']()).not.toBeNull();
    });

    it('reports a key the server refused', async () => {
      twoFactorWebauthnOptions.mockReturnValue(of({ data: { ceremony_id: 'cer-1', options: {} } }));
      webauthnGet.mockResolvedValue({ id: 'cred' });
      twoFactorChallenge.mockReturnValue(fail(401, { type: AUTH_PROBLEM.TwoFactorCodeInvalid }));
      const { component, restart } = create({ methods: ['webauthn'], defaultMethod: 'webauthn' });

      await component['useSecurityKey']();

      expect(component['errorMessage']()).not.toBeNull();
      expect(restart).not.toHaveBeenCalled();
    });
  });

  describe('errors', () => {
    function submitWith(status: number, error: unknown = null, headers?: Record<string, string>) {
      twoFactorChallenge.mockReturnValue(fail(status, error, headers));
      const created = create();
      created.component['form'].controls.code.setValue('000000');
      created.component['submit']();
      return created;
    }

    it('keeps the challenge open on a wrong code', () => {
      const { component, restart } = submitWith(401, { type: AUTH_PROBLEM.TwoFactorCodeInvalid });

      expect(component['errorMessage']()).not.toBeNull();
      expect(restart).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('returns to the password step when the challenge is gone', () => {
      const { restart } = submitWith(401, { type: AUTH_PROBLEM.TwoFactorChallengeInvalid });

      expect(restart).toHaveBeenCalledWith(expect.any(String));
      expect(restart.mock.calls[0][0]).not.toBe('');
    });

    it('returns to the password step when the account is locked', () => {
      const { restart } = submitWith(423);

      expect(restart).toHaveBeenCalledTimes(1);
    });

    it('returns to the password step when the attempts are throttled', () => {
      const { restart } = submitWith(429, null, { 'Retry-After': '30' });

      expect(restart).toHaveBeenCalledTimes(1);
    });

    it('shows a generic error for any other failure', () => {
      const { component, restart } = submitWith(500);

      expect(component['errorMessage']()).not.toBeNull();
      expect(restart).not.toHaveBeenCalled();
    });
  });

  it('goes back to the password step on request', () => {
    const { component, fixture, restart } = create();
    expect(component).toBeTruthy();

    (text(fixture, '[data-testid="back-to-login"]') as HTMLButtonElement).click();

    expect(restart).toHaveBeenCalledWith(null);
  });
});
