import { Component, inject, OnInit, signal } from '@angular/core';
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
  PermissionsService,
  ReconciliationRule,
  ReconciliationRuleCategory,
  ReconciliationRulePayload,
  TreasuryOpsApiService,
} from '@core';
import { TranslatePipe } from '@shared';

const nullableNumber = (value: string | null): number | null => (value === null ? null : Number(value));

@Component({
  selector: 'app-tr-reconciliation-rules',
  imports: [
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
export class TrReconciliationRulesComponent implements OnInit {
  private readonly api = inject(TreasuryOpsApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly canWrite = inject(PermissionsService).canWrite('treasury');

  protected readonly categories: ReconciliationRuleCategory[] = [
    'tax_payment',
    'payroll',
    'bank_expense',
    'internal_transfer',
    'generic_expense',
  ];
  protected readonly items = signal<ReconciliationRule[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  private editingId: string | null = null;

  protected readonly form = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    priority: this.fb.control(100),
    is_active: this.fb.control(true),
    direction: this.fb.control<'credit' | 'debit' | null>(null),
    expected_amount: this.fb.control<number | null>(null),
    amount_tolerance: this.fb.control(0),
    min_amount: this.fb.control<number | null>(null),
    max_amount: this.fb.control<number | null>(null),
    reference_contains: this.fb.control(''),
    description_contains: this.fb.control(''),
    counterparty_iban: this.fb.control(''),
    counterparty_name_contains: this.fb.control(''),
    category: this.fb.control<ReconciliationRuleCategory>('generic_expense', Validators.required),
    ledger_account_code: this.fb.control(''),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getReconciliationRules().subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
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
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formErrors.set(applyServerErrors(this.form, err));
      },
    });
  }

  protected remove(rule: ReconciliationRule): void {
    this.api.deleteReconciliationRule(rule.id).subscribe({ next: () => this.load() });
  }
}
