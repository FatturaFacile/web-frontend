import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessApiService, AuthStore } from '@core';
import { TEST_PASSWORD } from '../../../../../testing/credentials';
import { AcceptInvitationComponent } from './accept-invitation.component';

const preview = (hasAccount: boolean) => ({
  success: true,
  message: '',
  data: { email: 'eva@example.test', tenant_name: 'Acme', role: 'member', has_account: hasAccount, expires_at: null },
});

describe('AcceptInvitationComponent', () => {
  const previewInvitation = vi.fn();
  const acceptInvitation = vi.fn();

  function create(token: string | null, signedIn = false) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AcceptInvitationComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AccessApiService, useValue: { previewInvitation, acceptInvitation } },
        { provide: AuthStore, useValue: { isAuthenticated: () => signedIn, activeLocale: () => 'en', setLocale: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AcceptInvitationComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      state(): string;
      form: { patchValue(v: object): void; invalid: boolean };
      onSubmit(): void;
      acceptWithSession(): void;
    };
    return { component, fixture, navigate };
  }

  beforeEach(() => {
    previewInvitation.mockReset();
    acceptInvitation.mockReset();
  });

  it('is invalid without a token and does not call the API', () => {
    const { component } = create(null);

    expect(previewInvitation).not.toHaveBeenCalled();
    expect(component.state()).toBe('invalid');
  });

  it('shows an invalid invitation when the API answers 404', () => {
    previewInvitation.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const { component, fixture } = create('abc');
    fixture.detectChanges();

    expect(previewInvitation).toHaveBeenCalledWith('abc');
    expect(component.state()).toBe('invalid');
    expect(fixture.nativeElement.querySelector('[data-test="invitation-invalid"]')).not.toBeNull();
  });

  it('previews the invitation and lets a new person choose name and password', () => {
    previewInvitation.mockReturnValue(of(preview(false)));
    acceptInvitation.mockReturnValue(of({ success: true, message: '', data: { email: 'eva@example.test', tenant_name: 'Acme' } }));
    const { component, fixture } = create('abc');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test="invitation-summary"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test="sign-in-first"]')).toBeNull();
    expect(component.form.invalid).toBe(true);

    component.form.patchValue({ name: 'Eva', password: TEST_PASSWORD, password_confirmation: TEST_PASSWORD });
    component.onSubmit();

    expect(acceptInvitation).toHaveBeenCalledWith('abc', { name: 'Eva', password: TEST_PASSWORD, password_confirmation: TEST_PASSWORD });
    expect(component.state()).toBe('accepted');
  });

  it('does not submit when the confirmation differs', () => {
    previewInvitation.mockReturnValue(of(preview(false)));
    const { component, fixture } = create('abc');
    fixture.detectChanges();

    component.form.patchValue({ name: 'Eva', password: TEST_PASSWORD, password_confirmation: `${TEST_PASSWORD}x` });
    component.onSubmit();

    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it('asks an existing account to sign in first', () => {
    previewInvitation.mockReturnValue(of(preview(true)));
    const { fixture } = create('abc', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test="sign-in-first"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test="accept-with-session"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('#password')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test="sign-in"]').getAttribute('href')).toContain('returnUrl=');
  });

  it('accepts with the session of the signed in account and sends no body', () => {
    previewInvitation.mockReturnValue(of(preview(true)));
    acceptInvitation.mockReturnValue(of({ success: true, message: '', data: { email: 'eva@example.test', tenant_name: 'Acme' } }));
    const { component, fixture } = create('abc', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-test="accept-with-session"]')).not.toBeNull();
    component.acceptWithSession();

    expect(acceptInvitation).toHaveBeenCalledWith('abc');
    expect(component.state()).toBe('accepted');
  });

  it('shows the reason of a 409 and stays on the invitation', () => {
    previewInvitation.mockReturnValue(of(preview(true)));
    acceptInvitation.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Plan limit reached for this company.' } })),
    );
    const { component, fixture } = create('abc', true);
    fixture.detectChanges();

    component.acceptWithSession();
    fixture.detectChanges();

    expect(component.state()).toBe('ready');
    expect(fixture.nativeElement.textContent).toContain('Plan limit reached for this company.');
  });
});
