import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { CameraOutline, InboxOutline } from '@ant-design/icons-angular/icons';
import { SwissQrBillApiService } from '@core/api/swiss-qr-bill-api.service';
import { ParsedQrBill } from '@core/models/swiss-qr-bill.model';
import { SupplierQrUploadComponent } from './supplier-qr-upload.component';

const parsed: ParsedQrBill = {
  payload: 'SPC',
  version: '0200',
  iban: 'CH4431999123000889012',
  is_qr_iban: true,
  creditor: { address_type: 'S', name: 'Robert Schneider AG', street: null, house_number: null, postal_code: '2501', city: 'Biel', country: 'CH' },
  amount: 1949.75,
  currency: 'CHF',
  debtor: null,
  reference_type: 'QRR',
  reference: '210000000003139471430009017',
  message: null,
  billing_information: {},
  valid: true,
  errors: [],
  draft: {
    supplier_name: 'Robert Schneider AG',
    supplier_iban: 'CH4431999123000889012',
    invoice_number: null,
    invoice_date: null,
    vat_number: null,
    total_amount: 1949.75,
    currency: 'CHF',
    payment_reference: '210000000003139471430009017',
    payment_reference_type: 'QRR',
    notes: null,
  },
};

async function setup(parseFile: ReturnType<typeof vi.fn>) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [SupplierQrUploadComponent],
    providers: [
      provideHttpClient(),
      provideRouter([]),
      provideNzIcons([InboxOutline, CameraOutline]),
      { provide: SwissQrBillApiService, useValue: { parseFile } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(SupplierQrUploadComponent);
  fixture.detectChanges();
  return fixture;
}

describe('SupplierQrUploadComponent', () => {
  it('sends a dropped PDF to the parser and emits the decoded draft', async () => {
    const parseFile = vi.fn().mockReturnValue(of({ success: true, data: parsed }));
    const fixture = await setup(parseFile);
    const emitted: ParsedQrBill[] = [];
    fixture.componentInstance.parsed.subscribe((value) => emitted.push(value));

    fixture.componentInstance.handle(new File(['%PDF'], 'bill.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();

    expect(parseFile).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual([parsed]);
    expect(fixture.nativeElement.querySelector('[data-testid="qr-result"]')).not.toBeNull();
  });

  it('accepts images from the camera', async () => {
    const parseFile = vi.fn().mockReturnValue(of({ success: true, data: parsed }));
    const fixture = await setup(parseFile);

    fixture.componentInstance.handle(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }));

    expect(parseFile).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported file types without calling the API', async () => {
    const parseFile = vi.fn();
    const fixture = await setup(parseFile);

    fixture.componentInstance.handle(new File(['x'], 'bill.docx', { type: 'application/msword' }));
    fixture.detectChanges();

    expect(parseFile).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="qr-error"]')).not.toBeNull();
  });

  it('shows an error when the API cannot read a QR code', async () => {
    const parseFile = vi.fn().mockReturnValue(throwError(() => ({ status: 422 })));
    const fixture = await setup(parseFile);
    const emitted: ParsedQrBill[] = [];
    fixture.componentInstance.parsed.subscribe((value) => emitted.push(value));

    fixture.componentInstance.handle(new File(['%PDF'], 'bill.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();

    expect(emitted).toEqual([]);
    expect(fixture.nativeElement.querySelector('[data-testid="qr-error"]')).not.toBeNull();
  });
});
