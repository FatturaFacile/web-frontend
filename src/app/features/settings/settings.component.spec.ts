import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { I18nService, SettingsApiService, TranslateService } from '@core';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;

  const mockSettingsApi = {
    getTenantSettings: vi.fn().mockReturnValue(
      of({
        data: {
          id: 'tenant-1',
          name: 'Acme Corp',
          legal_name: 'Acme Corporation S.r.l.',
          fiscal_code: '12345678901',
          vat_number: 'IT12345678901',
          default_currency: 'EUR',
        },
      }),
    ),
    updateTenantSettings: vi.fn().mockReturnValue(of({ success: true, message: 'Settings saved' })),
    getBranches: vi.fn().mockReturnValue(
      of({
        data: [
          {
            id: 'br-1',
            name: 'Milano HQ',
            code: 'HQ',
            is_primary: true,
          },
        ],
        meta: { total: 1, current_page: 1, last_page: 1, per_page: 10 },
      }),
    ),
    getTenantUsers: vi.fn().mockReturnValue(
      of({
        data: [
          {
            id: 'u-1',
            name: 'Admin User',
            email: 'admin@acme.com',
            role: 'admin',
            is_active: true,
          },
        ],
      }),
    ),
    getSystemRoles: vi.fn().mockReturnValue(
      of({
        data: [
          {
            key: 'admin',
            name: 'Tenant Administrator',
            description: 'Admin role',
          },
        ],
      }),
    ),
    syncExchangeRates: vi.fn().mockReturnValue(of({ data: { synced_count: 5 } })),
  };

  const mockTranslate = {
    instant: vi.fn((k: string) => k),
    translate: vi.fn((k: string) => k),
  };

  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: SettingsApiService, useValue: mockSettingsApi },
        { provide: TranslateService, useValue: mockTranslate },
        { provide: I18nService, useValue: mockTranslate },
        { provide: NzMessageService, useValue: mockMessage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('creates the component and loads initial tenant data', async () => {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(component).toBeTruthy();
    expect(mockSettingsApi.getTenantSettings).toHaveBeenCalled();
    expect(mockSettingsApi.getBranches).toHaveBeenCalled();
    expect(mockSettingsApi.getTenantUsers).toHaveBeenCalled();
    expect(mockSettingsApi.getSystemRoles).toHaveBeenCalled();
  });

  it('submits valid tenant form and displays success notification', () => {
    fixture.detectChanges();
    component['tenantForm'].patchValue({ name: 'New Company Name' });
    component.saveTenantSettings();

    expect(mockSettingsApi.updateTenantSettings).toHaveBeenCalled();
    expect(mockMessage.success).toHaveBeenCalledWith('settings.messages.saved');
  });

  it('does not call the API while the name is empty or a field breaks an API rule', () => {
    fixture.detectChanges();
    mockSettingsApi.updateTenantSettings.mockClear();

    component['tenantForm'].patchValue({ name: '' });
    component.saveTenantSettings();
    component['tenantForm'].patchValue({ name: 'Acme', sdi_code: 'ABC', pec_email: 'not-an-email' });
    component.saveTenantSettings();

    expect(mockSettingsApi.updateTenantSettings).not.toHaveBeenCalled();
  });

  it('handles update failure gracefully with error notification', () => {
    mockSettingsApi.updateTenantSettings.mockReturnValueOnce(
      throwError(() => ({ message: 'Failed to update' })),
    );
    fixture.detectChanges();
    component.saveTenantSettings();

    expect(mockMessage.error).toHaveBeenCalled();
  });

  it('triggers currency exchange sync and informs user', () => {
    fixture.detectChanges();
    component.syncExchangeRates();

    expect(mockSettingsApi.syncExchangeRates).toHaveBeenCalled();
    expect(mockMessage.success).toHaveBeenCalled();
  });

  describe('bank configuration (iban / qr_iban)', () => {
    it('starts with empty IBAN fields, never a sample account', () => {
      const form = component['tenantForm'];
      expect(form.controls.iban.value).toBe('');
      expect(form.controls.qr_iban.value).toBe('');
    });

    it('fills the bank fields from the tenant settings returned by the API', () => {
      mockSettingsApi.getTenantSettings.mockReturnValueOnce(
        of({ data: { id: 't', name: 'Acme', iban: 'IT00TEST', qr_iban: 'CH00TEST' } }),
      );
      fixture.detectChanges();
      expect(component['tenantForm'].controls.iban.value).toBe('IT00TEST');
      expect(component['tenantForm'].controls.qr_iban.value).toBe('CH00TEST');
    });

    it('sends both IBANs to the API on save', () => {
      fixture.detectChanges();
      mockSettingsApi.updateTenantSettings.mockClear();
      component['tenantForm'].patchValue({ name: 'Acme', iban: 'IT00TEST', qr_iban: 'CH00TEST' });
      component.saveTenantSettings();
      expect(mockSettingsApi.updateTenantSettings).toHaveBeenCalledWith(expect.objectContaining({ iban: 'IT00TEST', qr_iban: 'CH00TEST' }));
    });

    it('rejects an IBAN longer than 34 characters', () => {
      fixture.detectChanges();
      mockSettingsApi.updateTenantSettings.mockClear();
      component['tenantForm'].patchValue({ name: 'Acme', iban: 'X'.repeat(35) });
      expect(component['tenantForm'].controls.iban.hasError('maxlength')).toBe(true);
      component.saveTenantSettings();
      expect(mockSettingsApi.updateTenantSettings).not.toHaveBeenCalled();
    });
  });
});
