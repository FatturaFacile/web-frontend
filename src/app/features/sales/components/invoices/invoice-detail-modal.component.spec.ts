import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore, CatalogApiService, InvoiceApiService, InvoiceDetailResource } from '@core';
import { icons } from '../../../../icons-provider';
import { InvoiceDetailModalComponent } from './invoice-detail-modal.component';

const invoice = {
  id: 'inv1',
  invoice_number: 'F-1',
  currency: 'CHF',
  total: '100.00',
  payment_term_id: null,
} as unknown as InvoiceDetailResource;
const mail = {
  id: 'm1',
  recipient: 'cliente@example.test',
  subject: 'Fattura',
  message: null,
  status: 'sent',
  error: null,
  sent_at: '2026-03-01T10:00:00Z',
  attachment_name: 'F-1.pdf',
};

describe('InvoiceDetailModalComponent', () => {
  const invoiceApi = { getDocumentEmails: vi.fn() };

  function setup(open: boolean) {
    const fixture = TestBed.createComponent(InvoiceDetailModalComponent);
    fixture.componentRef.setInput('invoice', invoice);
    fixture.componentRef.setInput('open', open);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: InvoiceApiService, useValue: invoiceApi },
        { provide: CatalogApiService, useValue: { getPaymentTerms: () => of({ data: [] }) } },
        { provide: AuthStore, useValue: { activeCurrency: () => 'CHF' } },
      ],
    });
  });

  it('does not read the e-mail history while the modal is closed', () => {
    setup(false);
    expect(invoiceApi.getDocumentEmails).not.toHaveBeenCalled();
  });

  it('reads the e-mails sent for the invoice when it opens and shows the recipient', async () => {
    invoiceApi.getDocumentEmails.mockReturnValue(of({ success: true, message: '', data: [mail] }));
    const fixture = setup(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(invoiceApi.getDocumentEmails).toHaveBeenCalledWith('invoice', 'inv1');
    expect(document.body.textContent).toContain('cliente@example.test');
  });

  it('keeps the modal usable when the history cannot be read', async () => {
    invoiceApi.getDocumentEmails.mockReturnValue(throwError(() => new Error('boom')));
    const fixture = setup(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.body.textContent).toContain('F-1');
  });
});
