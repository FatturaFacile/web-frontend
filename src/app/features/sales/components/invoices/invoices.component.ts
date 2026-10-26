import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { finalize, Observable, switchMap } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  I18nService,
  InvoiceApiService,
  InvoiceDetailResource,
  InvoiceResource,
  InvoiceStatus,
  Jurisdiction,
  PaymentStatus,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { InvoiceFacade } from '../../services/invoice.facade';
import { InvoiceFormDrawerComponent } from './invoice-form-drawer.component';

const STATUS: Record<InvoiceStatus, { key: string; color: string }> = {
  draft: { key: 'SALES.INVOICES.STATUS.DRAFT', color: 'default' },
  issued: { key: 'SALES.INVOICES.STATUS.ISSUED', color: 'processing' },
  paid: { key: 'SALES.INVOICES.STATUS.PAID', color: 'success' },
  cancelled: { key: 'SALES.INVOICES.STATUS.CANCELLED', color: 'error' },
};

const PAYMENT_KEYS: { key: string; value: PaymentStatus }[] = [
  { key: 'SALES.INVOICES.PAYMENT.UNPAID', value: 'unpaid' },
  { key: 'SALES.INVOICES.PAYMENT.PARTIALLY_PAID', value: 'partially_paid' },
  { key: 'SALES.INVOICES.PAYMENT.PAID', value: 'paid' },
  { key: 'SALES.INVOICES.PAYMENT.OVERDUE', value: 'overdue' },
];

const JURISDICTION_KEYS: { key: string; value: Jurisdiction }[] = [
  { key: 'SALES.INVOICES.JURISDICTIONS.IT', value: 'IT' },
  { key: 'SALES.INVOICES.JURISDICTIONS.CH', value: 'CH' },
];

@Component({
  selector: 'app-invoices',
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    NzTableModule,
    NzTagModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzIconModule,
    NzEmptyModule,
    NzSkeletonModule,
    NzDropdownModule,
    NzMenuModule,
    PageHeaderComponent,
    TranslatePipe,
    InvoiceFormDrawerComponent,
  ],
  template: `
    <app-page-header [title]="'SALES.INVOICES.TITLE' | translate" [subtitle]="'SALES.INVOICES.SUBTITLE' | translate" />

    <nz-card>
      <div class="toolbar">
        <input class="search"
            nz-input
            type="search"
            [attr.aria-label]="'SALES.INVOICES.SEARCH_PLACEHOLDER' | translate"
            [placeholder]="'SALES.INVOICES.SEARCH_PLACEHOLDER' | translate"
            [ngModel]="facade.filterParams().search"
            (ngModelChange)="facade.setFilter({ search: $event })"
          />

        <nz-select
          class="filter"
          nzAllowClear
          [nzPlaceHolder]="'SALES.INVOICES.FILTER_PAYMENT' | translate"
          [attr.aria-label]="'SALES.INVOICES.FILTER_PAYMENT' | translate"
          [nzOptions]="paymentOptions()"
          [ngModel]="facade.filterParams().payment_status"
          (ngModelChange)="facade.setFilter({ payment_status: $event ?? undefined })"
        />
        <nz-select
          class="filter"
          nzAllowClear
          [nzPlaceHolder]="'SALES.INVOICES.FILTER_JURISDICTION' | translate"
          [attr.aria-label]="'SALES.INVOICES.FILTER_JURISDICTION' | translate"
          [nzOptions]="jurisdictionOptions()"
          [ngModel]="facade.filterParams().jurisdiction"
          (ngModelChange)="facade.setFilter({ jurisdiction: $event ?? undefined })"
        />

        <span class="spacer"></span>
        <button nz-button nzType="primary" type="button" (click)="create()">
          <nz-icon nzType="plus" /> {{ 'SALES.INVOICES.NEW' | translate }}
        </button>
      </div>

      @if (!facade.loaded()) {
        <nz-skeleton [nzActive]="true" [nzParagraph]="{ rows: 6 }" />
      } @else {
        <nz-table
          #table
          nzSize="middle"
          [nzData]="facade.items()"
          [nzFrontPagination]="false"
          [nzLoading]="facade.loading()"
          [nzTotal]="facade.totalCount()"
          [nzPageIndex]="facade.pageIndex()"
          [nzPageSize]="facade.pageSize()"
          [nzNoResult]="empty"
          (nzPageIndexChange)="facade.setPage($event)"
          (nzPageSizeChange)="facade.setPageSize($event)"
        >
          <thead>
            <tr>
              <th>{{ 'SALES.INVOICES.COLUMNS.NUMBER' | translate }}</th>
              <th>{{ 'SALES.INVOICES.COLUMNS.DATE' | translate }}</th>
              <th>{{ 'SALES.INVOICES.COLUMNS.DUE_DATE' | translate }}</th>
              <th nzAlign="right">{{ 'SALES.INVOICES.COLUMNS.NET' | translate }}</th>
              <th nzAlign="right">{{ 'SALES.INVOICES.COLUMNS.VAT' | translate }}</th>
              <th nzAlign="right">{{ 'SALES.INVOICES.COLUMNS.TOTAL' | translate }}</th>
              <th>{{ 'SALES.INVOICES.COLUMNS.PAYMENT_STATUS' | translate }}</th>
              <th>{{ 'SALES.INVOICES.COLUMNS.JURISDICTION' | translate }}</th>
              <th nzAlign="right">{{ 'SALES.INVOICES.COLUMNS.ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (inv of table.data; track inv.id) {
              <tr>
                <td>
                  {{ inv.invoice_number }}
                  @if (inv.has_swiss_qr) {
                    <nz-tag nzColor="red">QR</nz-tag>
                  }
                </td>
                <td>{{ inv.issue_date | date: 'dd.MM.yyyy' }}</td>
                <td>{{ inv.due_date | date: 'dd.MM.yyyy' }}</td>
                <td nzAlign="right">{{ inv.subtotal | currency: inv.currency : 'symbol' : '1.2-2' }}</td>
                <td nzAlign="right">{{ inv.tax_amount | currency: inv.currency : 'symbol' : '1.2-2' }}</td>
                <td nzAlign="right">
                  <strong>{{ inv.total | currency: inv.currency : 'symbol' : '1.2-2' }}</strong>
                </td>
                <td>
                  <nz-tag [nzColor]="statusOf(inv).color">{{ statusOf(inv).key | translate }}</nz-tag>
                </td>
                <td>
                  <nz-tag>{{ 'SALES.INVOICES.JURISDICTIONS.' + jurisdictionOf(inv) | translate }}</nz-tag>
                </td>
                <td nzAlign="right">
                  <button
                    nz-button
                    nzType="text"
                    type="button"
                    nz-dropdown
                    nzTrigger="click"
                    nzPlacement="bottomRight"
                    [nzDropdownMenu]="menu"
                    [nzLoading]="busyId() === inv.id"
                    [disabled]="busyId() === inv.id"
                    [attr.aria-label]="'SALES.INVOICES.ACTIONS.MORE' | translate: { number: inv.invoice_number }"
                  >
                    <nz-icon nzType="more" />
                  </button>
                  <nz-dropdown-menu #menu="nzDropdownMenu">
                    <ul nz-menu>
                      <li nz-menu-item tabindex="0" (click)="openPdf(inv)" (keydown.enter)="openPdf(inv)">
                        <nz-icon nzType="file-pdf" /> {{ 'SALES.INVOICES.ACTIONS.DOWNLOAD_PDF' | translate }}
                      </li>
                      <li nz-menu-item tabindex="0" (click)="confirmEmail(inv)" (keydown.enter)="confirmEmail(inv)">
                        <nz-icon nzType="mail" /> {{ 'SALES.INVOICES.ACTIONS.SEND_EMAIL' | translate }}
                      </li>
                      @if (jurisdictionOf(inv) === 'IT') {
                        <li nz-menu-item tabindex="0" (click)="confirmSdi(inv)" (keydown.enter)="confirmSdi(inv)">
                          <nz-icon nzType="send" /> {{ 'SALES.INVOICES.ACTIONS.SEND_SDI' | translate }}
                        </li>
                      }
                      @if (jurisdictionOf(inv) === 'CH') {
                        <li nz-menu-item tabindex="0" (click)="generateQrBill(inv)" (keydown.enter)="generateQrBill(inv)">
                          <nz-icon nzType="qrcode" /> {{ 'SALES.INVOICES.ACTIONS.GENERATE_QR_BILL' | translate }}
                        </li>
                      }
                      @if (inv.invoice_type === 'proforma') {
                        <li nz-menu-item tabindex="0" (click)="confirmProforma(inv)" (keydown.enter)="confirmProforma(inv)">
                          <nz-icon nzType="swap" /> {{ 'SALES.INVOICES.ACTIONS.CONVERT_PROFORMA' | translate }}
                        </li>
                      }
                      <li nz-menu-divider></li>
                      <li nz-menu-item tabindex="0" (click)="duplicate(inv)" (keydown.enter)="duplicate(inv)">
                        <nz-icon nzType="copy" /> {{ 'SALES.INVOICES.ACTIONS.DUPLICATE' | translate }}
                      </li>
                    </ul>
                  </nz-dropdown-menu>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        <ng-template #empty>
          <nz-empty [nzNotFoundContent]="'SALES.INVOICES.EMPTY' | translate">
            <div nz-empty-footer>
              <button nz-button nzType="primary" type="button" (click)="create()">
                {{ 'SALES.INVOICES.EMPTY_CTA' | translate }}
              </button>
            </div>
          </nz-empty>
        </ng-template>
      }
    </nz-card>

    <app-invoice-form-drawer [(open)]="drawerOpen" [template]="template()" (saved)="facade.reload()" />
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }
    .search {
      width: 320px;
    }
    .filter {
      width: 180px;
    }
    .spacer {
      flex: 1;
    }
  `,
})
export class InvoicesComponent {
  protected readonly facade = inject(InvoiceFacade);
  private readonly api = inject(InvoiceApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);

  protected readonly drawerOpen = signal(false);
  protected readonly template = signal<InvoiceDetailResource | null>(null);
  /** Id of the invoice whose action is currently running (drives the row spinner). */
  protected readonly busyId = signal<string | null>(null);

  protected readonly paymentOptions = computed(() => {
    this.i18n.currentLanguage();
    return PAYMENT_KEYS.map((o) => ({ label: this.i18n.translate(o.key), value: o.value }));
  });
  protected readonly jurisdictionOptions = computed(() => {
    this.i18n.currentLanguage();
    return JURISDICTION_KEYS.map((o) => ({ label: this.i18n.translate(o.key), value: o.value }));
  });

  protected jurisdictionOf(inv: InvoiceResource): Jurisdiction {
    return inv.jurisdiction ?? (inv.currency === 'CHF' ? 'CH' : 'IT');
  }

  protected statusOf(inv: InvoiceResource): { key: string; color: string } {
    if (inv.invoice_type === 'proforma') {
      return { key: 'SALES.INVOICES.STATUS.PROFORMA', color: 'purple' };
    }
    if (inv.payment_status === 'overdue' && inv.status !== 'paid') {
      return { key: 'SALES.INVOICES.STATUS.OVERDUE', color: 'error' };
    }
    return STATUS[inv.status] ?? { key: 'SALES.INVOICES.STATUS.DRAFT', color: 'default' };
  }

  protected create(): void {
    this.template.set(null);
    this.drawerOpen.set(true);
  }

  /** Client-side clone: loads the full document and opens the builder as a new draft. */
  protected duplicate(inv: InvoiceResource): void {
    this.run(inv, this.api.get(inv.id), null, (res) => {
      this.template.set({ ...inv, ...res.data });
      this.drawerOpen.set(true);
    });
  }

  protected openPdf(inv: InvoiceResource): void {
    this.run(inv, this.api.downloadPdf(inv.id), null, (blob) => this.openBlob(blob));
  }

  protected generateQrBill(inv: InvoiceResource): void {
    this.run(
      inv,
      this.api.generateQrBill(inv.id).pipe(switchMap(() => this.api.downloadQrBill(inv.id))),
      'SALES.INVOICES.MESSAGES.QR_GENERATED',
      (blob) => {
        this.openBlob(blob);
        this.facade.reload();
      },
    );
  }

  protected confirmEmail(inv: InvoiceResource): void {
    this.confirm('SALES.INVOICES.ACTIONS.CONFIRM_EMAIL', () =>
      this.run(inv, this.api.sendByEmail(inv.id), 'SALES.INVOICES.MESSAGES.EMAIL_SENT'),
    );
  }

  protected confirmSdi(inv: InvoiceResource): void {
    this.confirm('SALES.INVOICES.ACTIONS.CONFIRM_SDI', () =>
      this.run(inv, this.api.sendToSdi(inv.id), 'SALES.INVOICES.MESSAGES.SDI_SENT', () => this.facade.reload()),
    );
  }

  protected confirmProforma(inv: InvoiceResource): void {
    this.confirm('SALES.INVOICES.ACTIONS.CONFIRM_PROFORMA', () =>
      this.run(inv, this.api.convertProforma(inv.id), 'SALES.INVOICES.MESSAGES.PROFORMA_CONVERTED', () =>
        this.facade.reload(),
      ),
    );
  }

  /**
   * Confirmation dialog. A modal is used instead of 
zPopconfirm because the
   * actions live in a dropdown that closes on click, which would dismiss an
   * anchored popconfirm before the user can answer.
   */
  private confirm(titleKey: string, onOk: () => void): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate(titleKey),
      nzOkText: this.i18n.translate('SALES.INVOICES.ACTIONS.OK'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOnOk: onOk,
    });
  }

  private run<T>(
    inv: InvoiceResource,
    request$: Observable<T>,
    successKey: string | null,
    onSuccess?: (result: T) => void,
  ): void {
    this.busyId.set(inv.id);
    request$.pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: (result) => {
        if (successKey) {
          this.message.success(this.i18n.translate(successKey));
        }
        onSuccess?.(result);
      },
      // Errors are surfaced by the global error interceptor.
      error: () => undefined,
    });
  }

  private openBlob(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}