import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { SsoLoginService } from '@core';
import { LoginComponent } from './login.component';

const TENANT = '0b5d3d7e-8f0e-4c53-9a63-6f1d3f6c2a11';

describe('LoginComponent single sign-on', () => {
  const start = vi.fn();

  function create() {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SsoLoginService, useValue: { start } },
      ],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance, fixture };
  }

  beforeEach(() => start.mockReset());

  it('shows the SSO button and reveals the tenant form on click', () => {
    const { component, fixture } = create();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.sso-section button')).not.toBeNull();
    expect(host.querySelector('#sso-tenant')).toBeNull();

    component['ssoOpen'].set(true);
    fixture.detectChanges();

    expect(host.querySelector('#sso-tenant')).not.toBeNull();
  });

  it('does not start without a valid tenant UUID', () => {
    const { component } = create();
    component['ssoForm'].patchValue({ tenantId: 'not-a-uuid' });

    component['onSsoSubmit']();

    expect(start).not.toHaveBeenCalled();
  });

  it('starts the chosen protocol for the tenant', () => {
    start.mockReturnValue(of(undefined));
    const { component } = create();
    component['ssoForm'].setValue({ tenantId: ` ${TENANT} `, protocol: 'saml' });

    component['onSsoSubmit']();

    expect(start).toHaveBeenCalledWith('saml', TENANT, null);
  });

  it('tells a tenant without SSO from a failure to start', () => {
    const { component } = create();
    component['ssoForm'].setValue({ tenantId: TENANT, protocol: 'oidc' });

    start.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    component['onSsoSubmit']();
    const unavailable = component['errorMessage']();

    start.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    component['onSsoSubmit']();

    expect(unavailable).toBeTruthy();
    expect(component['errorMessage']()).not.toBe(unavailable);
    expect(component['isSsoStarting']()).toBe(false);
  });
});
