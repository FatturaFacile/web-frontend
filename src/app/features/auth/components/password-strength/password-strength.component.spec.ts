import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiService, PasswordCheckResult, PasswordPolicyRules } from '@core';
import { TEST_PASSWORD } from '../../../../../testing/credentials';
import { icons } from '../../../../icons-provider';
import { PASSWORD_CHECK_DEBOUNCE_MS, PasswordStrengthComponent } from './password-strength.component';

const policy: PasswordPolicyRules = {
  min_length: 12,
  require_mixed_case: true,
  require_numbers: true,
  require_symbols: false,
  check_breached: true,
  history_count: 3,
  max_age_days: null,
  rules: ['min_length', 'mixed_case', 'numbers', 'breached'],
};

const result: PasswordCheckResult = {
  rules: [
    { code: 'min_length', passed: true, message: '' },
    { code: 'mixed_case', passed: true, message: '' },
    { code: 'numbers', passed: false, message: '' },
    { code: 'breached', passed: true, message: '' },
  ],
  acceptable: false,
  strength: 3,
};

describe('PasswordStrengthComponent', () => {
  const checkPassword = vi.fn();
  const getPasswordPolicyRules = vi.fn();

  function create(password = '') {
    TestBed.configureTestingModule({
      providers: [provideNzIcons(icons), { provide: AuthApiService, useValue: { checkPassword, getPasswordPolicyRules } }],
    });
    const fixture = TestBed.createComponent(PasswordStrengthComponent);
    fixture.componentRef.setInput('password', password);
    const checked = vi.fn();
    fixture.componentInstance.checked.subscribe(checked);
    fixture.detectChanges();
    const type = (value: string, email?: string) => {
      fixture.componentRef.setInput('password', value);
      if (email !== undefined) {
        fixture.componentRef.setInput('email', email);
      }
      fixture.detectChanges();
      vi.advanceTimersByTime(PASSWORD_CHECK_DEBOUNCE_MS);
      fixture.detectChanges();
    };
    return { fixture, component: fixture.componentInstance, checked, type, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    checkPassword.mockReset();
    getPasswordPolicyRules.mockReset();
    getPasswordPolicyRules.mockReturnValue(of({ success: true, message: '', data: policy }));
    checkPassword.mockReturnValue(of({ success: true, message: '', data: result }));
  });

  afterEach(() => vi.useRealTimers());

  it('lists the rules of the policy before anything is typed, without calling the check', () => {
    const { el } = create();

    expect(getPasswordPolicyRules).toHaveBeenCalledTimes(1);
    expect(el.querySelectorAll('[data-rule]').length).toBe(4);
    expect(checkPassword).not.toHaveBeenCalled();
  });

  it('waits for a pause in typing and checks only the last value', () => {
    const { type, fixture } = create();

    fixture.componentRef.setInput('password', 'a');
    fixture.detectChanges();
    vi.advanceTimersByTime(PASSWORD_CHECK_DEBOUNCE_MS - 50);
    fixture.componentRef.setInput('password', 'ab');
    fixture.detectChanges();
    vi.advanceTimersByTime(PASSWORD_CHECK_DEBOUNCE_MS - 50);
    expect(checkPassword).not.toHaveBeenCalled();

    type(`${TEST_PASSWORD}x`);

    expect(checkPassword).toHaveBeenCalledTimes(1);
    expect(checkPassword).toHaveBeenCalledWith({ password: `${TEST_PASSWORD}x`, email: null, tenant_id: null });
  });

  it('sends the account and the tenant to the check', () => {
    const { type, fixture } = create();
    fixture.componentRef.setInput('tenantId', 'tenant-1');

    type(TEST_PASSWORD, 'anna@acme.example');

    expect(checkPassword).toHaveBeenCalledWith({ password: TEST_PASSWORD, email: 'anna@acme.example', tenant_id: 'tenant-1' });
  });

  it('shows the strength and which rules passed or failed', () => {
    const { type, el, checked } = create();

    type(TEST_PASSWORD);

    expect(el.querySelector('[data-testid="strength-label"]')).not.toBeNull();
    expect(el.querySelector('[data-rule="min_length"]')?.classList.contains('passed')).toBe(true);
    expect(el.querySelector('[data-rule="numbers"]')?.classList.contains('failed')).toBe(true);
    expect(checked).toHaveBeenLastCalledWith(result);
  });

  it('clears the result when the password is emptied', () => {
    const { type, el, checked, component } = create();
    type(TEST_PASSWORD);

    type('');

    expect(el.querySelector('[data-testid="strength-label"]')).toBeNull();
    expect(component['strength']()).toBe(0);
    expect(checked).toHaveBeenLastCalledWith(null);
    expect(checkPassword).toHaveBeenCalledTimes(1);
  });

  it('falls back to a local estimate when the check is unavailable', () => {
    checkPassword.mockReturnValue(throwError(() => new Error('throttled')));
    const { type, component, checked } = create();

    type('Abcdef1!xyz');

    expect(component['offline']()).toBe(true);
    expect(component['strength']()).toBeGreaterThan(0);
    expect(checked).toHaveBeenLastCalledWith(null);
  });

  it('keeps only the answer of the latest keystroke', () => {
    const first = new Subject<{ data: PasswordCheckResult }>();
    checkPassword.mockReturnValueOnce(first).mockReturnValueOnce(of({ success: true, message: '', data: { ...result, strength: 4 } }));
    const { type, component } = create();

    type('first-password');
    type('second-password');
    first.next({ data: { ...result, strength: 1 } });

    expect(component['strength']()).toBe(4);
  });

  it('uses the default rules when the policy cannot be loaded', () => {
    getPasswordPolicyRules.mockReturnValue(throwError(() => new Error('offline')));
    const { el } = create();

    expect(el.querySelectorAll('[data-rule]').length).toBe(4);
  });
});
