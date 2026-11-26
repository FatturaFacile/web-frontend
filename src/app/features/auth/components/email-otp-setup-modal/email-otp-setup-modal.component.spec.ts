import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiService, AuthStore, I18nService } from '@core';
import { TEST_PASSWORD } from '../../../../../testing/credentials';
import { icons } from '../../../../icons-provider';
import { EmailOtpSetupModalComponent } from './email-otp-setup-modal.component';

describe('EmailOtpSetupModalComponent', () => {
  const api = { enableEmailTwoFactor: vi.fn(), confirmEmailTwoFactor: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };

  function create() {
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: AuthApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: AuthStore, useValue: { user: () => ({ id: 'u1', name: 'Anna', email: 'anna@acme.example' }) } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
    const fixture = TestBed.createComponent(EmailOtpSetupModalComponent);
    fixture.componentRef.setInput('isVisible', true);
    const completed = vi.fn();
    fixture.componentInstance.completed.subscribe(completed);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, completed };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.enableEmailTwoFactor.mockReturnValue(of({ success: true, message: '', data: { expires_in: 600, resend_available_in: 60 } }));
  });

  afterEach(() => vi.useRealTimers());

  it('does not start without the password', () => {
    const { component } = create();

    component['start']();

    expect(api.enableEmailTwoFactor).not.toHaveBeenCalled();
    expect(component['step']()).toBe('password');
  });

  it('confirms the password, which emails the first code, and moves to the code step', () => {
    const { component } = create();
    component['passwordForm'].setValue({ currentPassword: TEST_PASSWORD });

    component['start']();

    expect(api.enableEmailTwoFactor).toHaveBeenCalledWith({ current_password: TEST_PASSWORD });
    expect(component['step']()).toBe('code');
    expect(component['resendIn']()).toBe(60);
  });

  it('shows the API reason when the password is refused and stays on the password step', () => {
    api.enableEmailTwoFactor.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'Wrong password' } })));
    const { component } = create();
    component['passwordForm'].setValue({ currentPassword: TEST_PASSWORD });

    component['start']();

    expect(component['errorMessage']()).toBe('Wrong password');
    expect(component['step']()).toBe('password');
  });

  it('finishes without recovery codes when the user already has another factor', () => {
    api.confirmEmailTwoFactor.mockReturnValue(of({ success: true, message: '', data: { recovery_codes: [], methods: ['totp', 'email'] } }));
    const { component, completed } = create();
    component['passwordForm'].setValue({ currentPassword: TEST_PASSWORD });
    component['start']();
    component['codeForm'].setValue({ code: ' 123456 ' });

    component['confirm']();

    expect(api.confirmEmailTwoFactor).toHaveBeenCalledWith({ code: '123456' });
    expect(message.success).toHaveBeenCalled();
    expect(completed).toHaveBeenCalledTimes(1);
    expect(component['isVisible']()).toBe(false);
    expect(component['step']()).toBe('password');
  });

  it('shows the recovery codes once when the email code is the first factor', () => {
    api.confirmEmailTwoFactor.mockReturnValue(
      of({ success: true, message: '', data: { recovery_codes: ['AAAA-1111', '-', 'BBBB-2222'], methods: ['email'] } }),
    );
    const { component, completed } = create();
    component['passwordForm'].setValue({ currentPassword: TEST_PASSWORD });
    component['start']();
    component['codeForm'].setValue({ code: '123456' });

    component['confirm']();

    expect(component['step']()).toBe('recovery');
    expect(component['recoveryCodes']()).toEqual(['AAAA-1111', 'BBBB-2222']);
    expect(completed).not.toHaveBeenCalled();

    component['finish']();
    expect(completed).toHaveBeenCalledTimes(1);
    expect(component['recoveryCodes']()).toEqual([]);
  });

  it('completes the enrolment even when the dialog is closed on the recovery codes', () => {
    const { component, completed } = create();
    component['step'].set('recovery');

    component['close']();

    expect(completed).toHaveBeenCalledTimes(1);
  });

  it('reports a wrong code and keeps the code step', () => {
    api.confirmEmailTwoFactor.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: {} })));
    const { component } = create();
    component['passwordForm'].setValue({ currentPassword: TEST_PASSWORD });
    component['start']();
    component['codeForm'].setValue({ code: '000000' });

    component['confirm']();

    expect(component['errorMessage']()).toBe('auth.mfa.error.invalid_code');
    expect(component['step']()).toBe('code');
  });

  it('resends the code only after the countdown and honours Retry-After', () => {
    vi.useFakeTimers();
    const { component } = create();
    component['passwordForm'].setValue({ currentPassword: TEST_PASSWORD });
    component['start']();

    component['resend']();
    expect(api.enableEmailTwoFactor).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    expect(component['resendIn']()).toBe(0);

    api.enableEmailTwoFactor.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': '25' }) })),
    );
    component['resend']();
    expect(api.enableEmailTwoFactor).toHaveBeenCalledTimes(2);
    expect(component['resendIn']()).toBe(25);
    expect(component['errorMessage']()).toBe('auth.mfa.error.too_many_codes');
  });
});
