import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@env';
import { I18nService } from '@core';
import { FiscalSettingsComponent } from './fiscal-settings.component';

describe('FiscalSettingsComponent', () => {
  const base = environment.apiBaseUrl;
  let fixture: ComponentFixture<FiscalSettingsComponent>;
  let component: FiscalSettingsComponent;
  let http: HttpTestingController;
  const message = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    message.success.mockReset();
    message.error.mockReset();
    TestBed.configureTestingModule({
      imports: [FiscalSettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: { translate: (k: string) => k } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FiscalSettingsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => http.verify());

  function load(fiscal: unknown) {
    fixture.detectChanges();
    http
      .expectOne(`${base}/settings/preferences`)
      .flush({ success: true, message: '', data: { fiscal } });
    fixture.detectChanges();
  }

  it('loads the saved fiscal group into the form', () => {
    load({
      regime_fiscale: 'RF01',
      default_fund: {
        type: 'TC22',
        percent: '4.00',
        vat_rate: 22,
        natura: null,
        withholding_applies: false,
      },
      default_withholding: {
        type: 'RT01',
        reason: 'A',
        rate: 20,
        taxable_percent: 100,
        includes_fund: true,
      },
      stamp_duty_charge_mode: 'issuer',
      enasarco_enabled: true,
    });
    const v = component.form.getRawValue();
    expect(v.default_fund_enabled).toBe(true);
    expect(v.default_fund.percent).toBe(4);
    expect(v.default_withholding.includes_fund).toBe(true);
    expect(v.stamp_duty_charge_mode).toBe('issuer');
    expect(v.enasarco_enabled).toBe(true);
  });

  it('keeps the defaults when the group is still empty (`[]`)', () => {
    load([]);
    expect(component.payload()).toEqual({
      regime_fiscale: 'RF01',
      default_fund: null,
      default_withholding: null,
      stamp_duty_charge_mode: 'customer',
      enasarco_enabled: false,
    });
  });

  it('locks and clears the default ritenuta for a forfettario tenant', () => {
    load({ regime_fiscale: 'RF01', default_withholding: { type: 'RT01', reason: 'A', rate: 20 } });
    component.form.controls.regime_fiscale.setValue('RF19');
    fixture.detectChanges();

    expect(component.form.controls.default_withholding_enabled.disabled).toBe(true);
    expect(component.payload().default_withholding).toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="forfettario-note"]'),
    ).not.toBeNull();
  });

  it('does not let defaults overwrite settings that could not be loaded', () => {
    fixture.detectChanges();
    http
      .expectOne(`${base}/settings/preferences`)
      .flush({ message: 'down' }, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();
    component.save();

    http.expectNone(`${base}/settings/preferences/fiscal`);
    const submit = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    expect(submit?.disabled).toBe(true);
  });

  it('saves the fiscal group and binds server errors to the fields', () => {
    load([]);
    component.form.patchValue({ default_fund_enabled: true });
    component.form.controls.default_fund.patchValue({ type: 'TC22', percent: 4 });
    component.save();

    const req = http.expectOne(`${base}/settings/preferences/fiscal`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({
      regime_fiscale: 'RF01',
      default_fund: { type: 'TC22', percent: 4 },
      default_withholding: null,
    });
    req.flush(
      { message: 'Invalid', errors: { 'default_fund.percent': ['Too high'] } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    expect(component.form.get('default_fund.percent')?.errors).toEqual({ serverError: 'Too high' });
    expect(component.errorTip('default_fund.percent')).toBe('Too high');
  });
});
