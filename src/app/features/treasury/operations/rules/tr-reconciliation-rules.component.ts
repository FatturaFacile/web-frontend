import { Component, computed, DestroyRef, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  FetchGridModel,
  I18nService,
  PermissionsService,
  ReconciliationRule,
  ReconciliationRuleCategory,
  ReconciliationRulePayload,
  TreasuryOpsApiService,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, TableColumnDef, TranslatePipe } from '@shared';
import { revalidateOnStartChange } from '@shared/utils/date-validators';
import { atLeastField } from '@shared/utils/decimal-validators';

const nullableNumber = (value: string | null): number | null => (value === null ? null : Number(value));

@Component({
  selector: 'app-tr-reconciliation-rules',
  styleUrl: './tr-reconciliation-rules.component.scss',
  imports: [
    BaseTableComponent,
    IconActionDirective,
    ModalActionsDirective,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  templateUrl: './tr-reconciliation-rules.component.html',
})
export class TrReconciliationRulesComponent {
  private readonly api = inject(TreasuryOpsApiService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly canWrite = inject(PermissionsService).canWrite('treasury');

  protected readonly categories: ReconciliationRuleCategory[] = [
    'tax_payment',
    'payroll',
    'bank_expense',
    'internal_transfer',
    'generic_expense',
  ];

  /** Server-driven grid of the rules: paging, sorting, column filters and grouping run on the API. */
  protected readonly grid = new FetchGridModel<ReconciliationRule>((query) => this.api.getReconciliationRules(query));

  private readonly stateTpl = viewChild<TemplateRef<{ $implicit: ReconciliationRule; value: unknown }>>('stateTpl');

  protected readonly columns = computed<TableColumnDef<ReconciliationRule>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'priority', align: 'right', header: this.i18n.translate('TR.PRIORITY'), width: '110px' },
      { key: 'name', header: this.i18n.translate('TR.NAME') },
      {
        key: 'category',
        valueLabel: (value) => this.i18n.translate('TR.CATEGORY_' + value.toUpperCase()),
        valueGetter: (row) => this.i18n.translate('TR.CATEGORY_' + row.category.toUpperCase()),
        header: this.i18n.translate('TR.CATEGORY'),
        width: '200px',
      },
      { key: 'ledger_account_code', header: this.i18n.translate('TR.LEDGER_ACCOUNT_CODE'), width: '160px' },
      {
        key: 'is_active',
        serverKey: 'activity_state',
        valueLabel: (value) => this.i18n.translate(value === 'active' ? 'TR.ACTIVE' : 'TR.INACTIVE'),
        valueGetter: (row) => this.i18n.translate(row.is_active ? 'TR.ACTIVE' : 'TR.INACTIVE'),
        header: this.i18n.translate('TR.STATUS'),
        width: '130px',
        customCellTemplate: this.stateTpl(),
      },
    ];
  });
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  private editingId: string | null = null;

  protected readonly form = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(120)]),
    priority: this.fb.control(100, [Validators.min(1), Validators.max(100000)]),
    is_active: this.fb.control(true),
    direction: this.fb.control<'credit' | 'debit' | null>(null),
    expected_amount: this.fb.control<number | null>(null, Validators.min(0.01)),
    amount_tolerance: this.fb.control(0, [Validators.min(0), Validators.max(1000000)]),
    min_amount: this.fb.control<number | null>(null, Validators.min(0)),
    max_amount: this.fb.control<number | null>(null, [Validators.min(0), atLeastField('min_amount')]),
    reference_contains: this.fb.control('', Validators.maxLength(140)),
    description_contains: this.fb.control('', Validators.maxLength(140)),
    counterparty_iban: this.fb.control('', Validators.pattern(/^([A-Za-z]{2}\d{2}[A-Za-z0-9 ]{11,40})?$/)),
    counterparty_name_contains: this.fb.control('', Validators.maxLength(140)),
    category: this.fb.control<ReconciliationRuleCategory>('generic_expense', Validators.required),
    ledger_account_code: this.fb.control('', Validators.pattern(/^([A-Za-z0-9.-]{1,20})?$/)),
  });

  constructor() {
    // The API requires max_amount >= min_amount.
    revalidateOnStartChange(this.form, 'min_amount', 'max_amount', inject(DestroyRef));
  }

  protected openModal(rule: ReconciliationRule | null): void {
    this.editingId = rule?.id ?? null;
    this.formErrors.set([]);
    this.form.reset({
      name: rule?.name ?? '',
      priority: rule?.priority ?? 100,
      is_active: rule?.is_active ?? true,
      direction: rule?.direction ?? null,
      expected_amount: nullableNumber(rule?.expected_amount ?? null),
      amount_tolerance: Number(rule?.amount_tolerance ?? 0),
      min_amount: nullableNumber(rule?.min_amount ?? null),
      max_amount: nullableNumber(rule?.max_amount ?? null),
      reference_contains: rule?.reference_contains ?? '',
      description_contains: rule?.description_contains ?? '',
      counterparty_iban: rule?.counterparty_iban ?? '',
      counterparty_name_contains: rule?.counterparty_name_contains ?? '',
      category: rule?.category ?? 'generic_expense',
      ledger_account_code: rule?.ledger_account_code ?? '',
    });
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload: ReconciliationRulePayload = {
      ...value,
      reference_contains: value.reference_contains || null,
      description_contains: value.description_contains || null,
      counterparty_iban: value.counterparty_iban || null,
      counterparty_name_contains: value.counterparty_name_contains || null,
      ledger_account_code: value.ledger_account_code || null,
    };
    const id = this.editingId;
    this.saving.set(true);
    (id ? this.api.updateReconciliationRule(id, payload) : this.api.createReconciliationRule(payload)).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.grid.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formErrors.set(applyServerErrors(this.form, err));
      },
    });
  }

  protected remove(rule: ReconciliationRule): void {
    this.api.deleteReconciliationRule(rule.id).subscribe({ next: () => this.grid.reload() });
  }
}
