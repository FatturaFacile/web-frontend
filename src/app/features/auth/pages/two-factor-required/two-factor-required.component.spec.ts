import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiService, AuthStore } from '@core';
import { icons } from '../../../../icons-provider';
import { TwoFactorRequiredComponent } from './two-factor-required.component';

describe('TwoFactorRequiredComponent', () => {
  const logout = vi.fn();
  let required = true;
  let returnUrl: string | null = null;
  const storeState = {
    twoFactorSetupRequired: () => required,
    setTwoFactorSetupRequired: vi.fn((value: boolean) => {
      required = value;
    }),
    logout: vi.fn(),
    user: () => ({ id: 'u1', name: 'Anna', email: 'anna@acme.example' }),
  };

  function create() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: AuthStore, useValue: storeState },
        { provide: AuthApiService, useValue: { logout } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => returnUrl } } } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(TwoFactorRequiredComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, navigate, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    required = true;
    returnUrl = null;
  });

  it('offers the authenticator app and the email code', () => {
    const { el, navigate } = create();

    expect(el.querySelector('[data-testid="enroll-totp"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="enroll-email"]')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the enrolment of the chosen factor', () => {
    const { el, component } = create();

    (el.querySelector('[data-testid="enroll-email"]') as HTMLButtonElement).click();
    expect(component['showEmail']()).toBe(true);

    (el.querySelector('[data-testid="enroll-totp"]') as HTMLButtonElement).click();
    expect(component['showTotp']()).toBe(true);
  });

  it('lifts the block and goes where the user was heading once a factor is enrolled', () => {
    returnUrl = '/sales/invoices';
    const { component, navigate } = create();

    component['onEnrolled']();

    expect(storeState.setTwoFactorSetupRequired).toHaveBeenCalledWith(false);
    expect(navigate).toHaveBeenCalledWith('/sales/invoices');
  });

  it('never returns to the enrolment page or to another site', () => {
    returnUrl = '//evil.example';
    const first = create();
    first.component['onEnrolled']();
    expect(first.navigate).toHaveBeenCalledWith('/dashboard');

    TestBed.resetTestingModule();
    returnUrl = '/two-factor-setup?x=1';
    const second = create();
    second.component['onEnrolled']();
    expect(second.navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('leaves at once when there is nothing to enrol', () => {
    required = false;

    const { navigate } = create();

    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('lets the user sign out, even when the server cannot be reached', () => {
    logout.mockReturnValueOnce(of({ success: true, message: '', data: null }));
    const first = create();
    first.component['signOut']();
    expect(storeState.logout).toHaveBeenCalledTimes(1);
    expect(first.navigate).toHaveBeenCalledWith('/login');

    TestBed.resetTestingModule();
    logout.mockReturnValueOnce(throwError(() => new Error('offline')));
    const second = create();
    second.component['signOut']();
    expect(storeState.logout).toHaveBeenCalledTimes(2);
  });
});
