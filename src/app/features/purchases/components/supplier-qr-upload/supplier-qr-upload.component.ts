import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { SwissQrBillApiService } from '@core/api/swiss-qr-bill-api.service';
import { ParsedQrBill } from '@core/models/swiss-qr-bill.model';
import { MoneyPipe, TranslatePipe } from '@shared';

export const QR_BILL_ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
export const QR_BILL_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Drag-and-drop (or camera) upload of a supplier QR-bill, as PDF or image. The API decodes the QR code and the
 * parsed draft (creditor, IBAN, amount, reference, Swico invoice data) is emitted to pre-fill a supplier invoice.
 */
@Component({
  selector: 'app-supplier-qr-upload',
  imports: [NzAlertModule, NzButtonModule, NzDescriptionsModule, NzIconModule, NzSpinModule, NzUploadModule, MoneyPipe, TranslatePipe],
  templateUrl: './supplier-qr-upload.component.html',
  styleUrl: './supplier-qr-upload.component.scss',
})
export class SupplierQrUploadComponent {
  private readonly api = inject(SwissQrBillApiService);
  private readonly destroyRef = inject(DestroyRef);

  /** Emits the decoded QR-bill whenever a file was read successfully. */
  readonly parsed = output<ParsedQrBill>();

  protected readonly parsing = signal(false);
  protected readonly result = signal<ParsedQrBill | null>(null);
  protected readonly error = signal<string | null>(null);

  /** ng-zorro hands every dropped file here; returning false keeps it from being uploaded on its own. */
  protected readonly beforeUpload = (file: NzUploadFile): boolean => {
    this.handle(file as unknown as File);
    return false;
  };

  protected onCameraCapture(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (file) {
      this.handle(file);
    }
    input.value = '';
  }

  /** Reads a file: unsupported types and oversized files are rejected before they reach the API. */
  handle(file: File): void {
    this.result.set(null);

    if (!QR_BILL_ACCEPTED_TYPES.includes(file.type) || file.size > QR_BILL_MAX_BYTES) {
      this.error.set('qrBill.upload.failure');
      return;
    }

    this.error.set(null);
    this.parsing.set(true);
    this.api
      .parseFile(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.parsing.set(false);
          this.result.set(res.data);
          this.parsed.emit(res.data);
        },
        error: () => {
          this.parsing.set(false);
          this.error.set('qrBill.upload.failure');
        },
      });
  }
}
