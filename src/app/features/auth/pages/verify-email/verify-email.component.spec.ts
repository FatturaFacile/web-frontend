import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { AUTH_PROBLEM, AuthApiService } from '@core';
import { VerifyEmailComponent } from './verify-email.component';

describe('VerifyEmailComponent', () => {
  const verifyEmail = vi.fn();

  function create(token: string | null) {
    TestBed.configureTestingModule({
      imports: [VerifyEmailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthApiService, useValue: { verifyEmail } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } },
        },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(VerifyEmailComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance, navigate };
  }

  function problem(status: number, type: string) {
    return throwError(() => new HttpErrorResponse({ status, error: { type } }));
  }

  beforeEach(() => verifyEmail.mockReset());

  it('consumes the token and removes it from the address bar', () => {
    verifyEmail.mockReturnValue(of({ success: true }));
    const { component, navigate } = create('abc.def');

    expect(verifyEmail).toHaveBeenCalledWith('abc.def');
    expect(component['state']()).toBe('verified');
    expect(navigate).toHaveBeenCalledWith([], { queryParams: {}, replaceUrl: true });
  });

  it('does not call the API without a token', () => {
    const { component } = create(null);
    expect(verifyEmail).not.toHaveBeenCalled();
    expect(component['state']()).toBe('invalid');
  });

  it('tells expired links from invalid ones', () => {
    verifyEmail.mockReturnValue(problem(410, AUTH_PROBLEM.VerificationTokenExpired));
    expect(create('abc.def').component['state']()).toBe('expired');
  });

  it('reports an already used link as invalid', () => {
    verifyEmail.mockReturnValue(problem(400, AUTH_PROBLEM.VerificationTokenInvalid));
    expect(create('abc.def').component['state']()).toBe('invalid');
  });

  it('does not claim the link is invalid when the server fails', () => {
    verifyEmail.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    expect(create('abc.def').component['state']()).toBe('failed');
  });
});
