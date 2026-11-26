import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiService, AuthStore, TwoFactorStatus } from '@core';
import { TEST_PASSWORD } from '../../../../../testing/credentials';
import { icons } from '../../../../icons-provider';
import { EmailOtpCardComponent } from './email-otp-card.component';

const status = (emailEnabled: boolean): TwoFactorStatus => ({
  enabled: emailEnabled,
  email_enabled: emailEnabled,
  totp_enabled: false,
  pending_setup: false,
  confirmed_at: null,
  remaining_recovery_codes: 0,
  required_by_tenant: false,
});

describe('EmailOtpCardComponent', () => {
  const api = { disableEmailTwoFactor: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };

  function create(current: TwoFactorStatus) {
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: AuthApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: AuthStore, useValue: { user: () => ({ id: 'u1', name: 'Anna', email: 'anna@acme.example' }) } },
      ],
    });
    const fixture = TestBed.createComponent(EmailOtpCardComponent);
    fixture.componentRef.setInput('status', current);
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, changed, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => vi.clearAllMocks());

  it('offers to turn the factor on when it is off and opens the enrolment', () => {
    const { el, component } = create(status(false));

    expect(el.querySelector('[data-testid="email-otp-disable"]')).toBeNull();
    (el.querySelector('[data-testid="email-otp-enable"]') as HTMLButtonElement).click();

    expect(component['showSetup']()).toBe(true);
  });

  it('offers to turn the factor off when it is on', () => {
    const { el } = create(status(true));

    expect(el.querySelector('[data-testid="email-otp-enable"]')).toBeNull();
    expect(el.querySelector('[data-testid="email-otp-disable"]')).not.toBeNull();
  });

  it('turns the factor off with the password and tells the page', () => {
    api.disableEmailTwoFactor.mockReturnValue(of({ success: true, message: '', data: { methods: ['totp'] } }));
    const { component, changed } = create(status(true));
    component['openDisable']();
    component['passwordForm'].setValue({ currentPassword: TEST_PASSWORD });

    component['confirmDisable']();

    expect(api.disableEmailTwoFactor).toHaveBeenCalledWith({ current_password: TEST_PASSWORD });
    expect(component['showDisable']()).toBe(false);
    expect(message.success).toHaveBeenCalled();
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('does not call the API without the password', () => {
    const { component } = create(status(true));
    component['openDisable']();

    component['confirmDisable']();

    expect(api.disableEmailTwoFactor).not.toHaveBeenCalled();
  });

  it('explains that the last factor required by the company cannot be turned off', () => {
    api.disableEmailTwoFactor.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, error: { code: 'mfa_cannot_be_disabled' } })),
    );
    const { component, fixture, changed } = create(status(true));
    component['openDisable']();
    component['passwordForm'].setValue({ currentPassword: TEST_PASSWORD });

    component['confirmDisable']();
    fixture.detectChanges();

    expect(component['lastFactor']()).toBe(true);
    expect(component['showDisable']()).toBe(false);
    expect(changed).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="email-last-factor"]')).not.toBeNull();
  });

  it('keeps the dialog open with the reason when the password is wrong', () => {
    api.disableEmailTwoFactor.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'Wrong password' } })));
    const { component } = create(status(true));
    component['openDisable']();
    component['passwordForm'].setValue({ currentPassword: TEST_PASSWORD });

    component['confirmDisable']();

    expect(component['showDisable']()).toBe(true);
    expect(component['disableError']()).toBe('Wrong password');
  });
});
