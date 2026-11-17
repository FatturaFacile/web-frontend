import { TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nService } from '@core';
import { createFiscalControls } from './invoice-fiscal.form';
import { InvoiceFiscalSectionComponent } from './invoice-fiscal-section.component';

describe('InvoiceFiscalSectionComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InvoiceFiscalSectionComponent],
      providers: [{ provide: I18nService, useValue: { translate: (k: string) => k } }],
    });
  });

  function render(forfettario = false) {
    const fb = TestBed.inject(NonNullableFormBuilder);
    const form = fb.group(createFiscalControls(fb));
    const fixture = TestBed.createComponent(InvoiceFiscalSectionComponent);
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('forfettario', forfettario);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { form, fixture, el };
  }

  it('shows a backend split payment error next to its toggle', () => {
    const { form, fixture, el } = render();
    form.controls.split_payment.setErrors({ serverError: 'Split payment requires VAT' });
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="split-payment-error"]')?.textContent).toContain(
      'Split payment requires VAT',
    );
  });

  it('shows the ENASARCO rate error as a hint on the ENASARCO toggle', () => {
    const { form, fixture, el } = render();
    form.controls.enasarco.setErrors({ serverError: 'No ENASARCO rate for 2027' });
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="enasarco-error"]')?.textContent).toContain('2027');
  });

  it('explains the forfettario locks and renders locked toggles as disabled', async () => {
    const { form, fixture, el } = render(true);
    form.controls.withholding_enabled.disable();
    form.controls.split_payment.disable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="forfettario-lock"]')).not.toBeNull();
    const split = el.querySelector<HTMLInputElement>('#split_payment input[type="checkbox"]');
    expect(split?.disabled).toBe(true);
  });

  it('reveals the cassa fields only when cassa is enabled', () => {
    const { form, fixture, el } = render();
    expect(el.querySelector('#fund_percent')).toBeNull();
    form.controls.fund_enabled.setValue(true);
    fixture.detectChanges();
    expect(el.querySelector('#fund_percent')).not.toBeNull();
  });
});
