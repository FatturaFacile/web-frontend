import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { I18nService, SupportedLanguage } from '@core/i18n';
import { RfqApiService } from '@data-access/procurement/rfq-api.service';
import {
  ExternalBidSubmissionPayload,
  ExternalRfqPortalAttachment,
  ExternalRfqPortalView,
} from '@domain/procurement/rfq.models';
import { DateFormatPipe, downloadBlob, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';

export interface PortalBidLineEntry {
  rfq_line_id: string;
  line_number: number;
  item_code: string | null;
  description: string;
  technical_specifications: string | null;
  rfq_quantity: number;
  unit_of_measure: string;
  requested_delivery_date: string | null;
  is_no_bid: boolean;
  quoted_quantity: number;
  unit_price: number | null;
  discount_percent: number;
  lead_time_days: number;
  supplier_notes: string;
}

@Component({
  selector: 'app-supplier-bid-portal',
  imports: [
    DecimalPipe,
    FormsModule,
    TranslatePipe,
    DateFormatPipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    NzUploadModule,
  ],
  templateUrl: './supplier-bid-portal.component.html',
  styleUrl: './supplier-bid-portal.component.scss',
})
export class SupplierBidPortalComponent implements OnInit {
  readonly tokenInput = input<string | null>(null);

  private readonly api = inject(RfqApiService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);

  readonly token = signal<string>('');
  readonly loading = signal<boolean>(true);
  readonly submitting = signal<boolean>(false);
  readonly loadError = signal<boolean>(false);
  readonly portalView = signal<ExternalRfqPortalView | null>(null);
  readonly actionFeedback = signal<string | null>(null);

  readonly supplierQuoteReference = signal<string>('');
  readonly currencyCode = signal<string>('EUR');
  readonly paymentTermsDays = signal<number>(30);
  readonly incoterms = signal<string>('');
  readonly shippingCost = signal<number>(0);
  readonly validUntil = signal<string>('');
  readonly generalNotes = signal<string>('');
  readonly quotePdfFile = signal<File | null>(null);
  readonly lineEntries = signal<PortalBidLineEntry[]>([]);

  readonly declineModalVisible = signal<boolean>(false);
  readonly declineReason = signal<string>('');

  readonly languages: SupportedLanguage[] = ['it', 'en', 'de', 'fr'];
  readonly currencies = ['EUR', 'CHF', 'USD', 'GBP'];
  readonly currentLanguage = computed(() => this.i18n.currentLanguage());

  readonly itemsNetTotal = computed(() =>
    this.lineEntries().reduce((sum, entry) => sum + this.computeLineNet(entry), 0),
  );

  readonly totalLandedOffer = computed(
    () => this.itemsNetTotal() + Math.max(0, Number(this.shippingCost() || 0)),
  );

  readonly hasValidBidLine = computed(() =>
    this.lineEntries().some(
      (entry) => !entry.is_no_bid && entry.unit_price !== null && entry.unit_price >= 0,
    ),
  );

  readonly canInteract = computed(() => {
    const view = this.portalView();
    return !!view && view.can_submit && !this.loadError();
  });

  ngOnInit(): void {
    const resolvedToken = this.tokenInput() ?? this.route?.snapshot.paramMap.get('token') ?? '';
    this.token.set(resolvedToken);
    if (!resolvedToken) {
      this.loadError.set(true);
      this.loading.set(false);
      return;
    }
    this.loadPortal();
  }

  switchLanguage(lang: SupportedLanguage): void {
    void this.i18n.setLanguage(lang);
  }

  downloadAttachment(attachment: ExternalRfqPortalAttachment): void {
    const currentToken = this.token();
    if (!currentToken) {
      return;
    }
    this.api.downloadPublicAttachment(currentToken, attachment.id).subscribe({
      next: (blob) => downloadBlob(blob, attachment.file_name),
    });
  }

  readonly handleQuotePdfUpload = (file: NzUploadFile): boolean => {
    const rawFile =
      (file as unknown as { originFileObj?: File }).originFileObj ?? (file as unknown as File);
    if (rawFile instanceof File) {
      this.quotePdfFile.set(rawFile);
    }
    return false;
  };

  clearQuotePdf(): void {
    this.quotePdfFile.set(null);
  }

  updateLine<K extends keyof PortalBidLineEntry>(
    rfqLineId: string,
    field: K,
    value: PortalBidLineEntry[K],
  ): void {
    this.lineEntries.update((entries) =>
      entries.map((entry) => (entry.rfq_line_id === rfqLineId ? { ...entry, [field]: value } : entry)),
    );
  }

  computeLineNet(entry: PortalBidLineEntry): number {
    if (entry.is_no_bid || entry.unit_price === null || entry.unit_price < 0) {
      return 0;
    }
    const qty = Math.max(0, Number(entry.quoted_quantity || 0));
    const discount = Math.min(100, Math.max(0, Number(entry.discount_percent || 0)));
    return qty * Number(entry.unit_price) * (1 - discount / 100);
  }

  saveDraft(): void {
    this.submitBid('draft');
  }

  submitFinalQuote(): void {
    if (!this.hasValidBidLine()) {
      return;
    }
    this.submitBid('submit');
  }

  openDeclineModal(): void {
    this.declineReason.set('');
    this.declineModalVisible.set(true);
  }

  closeDeclineModal(): void {
    this.declineModalVisible.set(false);
  }

  confirmDecline(): void {
    const currentToken = this.token();
    if (!currentToken) {
      return;
    }

    this.submitting.set(true);
    this.api
      .declinePublicInvitation(currentToken, this.declineReason().trim() || null)
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.declineModalVisible.set(false);
          this.portalView.update((view) =>
            view
              ? {
                  ...view,
                  can_submit: false,
                  invitation: {
                    ...view.invitation,
                    status: 'declined',
                    declined_reason: this.declineReason().trim() || null,
                  },
                }
              : null,
          );
          const msg = this.i18n.translate('RFQ.PORTAL.DECLINED_OK');
          this.actionFeedback.set(msg);
          this.message.info(msg);
        },
        error: () => {
          this.submitting.set(false);
        },
      });
  }

  countdownLabel(): string {
    const deadline = this.portalView()?.rfq.submission_deadline;
    if (!deadline) {
      return '';
    }
    const diffMs = new Date(deadline).getTime() - Date.now();
    if (diffMs <= 0) {
      return this.i18n.translate('RFQ.COUNTDOWN_EXPIRED');
    }
    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) {
      return this.i18n.translate('RFQ.COUNTDOWN_DAYS', { days, hours });
    }
    return this.i18n.translate('RFQ.COUNTDOWN_HOURS', { hours, minutes });
  }

  private submitBid(action: 'draft' | 'submit'): void {
    const currentToken = this.token();
    if (!currentToken || !this.canInteract()) {
      return;
    }

    const payload: ExternalBidSubmissionPayload = {
      action,
      supplier_quote_reference: this.supplierQuoteReference().trim() || null,
      currency_code: this.currencyCode(),
      payment_terms_days: Math.max(0, Number(this.paymentTermsDays() || 0)),
      incoterms: this.incoterms().trim() || null,
      shipping_cost: Math.max(0, Number(this.shippingCost() || 0)),
      valid_until: this.validUntil() || null,
      general_notes: this.generalNotes().trim() || null,
      quote_attachment: this.quotePdfFile(),
      lines: this.lineEntries().map((entry) => ({
        rfq_line_id: entry.rfq_line_id,
        is_no_bid: entry.is_no_bid,
        quoted_quantity: entry.quoted_quantity,
        unit_price: entry.is_no_bid ? null : entry.unit_price,
        discount_percent: entry.is_no_bid ? 0 : entry.discount_percent,
        lead_time_days: entry.is_no_bid ? 0 : entry.lead_time_days,
        supplier_notes: entry.supplier_notes.trim() || null,
      })),
    };

    this.submitting.set(true);
    this.api.submitPublicBid(currentToken, payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.portalView.update((view) => (view ? { ...view, bid: res.data } : null));
        const key = action === 'draft' ? 'RFQ.PORTAL.SAVED_DRAFT_OK' : 'RFQ.PORTAL.SUBMITTED_OK';
        const msg = this.i18n.translate(key);
        this.actionFeedback.set(msg);
        this.message.success(msg);
      },
      error: () => {
        this.submitting.set(false);
      },
    });
  }

  private loadPortal(): void {
    this.loading.set(true);
    this.loadError.set(false);

    this.api.getPublicPortal(this.token()).subscribe({
      next: (res) => {
        const view = res.data;
        this.portalView.set(view);
        if (view.preferred_locale) {
          void this.i18n.setLanguage(view.preferred_locale);
        }

        const existingBid = view.bid;
        this.supplierQuoteReference.set(existingBid?.supplier_quote_reference ?? '');
        this.currencyCode.set(existingBid?.currency_code ?? view.rfq.currency_code ?? 'EUR');
        this.paymentTermsDays.set(existingBid?.payment_terms_days ?? 30);
        this.incoterms.set(existingBid?.incoterms ?? view.rfq.incoterms ?? '');
        this.shippingCost.set(existingBid?.shipping_cost ? Number(existingBid.shipping_cost) : 0);
        this.validUntil.set(existingBid?.valid_until ?? '');
        this.generalNotes.set(existingBid?.general_notes ?? '');

        const bidLinesByRfqLineId = new Map(
          (existingBid?.lines ?? []).map((line) => [line.rfq_line_id, line]),
        );

        this.lineEntries.set(
          view.rfq.lines.map((line) => {
            const existingLine = bidLinesByRfqLineId.get(line.id);
            const qty = existingLine ? Number(existingLine.quoted_quantity) : Number(line.quantity);
            return {
              rfq_line_id: line.id,
              line_number: line.line_number,
              item_code: line.item_code,
              description: line.description,
              technical_specifications: line.technical_specifications,
              rfq_quantity: Number(line.quantity),
              unit_of_measure: line.unit_of_measure,
              requested_delivery_date: line.requested_delivery_date,
              is_no_bid: existingLine?.is_no_bid ?? false,
              quoted_quantity: Number.isFinite(qty) && qty > 0 ? qty : Number(line.quantity),
              unit_price: existingLine && !existingLine.is_no_bid ? Number(existingLine.unit_price) : null,
              discount_percent: existingLine ? Number(existingLine.discount_percent ?? 0) : 0,
              lead_time_days: existingLine?.lead_time_days ?? 7,
              supplier_notes: existingLine?.supplier_notes ?? '',
            };
          }),
        );

        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }
}
