import { DatePipe, JsonPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal, viewChild, TemplateRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import {
  AccountType,
  AccountingApiService,
  CalculateTaxSettlementPayload,
  ChartOfAccount,
  FiscalPeriodResource,
  GeneralLedgerFiscalApiService,
  IntrastatDeclarationResource,
  IntrastatFlow,
  IntrastatPeriodicity,
  JournalEntryResource,
  NormalBalance,
  TaxSettlementResource,
  TrialBalanceReport,
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
import { notInFuture } from '@shared/utils/date-validators';
import { validationTipKey } from '@shared/utils/validation-tip';
import { LedgerEntryFormDrawerComponent } from './components/ledger-entry-form-drawer.component';

/** Assets and expenses grow on the debit side, everything else on the credit side. */
function defaultNormalBalance(type: AccountType): NormalBalance {
  return type === 'asset' || type === 'expense' ? 'debit' : 'credit';
}

/** First year the API accepts for an Intrastat list. */
const INTRASTAT_FIRST_YEAR = 2022;

@Component({
  selector: 'app-accounting',
  styleUrl: './accounting.component.scss',
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
    NzDatePickerModule,
    NzTableModule,
    NzDividerModule,
    BaseTableComponent,
    PageHeaderComponent,
    LedgerEntryFormDrawerComponent,
    TranslatePipe,
  ],
  providers: [TableStateService],
  templateUrl: './accounting.component.html',
})
export class AccountingComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly api = inject(AccountingApiService);
  private readonly fiscalApi = inject(GeneralLedgerFiscalApiService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
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
  protected readonly intrastatSubmitTarget = signal<IntrastatDeclarationResource | null>(null);

  /** The error text of a control of the account, VAT and Intrastat forms. */
  tip(control: AbstractControl): string {
    const key = validationTipKey(control);
    return key ? this.translate.instant(key) : '';
  }

  // Forms
  readonly accountForm = this.fb.group({
    account_code: this.fb.control('', [Validators.required, Validators.maxLength(50)]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    account_type: this.fb.control<AccountType>('asset', [Validators.required]),
    normal_balance: this.fb.control<NormalBalance>('debit', [Validators.required]),
    currency: this.fb.control('EUR'),
  });

  readonly calcVatForm = this.fb.group({
    period_type: this.fb.control<'monthly' | 'quarterly'>('monthly'),
    year: this.fb.control(new Date().getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]),
    period: this.fb.control(new Date().getMonth() + 1, [Validators.required, Validators.min(1), Validators.max(12)]),
  });

  readonly intrastatForm = this.fb.group({
    flow: this.fb.control<IntrastatFlow>('sales', [Validators.required]),
    year: this.fb.control(new Date().getFullYear(), [Validators.required, Validators.min(INTRASTAT_FIRST_YEAR), Validators.max(2099)]),
    periodicity: this.fb.control<IntrastatPeriodicity>('M', [Validators.required]),
    period: this.fb.control(new Date().getMonth() + 1, [Validators.required, Validators.min(1), Validators.max(12)]),
  });

  /** Protocol assigned by the receiving channel, asked when a validated list is marked as submitted. */
  readonly intrastatSubmitForm = this.fb.group({
    protocol_number: this.fb.control('', [Validators.required, Validators.maxLength(30)]),
    submitted_at: this.fb.control<Date | null>(null, [notInFuture]),
  });

  constructor() {
    this.accountForm.controls.account_type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => this.accountForm.controls.normal_balance.setValue(defaultNormalBalance(type)));

    // A quarterly list has periods 1 to 4, and the INTRA-2 purchases lists are monthly only.
    this.intrastatForm.controls.flow.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((flow) => {
      if (flow === 'purchases') {
        this.intrastatForm.controls.periodicity.setValue('M');
      }
    });
    this.intrastatForm.controls.periodicity.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((periodicity) => {
      const period = this.intrastatForm.controls.period;
      period.setValidators([Validators.required, Validators.min(1), Validators.max(periodicity === 'T' ? 4 : 12)]);
      period.updateValueAndValidity();
    });
  }

  private readonly dateTpl = viewChild<TemplateRef<unknown>>('dateTpl');
  private readonly currencyTpl = viewChild<TemplateRef<unknown>>('currencyTpl');
  private readonly accountTypeTpl = viewChild<TemplateRef<unknown>>('accountTypeTpl');
  private readonly normalBalanceTpl = viewChild<TemplateRef<unknown>>('normalBalanceTpl');
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
      key: 'account_code',
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
      key: 'account_type',
      header: 'accounting.columns.accountType',
      width: '140px',
      customCellTemplate: this.accountTypeTpl(),
    },
    {
      key: 'normal_balance',
      header: 'accounting.columns.normalBalance',
      width: '160px',
      customCellTemplate: this.normalBalanceTpl(),
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
        this.message.success(this.translate.instant('accounting.msgScritturaContabilizzataALibroGiornale', { entry_number: journal.entry_number }));
        this.loadLedgerEntries();
      },
      error: () => {
        this.message.error(this.translate.instant('accounting.msgErroreDuranteLaContabilizzazioneDellaScrittura'));
      },
    });
  }

  reverseJournal(journal: JournalEntryResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('accounting.dlgStornareLaScrittura', { entry_number: journal.entry_number }),
      nzOkText: this.translate.instant('accounting.dlgStornaScrittura'),
      nzOkDanger: true,
      nzCancelText: this.translate.instant('accounting.dlgAnnulla'),
      nzOnOk: () => {
        this.api.reverseJournal(journal.id).subscribe({
          next: () => {
            this.message.success(this.translate.instant('accounting.msgScritturaStornataConSuccesso', { entry_number: journal.entry_number }));
            this.loadLedgerEntries();
          },
          error: () => {
            this.message.error(this.translate.instant('accounting.msgErroreDuranteLoStorno'));
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
      account_code: '',
      name: '',
      account_type: 'asset',
      normal_balance: 'debit',
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
        this.message.success(this.translate.instant('accounting.msgContoMastroInseritoNelPianoDei'));
        this.loadChartOfAccounts();
      },
      error: () => {
        this.message.error(this.translate.instant('accounting.msgErroreDuranteLaCreazioneDelConto'));
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
        this.message.success(this.translate.instant('accounting.msgLiquidazioneIvaCalcolataSaldo', { balance: res.data.balance }));
        this.loadVatSettlements();
      },
      error: () => {
        this.message.error(this.translate.instant('accounting.msgErroreDuranteIlCalcoloDellaLiquidazione'));
      },
    });
  }

  postVatSettlement(settlement: TaxSettlementResource): void {
    this.api.postTaxSettlement(settlement.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('accounting.msgLiquidazioneIvaRegistrataALibroGiornale'));
        this.loadVatSettlements();
      },
    });
  }

  payVatSettlement(settlement: TaxSettlementResource): void {
    this.api.payTaxSettlement(settlement.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('accounting.msgPagamentoIvaRegistratoModelloF24Debito'));
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
      error: () => this.message.error(this.translate.instant('accounting.msgErroreDuranteIlDownloadXmlEstv')),
    });
  }

  loadVatAnnualReconciliation(year = new Date().getFullYear()): void {
    this.fiscalApi.getVatAnnualReconciliation(year).subscribe({
      next: (res) => {
        this.vatAnnualReconciliation.set(res.data);
        this.message.success(this.translate.instant('accounting.msgRiconciliazioneAnnualeIvaArt72Liva', { year }));
      },
      error: () => this.message.error(this.translate.instant('accounting.msgErroreNelCalcoloDellaRiconciliazioneAnnuale')),
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
      nzTitle: this.translate.instant('accounting.dlgChiudereDefinitivamenteIlPeriodoFiscale', { name: period.name }),
      nzContent: this.translate.instant('accounting.dlgLaChiusuraBloccheraNuoveRegistrazioniContabili'),
      nzOkText: this.translate.instant('accounting.dlgChiudiPeriodo'),
      nzOkDanger: true,
      nzCancelText: this.translate.instant('accounting.dlgAnnulla'),
      nzOnOk: () => {
        this.api.closeFiscalPeriod(period.id).subscribe({
          next: () => {
            this.message.success(this.translate.instant('accounting.msgPeriodoChiuso', { name: period.name }));
            this.loadFiscalPeriods();
          },
        });
      },
    });
  }

  reopenPeriod(period: FiscalPeriodResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('accounting.dlgRiaprireIlPeriodoFiscale', { name: period.name }),
      nzOkText: this.translate.instant('accounting.dlgRiapriPeriodo'),
      nzCancelText: this.translate.instant('accounting.dlgAnnulla'),
      nzOnOk: () => {
        this.api.reopenFiscalPeriod(period.id).subscribe({
          next: () => {
            this.message.success(this.translate.instant('accounting.msgPeriodoRiaperto', { name: period.name }));
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
      flow: 'sales',
      year: new Date().getFullYear(),
      periodicity: 'M',
      period: new Date().getMonth() + 1,
    });
    this.intrastatModalVisible.set(true);
  }

  submitGenerateIntrastat(): void {
    if (this.intrastatForm.invalid) {
      this.intrastatForm.markAllAsTouched();
      return;
    }

    this.api.generateIntrastatDeclaration(this.intrastatForm.getRawValue()).subscribe({
      next: (res) => {
        this.intrastatModalVisible.set(false);
        this.message.success(this.translate.instant('accounting.msgDichiarazioneIntrastatGenerata', { declaration_number: this.intrastatLabel(res.data) }));
        this.loadIntrastat();
      },
      error: () => {
        this.message.error(this.translate.instant('accounting.msgErroreDuranteLaGenerazioneIntrastat'));
      },
    });
  }

  /** Readable name of a list, e.g. "INTRA-1 2026/10". */
  intrastatLabel(dec: IntrastatDeclarationResource): string {
    return `${dec.model} ${dec.year}/${dec.period}`;
  }

  /** The API answers 200 for a valid list and 422 (shown by the error interceptor) when it has errors. */
  validateIntrastat(dec: IntrastatDeclarationResource): void {
    this.api.validateIntrastatDeclaration(dec.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('accounting.msgDichiarazioneIntrastatValidaFormalmentePerAgenzia'));
        this.loadIntrastat();
      },
      error: () => this.loadIntrastat(),
    });
  }

  submitIntrastat(dec: IntrastatDeclarationResource): void {
    this.intrastatSubmitForm.reset({ protocol_number: '', submitted_at: null });
    this.intrastatSubmitTarget.set(dec);
  }

  confirmSubmitIntrastat(): void {
    const dec = this.intrastatSubmitTarget();
    if (!dec) {
      return;
    }
    if (this.intrastatSubmitForm.invalid) {
      this.intrastatSubmitForm.markAllAsTouched();
      return;
    }
    const val = this.intrastatSubmitForm.getRawValue();
    this.api
      .submitIntrastatDeclaration(dec.id, {
        protocol_number: val.protocol_number.trim(),
        submitted_at: val.submitted_at ? val.submitted_at.toISOString() : null,
      })
      .subscribe({
        next: () => {
          this.intrastatSubmitTarget.set(null);
          this.message.success(this.translate.instant('accounting.msgDichiarazioneIntrastatTrasmessaTelematicamente', { declaration_number: this.intrastatLabel(dec) }));
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
