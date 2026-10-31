import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal, viewChild, TemplateRef } from '@angular/core';
import { finalize, Observable, switchMap } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
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
import {
  BaseTableComponent,
  PageHeaderComponent,
  TableColumnDef,
  TableQueryParams,
  TranslatePipe,
} from '@shared';
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
    NzTagModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzIconModule,
    NzDropdownModule,
    NzMenuModule,
    BaseTableComponent,
    PageHeaderComponent,
    TranslatePipe,
    InvoiceFormDrawerComponent,
  ],
  template: `
    <app-page-header [title]="'SALES.INVOICES.TITLE' | translate" [subtitle]="'SALES.INVOICES.SUBTITLE' | translate" />

    <nz-card>
      <div class="toolbar">
        <input
          class="search"
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

      <app-base-table
        [data]="facade.items()"
        [columns]="columns()"
        [loading]="facade.loading()"
        [total]="facade.totalCount()"
        [pageIndex]="facade.pageIndex()"
        [pageSize]="facade.pageSize()"
        [actionsTemplate]="actionsTpl"
        (paramsChange)="onParamsChange($event)"
      />

      <!-- Cell Templates -->
      <ng-template #numberTpl let-inv>
        <strong>{{ inv.invoice_number }}</strong>
        @if (inv.has_swiss_qr) {
          <nz-tag nzColor="red" style="margin-left: 6px;">QR</nz-tag>
        }
      </ng-template>

      <ng-template #dateTpl let-inv let-val="value">
        {{ val | date: 'dd.MM.yyyy' }}
      </ng-template>

      <ng-template #currencyTpl let-inv let-val="value">
        {{ val | currency: inv.currency : 'symbol' : '1.2-2' }}
      </ng-template>

      <ng-template #totalTpl let-inv let-val="value">
        <strong>{{ val | currency: inv.currency : 'symbol' : '1.2-2' }}</strong>
      </ng-template>

      <ng-template #statusTpl let-inv>
        <nz-tag [nzColor]="statusOf(inv).color">{{ statusOf(inv).key | translate }}</nz-tag>
      </ng-template>

      <ng-template #jurisdictionTpl let-inv>
        <nz-tag>{{ 'SALES.INVOICES.JURISDICTIONS.' + jurisdictionOf(inv) | translate }}</nz-tag>
      </ng-template>

      <!-- Row Actions Template -->
      <ng-template #actionsTpl let-inv>
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
      </ng-template>
    </nz-card>

    <app-invoice-form-drawer
      [open]="drawerOpen()"
      [template]="template()"
      (openChange)="drawerOpen.set($event)"
      (saved)="facade.reload()"
    />
  `,
  styles: `
    .toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .search {
      width: 280px;
    }
    .filter {
      width: 170px;
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
  protected readonly busyId = signal<string | null>(null);

  // Template views
  private readonly numberTpl = viewChild<TemplateRef<{ $implicit: InvoiceResource; value: unknown }>>('numberTpl');
  private readonly dateTpl = viewChild<TemplateRef<{ $implicit: InvoiceResource; value: unknown }>>('dateTpl');
  private readonly currencyTpl = viewChild<TemplateRef<{ $implicit: InvoiceResource; value: unknown }>>('currencyTpl');
  private readonly totalTpl = viewChild<TemplateRef<{ $implicit: InvoiceResource; value: unknown }>>('totalTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: InvoiceResource; value: unknown }>>('statusTpl');
  private readonly jurisdictionTpl = viewChild<TemplateRef<{ $implicit: InvoiceResource; value: unknown }>>('jurisdictionTpl');

  readonly columns = computed<TableColumnDef<InvoiceResource>[]>(() => [
    {
      key: 'invoice_number',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.NUMBER'),
      width: '180px',
      sortable: true,
      customCellTemplate: this.numberTpl(),
    },
    {
      key: 'issue_date',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.DATE'),
      width: '120px',
      sortable: true,
      customCellTemplate: this.dateTpl(),
    },
    {
      key: 'due_date',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.DUE_DATE'),
      width: '120px',
      sortable: true,
      customCellTemplate: this.dateTpl(),
    },
    {
      key: 'subtotal',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.NET'),
      width: '120px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'tax_amount',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.VAT'),
      width: '110px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'total',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.TOTAL'),
      width: '130px',
      align: 'right',
      sortable: true,
      customCellTemplate: this.totalTpl(),
    },
    {
      key: 'status',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.PAYMENT_STATUS'),
      width: '140px',
      customCellTemplate: this.statusTpl(),
    },
    {
      key: 'jurisdiction',
      header: this.i18n.translate('SALES.INVOICES.COLUMNS.JURISDICTION'),
      width: '120px',
      customCellTemplate: this.jurisdictionTpl(),
    },
  ]);

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

  protected onParamsChange(params: TableQueryParams): void {
    if (params.pageIndex !== this.facade.pageIndex()) {
      this.facade.setPage(params.pageIndex);
    }
    if (params.pageSize !== this.facade.pageSize()) {
      this.facade.setPageSize(params.pageSize);
    }
  }

  protected create(): void {
    this.template.set(null);
    this.drawerOpen.set(true);
  }

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
      error: () => undefined,
    });
  }

  private openBlob(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
