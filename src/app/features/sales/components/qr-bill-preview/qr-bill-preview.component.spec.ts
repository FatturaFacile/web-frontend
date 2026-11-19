import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceApiService } from '@core/api/invoice-api.service';
import { SwissQrBillApiService } from '@core/api/swiss-qr-bill-api.service';
import { QrBillPreviewComponent } from './qr-bill-preview.component';
import { QR_BILL_LABELS, QR_BILL_LANGUAGES } from './qr-bill-labels';

const bill = {
  payload: 'SPC',
  png: 'data:image/png;base64,iVBORw0KGgo=',
  reference_type: 'QRR',
  reference: '210000000003139471430009017',
  formatted_reference: '21 00000 00003 13947 14300 09017',
  iban: 'CH4431999123000889012',
  formatted_iban: 'CH44 3199 9123 0008 8901 2',
  currency: 'CHF',
  amount: 1949.75,
  formatted_amount: '1 949.75',
  creditor_lines: ['FatturaFacile Switzerland AG', 'Bahnhofstrasse 1', '6900 Lugano'],
  debtor_lines: null,
  message: 'Invoice INV-2026-0001',
};

async function setup(generatePdf = vi.fn()) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [QrBillPreviewComponent],
    providers: [
      provideHttpClient(),
      provideRouter([]),
      { provide: InvoiceApiService, useValue: { getQrBill: vi.fn().mockReturnValue(of({ success: true, data: bill })) } },
      { provide: SwissQrBillApiService, useValue: { generatePdf } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(QrBillPreviewComponent);
  (fixture.componentRef as ComponentRef<QrBillPreviewComponent>).setInput('invoiceId', 'inv-1');
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('QrBillPreviewComponent', () => {
  it('renders the receipt and payment part with the SIX data and the English labels by default', async () => {
    const fixture = await setup();
    const slip: HTMLElement = fixture.nativeElement.querySelector('[data-testid="qr-slip"]');

    expect(slip.textContent).toContain('Receipt');
    expect(slip.textContent).toContain('Payment part');
    expect(slip.textContent).toContain('CH44 3199 9123 0008 8901 2');
    expect(fixture.nativeElement.querySelector('[data-testid="qr-reference"]').textContent).toContain('21 00000 00003 13947 14300 09017');
    expect(slip.querySelector('img')?.getAttribute('src')).toBe(bill.png);
  });

  it('switches the slip labels live between IT, DE, FR and EN', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance as unknown as { language: { set(v: string): void } };

    for (const language of QR_BILL_LANGUAGES) {
      component.language.set(language);
      fixture.detectChanges();
      const text = fixture.nativeElement.querySelector('[data-testid="qr-slip"]').textContent as string;
      expect(text).toContain(QR_BILL_LABELS[language].paymentPart);
      expect(text).toContain(QR_BILL_LABELS[language].acceptancePoint);
    }
  });

  it('hides the perforation line for NONE and shows scissors only for the scissors style', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance as unknown as { perforation: { set(v: string): void } };
    const query = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);

    expect(query('qr-scissors')).not.toBeNull();

    component.perforation.set('DASHED_LINE');
    fixture.detectChanges();
    expect(query('qr-perforation-line')).not.toBeNull();
    expect(query('qr-scissors')).toBeNull();

    component.perforation.set('NONE');
    fixture.detectChanges();
    expect(query('qr-perforation-line')).toBeNull();
  });

  it('downloads the PDF with the selected mode, perforation and language', async () => {
    const generatePdf = vi.fn().mockReturnValue(of(new Blob(['%PDF'])));
    const fixture = await setup(generatePdf);
    const component = fixture.componentInstance as unknown as {
      language: { set(v: string): void };
      mode: { set(v: string): void };
    };
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue();

    component.language.set('fr');
    component.mode.set('STANDALONE');
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="qr-download"]') as HTMLButtonElement).click();

    expect(generatePdf).toHaveBeenCalledWith({
      invoice_id: 'inv-1',
      mode: 'STANDALONE',
      perforation: 'DASHED_LINE_WITH_SCISSORS',
      language: 'fr',
    });
  });
});
