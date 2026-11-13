import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';
import { decimalPattern, positiveNumber } from '@shared/utils/decimal-validators';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CreateTimeLogPayload,
  FeeNote,
  FetchGridModel,
  LegalCase,
  PracticeActivityItem,
  PracticeApiService,
  PracticeAppliedRetainer,
  PracticeClosing,
  PracticeClosingChecklistItem,
  PracticeClosingOverview,
  PracticeClosingRequest,
  PracticeFeeNoteRequest,
  PracticeRetainer,
  PracticeRetainerApplyRequest,
  PracticeRetainerBalance,
  PracticeRetainerRequest,
  ProfessionalsApiService,
  ProfessionalsClientName,
  QueryFilterParams,
  TimeLog,
  TranslateService,
} from '@core';
import { BaseTableComponent, MoneyPipe, PageHeaderComponent, TableColumnDef, TranslatePipe, IconActionDirective, ModalActionsDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';

/** Page-level filters of the activities grid (period and billing status). */
interface ActivityFilter extends QueryFilterParams {
  from?: string;
  to?: string;
  is_billed?: string;
}

/** Page-level filter of the retainers grid. */
interface RetainerFilter extends QueryFilterParams {
  status?: string;
}

type CellTemplate<T> = TemplateRef<{ $implicit: T; value: unknown }>;

@Component({
  selector: 'app-professionals',
  styleUrl: './professionals.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    IconActionDirective,
    ModalActionsDirective,
    DatePipe,
    UpperCasePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTabsModule,
    NzTableModule,
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
    NzCheckboxModule,
    NzProgressModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
    MoneyPipe,
    BaseTableComponent,
  ],
  templateUrl: './professionals.component.html',
})
export class ProfessionalsComponent implements OnInit {
  private readonly profApi = inject(ProfessionalsApiService);
  private readonly practiceApi = inject(PracticeApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly selectedTabIndex = signal<number>(0);

  // --- TAB 0: CASES ---
  readonly casesGrid = new FetchGridModel<LegalCase>((query) => this.profApi.getCases(query));
  /** Cases offered by the select of the modals (the grid only holds its current page). */
  readonly caseOptions = signal<LegalCase[]>([]);

  // --- TAB 1: ACTIVITY CONTROL ---
  readonly activitiesGrid = new FetchGridModel<TimeLog, ActivityFilter>((query) => this.profApi.getTimeLogs(query));
  readonly selectedActivities = signal<TimeLog[]>([]);
  /** Ids of the selected activities that can still be billed. */
  readonly selectedActivityIds = computed(() =>
    this.selectedActivities()
      .filter((a) => !a.is_billed)
      .map((a) => a.id),
  );
  readonly filterActivityStatus = signal<string>('unbilled');
  readonly fromDate = signal<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0, 10));
  readonly toDate = signal<string>(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().substring(0, 10));
  /** Unbilled minutes and amount of the period, from the activity control (over all the activities, not one page). */
  readonly unbilledTotals = signal<{ minutes: number; amount: number }>({ minutes: 0, amount: 0 });

  // --- TAB 2: FEE NOTES ---
  readonly feeNotesGrid = new FetchGridModel<FeeNote>((query) => this.profApi.getFeeNotes(query));
  readonly selectedFeeNote = signal<FeeNote | null>(null);
  readonly feeNoteDrawerVisible = signal<boolean>(false);
  readonly feeNoteActivities = signal<PracticeActivityItem[]>([]);
  readonly feeNoteRetainers = signal<PracticeAppliedRetainer[]>([]);
  readonly feeNoteDrawerLoading = signal<boolean>(false);

  // --- TAB 3: RETAINERS (FONDI SPESE) ---
  readonly retainersGrid = new FetchGridModel<PracticeRetainer, RetainerFilter>((query) => this.practiceApi.getRetainers(query));
  /** Open retainers offered by the select of the apply modal (the grid only holds its current page). */
  readonly openRetainerOptions = signal<PracticeRetainer[]>([]);
  readonly retainerBalances = signal<PracticeRetainerBalance[]>([]);
  readonly filterRetainerStatus = signal<string>('');

  // --- TAB 4: CLOSINGS & CHECKLISTS ---
  readonly closingsOverview = signal<PracticeClosingOverview | null>(null);
  readonly closings = signal<PracticeClosing[]>([]);
  readonly closingsLoading = signal<boolean>(false);
  readonly activeChecklistClosing = signal<PracticeClosing | null>(null);
  readonly checklistModalVisible = signal<boolean>(false);

  // Derived metrics for summary cards
  readonly totalUnbilledHours = computed(() => this.unbilledTotals().minutes / 60);

  readonly totalUnbilledAmount = computed(() => this.unbilledTotals().amount);

  readonly totalRetainerAvailable = computed(() =>
    this.retainerBalances().reduce((acc, b) => acc + (parseFloat(b.current_balance) || 0), 0),
  );

  // Modals visibility
  readonly feeNoteModalVisible = signal<boolean>(false);
  readonly timeLogModalVisible = signal<boolean>(false);
  readonly retainerModalVisible = signal<boolean>(false);
  readonly applyRetainerModalVisible = signal<boolean>(false);
  readonly closingModalVisible = signal<boolean>(false);

  // Forms
  readonly feeNoteForm = this.fb.group({
    client_id: ['', [Validators.required]],
    date: [new Date().toISOString().substring(0, 10), [Validators.required]],
    cpa_rate: ['4.00', [Validators.required, decimalPattern(2), Validators.max(100)]],
    ritenuta_rate: ['20.00', [Validators.required, decimalPattern(2), Validators.max(100)]],
    vat_rate: ['22.00', [Validators.required, decimalPattern(2), Validators.max(100)]],
    note_number: ['', [Validators.maxLength(50)]],
  });

  readonly timeLogForm = this.fb.group({
    legal_case_id: ['', [Validators.required]],
    date: [new Date().toISOString().substring(0, 10), [Validators.required]],
    duration_minutes: [60, [Validators.required, Validators.min(1)]],
    hourly_rate: [120, [Validators.required, Validators.min(0)]],
    description: ['', [Validators.required]],
  });

  readonly retainerForm = this.fb.group({
    client_id: ['', [Validators.required]],
    legal_case_id: [''],
    received_on: [new Date().toISOString().substring(0, 10), [Validators.required]],
    amount: ['1000.00', [Validators.required, decimalPattern(2), positiveNumber]],
    reference: ['', [Validators.maxLength(100)]],
    notes: ['', [Validators.maxLength(500)]],
  });

  readonly applyRetainerForm = this.fb.group({
    retainer_id: ['', [Validators.required]],
    fee_note_id: ['', [Validators.required]],
    amount: ['500.00', [Validators.required, decimalPattern(2), positiveNumber]],
  });

  readonly closingForm = this.fb.group({
    client_id: ['', [Validators.required]],
    period_start: [new Date(new Date().getFullYear(), 0, 1).toISOString().substring(0, 10), [Validators.required]],
    period_end: [new Date(new Date().getFullYear(), 11, 31).toISOString().substring(0, 10), [Validators.required, endsNotBefore('period_start')]],
    notes: ['', [Validators.maxLength(5000)]],
  });

  private readonly closingPeriodSync = revalidateOnStartChange(this.closingForm, 'period_start', 'period_end', inject(DestroyRef));

  ngOnInit(): void {
    this.applyActivityFilters();
    this.loadCaseOptions();
    this.loadRetainerSupport();
    this.loadClosings();
  }

  // --- Grid columns (the keys the API knows are in serverKey; the cell templates are in the HTML) ---
  private readonly caseNumberTpl = viewChild<CellTemplate<LegalCase>>('caseNumberTpl');
  private readonly caseClientTpl = viewChild<CellTemplate<LegalCase>>('caseClientTpl');
  private readonly caseHoursTpl = viewChild<CellTemplate<LegalCase>>('caseHoursTpl');
  private readonly moneyValueTpl = viewChild<CellTemplate<never>>('moneyValueTpl');
  private readonly dateValueTpl = viewChild<CellTemplate<never>>('dateValueTpl');
  private readonly amlTpl = viewChild<CellTemplate<LegalCase>>('amlTpl');
  private readonly caseStatusTpl = viewChild<CellTemplate<LegalCase>>('caseStatusTpl');
  private readonly actClientTpl = viewChild<CellTemplate<TimeLog>>('actClientTpl');
  private readonly actCaseTpl = viewChild<CellTemplate<TimeLog>>('actCaseTpl');
  private readonly actHoursTpl = viewChild<CellTemplate<TimeLog>>('actHoursTpl');
  private readonly actAmountTpl = viewChild<CellTemplate<TimeLog>>('actAmountTpl');
  private readonly actStatusTpl = viewChild<CellTemplate<TimeLog>>('actStatusTpl');
  private readonly feeNumberTpl = viewChild<CellTemplate<FeeNote>>('feeNumberTpl');
  private readonly feeClientTpl = viewChild<CellTemplate<FeeNote>>('feeClientTpl');
  private readonly feeGrossTpl = viewChild<CellTemplate<FeeNote>>('feeGrossTpl');
  private readonly retClientTpl = viewChild<CellTemplate<PracticeRetainer>>('retClientTpl');
  private readonly retCaseTpl = viewChild<CellTemplate<PracticeRetainer>>('retCaseTpl');
  private readonly retBalanceTpl = viewChild<CellTemplate<PracticeRetainer>>('retBalanceTpl');
  private readonly retStatusTpl = viewChild<CellTemplate<PracticeRetainer>>('retStatusTpl');

  protected readonly caseColumns = computed<TableColumnDef<LegalCase>[]>(() => [
    { key: 'case_number', header: 'PRACTICE.CASE_NUMBER', customCellTemplate: this.caseNumberTpl() },
    {
      key: 'client',
      serverKey: 'client.name',
      header: 'PRACTICE.CLIENT',
      valueGetter: (c) => this.clientName(c.client),
      customCellTemplate: this.caseClientTpl(),
    },
    { key: 'title', header: 'PRACTICE.SUBJECT' },
    {
      key: 'logged_minutes',
      header: 'PRACTICE.HOURS',
      valueGetter: (c) => this.hours(c.logged_minutes),
      valueLabel: (value) => String(this.hours(value)),
      customCellTemplate: this.caseHoursTpl(),
    },
    { key: 'fee_total', header: 'PRACTICE.FEE', customCellTemplate: this.moneyValueTpl() },
    {
      key: 'aml_kyc_completed',
      header: 'PRACTICE.AML_COMPLIANT',
      valueGetter: (c) => this.yesNo(c.aml_kyc_completed),
      valueLabel: (value) => this.yesNo(['1', 'true', 't'].includes(value)),
      customCellTemplate: this.amlTpl(),
    },
    { key: 'status', header: 'PRACTICE.STATUS', customCellTemplate: this.caseStatusTpl() },
  ]);

  protected readonly activityColumns = computed<TableColumnDef<TimeLog>[]>(() => [
    { key: 'date', header: 'PRACTICE.DATE', customCellTemplate: this.dateValueTpl() },
    {
      key: 'client',
      serverKey: 'legalCase.client.name',
      header: 'PRACTICE.CLIENT',
      valueGetter: (a) => this.clientName(a.legal_case?.client),
      customCellTemplate: this.actClientTpl(),
    },
    {
      key: 'case',
      serverKey: 'legalCase.title',
      header: 'PRACTICE.CASE',
      valueGetter: (a) => a.legal_case?.title ?? a.legal_case_id,
      customCellTemplate: this.actCaseTpl(),
    },
    { key: 'description', header: 'PRACTICE.DESCRIPTION' },
    {
      key: 'duration_minutes',
      header: 'PRACTICE.HOURS',
      valueGetter: (a) => this.hours(a.duration_minutes),
      valueLabel: (value) => String(this.hours(value)),
      customCellTemplate: this.actHoursTpl(),
    },
    { key: 'hourly_rate', header: 'PRACTICE.RATE', customCellTemplate: this.moneyValueTpl() },
    { key: 'fee_amount', header: 'PRACTICE.AMOUNT', customCellTemplate: this.actAmountTpl() },
    {
      key: 'status',
      serverKey: 'billing_status',
      header: 'PRACTICE.STATUS',
      valueGetter: (a) => this.activityStatusLabel(a.is_billed ? 'billed' : 'unbilled'),
      valueLabel: (value) => this.activityStatusLabel(value),
      customCellTemplate: this.actStatusTpl(),
    },
  ]);

  protected readonly feeNoteColumns = computed<TableColumnDef<FeeNote>[]>(() => [
    { key: 'note_number', header: 'PRACTICE.FEE_NOTE_NUM', customCellTemplate: this.feeNumberTpl() },
    { key: 'date', header: 'PRACTICE.DATE', customCellTemplate: this.dateValueTpl() },
    {
      key: 'client',
      serverKey: 'client.name',
      header: 'PRACTICE.CLIENT',
      valueGetter: (n) => this.clientName(n.client),
      customCellTemplate: this.feeClientTpl(),
    },
    { key: 'taxable_fees', header: 'PRACTICE.NET_AMOUNT', customCellTemplate: this.moneyValueTpl() },
    { key: 'cassa_previdenza_amount', header: 'PRACTICE.CPA_CONTRIBUTION', customCellTemplate: this.moneyValueTpl() },
    { key: 'ritenuta_acconto_amount', header: 'PRACTICE.WITHHOLDING', customCellTemplate: this.moneyValueTpl() },
    { key: 'vat_amount', header: 'PRACTICE.VAT', customCellTemplate: this.moneyValueTpl() },
    {
      key: 'gross_amount',
      header: 'PRACTICE.GROSS_AMOUNT',
      valueGetter: (n) => this.grossAmount(n),
      customCellTemplate: this.feeGrossTpl(),
    },
  ]);

  protected readonly retainerColumns = computed<TableColumnDef<PracticeRetainer>[]>(() => [
    { key: 'received_on', header: 'PRACTICE.DATE', customCellTemplate: this.dateValueTpl() },
    {
      key: 'client',
      serverKey: 'client.name',
      header: 'PRACTICE.CLIENT',
      valueGetter: (r) => this.clientName(r.client),
      customCellTemplate: this.retClientTpl(),
    },
    {
      key: 'legal_case',
      serverKey: 'legalCase.title',
      header: 'PRACTICE.CASE',
      valueGetter: (r) => r.legal_case?.title ?? '',
      customCellTemplate: this.retCaseTpl(),
    },
    { key: 'amount', header: 'PRACTICE.INITIAL_AMOUNT', customCellTemplate: this.moneyValueTpl() },
    {
      key: 'balance',
      header: 'PRACTICE.BALANCE_AVAILABLE',
      valueGetter: (r) => this.retainerBalance(r),
      customCellTemplate: this.retBalanceTpl(),
    },
    {
      key: 'status',
      header: 'PRACTICE.STATUS',
      valueGetter: (r) => this.retainerStatusLabel(r.status),
      valueLabel: (value) => this.retainerStatusLabel(value),
      customCellTemplate: this.retStatusTpl(),
    },
    { key: 'reference', header: 'PRACTICE.REFERENCE' },
  ]);

  /** Display name of a client embedded by the API. */
  clientName(client: ProfessionalsClientName | null | undefined): string {
    if (!client) {
      return '';
    }
    return client.company_name || [client.first_name, client.last_name].filter(Boolean).join(' ');
  }

  hours(minutes: number | string | null | undefined): number {
    return Math.round((Number(minutes ?? 0) / 60) * 100) / 100;
  }

  grossAmount(note: FeeNote): number {
    return Number(note.taxable_fees) + Number(note.cassa_previdenza_amount) + Number(note.vat_amount);
  }

  retainerBalance(retainer: PracticeRetainer): number {
    return Number(retainer.amount) - Number(retainer.applied_amount);
  }

  private yesNo(value: boolean | undefined): string {
    return this.translate.instant(value ? 'COMMON.YES' : 'COMMON.NO');
  }

  activityStatusLabel(status: string): string {
    return this.translate.instant('PRACTICE.STATUS_' + status.toUpperCase());
  }

  retainerStatusLabel(status: string): string {
    const key = { open: 'PRACTICE.RET_AVAILABLE', exhausted: 'PRACTICE.RET_DEPLETED', void: 'PRACTICE.RET_VOIDED' }[status];
    return key ? this.translate.instant(key) : status;
  }

  // --- TAB 0: CASES ---
  loadCaseOptions(): void {
    this.profApi.getCases({ per_page: 100 }).subscribe({
      next: (res) => this.caseOptions.set(res?.data ?? []),
    });
  }

  // --- TAB 1: ACTIVITY CONTROL ---
  /** Applies the period and billing status of the toolbar to the grid and refreshes the unbilled totals. */
  applyActivityFilters(): void {
    const status = this.filterActivityStatus();
    this.activitiesGrid.setFilter({
      from: this.fromDate(),
      to: this.toDate(),
      is_billed: status === 'billed' ? 'true' : status === 'unbilled' ? 'false' : undefined,
    });
    this.selectedActivities.set([]);
    this.loadUnbilledTotals();
  }

  /** Reloads the activities after a change (new time log, new fee note). */
  reloadActivities(): void {
    this.activitiesGrid.reload();
    this.selectedActivities.set([]);
    this.loadUnbilledTotals();
  }

  private loadUnbilledTotals(): void {
    this.practiceApi.getActivityControl({ from: this.fromDate(), to: this.toDate() }).subscribe({
      next: (res) => {
        const rows = res?.data?.rows ?? [];
        this.unbilledTotals.set({
          minutes: rows.reduce((total, row) => total + Number(row.unbilled_minutes), 0),
          amount: rows.reduce((total, row) => total + Number(row.unbilled_amount), 0),
        });
      },
    });
  }

  openLogTimeModal(): void {
    this.timeLogForm.reset({
      legal_case_id: this.caseOptions()[0]?.id || '',
      date: new Date().toISOString().substring(0, 10),
      duration_minutes: 60,
      hourly_rate: 120,
      description: '',
    });
    this.timeLogModalVisible.set(true);
  }

  saveTimeLog(): void {
    if (this.timeLogForm.invalid) {
      this.timeLogForm.markAllAsTouched();
      return;
    }
    const val = this.timeLogForm.getRawValue();
    const payload: CreateTimeLogPayload = {
      legal_case_id: val.legal_case_id,
      date: val.date,
      duration_minutes: Number(val.duration_minutes),
      hourly_rate: Number(val.hourly_rate),
      description: val.description,
    };

    this.profApi.logTime(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.TIME_LOG_SAVED'));
        this.timeLogModalVisible.set(false);
        this.reloadActivities();
        this.casesGrid.reload();
        this.loadCaseOptions();
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  openCreateFeeNoteModal(): void {
    const selectedIds = this.selectedActivityIds();
    const selectedActs = this.selectedActivities().filter((a) => selectedIds.includes(a.id));
    const firstClientId = selectedActs[0]?.legal_case?.client?.id || '';

    this.feeNoteForm.reset({
      client_id: firstClientId,
      date: new Date().toISOString().substring(0, 10),
      cpa_rate: '4.00',
      ritenuta_rate: '20.00',
      vat_rate: '22.00',
      note_number: '',
    });
    this.feeNoteModalVisible.set(true);
  }

  saveFeeNote(): void {
    if (this.feeNoteForm.invalid) {
      this.feeNoteForm.markAllAsTouched();
      return;
    }
    const val = this.feeNoteForm.getRawValue();
    const payload: PracticeFeeNoteRequest = {
      client_id: val.client_id,
      activity_ids: this.selectedActivityIds(),
      date: val.date,
      cpa_rate: val.cpa_rate,
      ritenuta_rate: val.ritenuta_rate,
      vat_rate: val.vat_rate,
      note_number: val.note_number || undefined,
    };

    this.practiceApi.createFeeNoteFromActivities(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.FEE_NOTE_CREATED'));
        this.feeNoteModalVisible.set(false);
        this.reloadActivities();
        this.feeNotesGrid.reload();
        this.casesGrid.reload();
        this.selectedTabIndex.set(2);
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  // --- TAB 2: FEE NOTES ---
  openFeeNoteDrawer(fn: FeeNote): void {
    this.selectedFeeNote.set(fn);
    this.feeNoteDrawerVisible.set(true);
    this.loadFeeNoteDetails(fn.id);
  }

  closeFeeNoteDrawer(): void {
    this.feeNoteDrawerVisible.set(false);
    this.selectedFeeNote.set(null);
    this.feeNoteActivities.set([]);
    this.feeNoteRetainers.set([]);
  }

  loadFeeNoteDetails(feeNoteId: string): void {
    this.feeNoteDrawerLoading.set(true);
    this.practiceApi.getFeeNoteActivities(feeNoteId).subscribe({
      next: (res) => {
        this.feeNoteActivities.set(res?.data || []);
      },
    });
    this.practiceApi.getFeeNoteRetainers(feeNoteId).subscribe({
      next: (res) => {
        this.feeNoteRetainers.set(res?.data || []);
        this.feeNoteDrawerLoading.set(false);
      },
      error: () => {
        this.feeNoteDrawerLoading.set(false);
      },
    });
  }

  openApplyRetainerModal(fn?: FeeNote): void {
    const feeNote = fn || this.selectedFeeNote();
    const availableRetainers = this.openRetainerOptions();

    this.applyRetainerForm.reset({
      fee_note_id: feeNote?.id || this.feeNotesGrid.items()[0]?.id || '',
      retainer_id: availableRetainers[0]?.id || '',
      amount: '500.00',
    });
    this.applyRetainerModalVisible.set(true);
  }

  saveApplyRetainer(): void {
    if (this.applyRetainerForm.invalid) {
      this.applyRetainerForm.markAllAsTouched();
      return;
    }
    const val = this.applyRetainerForm.getRawValue();
    const payload: PracticeRetainerApplyRequest = {
      fee_note_id: val.fee_note_id,
      amount: val.amount,
    };

    this.practiceApi.applyRetainer(val.retainer_id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.RETAINER_APPLIED'));
        this.applyRetainerModalVisible.set(false);
        this.loadRetainers();
        if (this.selectedFeeNote()) {
          this.loadFeeNoteDetails(this.selectedFeeNote()!.id);
        }
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  // --- TAB 3: RETAINERS (FONDI SPESE) ---
  /** Refreshes the retainers grid, the balance cards and the open retainers of the apply modal. */
  loadRetainers(): void {
    this.retainersGrid.reload();
    this.loadRetainerSupport();
  }

  private loadRetainerSupport(): void {
    this.practiceApi.getRetainers({ status: 'open', per_page: 100 }).subscribe({
      next: (res) => this.openRetainerOptions.set(res?.data ?? []),
    });
    this.practiceApi.getRetainerBalances().subscribe({
      next: (res) => {
        this.retainerBalances.set(res?.data || []);
      },
    });
  }

  onRetainerStatusChange(status: string | null): void {
    this.filterRetainerStatus.set(status ?? '');
    this.retainersGrid.setFilter({ status: status || undefined });
  }

  openCreateRetainerModal(): void {
    this.retainerForm.reset({
      client_id: '',
      legal_case_id: '',
      received_on: new Date().toISOString().substring(0, 10),
      amount: '1000.00',
      reference: '',
      notes: '',
    });
    this.retainerModalVisible.set(true);
  }

  saveRetainer(): void {
    if (this.retainerForm.invalid) {
      this.retainerForm.markAllAsTouched();
      return;
    }
    const val = this.retainerForm.getRawValue();
    const payload: PracticeRetainerRequest = {
      client_id: val.client_id,
      legal_case_id: val.legal_case_id || undefined,
      received_on: val.received_on,
      amount: val.amount,
      reference: val.reference || undefined,
      notes: val.notes || undefined,
    };

    this.practiceApi.createRetainer(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.RETAINER_CREATED'));
        this.retainerModalVisible.set(false);
        this.loadRetainers();
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  voidRetainer(retainerId: string): void {
    this.practiceApi.voidRetainer(retainerId).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.RETAINER_VOIDED'));
        this.loadRetainers();
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  // --- TAB 4: CLOSINGS & CHECKLISTS ---
  loadClosings(): void {
    this.closingsLoading.set(true);
    this.practiceApi
      .getClosingOverview({
        from: this.fromDate(),
        to: this.toDate(),
      })
      .subscribe({
        next: (res) => {
          this.closingsOverview.set(res?.data || null);
          this.closings.set(res?.data?.closings || []);
          this.closingsLoading.set(false);
        },
        error: () => {
          this.closingsLoading.set(false);
        },
      });
  }

  openCreateClosingModal(): void {
    this.closingForm.reset({
      client_id: '',
      period_start: new Date(new Date().getFullYear(), 0, 1).toISOString().substring(0, 10),
      period_end: new Date(new Date().getFullYear(), 11, 31).toISOString().substring(0, 10),
      notes: '',
    });
    this.closingModalVisible.set(true);
  }

  saveClosing(): void {
    if (this.closingForm.invalid) {
      this.closingForm.markAllAsTouched();
      return;
    }
    const val = this.closingForm.getRawValue();
    const defaultChecklist: PracticeClosingChecklistItem[] = [
      { key: 'bank_recon', label: 'Riconciliazione bancaria & estratti conto', done: false },
      { key: 'vat_settlement', label: 'Liquidazione IVA e comunicazione LIPE', done: false },
      { key: 'depreciation', label: 'Ammortamenti e registro cespiti', done: false },
      { key: 'accruals', label: 'Ratei, risconti e fatture da emettere/ricevere', done: false },
      { key: 'withholding_cert', label: 'Certificazione Unica (CU) compensi', done: false },
    ];

    const payload: PracticeClosingRequest = {
      client_id: val.client_id,
      period_start: val.period_start,
      period_end: val.period_end,
      checklist: defaultChecklist,
      notes: val.notes || undefined,
    };

    this.practiceApi.openClosing(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.CLOSING_OPENED'));
        this.closingModalVisible.set(false);
        this.loadClosings();
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  openChecklistModal(closing: PracticeClosing): void {
    this.activeChecklistClosing.set(closing);
    this.checklistModalVisible.set(true);
  }

  toggleChecklistItem(itemKey: string, done: boolean): void {
    const closing = this.activeChecklistClosing();
    if (!closing) return;

    const updatedChecklist = (closing.checklist || []).map((item) =>
      item.key === itemKey ? { ...item, done } : item,
    );
    this.activeChecklistClosing.set({ ...closing, checklist: updatedChecklist });

    this.practiceApi
      .updateClosingChecklist(closing.id, {
        items: updatedChecklist.map((i) => ({ key: i.key, done: i.done })),
      })
      .subscribe({
        next: () => {
          this.loadClosings();
        },
        error: () => {
          this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
        },
      });
  }

  closePeriod(closingId: string): void {
    this.practiceApi.closePeriod(closingId, { allow_unbilled: true }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.PERIOD_CLOSED'));
        this.checklistModalVisible.set(false);
        this.loadClosings();
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  reopenPeriod(closingId: string): void {
    this.practiceApi.reopenPeriod(closingId).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICE.PERIOD_REOPENED'));
        this.checklistModalVisible.set(false);
        this.loadClosings();
      },
      error: () => {
        this.message.error(this.translate.instant('PRACTICE.ACTION_ERROR'));
      },
    });
  }

  // Formatting helpers
  getChecklistCompletion(closing: PracticeClosing): number {
    if (!closing.checklist || closing.checklist.length === 0) return 0;
    const completed = closing.checklist.filter((i) => i.done).length;
    return Math.round((completed / closing.checklist.length) * 100);
  }

  getActivityStatusColor(status: string): string {
    return status === 'billed' ? 'success' : status === 'unbilled' ? 'warning' : 'default';
  }

  getRetainerStatusColor(status: string): string {
    switch (status) {
      case 'open':
        return 'success';
      case 'void':
        return 'error';
      default:
        return 'default';
    }
  }
}
