import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  FetchGridModel,
  I18nService,
  PagoPaNotice,
  PagoPaNoticePayload,
  PagoPaNoticeStatus,
  PermissionsService,
  QueryFilterParams,
  TreasuryOpsApiService,
} from '@core';
import { BaseTableComponent, ModalActionsDirective, MoneyPipe, TableColumnDef, TranslatePipe } from '@shared';

const STATUS_COLORS: Record<PagoPaNoticeStatus, string> = { pending: 'gold', paid: 'green', expired: 'red', cancelled: 'default' };

/** pagoPA payment notices of receivables: issue, cancel, record the payment and read the QR payload. */
@Component({
  selector: 'app-tr-pagopa-notices',
  styleUrl: './tr-pagopa-notices.component.scss',
  imports: [
    BaseTableComponent,
    ModalActionsDirective,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './tr-pagopa-notices.component.html',
})
export class TrPagoPaNoticesComponent {
  private readonly api = inject(TreasuryOpsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly canWrite = inject(PermissionsService).canWrite('treasury');
  protected readonly currency = inject(AuthStore).activeCurrency;

  protected readonly statuses: PagoPaNoticeStatus[] = ['pending', 'paid', 'expired', 'cancelled'];
  protected statusFilter: PagoPaNoticeStatus | null = null;

  /** Server-driven grid of the notices: paging, sorting, column filters and grouping run on the API. */
  protected readonly grid = new FetchGridModel<PagoPaNotice, QueryFilterParams & { status?: PagoPaNoticeStatus }>((query) => this.api.getPagoPaNotices(query));

  private readonly amountTpl = viewChild<TemplateRef<{ $implicit: PagoPaNotice; value: unknown }>>('amountTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: PagoPaNotice; value: unknown }>>('statusTpl');

  protected readonly columns = computed<TableColumnDef<PagoPaNotice>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'notice_code', header: this.i18n.translate('TR.PAGOPA_NOTICE_CODE'), width: '210px' },
      { key: 'iuv', header: this.i18n.translate('TR.PAGOPA_IUV'), width: '150px' },
      { key: 'debtor_name', header: this.i18n.translate('TR.DEBTOR') },
      { key: 'causale', header: this.i18n.translate('TR.PAGOPA_CAUSALE') },
      { key: 'due_date', header: this.i18n.translate('TR.DUE_DATE'), width: '120px' },
      { key: 'amount', align: 'right', header: this.i18n.translate('TR.AMOUNT'), width: '140px', customCellTemplate: this.amountTpl() },
      { key: 'status', header: this.i18n.translate('TR.STATUS'), width: '130px', customCellTemplate: this.statusTpl() },
    ];
  });

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly qrNotice = signal<PagoPaNotice | null>(null);
  protected readonly qrPayload = signal<string | null>(null);

  protected readonly form = this.fb.group({
    debtor_name: this.fb.control('', [Validators.required, Validators.maxLength(150)]),
    debtor_fiscal_code: this.fb.control('', [Validators.minLength(11), Validators.maxLength(16), Validators.pattern(/^[A-Za-z0-9]*$/)]),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    due_date: this.fb.control('', Validators.required),
    causale: this.fb.control('', [Validators.required, Validators.maxLength(140)]),
    creditor_fiscal_code: this.fb.control('', [Validators.required, Validators.pattern(/^[0-9]{11}$/)]),
  });

  protected statusColor(status: PagoPaNoticeStatus): string {
    return STATUS_COLORS[status];
  }

  protected statusLabel(status: PagoPaNoticeStatus): string {
    return this.i18n.translate('TR.PAGOPA_STATUS_' + status.toUpperCase());
  }

  protected onStatusChange(status: PagoPaNoticeStatus | null): void {
    this.statusFilter = status;
    this.grid.setFilter({ status: status ?? undefined });
  }

  protected openCreate(): void {
    this.form.reset();
    this.formErrors.set([]);
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload: PagoPaNoticePayload = {
      debtor_name: value.debtor_name,
      debtor_fiscal_code: value.debtor_fiscal_code || null,
      amount: (value.amount ?? 0).toFixed(2),
      currency: 'EUR',
      due_date: value.due_date,
      causale: value.causale,
      creditor_fiscal_code: value.creditor_fiscal_code,
    };

    this.saving.set(true);
    this.api.createPagoPaNotice(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.message.success(this.i18n.translate('TR.PAGOPA_ISSUED'));
        this.grid.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formErrors.set(applyServerErrors(this.form, err));
      },
    });
  }

  protected cancel(notice: PagoPaNotice): void {
    this.api.cancelPagoPaNotice(notice.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('TR.PAGOPA_CANCELLED'));
        this.grid.reload();
      },
    });
  }

  protected markPaid(notice: PagoPaNotice): void {
    this.api.markPagoPaNoticePaid(notice.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('TR.PAGOPA_MARKED_PAID'));
        this.grid.reload();
      },
    });
  }

  protected showQr(notice: PagoPaNotice): void {
    this.qrPayload.set(null);
    this.qrNotice.set(notice);
    this.api.getPagoPaNoticeQrPayload(notice.id).subscribe({ next: (res) => this.qrPayload.set(res.data.payload) });
  }

  protected closeQr(): void {
    this.qrNotice.set(null);
    this.qrPayload.set(null);
  }
}
