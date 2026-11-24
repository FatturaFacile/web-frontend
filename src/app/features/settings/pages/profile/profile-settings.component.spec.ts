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
  const logout = vi.fn();
  const newPassword = `${TEST_PASSWORD}N`;

  function create(twoFactorEnabled = false) {
    getTwoFactorStatus.mockReturnValue(of({ success: true, data: { enabled: twoFactorEnabled } }));
    TestBed.configureTestingModule({
      imports: [ProfileSettingsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthApiService, useValue: { getTwoFactorStatus, changePassword } },
        { provide: AuthStore, useValue: { logout } },
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
});
