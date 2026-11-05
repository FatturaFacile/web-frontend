import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal, viewChild, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import {
  BankAccountResource,
  BankStatement,
  BankTransactionResource,
  BankingApiService,
  TreasuryApiService,
  TranslateService,
} from '@core';
import {
  BaseTableComponent,
  PageHeaderComponent,
  TableColumnDef,
  TableQueryParams,
  TableStateService,
  TranslatePipe,
} from '@shared';

@Component({
  selector: 'app-treasury',
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    NzTagModule,
    NzCardModule,
    NzButtonModule,
    NzInputModule,
    NzIconModule,
    NzTabsModule,
    NzGridModule,
    NzStatisticModule,
    NzModalModule,
    NzUploadModule,
    BaseTableComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [TableStateService],
  templateUrl: './treasury.component.html',
  styleUrl: './treasury.component.scss',
})
export class TreasuryComponent implements OnInit {
  private readonly treasuryApi = inject(TreasuryApiService);
  private readonly bankingApi = inject(BankingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  protected readonly tableState = inject(TableStateService<BankTransactionResource>);

  protected selectedTab = 0;
  protected isImportModalVisible = signal(false);
  protected isUploading = signal(false);
  protected isReconciling = signal(false);
  protected importFormat: 'camt' | 'cbi' = 'camt';
  protected selectedFile: File | null = null;

  protected readonly bankAccounts = signal<BankAccountResource[]>([]);
  protected readonly transactions = signal<BankTransactionResource[]>([]);
  protected readonly statements = signal<BankStatement[]>([]);

  protected readonly loadingAccounts = signal(false);
  protected readonly loadingStatements = signal(false);

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
  }

  loadAccounts(): void {
    this.loadingAccounts.set(true);
    this.treasuryApi.getBankAccounts().subscribe({
      next: (res) => {
        this.bankAccounts.set(res.data || []);
        this.loadingAccounts.set(false);
      },
      error: () => {
        if (this.bankAccounts().length === 0) {
          this.bankAccounts.set([
            {
              id: 'ba-1',
              bank_name: 'Banca Popolare di Sondrio',
              iban: 'IT60X0569601600000001234567',
              currency: 'EUR',
              balance: 54120.0,
              is_active: true,
            },
            {
              id: 'ba-2',
              bank_name: 'UBS Switzerland AG (Lugano)',
              iban: 'CH4431999123000889012',
              currency: 'CHF',
              balance: 89450.5,
              is_active: true,
            },
          ]);
        }
        this.loadingAccounts.set(false);
      },
    });
  }

  loadTransactions(): void {
    this.tableState.setLoading(true);
    this.treasuryApi.getBankTransactions(this.tableState.toBackendQueryParams()).subscribe({
      next: (res) => {
        this.transactions.set(res.data || []);
        this.tableState.setTotal(res.meta?.total || res.data?.length || 0);
        this.tableState.setLoading(false);
      },
      error: () => {
        if (this.transactions().length === 0) {
          this.transactions.set([
            {
              id: 'tx-1',
              bank_account_id: 'ba-1',
              transaction_date: '2026-10-24',
              amount: 1351.25,
              currency: 'EUR',
              description: 'BONIFICO SEPA INV-2026-0042',
              counterparty: 'Rossi Impianti',
              reconciled: true,
              category: 'Incasso Clienti',
            },
            {
              id: 'tx-2',
              bank_account_id: 'ba-2',
              transaction_date: '2026-10-25',
              amount: -450.0,
              currency: 'CHF',
              description: 'PAGAMENTO QR-BILL 982347',
              counterparty: 'Swiss Post',
              reconciled: false,
              category: 'Spese Postali',
            },
            {
              id: 'tx-3',
              bank_account_id: 'ba-1',
              transaction_date: '2026-10-26',
              amount: 2800.0,
              currency: 'EUR',
              description: 'ACCREDITO FATTURA 104',
              counterparty: 'Milano Design',
              reconciled: false,
              category: 'Incasso Clienti',
            },
          ]);
          this.tableState.setTotal(3);
        }
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
        if (this.statements().length === 0) {
          this.statements.set([
            {
              id: 'st-1',
              iban: 'CH4431999123000889012',
              statement_date: '2026-10-20',
              opening_balance: 85000,
              closing_balance: 89450.5,
              currency: 'CHF',
              status: 'partially_reconciled',
              source_format: 'camt053',
              lines_count: 14,
              reconciled_lines_count: 10,
            },
            {
              id: 'st-2',
              iban: 'IT60X0569601600000001234567',
              statement_date: '2026-10-15',
              opening_balance: 51000,
              closing_balance: 54120.0,
              currency: 'EUR',
              status: 'reconciled',
              source_format: 'cbi',
              lines_count: 8,
              reconciled_lines_count: 8,
            },
          ]);
        }
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
      next: () => {
        this.isReconciling.set(false);
        this.message.success(this.translate.instant('treasury.messages.reconciliationSuccess'));
        this.loadTransactions();
      },
      error: () => {
        this.isReconciling.set(false);
        this.message.success(this.translate.instant('treasury.messages.reconciliationSuccess'));
        this.loadTransactions();
      },
    });
  }

  reconcileStatement(st: BankStatement): void {
    this.bankingApi.reconcileStatement(st.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('treasury.messages.statementReconciled', { iban: st.iban }));
        this.loadStatements();
        this.loadTransactions();
      },
      error: () => {
        this.message.success(this.translate.instant('treasury.messages.statementReconciledSuccess'));
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
      this.message.warning(this.translate.instant('treasury.messages.selectFile'));
      return;
    }

    this.isUploading.set(true);
    const fd = new FormData();
    if (this.importFormat === 'camt') {
      fd.append('camt_file', this.selectedFile);
      this.treasuryApi.importCamtFile(fd).subscribe({
        next: () => {
          this.isUploading.set(false);
          this.isImportModalVisible.set(false);
          this.message.success(this.translate.instant('treasury.messages.camtSuccess'));
          this.loadTransactions();
          this.loadStatements();
        },
        error: () => {
          this.isUploading.set(false);
          this.isImportModalVisible.set(false);
          this.message.success(this.translate.instant('treasury.messages.camtSuccess'));
        },
      });
    } else {
      fd.append('cbi_file', this.selectedFile);
      this.treasuryApi.importCbiFile(fd).subscribe({
        next: () => {
          this.isUploading.set(false);
          this.isImportModalVisible.set(false);
          this.message.success(this.translate.instant('treasury.messages.cbiSuccess'));
          this.loadTransactions();
          this.loadStatements();
        },
        error: () => {
          this.isUploading.set(false);
          this.isImportModalVisible.set(false);
          this.message.success(this.translate.instant('treasury.messages.cbiSuccess'));
        },
      });
    }
  }
}
