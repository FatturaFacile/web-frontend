import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { AUTH_PROBLEM, AuthApiService } from '@core';
import { ResetPasswordComponent } from './reset-password.component';
import { TEST_PASSWORD } from '../../../../../testing/credentials';

describe('ResetPasswordComponent', () => {
  const validateResetToken = vi.fn();
  const resetPassword = vi.fn();

  function create(token: string | null) {
    TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthApiService, useValue: { validateResetToken, resetPassword } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } },
        },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance, fixture, navigate };
  }

  function problem(status: number, type: string) {
    return throwError(() => new HttpErrorResponse({ status, error: { type } }));
  }

  beforeEach(() => {
    validateResetToken.mockReset();
    resetPassword.mockReset();
  });

  it('checks the token without consuming it and removes it from the address bar', () => {
    validateResetToken.mockReturnValue(of({ success: true }));
    const { component, navigate } = create('abc.def');

    expect(validateResetToken).toHaveBeenCalledWith('abc.def');
    expect(resetPassword).not.toHaveBeenCalled();
    expect(component['state']()).toBe('ready');
    expect(navigate).toHaveBeenCalledWith([], { queryParams: {}, replaceUrl: true });
  });

  it('does not call the API without a token', () => {
    const { component } = create(null);
    expect(validateResetToken).not.toHaveBeenCalled();
    expect(component['state']()).toBe('invalid');
  });

  it.each([
    [410, AUTH_PROBLEM.PasswordResetTokenExpired, 'expired'],
    [400, AUTH_PROBLEM.PasswordResetTokenInvalid, 'invalid'],
    [429, AUTH_PROBLEM.PasswordResetLocked, 'locked'],
    [429, 'about:blank', 'locked'],
    [500, 'about:blank', 'failed'],
  ])('maps a %i %s to the %s state', (status, type, expected) => {
    validateResetToken.mockReturnValue(problem(status, type));
    const { component } = create('abc.def');
    expect(component['state']()).toBe(expected);
  });

  it('shows and hides each password field on its own', () => {
    validateResetToken.mockReturnValue(of({ success: true }));
    const { fixture } = create('abc.def');
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const typeOf = (id: string) => root.querySelector<HTMLInputElement>(`#${id}`)?.type;
    const toggles = root.querySelectorAll<HTMLButtonElement>('button.toggle');

    expect(toggles).toHaveLength(2);
    expect(typeOf('password')).toBe('password');
    expect(typeOf('password_confirmation')).toBe('password');

    toggles[0].click();
    fixture.detectChanges();
    expect(typeOf('password')).toBe('text');
    expect(typeOf('password_confirmation')).toBe('password');
    expect(toggles[0].getAttribute('aria-pressed')).toBe('true');

    toggles[1].click();
    toggles[0].click();
    fixture.detectChanges();
    expect(typeOf('password')).toBe('password');
    expect(typeOf('password_confirmation')).toBe('text');
  });

  it('does not submit passwords that do not match', () => {
    validateResetToken.mockReturnValue(of({ success: true }));
    const { component } = create('abc.def');
    component['form'].setValue({ password: TEST_PASSWORD, password_confirmation: `${TEST_PASSWORD}x` });

    component['onSubmit']();

    expect(resetPassword).not.toHaveBeenCalled();
    expect(component['form'].controls.password_confirmation.hasError('mismatch')).toBe(true);
  });

  it('sends the token with the new password and opens the confirmation page', () => {
    validateResetToken.mockReturnValue(of({ success: true }));
    resetPassword.mockReturnValue(of({ success: true }));
    const { component, navigate } = create('abc.def');
    component['form'].setValue({ password: TEST_PASSWORD, password_confirmation: TEST_PASSWORD });

    component['onSubmit']();

    expect(resetPassword).toHaveBeenCalledWith({
      token: 'abc.def',
      password: TEST_PASSWORD,
      password_confirmation: TEST_PASSWORD,
    });
    expect(navigate).toHaveBeenCalledWith(['/password-updated'], { replaceUrl: true });
  });

  it('shows the password errors of the server and keeps the form open', () => {
    validateResetToken.mockReturnValue(of({ success: true }));
    resetPassword.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { errors: { password: ['Troppo debole'] } },
          }),
      ),
    );
    const { component } = create('abc.def');
    component['form'].setValue({ password: TEST_PASSWORD, password_confirmation: TEST_PASSWORD });

    component['onSubmit']();

    expect(component['state']()).toBe('ready');
    expect(component['form'].controls.password.getError('serverError')).toBe('Troppo debole');
  });

  it('leaves the form when the token stops working while it is open', () => {
    validateResetToken.mockReturnValue(of({ success: true }));
    resetPassword.mockReturnValue(problem(410, AUTH_PROBLEM.PasswordResetTokenExpired));
    const { component } = create('abc.def');
    component['form'].setValue({ password: TEST_PASSWORD, password_confirmation: TEST_PASSWORD });

    component['onSubmit']();

    expect(component['state']()).toBe('expired');
  });
});
