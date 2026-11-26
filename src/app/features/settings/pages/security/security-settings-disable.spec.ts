import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthApiService } from '@core';
import { TEST_PASSWORD } from '../../../../../testing/credentials';
import { SecuritySettingsComponent } from './security-settings.component';

describe('SecuritySettingsComponent disable form', () => {
  const disableTwoFactor = vi.fn(() => of({ success: true, data: { enabled: false } }));
  const sendSmsVerificationCode = vi.fn(() => of({ success: true, data: { expires_in: 600, resend_available_in: 60 } }));
  const sendEmailVerificationCode = vi.fn(() => of({ success: true, data: { expires_in: 600, resend_available_in: 60 } }));

  function create() {
    disableTwoFactor.mockClear();
    sendEmailVerificationCode.mockClear();
    TestBed.configureTestingModule({
      imports: [SecuritySettingsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthApiService,
          useValue: {
            disableTwoFactor,
            getTwoFactorStatus: () => of({ success: true, data: { enabled: true } }),
            getSessions: () => of({ success: true, data: [[], []] }),
            getTrustedDevices: () => of({ success: true, message: '', data: [], meta: { days: 30, enabled: true } }),
            sendEmailVerificationCode,
            sendSmsVerificationCode,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(SecuritySettingsComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('does not call the API while the password and both codes are empty', () => {
    const component = create();

    component.confirmDisable();

    expect(disableTwoFactor).not.toHaveBeenCalled();
  });

  it('requires one of the two codes, like required_without on the API', () => {
    const component = create();
    const form = component['disableForm'];

    form.patchValue({ currentPassword: TEST_PASSWORD });
    component.confirmDisable();
    expect(disableTwoFactor).not.toHaveBeenCalled();
    expect(component['isSecondFactorRequired']('code')).toBe(true);

    form.patchValue({ recoveryCode: 'abcd-efgh' });
    expect(form.controls.code.valid).toBe(true);
    expect(component['isSecondFactorRequired']('recoveryCode')).toBe(false);
    component.confirmDisable();
    expect(disableTwoFactor).toHaveBeenCalledTimes(1);
  });

  it('accepts the emailed code as the proof, like required_without_all on the API', () => {
    const component = create();
    const form = component['disableForm'];

    form.patchValue({ currentPassword: TEST_PASSWORD });
    expect(component['isSecondFactorRequired']('code', 'recoveryCode')).toBe(true);

    form.patchValue({ emailCode: '654321' });
    expect(form.controls.code.valid).toBe(true);
    expect(form.controls.recoveryCode.valid).toBe(true);
    expect(component['isSecondFactorRequired']('code', 'recoveryCode')).toBe(false);
    component.confirmDisable();

    expect(disableTwoFactor).toHaveBeenCalledWith({
      current_password: TEST_PASSWORD,
      code: undefined,
      recovery_code: undefined,
      email_code: '654321',
    });
  });

  it('emails a proof code and remembers that it was sent', () => {
    const component = create();

    component.sendEmailProofCode();

    expect(sendEmailVerificationCode).toHaveBeenCalledTimes(1);
    expect(component['emailCodeSent']()).toBe(true);
  });

  it('describes a session by its browser and system', () => {
    const component = create();

    expect(
      component['deviceLabel']({
        kind: 'session',
        id: '1',
        name: null,
        ip_address: '203.0.113.7',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        last_used_at: '2026-11-20T10:00:00Z',
        expires_at: '2026-12-20T10:00:00Z',
        current: false,
      }),
    ).toBe('Chrome / Windows');
  });

  it('accepts the SMS code as the proof and sends it', () => {
    const component = create();
    const form = component['disableForm'];

    form.patchValue({ currentPassword: TEST_PASSWORD });
    expect(component['isSecondFactorRequired']('code', 'recoveryCode', 'emailCode')).toBe(true);

    form.patchValue({ smsCode: '445566' });
    expect(form.controls.code.valid).toBe(true);
    expect(form.controls.emailCode.valid).toBe(true);
    component.confirmDisable();

    expect(disableTwoFactor).toHaveBeenCalledWith(expect.objectContaining({ current_password: TEST_PASSWORD, sms_code: '445566' }));
  });

  it('sends a proof code by SMS and remembers that it was sent', () => {
    const component = create();

    component.sendSmsProofCode();

    expect(sendSmsVerificationCode).toHaveBeenCalledTimes(1);
    expect(component['smsCodeSent']()).toBe(true);
  });
});
