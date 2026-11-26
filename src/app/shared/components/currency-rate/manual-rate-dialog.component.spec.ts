import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CurrencyApiService } from '@core/api/currency-api.service';
import { I18nService } from '@core/i18n/i18n.service';
import { icons } from '../../../icons-provider';
import { ManualRateDialogComponent } from './manual-rate-dialog.component';

describe('ManualRateDialogComponent', () => {
  let api: { createRate: ReturnType<typeof vi.fn> };
  let message: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      createRate: vi.fn((payload: { rate: string }) =>
        of({ success: true, message: 'ok', data: { id: 'r-1', ...payload } }),
      ),
    };
    message = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: CurrencyApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: { translate: vi.fn((key: string) => key) } },
      ],
    });
  });

  function create() {
    const fixture = TestBed.createComponent(ManualRateDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function fillValid(component: ManualRateDialogComponent): void {
    component.form.patchValue({
      base: 'EUR',
      quote: 'CHF',
      rate: '0.941200',
      valid_on: '2026-11-20',
      rate_type: 'mid',
    });
  }

  describe('rate validator', () => {
    it.each(['0.941200', '1', '12.5', '0.000001', '1,5'])('accepts %s', (value) => {
      const { componentInstance: component } = create();
      component.form.controls.rate.setValue(value);
      expect(component.form.controls.rate.valid).toBe(true);
    });

    it.each(['0.9412345', 'abc', '-1', '1.2.3', '.5'])('refuses %s as a wrong format', (value) => {
      const { componentInstance: component } = create();
      component.form.controls.rate.setValue(value);
      expect(component.form.controls.rate.hasError('rateFormat')).toBe(true);
      expect(component.errorTip('rate')).toBe('FINANCE.CURRENCIES.ERROR.RATE_FORMAT');
    });

    it('refuses zero and an empty rate', () => {
      const { componentInstance: component } = create();
      component.form.controls.rate.setValue('0.000000');
      expect(component.form.controls.rate.hasError('ratePositive')).toBe(true);
      component.form.controls.rate.setValue('');
      expect(component.form.controls.rate.hasError('required')).toBe(true);
    });
  });

  describe('reason', () => {
    it('is required for a contract rate only', () => {
      const { componentInstance: component } = create();
      fillValid(component);
      expect(component.form.valid).toBe(true);

      component.form.controls.rate_type.setValue('contract');
      expect(component.form.controls.reason.hasError('required')).toBe(true);
      expect(component.form.valid).toBe(false);

      component.form.controls.reason.setValue('Annual supply contract');
      expect(component.form.valid).toBe(true);

      component.form.controls.reason.setValue('');
      component.form.controls.rate_type.setValue('mid');
      expect(component.form.controls.reason.valid).toBe(true);
    });

    it('does not send a contract rate without a reason', () => {
      const { componentInstance: component } = create();
      fillValid(component);
      component.form.controls.rate_type.setValue('contract');

      component.submit();

      expect(api.createRate).not.toHaveBeenCalled();
    });
  });

  describe('submit', () => {
    it('sends the rate as the decimal string that was typed and reports the saved rate', () => {
      const fixture = create();
      const component = fixture.componentInstance;
      const saved = vi.fn();
      component.saved.subscribe(saved);
      fillValid(component);
      component.form.controls.rate.setValue(' 0,941200 ');
      component.form.controls.rate_type.setValue('contract');
      component.form.controls.reason.setValue(' Supply contract ');
      component.form.controls.contract_reference.setValue('CTR-7');

      component.submit();

      const payload = api.createRate.mock.calls[0][0];
      expect(payload).toEqual({
        base: 'EUR',
        quote: 'CHF',
        rate: '0.941200',
        valid_on: '2026-11-20',
        rate_type: 'contract',
        reason: 'Supply contract',
        contract_reference: 'CTR-7',
      });
      expect(typeof payload.rate).toBe('string');
      expect(saved).toHaveBeenCalledTimes(1);
      expect(message.success).toHaveBeenCalledWith('FINANCE.CURRENCIES.MESSAGE.RATE_SAVED');
      expect(component.open()).toBe(false);
    });

    it('maps a 422 to the fields and keeps the dialog data', () => {
      api.createRate.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: {
                message: 'invalid',
                errors: { rate: ['Rate too far from the market'], contract_reference: ['Unknown'] },
              },
            }),
        ),
      );
      const { componentInstance: component } = create();
      fillValid(component);

      component.submit();

      expect(component.form.controls.rate.errors?.['serverError']).toBe(
        'Rate too far from the market',
      );
      expect(component.errorTip('rate')).toBe('Rate too far from the market');
      expect(component.form.controls.contract_reference.errors?.['serverError']).toBe('Unknown');
      expect(component.saving()).toBe(false);
      expect(message.success).not.toHaveBeenCalled();
    });
  });
});
