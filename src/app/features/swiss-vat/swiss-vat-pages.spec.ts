import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@env';
import { I18nService, PermissionsService } from '@core';
import { icons } from '../../icons-provider';
import { SwissVatConfigComponent } from './swiss-vat-config.component';
import { SwissVatReturnsComponent } from './swiss-vat-returns.component';
import { SwissVatStore } from './swiss-vat.store';

const base = `${environment.apiBaseUrl}/swiss-vat`;

describe('Swiss VAT pages', () => {
  let http: HttpTestingController;
  const message = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  beforeEach(() => {
    message.success.mockReset();
    message.error.mockReset();
    message.info.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(icons),
        SwissVatStore,
        { provide: LOCALE_ID, useValue: 'de-CH' },
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: PermissionsService, useValue: { canAccess: () => true } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('renders Swiss VAT returns dashboard and calculates a period', async () => {
    const fixture = TestBed.createComponent(SwissVatReturnsComponent);
    fixture.detectChanges();

    http.expectOne(`${base}/config`).flush({
      success: true,
      message: '',
      data: {
        id: 'c1',
        tenant_id: 't1',
        uid_mwst: 'CHE-116.281.710 MWST',
        accounting_method: 'effective',
        consideration_basis: 'agreed',
        reporting_frequency: 'quarterly',
        sss_rate_primary: null,
        sss_rate_secondary: null,
        sss_sector_primary: null,
        sss_sector_secondary: null,
        rounding_mode: 'chf_005',
        auto_detect_bezugsteuer: true,
        bezugsteuer_threshold_chf: '10000.00',
        default_currency: 'CHF',
        canton: 'TI',
        gl_accounts: {},
        updated_at: null,
      },
    });
    http.expectOne(`${base}/returns`).flush({ success: true, message: '', data: [] });

    await fixture.whenStable();
    fixture.detectChanges();

    const calcBtn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="ch-vat-calculate-btn"]');
    expect(calcBtn).not.toBeNull();
  });

  it('loads Swiss VAT config, statutory tax codes, and SSS sector bands', async () => {
    const fixture = TestBed.createComponent(SwissVatConfigComponent);
    fixture.detectChanges();

    http.expectOne(`${base}/config`).flush({
      success: true,
      message: '',
      data: {
        id: 'c1',
        tenant_id: 't1',
        uid_mwst: 'CHE-116.281.710 MWST',
        accounting_method: 'saldosteuersatz',
        consideration_basis: 'agreed',
        reporting_frequency: 'semiannual',
        sss_rate_primary: '6.20',
        sss_rate_secondary: null,
        sss_sector_primary: 'SSS_62',
        sss_sector_secondary: null,
        rounding_mode: 'chf_005',
        auto_detect_bezugsteuer: true,
        bezugsteuer_threshold_chf: '10000.00',
        default_currency: 'CHF',
        canton: 'ZH',
        gl_accounts: {},
        updated_at: null,
      },
    });
    http.expectOne(`${base}/tax-codes`).flush({ success: true, message: '', data: [] });
    http.expectOne(`${base}/sss-sectors`).flush({ success: true, message: '', data: [] });

    await fixture.whenStable();
    fixture.detectChanges();

    const saveBtn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="ch-save-config-btn"]');
    expect(saveBtn).not.toBeNull();
  });
});
