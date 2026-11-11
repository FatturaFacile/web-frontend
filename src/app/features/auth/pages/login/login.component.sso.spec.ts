import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { SsoLoginService } from '@core';
import { LoginComponent } from './login.component';

describe('LoginComponent single sign-on', () => {
  const signInWithEmail = vi.fn();

  function create() {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SsoLoginService, useValue: { signInWithEmail } },
      ],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance, fixture };
  }

  beforeEach(() => signInWithEmail.mockReset());

  it('shows the SSO button next to the password form', () => {
    const { fixture } = create();

    expect((fixture.nativeElement as HTMLElement).querySelector('.sso-section button')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('#password')).not.toBeNull();
  });

  it('does not look anything up without a valid email', () => {
    const { component } = create();
    component['loginForm'].controls.email.setValue('not-an-email');

    component['onSsoSubmit']();

    expect(signInWithEmail).not.toHaveBeenCalled();
  });

  it('discovers the SSO of the typed email and leaves for the identity provider', () => {
    signInWithEmail.mockReturnValue(of(true));
    const { component } = create();
    component['loginForm'].controls.email.setValue('anna@acme.example');

    component['onSsoSubmit']();

    expect(signInWithEmail).toHaveBeenCalledWith('anna@acme.example', null);
    expect(component['errorMessage']()).toBeNull();
  });

  it('says so when the address has no SSO and keeps the password form', () => {
    signInWithEmail.mockReturnValue(of(false));
    const { component } = create();
    component['loginForm'].controls.email.setValue('anna@acme.example');

    component['onSsoSubmit']();

    expect(component['errorMessage']()).toBeTruthy();
    expect(component['isSsoStarting']()).toBe(false);
    expect(component['isChallengeStep']()).toBe(false);
  });

  it('tells a failure to start from an address without SSO', () => {
    const { component } = create();
    component['loginForm'].controls.email.setValue('anna@acme.example');

    signInWithEmail.mockReturnValue(of(false));
    component['onSsoSubmit']();
    const unavailable = component['errorMessage']();

    signInWithEmail.mockReturnValue(throwError(() => new Error('boom')));
    component['onSsoSubmit']();

    expect(component['errorMessage']()).not.toBe(unavailable);
    expect(component['isSsoStarting']()).toBe(false);
  });
});
