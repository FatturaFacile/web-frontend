import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AccrualScheduleStatus,
  AccrualSourceType,
  AccrualSummaryItem,
  AccrualType,
  applyServerErrors,
  AuthStore,
  CreateAccrualPayload,
  GeneralLedgerApiService,
  GlJournalEntry,
  I18nService,
  PermissionsService,
} from '@core';
import { downloadBlob, IconActionDirective, ModalActionsDirective, MoneyPipe, TranslatePipe } from '@shared';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';
import { GlJournalInspectorDrawerComponent } from '../journals/gl-journal-inspector-drawer.component';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlLookupStore } from '../shared/gl-lookup.store';
import { calculateCompetencePreview } from './competence-calculator.util';
import { GlAccrualsStore } from './gl-accruals.store';

@Component({
  selector: 'app-gl-accruals',
  styleUrl: './gl-accruals.component.scss',
  providers: [GlAccrualsStore],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzFormModule,
    NzGridModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    GlErrorAlertComponent,
    GlJournalInspectorDrawerComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './gl-accruals.component.html',
})
export class GlAccrualsComponent implements OnInit {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly store = inject(GlAccrualsStore);
  protected readonly lookups = inject(GlLookupStore);
  protected readonly activeCurrency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly types: AccrualType[] = [
    'prepaid_expense',
    'deferred_revenue',
    'accrued_revenue',
    'accrued_expense',
  ];
  protected readonly sourceTypes: AccrualSourceType[] = [
    'sales_invoice_line',
    'passive_invoice_line',
    'journal_line',
    'manual',
  ];
  protected readonly statuses: AccrualScheduleStatus[] = [
    'calculated',
    'closing_posted',
    'reversal_posted',
  ];

  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly error = signal<unknown>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly autoGenerateReversals = signal(false);
  protected readonly inspectedEntry = signal<GlJournalEntry | null>(null);

  protected readonly form = this.fb.group({
    accrual_type: this.fb.control<AccrualType>('prepaid_expense', Validators.required),
    description: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    total_amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    coverage_start: this.fb.control('', Validators.required),
    coverage_end: this.fb.control('', [
      Validators.required,
      endsNotBefore('coverage_start', { strict: true }),
    ]),
    cutoff_date: this.fb.control('', Validators.required),
    income_statement_account_id: this.fb.control('', Validators.required),
    balance_sheet_account_id: this.fb.control('', Validators.required),
    cost_center_id: this.fb.control(''),
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  protected readonly manualPreview = computed(() => {
    const v = this.formValue();
    if (!v.total_amount || !v.coverage_start || !v.coverage_end || !v.cutoff_date) {
      return null;
    }
    return calculateCompetencePreview({
      totalAmount: Number(v.total_amount),
      startDate: v.coverage_start,
      endDate: v.coverage_end,
      explicitType: v.accrual_type ?? 'prepaid_expense',
      fiscalYearEnd: v.cutoff_date,
    });
  });

  protected readonly displayCurrency = computed(
    () => this.store.currency() || this.activeCurrency(),
  );

  protected readonly allPendingChecked = computed(() => {
    const pending = this.store.pendingItems();
    const selected = this.store.selectedSet();
    return pending.length > 0 && pending.every((item) => selected.has(item.item_key));
  });

  constructor() {
    revalidateOnStartChange(this.form, 'coverage_start', 'coverage_end', this.destroyRef);
    this.lookups.load();
  }

  ngOnInit(): void {
    void this.initWorkbench();
  }

  private async initWorkbench(): Promise<void> {
    await this.store.loadFiscalYears();
    await this.store.loadSummary();
  }

  protected onFiscalYearChange(fiscalYearId: string | null): void {
    this.store.setFilter({ fiscalYearId });
    void this.store.loadSummary();
  }

  protected setType(accrualType: AccrualType | null): void {
    this.store.setFilter({ accrualType });
    void this.store.loadSummary();
  }

  protected setStatus(status: AccrualScheduleStatus | null): void {
    this.store.setFilter({ status });
    void this.store.loadSummary();
  }

  protected setSourceType(sourceType: AccrualSourceType | null): void {
    this.store.setFilter({ sourceType });
    void this.store.loadSummary();
  }

  protected setAccountId(accountId: string | null): void {
    this.store.setFilter({ accountId });
    void this.store.loadSummary();
  }

  protected setCompetenceFrom(competenceFrom: string): void {
    this.store.setFilter({ competenceFrom: competenceFrom || null });
    void this.store.loadSummary();
  }

  protected setCompetenceTo(competenceTo: string): void {
    this.store.setFilter({ competenceTo: competenceTo || null });
    void this.store.loadSummary();
  }

  protected setSearch(search: string): void {
    this.store.setFilter({ search });
    void this.store.loadSummary();
  }

  protected typeTagColor(type: AccrualType): string {
    switch (type) {
      case 'prepaid_expense':
        return 'blue';
      case 'deferred_revenue':
        return 'purple';
      case 'accrued_revenue':
        return 'green';
      case 'accrued_expense':
        return 'orange';
    }
  }

  protected statusTagColor(status: AccrualScheduleStatus): string {
    switch (status) {
      case 'calculated':
        return 'gold';
      case 'closing_posted':
        return 'blue';
      case 'reversal_posted':
        return 'green';
    }
  }

  protected isItemChecked(item: AccrualSummaryItem): boolean {
    return this.store.selectedSet().has(item.item_key);
  }

  protected async runClosingEntries(): Promise<void> {
    if (!this.canWrite) {
      return;
    }
    if (this.store.pendingItems().length === 0) {
      this.message.info(this.i18n.translate('GL.ACCRUALS_NO_PENDING'));
      return;
    }
    const result = await this.store.generateClosingEntries(this.autoGenerateReversals());
    if (result) {
      this.message.success(
        this.i18n.translate('GL.ACCRUALS_CLOSING_SUCCESS', {
          posted: result.posted.length,
          skipped: result.skipped.length,
          failed: result.failed.length,
        }),
      );
      if (result.failed.length > 0) {
        this.message.warning(result.failed[0].message);
      }
      await this.store.loadSummary();
    }
  }

  protected async runReversals(): Promise<void> {
    if (!this.canWrite) {
      return;
    }
    if (this.store.reversibleItems().length === 0) {
      this.message.info(this.i18n.translate('GL.ACCRUALS_NO_PENDING'));
      return;
    }
    const result = await this.store.generateReversals();
    if (result) {
      this.message.success(
        this.i18n.translate('GL.ACCRUALS_REVERSAL_SUCCESS', {
          reversed: result.reversed.length,
          skipped: result.skipped.length,
          failed: result.failed.length,
        }),
      );
      if (result.failed.length > 0) {
        this.message.warning(result.failed[0].message);
      }
      await this.store.loadSummary();
    }
  }

  protected async exportReconciliation(format: 'csv' | 'xlsx' = 'csv'): Promise<void> {
    const file = await this.store.exportReconciliation(format);
    if (file) {
      downloadBlob(file.blob, file.filename);
    }
  }

  protected inspectJournal(journalEntryId: string | null): void {
    if (!journalEntryId) {
      return;
    }
    this.api.getJournal(journalEntryId).subscribe({
      next: (res) => {
        if (res?.data) {
          this.inspectedEntry.set(res.data);
        }
      },
    });
  }

  protected reverseInspected(entry: GlJournalEntry): void {
    const reversalDate = entry.auto_reverse_on ?? this.store.reversalDate() ?? entry.posting_date;
    this.api
      .reverseJournalEntry(entry.id, {
        reversal_date: reversalDate,
        reason: this.i18n.translate('GL.JOURNAL_STORNO_REASON'),
      })
      .subscribe({
        next: () => {
          this.inspectedEntry.set(null);
          void this.store.loadSummary();
        },
      });
  }

  protected openCreate(): void {
    this.form.reset({
      accrual_type: 'prepaid_expense',
      cutoff_date: this.store.cutoffDate() || '',
    });
    this.formErrors.set([]);
    this.error.set(null);
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload: CreateAccrualPayload = {
      accrual_type: value.accrual_type,
      description: value.description,
      total_amount: value.total_amount ?? 0,
      coverage_start: value.coverage_start,
      coverage_end: value.coverage_end,
      cutoff_date: value.cutoff_date,
      income_statement_account_id: value.income_statement_account_id,
      balance_sheet_account_id: value.balance_sheet_account_id,
      cost_center_id: value.cost_center_id || null,
    };
    this.saving.set(true);
    this.api.createAccrual(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.message.success(this.i18n.translate('GL.ACCRUAL_CREATED'));
        void this.store.loadSummary();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(err);
        this.formErrors.set(applyServerErrors(this.form, err));
      },
    });
  }
}
