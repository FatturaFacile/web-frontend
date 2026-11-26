import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { AUTH_PROBLEM, AuthApiService, AuthStore } from '@core';
import { ProfileSettingsComponent } from './profile-settings.component';
import { TEST_PASSWORD } from '../../../../../testing/credentials';

describe('ProfileSettingsComponent', () => {
  const getTwoFactorStatus = vi.fn();
  const changePassword = vi.fn();
  const sendEmailVerificationCode = vi.fn();
  const getPasswordPolicyRules = vi.fn();
  const checkPassword = vi.fn();
  const logout = vi.fn();
  const newPassword = `${TEST_PASSWORD}N`;

  function create(twoFactorEnabled = false, status: Record<string, unknown> = {}) {
    getTwoFactorStatus.mockReturnValue(of({ success: true, data: { enabled: twoFactorEnabled, ...status } }));
    getPasswordPolicyRules.mockReturnValue(of({ success: true, message: '', data: { rules: ['min_length'], min_length: 12, history_count: 0 } }));
    TestBed.configureTestingModule({
      imports: [ProfileSettingsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthApiService,
          useValue: { getTwoFactorStatus, changePassword, sendEmailVerificationCode, getPasswordPolicyRules, checkPassword },
        },
        { provide: AuthStore, useValue: { logout, user: () => ({ id: 'u1', email: 'anna@acme.example' }), activeTenantId: () => 'tenant-1' } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ProfileSettingsComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance, fixture, navigate };
  }

  function fill(component: ProfileSettingsComponent, extra: Record<string, string> = {}) {
    component['form'].setValue({
      current_password: TEST_PASSWORD,
      password: newPassword,
      password_confirmation: newPassword,
      code: '',
      recovery_code: '',
      email_code: '',
      ...extra,
    });
  }

  function validationError(errors: Record<string, string[]>) {
    return throwError(
      () => new HttpErrorResponse({ status: 422, error: { message: 'The given data was invalid.', errors } }),
    );
  }

  beforeEach(() => {
    getTwoFactorStatus.mockReset();
    changePassword.mockReset();
    logout.mockReset();
    sendEmailVerificationCode.mockReset();
    checkPassword.mockReset();
  });

  it('does not submit an incomplete form or a confirmation that differs', () => {
    const { component } = create();

    component['onSubmit']();
    fill(component, { password_confirmation: `${newPassword}x` });
    component['onSubmit']();

    expect(changePassword).not.toHaveBeenCalled();
    expect(component['form'].controls.password_confirmation.hasError('mismatch')).toBe(true);
  });

  it('sends only the passwords without two factors, then signs out and shows the confirmation page', () => {
    changePassword.mockReturnValue(of({ success: true }));
    const { component, navigate } = create();
    fill(component);

    component['onSubmit']();

    expect(changePassword).toHaveBeenCalledWith({
      current_password: TEST_PASSWORD,
      password: newPassword,
      password_confirmation: newPassword,
    });
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/password-updated'], { replaceUrl: true });
  });

  it('asks the app code with two factors, or a recovery code instead', () => {
    changePassword.mockReturnValue(of({ success: true }));
    const { component, fixture } = create(true);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('#code')).not.toBeNull();
    fill(component);
    component['onSubmit']();
    expect(changePassword).not.toHaveBeenCalled();

    component['form'].controls.code.setValue(' 123456 ');
    component['onSubmit']();
    expect(changePassword).toHaveBeenLastCalledWith(expect.objectContaining({ code: '123456' }));

    component['toggleRecoveryCode']();
    fixture.detectChanges();
    expect(root.querySelector('#code')).toBeNull();
    expect(root.querySelector('#recovery_code')).not.toBeNull();

    component['form'].controls.recovery_code.setValue('abcde-fghjk');
    component['onSubmit']();
    const payload = changePassword.mock.calls.at(-1)?.[0];
    expect(payload.recovery_code).toBe('abcde-fghjk');
    expect(payload).not.toHaveProperty('code');
  });

  it('puts the errors of the server on their fields and stays signed in', () => {
    changePassword.mockReturnValue(validationError({ current_password: ['La password attuale non è corretta.'] }));
    const { component } = create();
    fill(component);

    component['onSubmit']();

    expect(component['form'].controls.current_password.getError('serverError')).toBe(
      'La password attuale non è corretta.',
    );
    expect(logout).not.toHaveBeenCalled();
  });

  it('shows the code field when the server asks a second factor the status did not report', () => {
    changePassword.mockReturnValue(validationError({ code: ['Inserisci il codice.'] }));
    const { component } = create(false);
    fill(component);

    component['onSubmit']();

    expect(component['twoFactorEnabled']()).toBe(true);
    expect(component['form'].controls.code.getError('serverError')).toBe('Inserisci il codice.');
  });

  it('tells the user that the change is locked after too many attempts', () => {
    changePassword.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 429, error: { type: AUTH_PROBLEM.PasswordChangeLocked } })),
    );
    const { component } = create();
    fill(component);

    component['onSubmit']();

    expect(component['isLocked']()).toBe(true);
    expect(logout).not.toHaveBeenCalled();
  });

  it('shows and hides each password field on its own', () => {
    const { fixture } = create();
    const root: HTMLElement = fixture.nativeElement;
    const typeOf = (id: string) => root.querySelector<HTMLInputElement>(`#${id}`)?.type;
    const toggles = root.querySelectorAll<HTMLButtonElement>('button.toggle');

    expect(toggles).toHaveLength(3);
    toggles[1].click();
    fixture.detectChanges();

    expect(typeOf('current_password')).toBe('password');
    expect(typeOf('password')).toBe('text');
    expect(typeOf('password_confirmation')).toBe('password');
    expect(toggles[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('asks the emailed code when the email code is the only factor, and sends it', () => {
    changePassword.mockReturnValue(of({ success: true }));
    sendEmailVerificationCode.mockReturnValue(of({ success: true, data: { expires_in: 600, resend_available_in: 60 } }));
    const { component, fixture } = create(true, { email_enabled: true, totp_enabled: false });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('#email_code')).not.toBeNull();
    expect(root.querySelector('#code')).toBeNull();

    component['sendEmailCode']();
    expect(sendEmailVerificationCode).toHaveBeenCalledTimes(1);
    expect(component['emailCodeSent']()).toBe(true);

    fill(component);
    component['onSubmit']();
    expect(changePassword).not.toHaveBeenCalled();

    component['form'].controls.email_code.setValue(' 654321 ');
    component['onSubmit']();
    const payload = changePassword.mock.calls.at(-1)?.[0];
    expect(payload.email_code).toBe('654321');
    expect(payload).not.toHaveProperty('code');
    expect(payload).not.toHaveProperty('recovery_code');
  });

  it('lets the user switch between the authenticator and the emailed code when both are on', () => {
    const { component, fixture } = create(true, { email_enabled: true, totp_enabled: true });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('#code')).not.toBeNull();
    expect(root.querySelector('[data-testid="toggle-email-code"]')).not.toBeNull();

    component['toggleEmailCode']();
    fixture.detectChanges();
    expect(root.querySelector('#email_code')).not.toBeNull();
    expect(root.querySelector('#code')).toBeNull();

    component['toggleEmailCode']();
    fixture.detectChanges();
    expect(root.querySelector('#code')).not.toBeNull();
  });

  it('shows the live strength of the new password', () => {
    const { fixture } = create();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('app-password-strength')).not.toBeNull();
    expect(getPasswordPolicyRules).toHaveBeenCalledWith('tenant-1');
  });
});
