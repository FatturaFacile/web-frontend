import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { InvoiceApiService } from '@core/api/invoice-api.service';
import { SwissQrBillApiService } from '@core/api/swiss-qr-bill-api.service';
import { SwissQrBillData } from '@core/models';
import { QrBillLanguage, QrBillMode, QrBillPerforation } from '@core/models/swiss-qr-bill.model';
import { I18nService } from '@core';
import { TranslatePipe, downloadBlob } from '@shared';

export const QR_BILL_LANGUAGES: readonly QrBillLanguage[] = ['it', 'de', 'fr', 'en'];

const SLIP_LABEL_KEYS = [
  'receipt',
  'paymentPart',
  'accountPayableTo',
  'reference',
  'additionalInformation',
  'payableBy',
  'payableByName',
  'currency',
  'amount',
  'acceptancePoint',
  'separateBeforePaying',
] as const;

type SlipLabels = Record<(typeof SLIP_LABEL_KEYS)[number], string>;

/**
 * Live preview of the SIX payment slip of an invoice (receipt 62 mm + payment part 148 mm) in IT/DE/FR/EN, with a
 * download of the real PDF (attached to an A4 page or as a standalone 210x105 mm slip).
 */
@Component({
  selector: 'app-qr-bill-preview',
  imports: [FormsModule, NzAlertModule, NzButtonModule, NzSelectModule, NzSpinModule, TranslatePipe],
  styleUrl: './qr-bill-preview.component.scss',
  templateUrl: './qr-bill-preview.component.html',
})
export class QrBillPreviewComponent {
  private readonly invoices = inject(InvoiceApiService);
  private readonly qrApi = inject(SwissQrBillApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(I18nService);

  readonly invoiceId = input.required<string>();
  readonly defaultLanguage = input<QrBillLanguage>('en');
  readonly defaultPerforation = input<QrBillPerforation>('DASHED_LINE_WITH_SCISSORS');

  protected readonly languages = QR_BILL_LANGUAGES;
  protected readonly language = signal<QrBillLanguage>('en');
  protected readonly mode = signal<QrBillMode>('A4_ATTACHED');
  protected readonly perforation = signal<QrBillPerforation | null>(null);
  protected readonly bill = signal<SwissQrBillData | null>(null);
  protected readonly loading = signal(false);
  protected readonly downloading = signal(false);
  protected readonly failure = signal<string | null>(null);

  protected readonly labels = computed(() => {
    const language = this.language();
    return Object.fromEntries(
      SLIP_LABEL_KEYS.map((key) => [key, this.i18n.translateIn(language, `qrBill.slip.${key}`)])
    ) as SlipLabels;
  });
  protected readonly effectivePerforation = computed(() => this.perforation() ?? this.defaultPerforation());
  protected readonly showsScissors = computed(() => this.effectivePerforation() === 'DASHED_LINE_WITH_SCISSORS');
  protected readonly showsLine = computed(() => this.effectivePerforation() !== 'NONE');
  protected readonly referenceText = computed(() => {
    const bill = this.bill();
    return bill?.formatted_reference ?? bill?.reference ?? null;
  });

  constructor() {
    // SIX fixes the slip wording per slip language, so all four API dictionaries are needed, not just the active one.
    QR_BILL_LANGUAGES.forEach((lang) => void this.i18n.loadDictionary(lang));
    effect(() => this.language.set(this.defaultLanguage()));
    effect(() => this.load(this.invoiceId()));
  }

  protected download(): void {
    this.downloading.set(true);
    this.qrApi
      .generatePdf({
        invoice_id: this.invoiceId(),
        mode: this.mode(),
        perforation: this.effectivePerforation(),
        language: this.language(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.downloading.set(false);
          downloadBlob(blob, `qr-bill-${this.invoiceId()}.pdf`);
        },
        error: () => {
          this.downloading.set(false);
          this.failure.set('qrBill.preview.unavailable');
        },
      });
  }

  private load(invoiceId: string): void {
    this.loading.set(true);
    this.failure.set(null);
    this.invoices
      .getQrBill(invoiceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.bill.set(res.data);
          this.loading.set(false);
        },
        error: () => {
          this.bill.set(null);
          this.failure.set('qrBill.preview.unavailable');
          this.loading.set(false);
        },
      });
  }
}
