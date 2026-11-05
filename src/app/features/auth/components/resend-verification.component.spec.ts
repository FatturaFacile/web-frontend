import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { AuthApiService } from '@core';
import { ResendVerificationComponent } from './resend-verification.component';

describe('ResendVerificationComponent', () => {
  const resendVerificationEmail = vi.fn();

  function create(email = '') {
    const fixture = TestBed.createComponent(ResendVerificationComponent);
    fixture.componentRef.setInput('email', email);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    resendVerificationEmail.mockReset();
    TestBed.configureTestingModule({
      imports: [ResendVerificationComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthApiService, useValue: { resendVerificationEmail } },
      ],
    });
  });

  it('starts from the known address and sends it', () => {
    resendVerificationEmail.mockReturnValue(of({ success: true }));
    const component = create('giulia@example.com');

    component['resend']();

    expect(resendVerificationEmail).toHaveBeenCalledWith('giulia@example.com');
    expect(component['state']()).toBe('sent');
  });

  it('does nothing without an address', () => {
    const component = create();
    component['resend']();
    expect(resendVerificationEmail).not.toHaveBeenCalled();
  });

  it('distinguishes throttling from other failures', () => {
    const component = create('giulia@example.com');

    resendVerificationEmail.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));
    component['resend']();
    expect(component['state']()).toBe('throttled');

    resendVerificationEmail.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    component['resend']();
    expect(component['state']()).toBe('failed');
  });
});
