import { Component, computed, DestroyRef, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  Accrual,
  AccrualType,
  applyServerErrors,
  AuthStore,
  CreateAccrualPayload,
  FetchGridModel,
  GeneralLedgerApiService,
  I18nService,
  PermissionsService,
  QueryFilterParams,
} from '@core';
import { BaseTableComponent, MoneyPipe, TableColumnDef, TranslatePipe, IconActionDirective, ModalActionsDirective } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlLookupStore } from '../shared/gl-lookup.store';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';

interface AccrualGridFilter extends QueryFilterParams {
  accrual_type?: string;
}

@Component({
  selector: 'app-gl-accruals',
  styleUrl: './gl-accruals.component.scss',
  imports: [
    BaseTableComponent,
    IconActionDirective,
    ModalActionsDirective,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    GlErrorAlertComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './gl-accruals.component.html',
})
export class GlAccrualsComponent {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly lookups = inject(GlLookupStore);
  protected readonly currency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly types: AccrualType[] = ['accrued_revenue', 'accrued_expense', 'prepaid_expense', 'deferred_revenue'];
  protected readonly grid = new FetchGridModel<Accrual, AccrualGridFilter>((query) => this.api.getAccruals(query));
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly error = signal<unknown>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly typeFilter = signal<AccrualType | null>(null);

  protected readonly form = this.fb.group({
    accrual_type: this.fb.control<AccrualType>('prepaid_expense', Validators.required),
    description: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    total_amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    coverage_start: this.fb.control('', Validators.required),
    coverage_end: this.fb.control('', [Validators.required, endsNotBefore('coverage_start', { strict: true })]),
    cutoff_date: this.fb.control('', Validators.required),
    income_statement_account_id: this.fb.control('', Validators.required),
    balance_sheet_account_id: this.fb.control('', Validators.required),
    cost_center_id: this.fb.control(''),
  });

  private readonly typeTpl = viewChild<TemplateRef<{ $implicit: Accrual; value: unknown }>>('typeTpl');
  private readonly coverageTpl = viewChild<TemplateRef<{ $implicit: Accrual; value: unknown }>>('coverageTpl');
  private readonly totalTpl = viewChild<TemplateRef<{ $implicit: Accrual; value: unknown }>>('totalTpl');
  private readonly amountTpl = viewChild<TemplateRef<{ $implicit: Accrual; value: unknown }>>('amountTpl');
  private readonly daysTpl = viewChild<TemplateRef<{ $implicit: Accrual; value: unknown }>>('daysTpl');

  protected readonly columns = computed<TableColumnDef<Accrual>[]>(() => {
    this.i18n.currentLanguage();
    return [
      {
        key: 'accrual_type',
        header: 'GL.ACCRUAL_TYPE',
        valueLabel: (value) => this.i18n.translate('GL.ACCRUAL_' + value.toUpperCase()),
        customCellTemplate: this.typeTpl(),
      },
      { key: 'description', header: 'GL.COL_DESCRIPTION' },
      { key: 'coverage_start', header: 'GL.COVERAGE', customCellTemplate: this.coverageTpl() },
      { key: 'cutoff_date', header: 'GL.CUTOFF_DATE' },
      { key: 'total_amount', header: 'GL.ACCRUAL_TOTAL', align: 'right', customCellTemplate: this.totalTpl() },
      { key: 'amount', header: 'GL.ACCRUAL_AMOUNT', align: 'right', customCellTemplate: this.amountTpl() },
      { key: 'accrued_days', header: 'GL.ACCRUAL_DAYS', customCellTemplate: this.daysTpl() },
      { key: 'reversal_date', header: 'GL.REVERSAL_DATE' },
    ];
  });

  constructor() {
    // The API requires coverage_end after coverage_start.
    revalidateOnStartChange(this.form, 'coverage_start', 'coverage_end', this.destroyRef);
    this.lookups.load();
  }

  protected setType(type: AccrualType | null): void {
    this.typeFilter.set(type);
    this.grid.setFilter({ accrual_type: type ?? undefined });
  }

  protected openCreate(): void {
    this.form.reset({ accrual_type: 'prepaid_expense' });
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
        this.grid.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(err);
        this.formErrors.set(applyServerErrors(this.form, err));
      },
    });
  }
}
