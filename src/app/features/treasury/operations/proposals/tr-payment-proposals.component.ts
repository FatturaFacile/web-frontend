import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  CreatePaymentProposalPayload,
  FetchGridModel,
  I18nService,
  PaymentProposal,
  PaymentProposalExcluded,
  PaymentProposalFormat,
  PaymentProposalStatus,
  PermissionsService,
  QueryFilterParams,
  TreasuryApiService,
  TreasuryOpsApiService,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, MoneyPipe, TableColumnDef, TranslatePipe } from '@shared';
import { downloadBlob } from '../../../general-ledger/shared/gl-dates';
import { TrLookupStore } from '../tr-lookup.store';
import { notInPast } from '@shared/utils/date-validators';

const STATUS_COLORS: Record<PaymentProposalStatus, string> = { draft: 'gold', converted: 'green', rejected: 'red' };

@Component({
  selector: 'app-tr-payment-proposals',
  styleUrl: './tr-payment-proposals.component.scss',
  imports: [
    BaseTableComponent,
    IconActionDirective,
    ModalActionsDirective,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './tr-payment-proposals.component.html',
})
export class TrPaymentProposalsComponent implements OnInit {
  private readonly api = inject(TreasuryOpsApiService);
  private readonly treasuryApi = inject(TreasuryApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly banks = inject(TrLookupStore);
  protected readonly userId = inject(AuthStore).user()?.id ?? null;
  protected readonly canWrite = inject(PermissionsService).canWrite('treasury');

  protected readonly statuses: PaymentProposalStatus[] = ['draft', 'converted', 'rejected'];
  protected readonly formats: PaymentProposalFormat[] = ['sepa_pain_001_it', 'iso_pain_001_ch'];
  protected readonly excluded = signal<PaymentProposalExcluded[]>([]);
  protected readonly saving = signal(false);
  protected readonly createOpen = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly rejectTarget = signal<PaymentProposal | null>(null);
  protected statusFilter: PaymentProposalStatus | null = 'draft';
  protected rejectReason = '';

  /** Server-driven grid of the proposals: paging, sorting, column filters and grouping run on the API. */
  protected readonly grid = new FetchGridModel<PaymentProposal, QueryFilterParams & { status?: PaymentProposalStatus }>(
    (query) => this.api.getPaymentProposals(query),
  );

  private readonly amountTpl = viewChild<TemplateRef<{ $implicit: PaymentProposal; value: unknown }>>('amountTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: PaymentProposal; value: unknown }>>('statusTpl');

  protected readonly columns = computed<TableColumnDef<PaymentProposal>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'proposal_number', header: this.i18n.translate('TR.PROPOSAL_NUMBER'), width: '150px' },
      {
        key: 'bank_account_id',
        serverKey: 'bankAccount.bank_name',
        valueGetter: (row) => this.banks.label(row.bank_account_id),
        header: this.i18n.translate('TR.BANK_ACCOUNT'),
      },
      { key: 'execution_date', header: this.i18n.translate('TR.EXECUTION_DATE'), width: '130px' },
      {
        key: 'format',
        valueLabel: (value) => this.i18n.translate('TR.FORMAT_' + value.toUpperCase()),
        valueGetter: (row) => this.i18n.translate('TR.FORMAT_' + row.format.toUpperCase()),
        header: this.i18n.translate('TR.FORMAT'),
        width: '170px',
      },
      { key: 'item_count', align: 'right', header: this.i18n.translate('TR.ITEMS'), width: '100px' },
      { key: 'total_amount', align: 'right', header: this.i18n.translate('TR.TOTAL'), width: '150px', customCellTemplate: this.amountTpl() },
      {
        key: 'status',
        valueLabel: (value) => this.i18n.translate('TR.PROPOSAL_STATUS_' + value.toUpperCase()),
        valueGetter: (row) => this.i18n.translate('TR.PROPOSAL_STATUS_' + row.status.toUpperCase()),
        header: this.i18n.translate('TR.STATUS'),
        width: '170px',
        customCellTemplate: this.statusTpl(),
      },
    ];
  });

  protected readonly form = this.fb.group({
    bank_account_id: this.fb.control('', Validators.required),
    execution_date: this.fb.control('', [Validators.required, notInPast]),
    due_until: this.fb.control('', Validators.required),
    include_discounts: this.fb.control(false),
    format: this.fb.control<PaymentProposalFormat>('sepa_pain_001_it', Validators.required),
  });

  ngOnInit(): void {
    this.banks.load();
    this.grid.setFilter({ status: this.statusFilter ?? undefined });
  }

  protected statusColor(status: PaymentProposalStatus): string {
    return STATUS_COLORS[status];
  }

  protected onStatusChange(status: PaymentProposalStatus | null): void {
    this.statusFilter = status;
    this.grid.setFilter({ status: status ?? undefined });
  }

  protected openCreate(): void {
    this.form.reset({ include_discounts: false, format: 'sepa_pain_001_it' });
    this.formErrors.set([]);
    this.createOpen.set(true);
  }

  protected create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload: CreatePaymentProposalPayload = this.form.getRawValue();
    this.saving.set(true);
    this.api.createPaymentProposal(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.excluded.set(res.meta?.excluded ?? []);
        this.message.success(this.i18n.translate('TR.PROPOSAL_CREATED'));
        this.grid.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formErrors.set(applyServerErrors(this.form, err));
      },
    });
  }

  /** The approver cannot be the author: the button is hidden for the author and the server answers 403 anyway. */
  protected approve(proposal: PaymentProposal): void {
    this.api.approvePaymentProposal(proposal.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('TR.PROPOSAL_APPROVED'));
        this.grid.reload();
      },
    });
  }

  protected openReject(proposal: PaymentProposal): void {
    this.rejectReason = '';
    this.rejectTarget.set(proposal);
  }

  protected confirmReject(): void {
    const target = this.rejectTarget();
    if (!target || !this.rejectReason.trim()) {
      return;
    }
    this.api.rejectPaymentProposal(target.id, this.rejectReason.trim()).subscribe({
      next: () => {
        this.rejectTarget.set(null);
        this.grid.reload();
      },
    });
  }

  protected downloadPain001(proposal: PaymentProposal): void {
    if (!proposal.payment_batch_id) {
      return;
    }
    this.treasuryApi.downloadPaymentBatchXml(proposal.payment_batch_id).subscribe({
      next: (blob) => downloadBlob(blob, `${proposal.proposal_number}-pain001.xml`),
    });
  }
}
