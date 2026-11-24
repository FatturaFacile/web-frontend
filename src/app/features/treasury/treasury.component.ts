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
import { NzDividerModule } from 'ng-zorro-antd/divider';
import {
  BankAccountResource,
  BankStatement,
  BankTransactionResource,
  BankingApiService,
  BillingApiService,
  CashForecastResource,
  CreateBankAccountPayload,
  FetchGridModel,
  CreatePaymentBatchPayload,
  PaymentBatchResource,
  PaymentBatchStatus,
  PaymentMethodType,
  TreasuryApiService,
  TranslateService,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, MoneyPipe, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { ibanValidator } from '@shared/utils/iban-validator';
import { validationTipKey } from '@shared/utils/validation-tip';

@Component({
  selector: 'app-treasury',
  styleUrl: './treasury.component.scss',
  imports: [
    IconActionDirective,
    ModalActionsDirective,
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
    NzDividerModule,
    BaseTableComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
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

  protected selectedTab = 0;
  protected isImportModalVisible = signal(false);
  protected isUploading = signal(false);
  protected isReconciling = signal(false);
  protected importFormat: 'camt' | 'cbi' = 'camt';
  protected readonly selectedFile = signal<File | null>(null);

  /** Server-driven grids: paging, sorting, column filters and grouping run on the API. */
  protected readonly txGrid = new FetchGridModel<BankTransactionResource>((query) => this.treasuryApi.getBankTransactions(query));
  protected readonly accountsGrid = new FetchGridModel<BankAccountResource>((query) => this.treasuryApi.getBankAccounts(query));
  protected readonly statementsGrid = new FetchGridModel<BankStatement>((query) => this.bankingApi.getBankStatements(query));
  protected readonly batchesGrid = new FetchGridModel<PaymentBatchResource>((query) => this.treasuryApi.getPaymentBatches(query));
  protected readonly forecastsGrid = new FetchGridModel<CashForecastResource>((query) => this.treasuryApi.getCashForecasts(query));

  // Bank accounts (all of them: balance totals and the batch account picker are not paged)
  protected readonly bankAccounts = signal<BankAccountResource[]>([]);
  readonly accountModalVisible = signal(false);

  /** Transactions still to reconcile over the whole dataset (not only the loaded page). */
  readonly unreconciledCount = signal(0);

  // Payment Batches
  readonly batchModalVisible = signal(false);

  // KPIs
  readonly totalEurBalance = computed(() => {
    return this.bankAccounts()
      .filter((a) => a.currency === 'EUR')
      .reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0);
  });

  protected readonly totalChfBalance = computed(() => {
    return this.bankAccounts()
      .filter((a) => a.currency === 'CHF')
      .reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0);
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
  private readonly txStatusTpl = viewChild<TemplateRef<unknown>>('txStatusTpl');
  private readonly statusTpl = viewChild<TemplateRef<unknown>>('statusTpl');
  private readonly batchRefTpl = viewChild<TemplateRef<unknown>>('batchRefTpl');
  private readonly batchMethodTpl = viewChild<TemplateRef<unknown>>('batchMethodTpl');
  private readonly batchAmountTpl = viewChild<TemplateRef<unknown>>('batchAmountTpl');
  private readonly batchStatusTpl = viewChild<TemplateRef<unknown>>('batchStatusTpl');
  private readonly forecastAmountTpl = viewChild<TemplateRef<unknown>>('forecastAmountTpl');
  private readonly forecastRiskTpl = viewChild<TemplateRef<unknown>>('forecastRiskTpl');

  readonly txColumns = computed<TableColumnDef<BankTransactionResource>[]>(() => [
    {
      key: 'booking_date',
      header: 'treasury.columns.valueDate',
      width: '120px',
      customCellTemplate: this.dateTpl(),
    },
    {
      key: 'description',
      header: 'treasury.columns.description',
      width: '320px',
    },
    {
      key: 'reference',
      header: 'treasury.columns.reference',
      width: '200px',
    },
    {
      key: 'bank_account',
      serverKey: 'bankAccount.bank_name',
      valueGetter: (row) => row.bank_account?.bank_name,
      header: 'treasury.columns.bankAccount',
      width: '200px',
    },
    {
      key: 'amount',
      header: 'treasury.columns.amount',
      width: '140px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'status',
      valueGetter: (row) => this.transactionStatusLabel(row.status),
      valueLabel: (value) => this.transactionStatusLabel(value),
      header: 'treasury.columns.status',
      width: '180px',
      customCellTemplate: this.txStatusTpl(),
    },
  ]);

  readonly accountColumns = computed<TableColumnDef<BankAccountResource>[]>(() => [
    {
      key: 'bank_name',
      header: 'treasury.columns.bankName',
      width: '220px',
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
      key: 'available_balance',
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
      key: 'account_iban',
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
      valueGetter: (row) => this.statementStatusLabel(row.status),
      valueLabel: (value) => this.statementStatusLabel(value),
      header: 'treasury.columns.reconciliationStatus',
      width: '170px',
      customCellTemplate: this.statusTpl(),
    },
  ]);

  readonly batchColumns = computed<TableColumnDef<PaymentBatchResource>[]>(() => [
    { key: 'batch_reference', header: 'treasury.lblRiferimentoDistinta', customCellTemplate: this.batchRefTpl() },
    { key: 'payment_method', header: 'treasury.lblMetodoPagamento', customCellTemplate: this.batchMethodTpl() },
    { key: 'execution_date', header: 'treasury.lblDataEsecuzione', customCellTemplate: this.dateTpl() },
    { key: 'total_amount', header: 'treasury.lblImportoTotale', align: 'right', customCellTemplate: this.batchAmountTpl() },
    { key: 'status', header: 'treasury.lblStato', customCellTemplate: this.batchStatusTpl() },
  ]);

  readonly forecastColumns = computed<TableColumnDef<CashForecastResource>[]>(() => [
    { key: 'calculation_date', header: 'treasury.lblDataAnalisi', customCellTemplate: this.dateTpl() },
    { key: 'horizon_days', header: 'treasury.lblOrizzonteGiorni' },
    { key: 'opening_cash_balance', header: 'treasury.lblCassaIniziale', align: 'right', customCellTemplate: this.forecastAmountTpl() },
    { key: 'projected_inflows', header: 'treasury.lblEntratePreviste', align: 'right', customCellTemplate: this.forecastAmountTpl() },
    { key: 'projected_outflows', header: 'treasury.lblUscitePreviste', align: 'right', customCellTemplate: this.forecastAmountTpl() },
    { key: 'closing_cash_balance', header: 'treasury.lblSaldoFinalePrevisto', align: 'right', customCellTemplate: this.forecastAmountTpl() },
    {
      key: 'deficit_detected',
      serverKey: 'risk_state',
      valueGetter: (row) => this.forecastRiskLabel(row.deficit_detected ? 'deficit' : 'covered'),
      valueLabel: (value) => this.forecastRiskLabel(value),
      header: 'treasury.lblRischioDeficit',
      customCellTemplate: this.forecastRiskTpl(),
    },
  ]);

  protected transactionStatusLabel(status: string | null | undefined): string {
    return this.translate.instant('treasury.transactionStatus.' + status);
  }

  protected statementStatusLabel(status: string | null | undefined): string {
    return this.translate.instant('treasury.statementStatus.' + status);
  }

  protected forecastRiskLabel(state: string): string {
    return this.translate.instant('treasury.forecastRisk.' + state);
  }

  ngOnInit(): void {
    this.loadAccounts();
    this.refreshUnreconciledCount();
  }

  // --- Bank Accounts ---

  /** Reloads the account list used by the balance totals and the batch picker, and the accounts grid. */
  loadAccounts(): void {
    this.accountsGrid.reload();
    this.treasuryApi.getBankAccounts().subscribe({
      next: (res) => this.bankAccounts.set(res.data || []),
      error: () => this.bankAccounts.set([]),
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
    this.txGrid.reload();
    this.refreshUnreconciledCount();
  }

  loadStatements(): void {
    this.statementsGrid.reload();
  }

  onSearchChange(search: string): void {
    this.txGrid.setFilter({ search: search || undefined });
  }

  /** Counts the transactions still to reconcile over the whole dataset, not only the loaded page. */
  private refreshUnreconciledCount(): void {
    this.txGrid.loadValues('status').subscribe((values) => {
      this.unreconciledCount.set(values.find((v) => v.value === 'unmatched')?.count ?? 0);
    });
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
      this.selectedFile.set(input.files[0]);
    }
  }

  submitImport(): void {
    const file = this.selectedFile();
    if (!file) {
      this.message.warning(this.translate.instant('treasury.msgSelezionaUnFileDaImportare'));
      return;
    }

    this.isUploading.set(true);
    const fd = new FormData();
    if (this.importFormat === 'camt') {
      // CAMT goes through the payment import (`/sales/payment-imports`); it auto-matches credits to open invoices.
      this.billingApi.uploadPaymentImport(file).subscribe({
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
      fd.append('file', file);
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
    this.batchesGrid.reload();
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
    this.forecastsGrid.reload();
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
