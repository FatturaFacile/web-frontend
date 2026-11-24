import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  TesseraSanitariaApiService,
  FetchGridModel,
  TesseraSanitariaExpense,
  TesseraSanitariaExpenseFilterParams,
  TesseraSanitariaExpenseRequest,
  TesseraSanitariaExpenseType,
  TesseraSanitariaSettings,
  TesseraSanitariaSettingsRequest,
  TesseraSanitariaSubjectType,
  TesseraSanitariaSummary,
  TranslateService,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, MoneyPipe, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';

@Component({
  selector: 'app-tessera-sanitaria',
  styleUrl: './tessera-sanitaria.component.scss',
  imports: [
    IconActionDirective,
    ModalActionsDirective,
    DatePipe,
    UpperCasePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTabsModule,
    BaseTableComponent,
    NzTagModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzFormModule,
    NzModalModule,
    NzDescriptionsModule,
    NzSpaceModule,
    NzStatisticModule,
    NzPopconfirmModule,
    NzSwitchModule,
    NzAlertModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './tessera-sanitaria.component.html',
})
export class TesseraSanitariaComponent implements OnInit {
  private readonly api = inject(TesseraSanitariaApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly selectedTabIndex = signal<number>(0);
  readonly selectedYear = signal<number>(2026);

  // --- TAB 0: EXPENSES ---
  /** Server-driven grid of the flagged expenses: paging, sorting, column filters and grouping run on the API. */
  readonly expenses = new FetchGridModel<TesseraSanitariaExpense, TesseraSanitariaExpenseFilterParams>((query) =>
    this.api.getExpenses(query),
  );
  /** Every expense of the filtered grid (all pages): the totals above the grid are not limited to the loaded page. */
  private readonly totalsSource = signal<TesseraSanitariaExpense[]>([]);

  private readonly documentTpl = viewChild<TemplateRef<unknown>>('documentTpl');
  private readonly paymentDateTpl = viewChild<TemplateRef<unknown>>('paymentDateTpl');
  private readonly expenseTypeTpl = viewChild<TemplateRef<unknown>>('expenseTypeTpl');
  private readonly amountTpl = viewChild<TemplateRef<unknown>>('amountTpl');
  private readonly fiscalCodeTpl = viewChild<TemplateRef<unknown>>('fiscalCodeTpl');
  private readonly traceableTpl = viewChild<TemplateRef<unknown>>('traceableTpl');
  private readonly oppositionTpl = viewChild<TemplateRef<unknown>>('oppositionTpl');
  private readonly transmissionTpl = viewChild<TemplateRef<unknown>>('transmissionTpl');
  private readonly expenseActionsTpl = viewChild<TemplateRef<unknown>>('expenseActionsTpl');

  protected readonly expenseColumns = computed<TableColumnDef<TesseraSanitariaExpense>[]>(() => {
    const isTrue = (value: string): boolean => value === '1' || value === 'true';
    const yesNo = (flag: boolean): string => this.translate.instant(flag ? 'STS.YES' : 'STS.NO');
    return [
      { key: 'document_number', header: 'STS.DOCUMENT', customCellTemplate: this.documentTpl() },
      { key: 'payment_date', header: 'STS.PAYMENT_DATE', customCellTemplate: this.paymentDateTpl() },
      { key: 'expense_type', header: 'STS.EXPENSE_TYPE', valueGetter: (row) => this.getExpenseTypeName(row.expense_type), valueLabel: (value) => this.getExpenseTypeName(value as TesseraSanitariaExpenseType), customCellTemplate: this.expenseTypeTpl() },
      { key: 'amount', header: 'STS.AMOUNT', align: 'right', customCellTemplate: this.amountTpl() },
      // Encrypted and hidden from the API output: the server cannot sort, filter or group by it.
      { key: 'patient_fiscal_code', header: 'STS.PATIENT_FISCAL_CODE', sortable: false, filterable: false, groupable: false, customCellTemplate: this.fiscalCodeTpl() },
      { key: 'payment_traceable', header: 'STS.TRACEABLE', align: 'center', valueGetter: (row) => yesNo(row.payment_traceable), valueLabel: (value) => yesNo(isTrue(value)), customCellTemplate: this.traceableTpl() },
      { key: 'patient_opposition', header: 'STS.OPPOSITION', align: 'center', valueGetter: (row) => yesNo(row.patient_opposition), valueLabel: (value) => yesNo(isTrue(value)), customCellTemplate: this.oppositionTpl() },
      { key: 'transmission_status', header: 'STS.STATUS', valueGetter: (row) => (row.transmission_status || 'pending').toUpperCase(), valueLabel: (value) => value.toUpperCase(), customCellTemplate: this.transmissionTpl() },
    ];
  });
  readonly selectedExpense = signal<TesseraSanitariaExpense | null>(null);
  readonly drawerVisible = signal<boolean>(false);
  readonly flagModalVisible = signal<boolean>(false);

  // --- TAB 1: ANNUAL SUMMARY ---
  readonly summary = signal<TesseraSanitariaSummary | null>(null);
  readonly summaryLoading = signal<boolean>(false);

  // --- TAB 2: EXPORT ---
  readonly exportLoading = signal<boolean>(false);
  readonly exportedContent = signal<string | null>(null);

  // --- TAB 3: SETTINGS ---
  readonly settings = signal<TesseraSanitariaSettings | null>(null);
  readonly settingsLoading = signal<boolean>(false);

  // Derived metrics
  readonly totalExpensesAmount = computed(() =>
    this.totalsSource().reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
  );
  readonly totalTraceableAmount = computed(() =>
    this.totalsSource()
      .filter((e) => e.payment_traceable)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
  );
  readonly totalOpposedCount = computed(
    () => this.totalsSource().filter((e) => e.patient_opposition).length,
  );
  readonly totalTransmittedCount = computed(
    () => this.totalsSource().filter((e) => e.transmission_status === 'transmitted').length,
  );

  // Forms
  readonly flagForm = this.fb.group({
    document_type: ['invoice' as 'invoice' | 'commercial_document', [Validators.required]],
    document_id: ['', [Validators.required]],
    expense_type: ['SV' as TesseraSanitariaExpenseType, [Validators.required]],
    expense_flag: [''],
    payment_date: ['2026-03-15', [Validators.required]],
    amount: [100.0, [Validators.min(0.01), Validators.max(99999.99)]],
    tax_rate: [22.0 as number | null, [Validators.min(0), Validators.max(99.99)]],
    vat_nature: ['', [Validators.maxLength(4)]],
    patient_fiscal_code: ['', [Validators.pattern(/^[A-Za-z0-9]{16}$/)]],
    patient_opposition: [false],
    payment_traceable: [true],
  });

  readonly settingsForm = this.fb.group({
    is_enabled: [true],
    subject_type: ['professional' as TesseraSanitariaSubjectType],
    owner_fiscal_code: ['RSSMRA80A01H501Z', [Validators.pattern(/^[A-Za-z0-9]{11,16}$/)]],
    region_code: ['030', [Validators.maxLength(3)]],
    asl_code: ['201', [Validators.maxLength(3)]],
    ssa_code: ['', [Validators.maxLength(6)]],
  });

  readonly exportForm = this.fb.group({
    format: ['json' as 'json' | 'csv'],
  });

  /** `tax_rate` prohibits `vat_nature`: filling one clears the other. */
  private readonly vatNatureSync = this.flagForm.controls.vat_nature.valueChanges.pipe(takeUntilDestroyed()).subscribe((nature) => {
    if (nature) {
      this.flagForm.controls.tax_rate.setValue(null, { emitEvent: false });
    }
  });

  private readonly taxRateSync = this.flagForm.controls.tax_rate.valueChanges.pipe(takeUntilDestroyed()).subscribe((rate) => {
    if (rate !== null && this.flagForm.controls.vat_nature.value) {
      this.flagForm.controls.vat_nature.setValue('', { emitEvent: false });
    }
  });

  private readonly oppositionSync = this.flagForm.controls.patient_opposition.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe(() => this.syncPatientFiscalCodeValidator());

  /** The patient fiscal code is mandatory unless the patient opposes the transmission (required_unless). */
  protected patientFiscalCodeRequired(): boolean {
    return !this.flagForm.controls.patient_opposition.value;
  }

  private syncPatientFiscalCodeValidator(): void {
    const control = this.flagForm.controls.patient_fiscal_code;
    if (this.patientFiscalCodeRequired()) {
      control.addValidators(Validators.required);
    } else {
      control.removeValidators(Validators.required);
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  ngOnInit(): void {
    this.syncPatientFiscalCodeValidator();
    this.expenses.setFilter({ year: this.selectedYear() });
    this.loadExpenseTotals();
    this.loadSummary();
    this.loadSettings();
  }

  // --- TAB 0: EXPENSES ---
  loadExpenses(): void {
    this.expenses.setFilter({ year: this.selectedYear() });
    this.expenses.reload();
    this.loadExpenseTotals();
  }

  private loadExpenseTotals(): void {
    this.expenses.loadAllRows().subscribe({ next: (rows) => this.totalsSource.set(rows), error: () => this.totalsSource.set([]) });
  }

  openFlagModal(): void {
    this.flagForm.reset({
      document_type: 'invoice',
      document_id: '',
      expense_type: 'SV',
      expense_flag: '',
      payment_date: '2026-03-15',
      amount: 100.0,
      tax_rate: 22.0,
      vat_nature: '',
      patient_fiscal_code: '',
      patient_opposition: false,
      payment_traceable: true,
    });
    this.flagModalVisible.set(true);
  }

  submitFlagExpense(): void {
    this.syncPatientFiscalCodeValidator();
    if (this.flagForm.invalid) {
      this.flagForm.markAllAsTouched();
      return;
    }
    const val = this.flagForm.getRawValue();
    const payload: TesseraSanitariaExpenseRequest = {
      document_type: val.document_type,
      document_id: val.document_id,
      expense_type: val.expense_type,
      expense_flag: val.expense_flag || undefined,
      payment_date: val.payment_date,
      amount: val.amount,
      tax_rate: val.vat_nature ? undefined : (val.tax_rate ?? undefined),
      vat_nature: val.vat_nature || undefined,
      patient_fiscal_code: val.patient_fiscal_code || undefined,
      patient_opposition: val.patient_opposition,
      payment_traceable: val.payment_traceable,
    };

    this.api.flagExpense(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('STS.EXPENSE_FLAGGED'));
        this.flagModalVisible.set(false);
        this.loadExpenses();
        this.loadSummary();
      },
      error: () => {
        this.message.error(this.translate.instant('STS.ACTION_ERROR'));
      },
    });
  }

  removeExpenseFlag(id: string): void {
    this.api.removeExpenseFlag(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('STS.FLAG_REMOVED'));
        this.loadExpenses();
        this.loadSummary();
      },
      error: () => {
        this.message.error(this.translate.instant('STS.ACTION_ERROR'));
      },
    });
  }

  openExpenseDrawer(e: TesseraSanitariaExpense): void {
    this.selectedExpense.set(e);
    this.drawerVisible.set(true);
  }

  closeExpenseDrawer(): void {
    this.drawerVisible.set(false);
    this.selectedExpense.set(null);
  }

  // --- TAB 1: SUMMARY ---
  loadSummary(): void {
    this.summaryLoading.set(true);
    this.api.getSummary(this.selectedYear()).subscribe({
      next: (res) => {
        this.summary.set(res?.data || null);
        this.summaryLoading.set(false);
      },
      error: () => {
        this.summaryLoading.set(false);
      },
    });
  }

  changeYear(year: number): void {
    this.selectedYear.set(year);
    this.loadExpenses();
    this.loadSummary();
  }

  // --- TAB 2: EXPORT ---
  exportExpenses(): void {
    this.exportLoading.set(true);
    const format = this.exportForm.getRawValue().format;

    this.api.exportExpenses(this.selectedYear(), format).subscribe({
      next: (res) => {
        const content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
        this.exportedContent.set(content);
        this.exportLoading.set(false);
        this.message.success(this.translate.instant('STS.EXPORT_SUCCESS'));
      },
      error: () => {
        this.exportLoading.set(false);
        this.message.error(this.translate.instant('STS.ACTION_ERROR'));
      },
    });
  }

  // --- TAB 3: SETTINGS ---
  loadSettings(): void {
    this.settingsLoading.set(true);
    this.api.getSettings().subscribe({
      next: (res) => {
        this.settings.set(res?.data || null);
        if (res?.data) {
          this.settingsForm.reset({
            is_enabled: res.data.is_enabled,
            subject_type: res.data.subject_type || 'professional',
            owner_fiscal_code: res.data.owner_fiscal_code || '',
            region_code: res.data.region_code || '',
            asl_code: res.data.asl_code || '',
            ssa_code: res.data.ssa_code || '',
          });
        }
        this.settingsLoading.set(false);
      },
      error: () => {
        this.settingsLoading.set(false);
      },
    });
  }

  saveSettings(): void {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }
    const val = this.settingsForm.getRawValue();
    const payload: TesseraSanitariaSettingsRequest = {
      is_enabled: val.is_enabled,
      subject_type: val.subject_type,
      owner_fiscal_code: val.owner_fiscal_code || undefined,
      region_code: val.region_code || undefined,
      asl_code: val.asl_code || undefined,
      ssa_code: val.ssa_code || undefined,
    };

    this.api.updateSettings(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('STS.SETTINGS_SAVED'));
        this.loadSettings();
      },
      error: () => {
        this.message.error(this.translate.instant('STS.ACTION_ERROR'));
      },
    });
  }

  getExpenseTypeName(type: TesseraSanitariaExpenseType): string {
    switch (type) {
      case 'TK':
        return 'Ticket Sanitario (TK)';
      case 'FC':
        return 'Farmaco da Banco / Omeopatico (FC)';
      case 'FV':
        return 'Farmaco Veterinario (FV)';
      case 'SV':
        return 'Visita Medica / Sanitaria Generica (SV)';
      case 'SP':
        return 'Prestazione Specialistica (SP)';
      case 'AD':
        return 'Dispositivo Medico CE (AD)';
      case 'AS':
        return 'Altra Spesa Sanitaria (AS)';
      case 'SR':
        return 'Spese di Ricovero (SR)';
      case 'CT':
        return 'Cure Termali (CT)';
      case 'PI':
        return 'Protesi & Integrativa (PI)';
      case 'IC':
        return 'Intervento Chirurgico (IC)';
      case 'AA':
        return 'Altra Spesa (AA)';
      default:
        return type;
    }
  }

  getExpenseTypeColor(type: TesseraSanitariaExpenseType): string {
    switch (type) {
      case 'SV':
      case 'SP':
        return 'blue';
      case 'AD':
      case 'PI':
        return 'purple';
      case 'FC':
      case 'FV':
        return 'cyan';
      case 'SR':
      case 'IC':
        return 'red';
      default:
        return 'default';
    }
  }

  getTransmissionStatusColor(status?: string): string {
    switch (status) {
      case 'transmitted':
        return 'success';
      case 'pending':
        return 'warning';
      case 'opposed':
        return 'magenta';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  }
}
