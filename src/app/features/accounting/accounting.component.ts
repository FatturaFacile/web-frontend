import { DatePipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal, viewChild, TemplateRef } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  AccountType,
  AccountingApiService,
  CalculateTaxSettlementPayload,
  ChartOfAccount,
  FiscalPeriodResource,
  GeneralLedgerFiscalApiService,
  IntrastatDeclarationResource,
  JournalEntryResource,
  TaxSettlementResource,
  TrialBalanceReport,
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
import { LedgerEntryFormDrawerComponent } from './components/ledger-entry-form-drawer.component';

@Component({
  selector: 'app-accounting',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    JsonPipe,
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
    NzTableModule,
    NzDividerModule,
    BaseTableComponent,
    PageHeaderComponent,
    LedgerEntryFormDrawerComponent,
    TranslatePipe,
  ],
  providers: [TableStateService],
  templateUrl: './accounting.component.html',
  styleUrl: './accounting.component.scss',
})
export class AccountingComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  private readonly fiscalApi = inject(GeneralLedgerFiscalApiService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly tableState = inject(TableStateService<JournalEntryResource>);

  protected selectedTab = 0;
  protected readonly drawerOpen = signal(false);

  // Core Data Signals
  protected readonly ledgerEntries = signal<JournalEntryResource[]>([]);
  protected readonly chartOfAccounts = signal<ChartOfAccount[]>([]);
  protected readonly vatSettlements = signal<TaxSettlementResource[]>([]);
  protected readonly vatAnnualReconciliation = signal<Record<string, unknown> | null>(null);
  protected readonly fiscalPeriods = signal<FiscalPeriodResource[]>([]);
  protected readonly intrastatDeclarations = signal<IntrastatDeclarationResource[]>([]);
  protected readonly trialBalance = signal<TrialBalanceReport | null>(null);

  // Loaders
  protected readonly loadingCoa = signal(false);
  protected readonly loadingVat = signal(false);
  protected readonly loadingPeriods = signal(false);
  protected readonly loadingIntrastat = signal(false);
  protected readonly loadingTrialBalance = signal(false);

  // Modals
  protected readonly accountModalVisible = signal(false);
  protected readonly calcVatModalVisible = signal(false);
  protected readonly intrastatModalVisible = signal(false);

  // Forms
  readonly accountForm = this.fb.group({
    code: this.fb.control('', [Validators.required]),
    name: this.fb.control('', [Validators.required]),
    type: this.fb.control<AccountType>('asset', [Validators.required]),
    currency: this.fb.control('EUR', [Validators.required]),
  });

  readonly calcVatForm = this.fb.group({
    period_type: this.fb.control<'monthly' | 'quarterly'>('monthly', [Validators.required]),
    year: this.fb.control(new Date().getFullYear(), [Validators.required, Validators.min(2000)]),
    period: this.fb.control(new Date().getMonth() + 1, [Validators.required, Validators.min(1), Validators.max(12)]),
  });

  readonly intrastatForm = this.fb.group({
    year: this.fb.control(new Date().getFullYear(), [Validators.required]),
    period: this.fb.control(new Date().getMonth() + 1, [Validators.required]),
    direction: this.fb.control<'dispatch' | 'arrival' | 'both'>('dispatch', [Validators.required]),
  });

  private readonly dateTpl = viewChild<TemplateRef<unknown>>('dateTpl');
  private readonly currencyTpl = viewChild<TemplateRef<unknown>>('currencyTpl');
  private readonly accountTypeTpl = viewChild<TemplateRef<unknown>>('accountTypeTpl');
  private readonly vatStatusTpl = viewChild<TemplateRef<unknown>>('vatStatusTpl');


  readonly ledgerColumns = computed<TableColumnDef<JournalEntryResource>[]>(() => [
    {
      key: 'entry_number',
      header: 'accounting.columns.entryNumber',
      width: '180px',
      sortable: true,
    },
    {
      key: 'posting_date',
      header: 'accounting.columns.date',
      width: '130px',
      sortable: true,
      customCellTemplate: this.dateTpl(),
    },
    {
      key: 'description',
      header: 'accounting.columns.description',
      width: '320px',
    },
    {
      key: 'status',
      header: 'accounting.columns.status',
      width: '120px',
    },
    {
      key: 'total_debit',
      header: 'accounting.columns.totalDebit',
      width: '140px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'total_credit',
      header: 'accounting.columns.totalCredit',
      width: '140px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
  ]);

  readonly coaColumns = computed<TableColumnDef<ChartOfAccount>[]>(() => [
    {
      key: 'code',
      header: 'accounting.columns.accountCode',
      width: '140px',
      sortable: true,
    },
    {
      key: 'name',
      header: 'accounting.columns.accountName',
      width: '300px',
      sortable: true,
    },
    {
      key: 'type',
      header: 'accounting.columns.accountType',
      width: '140px',
      customCellTemplate: this.accountTypeTpl(),
    },
    {
      key: 'balance',
      header: 'accounting.columns.currentBalance',
      width: '160px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
  ]);

  readonly vatColumns = computed<TableColumnDef<TaxSettlementResource>[]>(() => [
    {
      key: 'period',
      header: 'accounting.columns.period',
      width: '140px',
    },
    {
      key: 'year',
      header: 'accounting.columns.year',
      width: '100px',
    },
    {
      key: 'period_type',
      header: 'accounting.columns.jurisdiction',
      width: '120px',
    },
    {
      key: 'vat_payable',
      header: 'accounting.columns.vatCollected',
      width: '180px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'vat_receivable',
      header: 'accounting.columns.vatPaid',
      width: '180px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'balance',
      header: 'accounting.columns.vatBalance',
      width: '150px',
      align: 'right',
      customCellTemplate: this.currencyTpl(),
    },
    {
      key: 'status',
      header: 'accounting.columns.status',
      width: '120px',
      customCellTemplate: this.vatStatusTpl(),
    },
  ]);

  ngOnInit(): void {
    this.loadLedgerEntries();
    this.loadChartOfAccounts();
    this.loadVatSettlements();
    this.loadFiscalPeriods();
    this.loadIntrastat();
    this.loadTrialBalance();
  }

  onTabChange(index: number): void {
    if (index === 1 && this.chartOfAccounts().length === 0) {
      this.loadChartOfAccounts();
    } else if (index === 2 && this.vatSettlements().length === 0) {
      this.loadVatSettlements();
    } else if (index === 3 && this.fiscalPeriods().length === 0) {
      this.loadFiscalPeriods();
    } else if (index === 4 && this.intrastatDeclarations().length === 0) {
      this.loadIntrastat();
    } else if (index === 5 && !this.trialBalance()) {
      this.loadTrialBalance();
    }
  }

  // --- Journals ---

  loadLedgerEntries(): void {
    this.tableState.setLoading(true);
    this.api.getJournals(this.tableState.toBackendQueryParams()).subscribe({
      next: (res) => {
        const data = (res.data || []).map((e) => ({
          ...e,
          total_debit: e.lines?.reduce((s, l) => s + (Number(l.debit_amount) || 0), 0) || 0,
          total_credit: e.lines?.reduce((s, l) => s + (Number(l.credit_amount) || 0), 0) || 0,
        }));
        this.ledgerEntries.set(data);
        this.tableState.setTotal(res.meta?.total || data.length);
        this.tableState.setLoading(false);
      },
      error: () => {
        this.ledgerEntries.set([]);
        this.tableState.setTotal(0);
        this.tableState.setLoading(false);
      },
    });
  }

  postJournal(journal: JournalEntryResource): void {
    this.api.postJournal(journal.id).subscribe({
      next: () => {
        this.message.success(`Scrittura ${journal.entry_number} contabilizzata a libro giornale`);
        this.loadLedgerEntries();
      },
      error: () => {
        this.message.error('Errore durante la contabilizzazione della scrittura');
      },
    });
  }

  reverseJournal(journal: JournalEntryResource): void {
    this.modal.confirm({
      nzTitle: `Stornare la scrittura ${journal.entry_number}?`,
      nzOkText: 'Storna Scrittura',
      nzOkDanger: true,
      nzCancelText: 'Annulla',
      nzOnOk: () => {
        this.api.reverseJournal(journal.id).subscribe({
          next: () => {
            this.message.success(`Scrittura ${journal.entry_number} stornata con successo`);
            this.loadLedgerEntries();
          },
          error: () => {
            this.message.error('Errore durante lo storno');
          },
        });
      },
    });
  }

  // --- Chart of Accounts ---

  loadChartOfAccounts(): void {
    this.loadingCoa.set(true);
    this.api.getAccounts().subscribe({
      next: (res) => {
        this.chartOfAccounts.set(res.data || []);
        this.loadingCoa.set(false);
      },
      error: () => {
        this.chartOfAccounts.set([]);
        this.loadingCoa.set(false);
      },
    });
  }

  openAccountModal(): void {
    this.accountForm.reset({
      code: '',
      name: '',
      type: 'asset',
      currency: 'EUR',
    });
    this.accountModalVisible.set(true);
  }

  submitAccount(): void {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      return;
    }

    const payload = this.accountForm.getRawValue();
    this.api.createAccount(payload).subscribe({
      next: () => {
        this.accountModalVisible.set(false);
        this.message.success('Conto mastro inserito nel Piano dei Conti');
        this.loadChartOfAccounts();
      },
      error: () => {
        this.message.error('Errore durante la creazione del conto');
      },
    });
  }

  // --- VAT & Tax Settlements ---

  loadVatSettlements(): void {
    this.loadingVat.set(true);
    this.api.getTaxSettlements().subscribe({
      next: (res) => {
        this.vatSettlements.set(res.data || []);
        this.loadingVat.set(false);
      },
      error: () => {
        this.vatSettlements.set([]);
        this.loadingVat.set(false);
      },
    });
  }

  openCalcVatModal(): void {
    this.calcVatForm.reset({
      period_type: 'monthly',
      year: new Date().getFullYear(),
      period: new Date().getMonth() + 1,
    });
    this.calcVatModalVisible.set(true);
  }

  submitCalculateVat(): void {
    if (this.calcVatForm.invalid) {
      this.calcVatForm.markAllAsTouched();
      return;
    }

    const payload: CalculateTaxSettlementPayload = this.calcVatForm.getRawValue();
    this.api.calculateTaxSettlement(payload).subscribe({
      next: (res) => {
        this.calcVatModalVisible.set(false);
        this.message.success(`Liquidazione IVA calcolata: saldo € ${res.data.balance}`);
        this.loadVatSettlements();
      },
      error: () => {
        this.message.error('Errore durante il calcolo della liquidazione IVA');
      },
    });
  }

  postVatSettlement(settlement: TaxSettlementResource): void {
    this.api.postTaxSettlement(settlement.id).subscribe({
      next: () => {
        this.message.success('Liquidazione IVA registrata a libro giornale');
        this.loadVatSettlements();
      },
    });
  }

  payVatSettlement(settlement: TaxSettlementResource): void {
    this.api.payTaxSettlement(settlement.id).subscribe({
      next: () => {
        this.message.success('Pagamento IVA registrato (modello F24 / debito estinto)');
        this.loadVatSettlements();
      },
    });
  }

  downloadSwissEstvXml(settlement: TaxSettlementResource): void {
    this.fiscalApi.downloadSwissEstvXml(settlement.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `estv-vat-${settlement.year}-${settlement.period}.xml`;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.message.error('Errore durante il download XML ESTV eCH-0217'),
    });
  }

  loadVatAnnualReconciliation(year = new Date().getFullYear()): void {
    this.fiscalApi.getVatAnnualReconciliation(year).subscribe({
      next: (res) => {
        this.vatAnnualReconciliation.set(res.data);
        this.message.success(`Riconciliazione annuale IVA ${year} (Art. 72 LIVA) calcolata`);
      },
      error: () => this.message.error('Errore nel calcolo della riconciliazione annuale IVA'),
    });
  }

  // --- Fiscal Periods ---

  loadFiscalPeriods(): void {
    this.loadingPeriods.set(true);
    this.api.getFiscalPeriods().subscribe({
      next: (res) => {
        this.fiscalPeriods.set(res.data || []);
        this.loadingPeriods.set(false);
      },
      error: () => {
        this.fiscalPeriods.set([]);
        this.loadingPeriods.set(false);
      },
    });
  }

  closePeriod(period: FiscalPeriodResource): void {
    this.modal.confirm({
      nzTitle: `Chiudere definitivamente il periodo fiscale ${period.name}?`,
      nzContent: 'La chiusura bloccherà nuove registrazioni contabili con data appartenente a questo intervallo.',
      nzOkText: 'Chiudi Periodo',
      nzOkDanger: true,
      nzCancelText: 'Annulla',
      nzOnOk: () => {
        this.api.closeFiscalPeriod(period.id).subscribe({
          next: () => {
            this.message.success(`Periodo ${period.name} chiuso`);
            this.loadFiscalPeriods();
          },
        });
      },
    });
  }

  reopenPeriod(period: FiscalPeriodResource): void {
    this.modal.confirm({
      nzTitle: `Riaprire il periodo fiscale ${period.name}?`,
      nzOkText: 'Riapri Periodo',
      nzCancelText: 'Annulla',
      nzOnOk: () => {
        this.api.reopenFiscalPeriod(period.id).subscribe({
          next: () => {
            this.message.success(`Periodo ${period.name} riaperto`);
            this.loadFiscalPeriods();
          },
        });
      },
    });
  }

  // --- Intrastat ---

  loadIntrastat(): void {
    this.loadingIntrastat.set(true);
    this.api.getIntrastatDeclarations().subscribe({
      next: (res) => {
        this.intrastatDeclarations.set(res.data || []);
        this.loadingIntrastat.set(false);
      },
      error: () => {
        this.intrastatDeclarations.set([]);
        this.loadingIntrastat.set(false);
      },
    });
  }

  openIntrastatModal(): void {
    this.intrastatForm.reset({
      year: new Date().getFullYear(),
      period: new Date().getMonth() + 1,
      direction: 'dispatch',
    });
    this.intrastatModalVisible.set(true);
  }

  submitGenerateIntrastat(): void {
    if (this.intrastatForm.invalid) {
      this.intrastatForm.markAllAsTouched();
      return;
    }

    const val = this.intrastatForm.getRawValue();
    this.api.generateIntrastatDeclaration(val.year, val.period, val.direction).subscribe({
      next: (res) => {
        this.intrastatModalVisible.set(false);
        this.message.success(`Dichiarazione Intrastat ${res.data.declaration_number} generata`);
        this.loadIntrastat();
      },
      error: () => {
        this.message.error('Errore durante la generazione Intrastat');
      },
    });
  }

  validateIntrastat(dec: IntrastatDeclarationResource): void {
    this.api.validateIntrastatDeclaration(dec.id).subscribe({
      next: (res) => {
        if (res.data.is_valid) {
          this.message.success('Dichiarazione Intrastat valida formalmente per Agenzia Dogane');
        } else {
          this.message.warning(`Errori riscontrati: ${(res.data.errors || []).join(', ')}`);
        }
        this.loadIntrastat();
      },
    });
  }

  submitIntrastat(dec: IntrastatDeclarationResource): void {
    this.api.submitIntrastatDeclaration(dec.id).subscribe({
      next: () => {
        this.message.success(`Dichiarazione Intrastat ${dec.declaration_number} trasmessa telematicamente`);
        this.loadIntrastat();
      },
    });
  }

  // --- Trial Balance ---

  loadTrialBalance(year = new Date().getFullYear()): void {
    this.loadingTrialBalance.set(true);
    this.api.getTrialBalance(year).subscribe({
      next: (res) => {
        this.trialBalance.set(res.data);
        this.loadingTrialBalance.set(false);
      },
      error: () => {
        this.trialBalance.set(null);
        this.loadingTrialBalance.set(false);
      },
    });
  }

  onSearchChange(search: string): void {
    this.tableState.setSearch(search);
    this.loadLedgerEntries();
  }

  onParamsChange(params: TableQueryParams): void {
    this.tableState.setPage(params.pageIndex);
    this.tableState.setPageSize(params.pageSize);
    if (params.sort) {
      this.tableState.setSort(params.sort.key, params.sort.order);
    }
    this.loadLedgerEntries();
  }

  getAccountTypeColor(type: string): string {
    switch (type) {
      case 'asset':
        return 'blue';
      case 'liability':
        return 'volcano';
      case 'equity':
        return 'purple';
      case 'revenue':
        return 'green';
      case 'expense':
        return 'orange';
      default:
        return 'default';
    }
  }
}
