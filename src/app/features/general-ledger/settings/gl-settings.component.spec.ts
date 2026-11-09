import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeneralLedgerApiService, LedgerSettings, PermissionsService } from '@core';
import { GlSettingsComponent } from './gl-settings.component';

const settings: LedgerSettings = {
  posting_accounts: {
    fx_realised_gain: { account_id: 'a-gain', account_code: '790', account_name: 'FX gain', source: 'configured' },
    fx_realised_loss: { account_id: null, account_code: null, account_name: null, source: null },
  },
  manual_journal_approval_required: true,
  manual_journal_approval_threshold: '500.00',
};

describe('GlSettingsComponent', () => {
  const api = {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    getAccountList: vi.fn(),
    getCostCenters: vi.fn(),
    getProfitCenters: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    api.getSettings.mockReturnValue(of({ success: true, message: '', data: settings }));
    api.updateSettings.mockReturnValue(of({ success: true, message: 'Saved', data: settings }));
    api.getAccountList.mockReturnValue(of({ data: [] }));
    api.getCostCenters.mockReturnValue(of({ data: [] }));
    api.getProfitCenters.mockReturnValue(of({ data: [] }));
    await TestBed.configureTestingModule({
      imports: [GlSettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: GeneralLedgerApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('fills the form from the settings and saves the realised FX accounts and the four-eyes policy', () => {
    const fixture = TestBed.createComponent(GlSettingsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as { save(): void; form: { getRawValue(): { posting_accounts: Record<string, string | null> } } };

    const raw = component.form.getRawValue();
    expect(raw.posting_accounts['fx_realised_gain']).toBe('a-gain');
    expect(raw.posting_accounts['fx_realised_loss']).toBeNull();

    component.save();
    const payload = api.updateSettings.mock.calls[0][0];
    expect(payload.posting_accounts.fx_realised_gain).toBe('a-gain');
    expect(payload.manual_journal_approval_required).toBe(true);
    expect(payload.manual_journal_approval_threshold).toBe(500);
  });

  it('sends no threshold when the approval is switched off', () => {
    const fixture = TestBed.createComponent(GlSettingsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      save(): void;
      form: { patchValue(value: object): void };
    };
    component.form.patchValue({ manual_journal_approval_required: false });
    component.save();
    expect(api.updateSettings.mock.calls[0][0].manual_journal_approval_threshold).toBeNull();
  });
});
