import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore, GeneralLedgerFiscalApiService, PermissionsService } from '@core';
import { GlVatSettingsComponent } from './gl-vat-settings.component';

describe('GlVatSettingsComponent', () => {
  const api = { getVatSettings: vi.fn(), updateVatSettings: vi.fn() };
  const settings = {
    periodicity: 'quarterly',
    regime: 'net_tax_rate',
    mwst_basis: 'received',
    sss_rate_1: '6.20',
    sss_rate_2: '3.70',
    lipe_prorata_percent: '80.00',
    lipe_advance_amount: '150.00',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    api.getVatSettings.mockReturnValue(of({ data: settings }));
    api.updateVatSettings.mockReturnValue(of({ message: 'Saved', data: settings }));
  });

  function setup(jurisdiction: 'CH' | 'IT') {
    TestBed.configureTestingModule({
      imports: [GlVatSettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: GeneralLedgerFiscalApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn() } },
        { provide: AuthStore, useValue: { activeJurisdiction: () => jurisdiction } },
      ],
    });
    const fixture = TestBed.createComponent(GlVatSettingsComponent);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as { save(): void };
  }

  it('saves the Swiss method, basis and Saldosteuersatz rates', () => {
    setup('CH').save();
    expect(api.updateVatSettings).toHaveBeenCalledWith({
      periodicity: 'quarterly',
      regime: 'net_tax_rate',
      mwst_basis: 'received',
      sss_rate_1: '6.20',
      sss_rate_2: '3.70',
    });
  });

  it('saves the Italian LIPE periodicity, pro-rata and advance', () => {
    setup('IT').save();
    expect(api.updateVatSettings).toHaveBeenCalledWith({
      periodicity: 'quarterly',
      lipe_prorata_percent: '80.00',
      lipe_advance_amount: '150.00',
    });
  });
});
