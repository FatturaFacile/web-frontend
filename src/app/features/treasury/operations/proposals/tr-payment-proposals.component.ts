import { Component, inject, OnInit, signal } from '@angular/core';
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
  I18nService,
  PaymentProposal,
  PaymentProposalExcluded,
  PaymentProposalFormat,
  PaymentProposalStatus,
  PermissionsService,
  TreasuryApiService,
  TreasuryOpsApiService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, MoneyPipe, TranslatePipe, GridExportDirective, GridSortPipe } from '@shared';
import { downloadBlob } from '../../../general-ledger/shared/gl-dates';
import { TrLookupStore } from '../tr-lookup.store';
import { notInPast } from '@shared/utils/date-validators';

const STATUS_COLORS: Record<PaymentProposalStatus, string> = { draft: 'gold', converted: 'green', rejected: 'red' };

@Component({
  selector: 'app-tr-payment-proposals',
  styleUrl: './tr-payment-proposals.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
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
  protected readonly items = signal<PaymentProposal[]>([]);
  protected readonly excluded = signal<PaymentProposalExcluded[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly createOpen = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly rejectTarget = signal<PaymentProposal | null>(null);
  protected statusFilter: PaymentProposalStatus | null = 'draft';
  protected rejectReason = '';

  protected readonly form = this.fb.group({
    bank_account_id: this.fb.control('', Validators.required),
    execution_date: this.fb.control('', [Validators.required, notInPast]),
    due_until: this.fb.control('', Validators.required),
    include_discounts: this.fb.control(false),
    format: this.fb.control<PaymentProposalFormat>('sepa_pain_001_it', Validators.required),
  });

  ngOnInit(): void {
    this.banks.load();
    this.load();
  }

  protected statusColor(status: PaymentProposalStatus): string {
    return STATUS_COLORS[status];
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getPaymentProposals(this.statusFilter ?? undefined).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
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
        this.load();
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
        this.load();
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
        this.load();
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
