import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
            city: 'Milano',
            country: 'IT',
            is_headquarters: true,
          },
        ],
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
    getAuditLogs: vi.fn().mockReturnValue(
      of({
        data: [
          {
            id: 'log-1',
            created_at: '2026-11-08T10:00:00Z',
            user_name: 'Admin User',
            event: 'login',
            auditable_type: 'auth',
            ip_address: '127.0.0.1',
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
        { provide: SettingsApiService, useValue: mockSettingsApi },
        { provide: TranslateService, useValue: mockTranslate },
        { provide: I18nService, useValue: mockTranslate },
        { provide: NzMessageService, useValue: mockMessage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
  });

  it('creates the component and loads initial tenant data', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(mockSettingsApi.getTenantSettings).toHaveBeenCalled();
    expect(mockSettingsApi.getBranches).toHaveBeenCalled();
    expect(mockSettingsApi.getTenantUsers).toHaveBeenCalled();
    expect(mockSettingsApi.getSystemRoles).toHaveBeenCalled();
    expect(mockSettingsApi.getAuditLogs).toHaveBeenCalled();
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
});
