import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { AuthApiService } from '@core';
import { ForgotPasswordComponent } from './forgot-password.component';

const EMAIL = 'giuliabianchitest@example.com';

describe('ForgotPasswordComponent', () => {
  const forgotPassword = vi.fn();
  const resendResetPasswordEmail = vi.fn();

  function create() {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    forgotPassword.mockReset();
    resendResetPasswordEmail.mockReset();
    TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthApiService, useValue: { forgotPassword, resendResetPasswordEmail } },
      ],
    });
  });

  it('does not call the API with an invalid address', () => {
    const component = create();
    component['form'].setValue({ email: 'not-an-email' });
    component['onSubmit']();
    expect(forgotPassword).not.toHaveBeenCalled();
  });

  it('shows the generic confirmation, then resends through the dedicated endpoint', () => {
    forgotPassword.mockReturnValue(of({ success: true }));
    resendResetPasswordEmail.mockReturnValue(of({ success: true }));
    const component = create();
    component['form'].setValue({ email: EMAIL });

    component['onSubmit']();
    expect(forgotPassword).toHaveBeenCalledWith(EMAIL);
    expect(component['requested']()).toBe(true);

    component['onSubmit']();
    expect(resendResetPasswordEmail).toHaveBeenCalledWith(EMAIL);
    expect(forgotPassword).toHaveBeenCalledTimes(1);
  });

  it('tells the user when the limit is reached', () => {
    forgotPassword.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));
    const component = create();
    component['form'].setValue({ email: EMAIL });

    component['onSubmit']();

    expect(component['errorKey']()).toBe('AUTH.TOO_MANY_ATTEMPTS');
    expect(component['requested']()).toBe(false);
  });
});
