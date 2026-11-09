import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { icons } from '../../../../icons-provider';
import { CatalogApiService, ClientApiService, I18nService, InvoiceApiService } from '@core';
import { InvoiceFormDrawerComponent } from './invoice-form-drawer.component';

describe('InvoiceFormDrawerComponent', () => {
  let fixture: ComponentFixture<InvoiceFormDrawerComponent>;
  let component: InvoiceFormDrawerComponent;
  let invoiceApi: { create: ReturnType<typeof vi.fn> };
  let message: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    invoiceApi = { create: vi.fn().mockReturnValue(of({ data: { id: 'inv-1' } })) };
    message = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [InvoiceFormDrawerComponent],
      providers: [
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: InvoiceApiService, useValue: invoiceApi },
        { provide: ClientApiService, useValue: { list: vi.fn().mockReturnValue(of({ data: [] })) } },
        {
          provide: CatalogApiService,
          useValue: {
            getPaymentTerms: vi
              .fn()
              .mockReturnValue(of({ data: [{ id: 'pt-30', code: 'TP30', name: '30 days', days: 30 }] })),
          },
        },
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: { translate: vi.fn((key: string) => key) } },
      ],
    });

    fixture = TestBed.createComponent(InvoiceFormDrawerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  const fillValidForm = (): void => {
    component.form.patchValue({ contact_id: 'cl-1', currency: 'EUR', jurisdiction: 'IT' });
    component.form.controls.items.at(0).patchValue({ description: 'Consulting', unit_price: 100 });
  };

  it('never offers an editable invoice number and does not send one', () => {
    expect(component.form.contains('invoice_number')).toBe(false);
    expect(fixture.nativeElement.querySelector('#invoice_number')).toBeNull();

    fillValidForm();
    component.submit();
    expect(invoiceApi.create).toHaveBeenCalledTimes(1);
    expect(invoiceApi.create.mock.calls[0][0]).not.toHaveProperty('invoice_number');
  });

  it('sends the payment term chosen from the catalog', () => {
    expect(component['paymentTerms']().map((t) => t.id)).toEqual(['pt-30']);

    fillValidForm();
    component.form.patchValue({ payment_term_id: 'pt-30' });
    component.submit();
    expect(invoiceApi.create.mock.calls[0][0]).toMatchObject({ payment_term_id: 'pt-30', currency: 'EUR' });
  });

  it('sends null when no payment term is chosen', () => {
    fillValidForm();
    component.submit();
    expect(invoiceApi.create.mock.calls[0][0].payment_term_id).toBeNull();
  });

  it('explains a 422 on exchange_rate with the currency and the date', () => {
    invoiceApi.create.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'invalid', errors: { exchange_rate: ['No exchange rate for that date'] } },
          }),
      ),
    );
    fillValidForm();
    component.submit();
    expect(message.error).toHaveBeenCalledTimes(1);
    expect(message.error.mock.calls[0][0]).toBe('SALES.INVOICES.ERRORS.NO_EXCHANGE_RATE');
    expect(component.saving()).toBe(false);
  });
});
