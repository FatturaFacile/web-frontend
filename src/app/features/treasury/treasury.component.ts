import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal, viewChild, TemplateRef } from '@angular/core';
import { AbstractControl, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import {
  BankAccountResource,
  BankStatement,
  BankTransactionResource,
  BankingApiService,
  BillingApiService,
  CashForecastResource,
  CreateBankAccountPayload,
  CreatePaymentBatchPayload,
  PaymentBatchResource,
  PaymentBatchStatus,
  PaymentMethodType,
  TreasuryApiService,
  TranslateService,
} from '@core';
import {
  BaseTableComponent,
  MoneyPipe,
  PageHeaderComponent,
  TableColumnDef,
  TableQueryParams,
  TableStateService,
  TranslatePipe,
} from '@shared';
import { ibanValidator } from '@shared/utils/iban-validator';
import { validationTipKey } from '@shared/utils/validation-tip';

@Component({
  selector: 'app-treasury',
  styleUrl: './treasury.component.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CurrencyPipe,
    DatePipe,
    MoneyPipe,
    NzTagModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzFormModule,
    NzIconModule,
    NzTabsModule,
    NzGridModule,
    NzStatisticModule,
    NzModalModule,
    NzUploadModule,
    NzTableModule,
    NzDividerModule,
    BaseTableComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [TableStateService],
  templateUrl: './treasury.component.html',
})
export class TreasuryComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly treasuryApi = inject(TreasuryApiService);
  private readonly bankingApi = inject(BankingApiService);
  private readonly billingApi = inject(BillingApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly tableState = inject(TableStateService<BankTransactionResource>);

  protected selectedTab = 0;
  protected isImportModalVisible = signal(false);
  protected isUploading = signal(false);
  protected isReconciling = signal(false);
  protected importFormat: 'camt' | 'cbi' = 'camt';
  protected selectedFile: File | null = null;

  // Bank Accounts
  protected readonly bankAccounts = signal<BankAccountResource[]>([]);
  protected readonly loadingAccounts = signal(false);
  protected readonly accountModalVisible = signal(false);

  // Transactions & Statements
  protected readonly transactions = signal<BankTransactionResource[]>([]);
  protected readonly statements = signal<BankStatement[]>([]);
  protected readonly loadingStatements = signal(false);

  // Payment Batches
  protected readonly paymentBatches = signal<PaymentBatchResource[]>([]);
  protected readonly loadingBatches = signal(false);
  protected readonly batchModalVisible = signal(false);

  // Cash Forecasts
  protected readonly cashForecasts = signal<CashForecastResource[]>([]);
  protected readonly loadingForecasts = signal(false);

  // KPIs
  protected readonly totalEurBalance = computed(() => {
    return this.bankAccounts()
      .filter((a) => a.currency === 'EUR')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  });

  protected readonly totalChfBalance = computed(() => {
    return this.bankAccounts()
      .filter((a) => a.currency === 'CHF')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  });

  protected readonly unreconciledCount = computed(() => {
    return this.transactions().filter((t) => !t.reconciled).length;
  });

  // Forms
  readonly accountForm = this.fb.group({
    bank_name: this.fb.control('', [Validators.required, Validators.maxLength(150)]),
    iban: this.fb.control('', [Validators.required, Validators.maxLength(34), ibanValidator]),
    currency: this.fb.control<'EUR' | 'CHF'>('EUR', [Validators.required]),
    branch_name: this.fb.control('', [Validators.maxLength(150)]),
    bic_swift: this.fb.control('', [Validators.pattern(/^([A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?)?$/)]),
    account_type: this.fb.control('checking'),
    opening_balance: this.fb.control(0),
  });

  readonly batchForm = this.fb.group({
    bank_account_id: this.fb.control('', [Validators.required]),
    batch_reference: this.fb.control('DIST-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-4), [Validators.maxLength(50)]),
    payment_method: this.fb.control<PaymentMethodType>('sepa_credit_transfer', [Validators.required]),
    recipient_name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    recipient_iban: this.fb.control('', [Validators.required, Validators.maxLength(42), ibanValidator]),
    amount: this.fb.control(0, [Validators.required, Validators.min(0.01)]),
    remittance_reference: this.fb.control('', [Validators.maxLength(140)]),
  });

  /** Translation key of the error shown under a form control of the account and payment batch forms. */
  protected errorKey(control: AbstractControl | null): string {
    return validationTipKey(control) || 'COMMON.VALIDATION.INVALID_VALUE';
  }

  private readonly dateTpl = viewChild<TemplateRef<unknown>>('dateTpl');
  private readonly currencyTpl = viewChild<TemplateRef<unknown>>('currencyTpl');
  private readonly reconciledTpl = viewChild<TemplateRef<unknown>>('reconciledTpl');
  private readonly statusTpl = viewChild<TemplateRef<unknown>>('statusTpl');

  readonly txColumns = computed<TableColumnDef<BankTransactionResource>[]>(() => [
    {
      key: 'transaction_date',
      header: 'treasury.columns.valueDate',
      width: '120px',
      sortable: true,
      customCellTemplate: this.dateTpl(),
    },
    {
      key: 'description',
      header: 'treasury.columns.description',
      width: '320px',
      sortable: true,
    },
    {
      key: 'counterparty',
      header: 'treasury.columns.counterparty',
      width: '220px',
    },
    {
      key: 'amount',
      header: 'treasury.columns.amount',
      width: '140px',
      align: 'right',
      sortable: true,
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'category',
      header: 'treasury.columns.category',
      width: '160px',
    },
    {
      key: 'reconciled',
      header: 'treasury.columns.status',
      width: '160px',
      customCellTemplate: this.reconciledTpl(),
    },
  ]);

  readonly accountColumns = computed<TableColumnDef<BankAccountResource>[]>(() => [
    {
      key: 'bank_name',
      header: 'treasury.columns.bankName',
      width: '220px',
      sortable: true,
    },
    {
      key: 'iban',
      header: 'treasury.columns.bankDetails',
      width: '260px',
    },
    {
      key: 'currency',
      header: 'treasury.columns.currency',
      width: '100px',
    },
    {
      key: 'balance',
      header: 'treasury.columns.availableBalance',
      width: '180px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
  ]);

  readonly statementColumns = computed<TableColumnDef<BankStatement>[]>(() => [
    {
      key: 'statement_date',
      header: 'treasury.columns.statementDate',
      width: '130px',
      customCellTemplate: this.dateTpl(),
    },
    {
      key: 'iban',
      header: 'treasury.columns.iban',
      width: '240px',
    },
    {
      key: 'source_format',
      header: 'treasury.columns.format',
      width: '120px',
    },
    {
      key: 'closing_balance',
      header: 'treasury.columns.closingBalance',
      width: '150px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'status',
      header: 'treasury.columns.reconciliationStatus',
      width: '170px',
      customCellTemplate: this.statusTpl(),
    },
  ]);

  ngOnInit(): void {
    this.loadAccounts();
    this.loadTransactions();
    this.loadStatements();
    this.loadPaymentBatches();
    this.loadCashForecasts();
  }

  // --- Bank Accounts ---

  loadAccounts(): void {
    this.loadingAccounts.set(true);
    this.treasuryApi.getBankAccounts().subscribe({
      next: (res) => {
        this.bankAccounts.set(res.data || []);
        this.loadingAccounts.set(false);
      },
      error: () => {
        this.bankAccounts.set([]);
        this.loadingAccounts.set(false);
      },
    });
  }

  openAccountModal(): void {
    this.accountForm.reset({
      bank_name: '',
      iban: '',
      currency: 'EUR',
      branch_name: '',
      bic_swift: '',
      account_type: 'checking',
      opening_balance: 0,
    });
    this.accountModalVisible.set(true);
  }

  submitAccount(): void {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      return;
    }

    const payload: CreateBankAccountPayload = this.accountForm.getRawValue();
    this.treasuryApi.createBankAccount(payload).subscribe({
      next: () => {
        this.accountModalVisible.set(false);
        this.message.success(this.translate.instant('treasury.msgContoBancarioRegistratoConSuccesso'));
        this.loadAccounts();
      },
      error: () => {
        this.message.error(this.translate.instant('treasury.msgErroreDuranteLaRegistrazioneDelConto'));
      },
    });
  }

  deleteAccount(account: BankAccountResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('treasury.dlgEliminareIlConto', { bank_name: account.bank_name, iban: account.iban }),
      nzOkText: this.translate.instant('treasury.dlgElimina'),
      nzOkDanger: true,
      nzCancelText: this.translate.instant('treasury.dlgAnnulla'),
      nzOnOk: () => {
        this.treasuryApi.deleteBankAccount(account.id).subscribe({
          next: () => {
            this.message.success(this.translate.instant('treasury.msgContoEliminato'));
            this.loadAccounts();
          },
        });
      },
    });
  }

  // --- Transactions & Auto Match ---

  loadTransactions(): void {
    this.tableState.setLoading(true);
    this.treasuryApi.getBankTransactions(this.tableState.toBackendQueryParams()).subscribe({
      next: (res) => {
        this.transactions.set(res.data || []);
        this.tableState.setTotal(res.meta?.total || res.data?.length || 0);
        this.tableState.setLoading(false);
      },
      error: () => {
        this.transactions.set([]);
        this.tableState.setTotal(0);
        this.tableState.setLoading(false);
      },
    });
  }

  loadStatements(): void {
    this.loadingStatements.set(true);
    this.bankingApi.getBankStatements().subscribe({
      next: (res) => {
        this.statements.set(res.data || []);
        this.loadingStatements.set(false);
      },
      error: () => {
        this.statements.set([]);
        this.loadingStatements.set(false);
      },
    });
  }

  onSearchChange(search: string): void {
    this.tableState.setSearch(search);
    this.loadTransactions();
  }

  onParamsChange(params: TableQueryParams): void {
    this.tableState.setPage(params.pageIndex);
    this.tableState.setPageSize(params.pageSize);
    if (params.sort) {
      this.tableState.setSort(params.sort.key, params.sort.order);
    }
    this.loadTransactions();
  }

  triggerAutoMatch(): void {
    this.isReconciling.set(true);
    this.treasuryApi.reconcileTransactionsAutoMatch().subscribe({
      next: (res) => {
        this.isReconciling.set(false);
        this.message.success(this.translate.instant('treasury.msgConciliazioneCompletataMovimentiRiconciliati', { value: res.data?.matched_count || 0 }));
        this.loadTransactions();
      },
      error: () => {
        this.isReconciling.set(false);
        this.message.error(this.translate.instant('treasury.msgErroreDuranteLaConciliazioneAutomatica'));
      },
    });
  }

  reconcileStatement(st: BankStatement): void {
    this.bankingApi.reconcileStatement(st.id).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('treasury.msgEstrattoContoRiconciliatoRighe', { value: res.data?.reconciled_count || 0 }));
        this.loadStatements();
        this.loadTransactions();
      },
      error: () => {
        this.message.error(this.translate.instant('treasury.msgErroreDuranteLaRiconciliazioneDellEstratto'));
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  submitImport(): void {
    if (!this.selectedFile) {
      this.message.warning(this.translate.instant('treasury.msgSelezionaUnFileDaImportare'));
      return;
    }

    this.isUploading.set(true);
    const fd = new FormData();
    if (this.importFormat === 'camt') {
      // CAMT goes through the payment import (`/sales/payment-imports`); it auto-matches credits to open invoices.
      this.billingApi.uploadPaymentImport(this.selectedFile).subscribe({
        next: (res) => {
          this.isUploading.set(false);
          this.isImportModalVisible.set(false);
          this.message.success(this.translate.instant('treasury.msgImportatiMovimentiCamt', { value: res.data?.lines?.length ?? 0 }));
          this.loadTransactions();
          this.loadStatements();
        },
        error: () => {
          this.isUploading.set(false);
          this.message.error(this.translate.instant('treasury.msgErroreDuranteLImportazioneCamt'));
        },
      });
    } else {
      fd.append('file', this.selectedFile);
      this.treasuryApi.importCbiFile(fd).subscribe({
        next: (res) => {
          this.isUploading.set(false);
          this.isImportModalVisible.set(false);
          this.message.success(this.translate.instant('treasury.msgImportatiMovimentiCbi', { value: res.data?.imported_count || 0 }));
          this.loadTransactions();
          this.loadStatements();
        },
        error: () => {
          this.isUploading.set(false);
          this.message.error(this.translate.instant('treasury.msgErroreDuranteLImportazioneCbi'));
        },
      });
    }
  }

  // --- Payment Batches ---

  loadPaymentBatches(): void {
    this.loadingBatches.set(true);
    this.treasuryApi.getPaymentBatches().subscribe({
      next: (res) => {
        this.paymentBatches.set(res.data || []);
        this.loadingBatches.set(false);
      },
      error: () => {
        this.paymentBatches.set([]);
        this.loadingBatches.set(false);
      },
    });
  }

  openBatchModal(): void {
    const defaultAccId = this.bankAccounts()[0]?.id || '';
    this.batchForm.reset({
      bank_account_id: defaultAccId,
      batch_reference: 'DIST-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-4),
      payment_method: 'sepa_credit_transfer',
      recipient_name: '',
      recipient_iban: '',
      amount: 0,
      remittance_reference: '',
    });
    this.batchModalVisible.set(true);
  }

  submitBatch(): void {
    if (this.batchForm.invalid) {
      this.batchForm.markAllAsTouched();
      return;
    }

    const val = this.batchForm.getRawValue();
    const payload: CreatePaymentBatchPayload = {
      bank_account_id: val.bank_account_id,
      batch_reference: val.batch_reference,
      payment_method: val.payment_method,
      lines: [
        {
          recipient_name: val.recipient_name,
          recipient_iban: val.recipient_iban,
          amount: val.amount,
          remittance_reference: val.remittance_reference || undefined,
        },
      ],
    };

    this.treasuryApi.createPaymentBatch(payload).subscribe({
      next: (res) => {
        this.batchModalVisible.set(false);
        this.message.success(this.translate.instant('treasury.msgDistintaCreata', { batch_reference: res.data.batch_reference }));
        this.loadPaymentBatches();
      },
      error: () => {
        this.message.error(this.translate.instant('treasury.msgErroreDuranteLaCreazioneDellaDistinta'));
      },
    });
  }

  submitBatchApproval(batch: PaymentBatchResource): void {
    this.treasuryApi.submitPaymentBatchApproval(batch.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('treasury.msgDistintaInviataPerApprovazione', { batch_reference: batch.batch_reference }));
        this.loadPaymentBatches();
      },
    });
  }

  approveBatch(batch: PaymentBatchResource): void {
    this.treasuryApi.approvePaymentBatch(batch.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('treasury.msgDistintaApprovata', { batch_reference: batch.batch_reference }));
        this.loadPaymentBatches();
      },
    });
  }

  exportBatchXml(batch: PaymentBatchResource): void {
    this.treasuryApi.exportPaymentBatch(batch.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('treasury.msgDistintaEsportataInXmlPain001', { batch_reference: batch.batch_reference }));
        this.loadPaymentBatches();
      },
    });
  }

  downloadBatchXml(batch: PaymentBatchResource): void {
    this.treasuryApi.downloadPaymentBatchXml(batch.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${batch.batch_reference}.xml`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  cancelBatch(batch: PaymentBatchResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('treasury.dlgAnnullareLaDistinta', { batch_reference: batch.batch_reference }),
      nzOkText: this.translate.instant('treasury.dlgAnnullaDistinta'),
      nzOkDanger: true,
      nzCancelText: this.translate.instant('treasury.dlgChiudi'),
      nzOnOk: () => {
        this.treasuryApi.cancelPaymentBatch(batch.id).subscribe({
          next: () => {
            this.message.success(this.translate.instant('treasury.msgDistintaAnnullata'));
            this.loadPaymentBatches();
          },
        });
      },
    });
  }

  // --- Cash Forecasts ---

  loadCashForecasts(): void {
    this.loadingForecasts.set(true);
    this.treasuryApi.getCashForecasts().subscribe({
      next: (res) => {
        this.cashForecasts.set(res.data || []);
        this.loadingForecasts.set(false);
      },
      error: () => {
        this.cashForecasts.set([]);
        this.loadingForecasts.set(false);
      },
    });
  }

  generateForecast(days: number): void {
    this.treasuryApi.generateCashForecast(days).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('treasury.msgPrevisioneDiCassaGenerataPerGiorni', { horizon_days: res.data.horizon_days }));
        this.loadCashForecasts();
      },
      error: () => {
        this.message.error(this.translate.instant('treasury.msgErroreDuranteLaGenerazioneDellaPrevisione'));
      },
    });
  }

  batchStatusColor(status: PaymentBatchStatus): string {
    switch (status) {
      case 'approved':
      case 'executed':
        return 'success';
      case 'pending_approval':
        return 'warning';
      case 'exported':
        return 'processing';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  }
}
