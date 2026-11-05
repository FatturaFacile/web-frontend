import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { AuthApiService } from '@core';
import { passwordStrength, RegisterComponent } from './register.component';

const VALID = {
  first_name: 'Giulia',
  last_name: 'Bianchi',
  email: 'giulia@example.com',
  company_name: 'Bianchi Srl',
  country: 'IT' as const,
  tax_id: '12345678901',
  password: 'Str0ng!Passw0rd',
  password_confirmation: 'Str0ng!Passw0rd',
  terms_accepted: true,
  privacy_accepted: true,
};

describe('RegisterComponent', () => {
  const register = vi.fn();

  function create() {
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    register.mockReset();
    TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthApiService, useValue: { register } },
      ],
    });
  });

  it('does not call the API while the form is invalid', () => {
    const component = create();
    component['onSubmit']();
    expect(register).not.toHaveBeenCalled();
    expect(component['form'].controls.email.touched).toBe(true);
  });

  it('requires both the terms and the privacy policy', () => {
    const component = create();
    component['form'].setValue({ ...VALID, privacy_accepted: false });
    component['onSubmit']();
    expect(register).not.toHaveBeenCalled();
  });

  it('rejects different passwords', () => {
    const component = create();
    component['form'].setValue({ ...VALID, password_confirmation: 'Different!Passw0rd' });
    expect(component['form'].controls.password_confirmation.hasError('mismatch')).toBe(true);
    component['onSubmit']();
    expect(register).not.toHaveBeenCalled();
  });

  it('accepts matching passwords after a mismatch', () => {
    const component = create();
    component['form'].setValue({ ...VALID, password_confirmation: 'Different!Passw0rd' });
    component['form'].controls.password_confirmation.setValue(VALID.password);
    expect(component['form'].valid).toBe(true);
  });

  it('sends the form and passes the address through the navigation state, not the URL', () => {
    register.mockReturnValue(of({ success: true }));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const component = create();
    component['form'].setValue(VALID);

    component['onSubmit']();

    expect(register).toHaveBeenCalledWith(VALID);
    expect(navigate).toHaveBeenCalledWith(['/register/check-email'], {
      state: { email: VALID.email },
    });
  });

  it('binds the validation errors of the server to the fields', () => {
    register.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'Invalid', errors: { tax_id: ['Not a valid VAT number'] } },
          }),
      ),
    );
    const component = create();
    component['form'].setValue(VALID);

    component['onSubmit']();

    expect(component['form'].controls.tax_id.getError('serverError')).toBe(
      'Not a valid VAT number',
    );
    expect(component['isSubmitting']()).toBe(false);
  });

  it('shows a message when the requests are throttled', () => {
    register.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));
    const component = create();
    component['form'].setValue(VALID);

    component['onSubmit']();

    expect(component['errorMessage']()).toBeTruthy();
  });

  it('rates the password', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc')).toBe(1);
    expect(passwordStrength('Abcdefghij')).toBe(2);
    expect(passwordStrength('Abcdefghi1')).toBe(3);
    expect(passwordStrength('Str0ng!Passw0rd')).toBe(4);
  });
});
