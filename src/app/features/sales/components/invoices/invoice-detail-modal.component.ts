import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { catchError, map, of } from 'rxjs';
import { AuthStore, CatalogApiService, DocumentEmailRecord, InvoiceApiService, InvoiceDetailResource } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';

/**
 * Read-only detail of an invoice: number (assigned by the server), payment term and, for a foreign-currency invoice,
 * the exchange rate with its source and date.
 */
@Component({
  selector: 'app-invoice-detail-modal',
  imports: [
    DatePipe,
    MoneyPipe,
    NzModalModule,
    NzDescriptionsModule,
    NzButtonModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'SALES.INVOICES.DETAIL.TITLE' | translate"
      nzWidth="640px"
      [nzFooter]="footer"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        @if (invoice(); as inv) {
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
            <nz-descriptions-item [nzTitle]="'SALES.INVOICES.FORM.NUMBER' | translate">
              <strong>{{ inv.invoice_number }}</strong>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'SALES.INVOICES.FORM.CURRENCY' | translate">
              {{ inv.currency }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'SALES.INVOICES.FORM.PAYMENT_TERM' | translate">
              {{ paymentTermLabel() || '-' }}
            </nz-descriptions-item>
            @if (isForeignCurrency()) {
              <nz-descriptions-item [nzTitle]="'SALES.INVOICES.DETAIL.EXCHANGE_RATE' | translate">
                {{ inv.exchange_rate ?? '-' }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'SALES.INVOICES.DETAIL.EXCHANGE_RATE_SOURCE' | translate">
                {{ inv.exchange_rate_source || '-' }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'SALES.INVOICES.DETAIL.EXCHANGE_RATE_DATE' | translate">
                {{ inv.exchange_rate_date ? (inv.exchange_rate_date | date: 'dd.MM.yyyy') : '-' }}
              </nz-descriptions-item>
            }
            <nz-descriptions-item [nzTitle]="'SALES.INVOICES.TOTALS.GROSS' | translate">
              <strong>{{ inv.total | money: inv.currency }}</strong>
            </nz-descriptions-item>
          </nz-descriptions>
          @if (!isForeignCurrency()) {
            <p class="hint">{{ 'SALES.INVOICES.DETAIL.NO_FX_NEEDED' | translate }}</p>
          }
          <h4 class="emails-title">{{ 'SALES.INVOICES.DETAIL.EMAILS' | translate }}</h4>
          <nz-table #emailTable [nzData]="emails()" [nzFrontPagination]="false" nzSize="small" [nzLoading]="emailsLoading()">
            <thead>
              <tr>
                <th>{{ 'SALES.INVOICES.DETAIL.EMAIL_RECIPIENT' | translate }}</th>
                <th>{{ 'SALES.INVOICES.DETAIL.EMAIL_STATUS' | translate }}</th>
                <th>{{ 'SALES.INVOICES.DETAIL.EMAIL_SENT_AT' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (mail of emailTable.data; track mail.id) {
                <tr>
                  <td>{{ mail.recipient }}</td>
                  <td>
                    <nz-tag [nzColor]="mail.status === 'sent' ? 'green' : mail.status === 'failed' ? 'red' : 'default'">
                      {{ mail.status }}
                    </nz-tag>
                    @if (mail.error) {
                      <div class="hint">{{ mail.error }}</div>
                    }
                  </td>
                  <td>{{ mail.sent_at ? (mail.sent_at | date: 'dd.MM.yyyy HH:mm') : '-' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
      <ng-template #footer>
        <button nz-button nzType="primary" type="button" (click)="open.set(false)">
          {{ 'COMMON.CLOSE' | translate }}
        </button>
      </ng-template>
    </nz-modal>
  `,
})
export class InvoiceDetailModalComponent {
  private readonly authStore = inject(AuthStore);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly invoiceApi = inject(InvoiceApiService);

  readonly open = model(false);
  readonly invoice = input<InvoiceDetailResource | null>(null);

  /** E-mails sent for the invoice, loaded when the modal opens. */
  protected readonly emails = signal<DocumentEmailRecord[]>([]);
  protected readonly emailsLoading = signal(false);

  constructor() {
    effect(() => {
      const id = this.open() ? this.invoice()?.id : null;
      untracked(() => this.loadEmails(id ?? null));
    });
  }

  private loadEmails(id: string | null): void {
    this.emails.set([]);
    if (!id) {
      return;
    }
    this.emailsLoading.set(true);
    this.invoiceApi.getDocumentEmails('invoice', id).subscribe({
      next: (res) => {
        this.emails.set(res.data);
        this.emailsLoading.set(false);
      },
      error: () => this.emailsLoading.set(false),
    });
  }

  private readonly paymentTerms = toSignal(
    this.catalogApi.getPaymentTerms().pipe(
      map((res) => res.data),
      catchError(() => of([])),
    ),
    { initialValue: [] },
  );

  /** A foreign-currency invoice carries the server-assigned rate against the accounting currency. */
  protected readonly isForeignCurrency = computed(() => {
    const inv = this.invoice();
    return !!inv && inv.currency !== this.authStore.activeCurrency();
  });

  protected readonly paymentTermLabel = computed(() => {
    const id = this.invoice()?.payment_term_id;
    const term = this.paymentTerms().find((t) => t.id === id);
    return term ? `${term.code} - ${term.name}` : '';
  });
}
