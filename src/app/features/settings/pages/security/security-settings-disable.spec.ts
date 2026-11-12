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

  function create() {
    disableTwoFactor.mockClear();
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
});
