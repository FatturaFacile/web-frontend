import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
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
import { NzTableModule } from 'ng-zorro-antd/table';
import {
  Accrual,
  AccrualType,
  applyServerErrors,
  AuthStore,
  CreateAccrualPayload,
  GeneralLedgerApiService,
  I18nService,
  PermissionsService,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlLookupStore } from '../shared/gl-lookup.store';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';

@Component({
  selector: 'app-gl-accruals',
  styleUrl: './gl-accruals.component.scss',
  imports: [
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
    NzTableModule,
    GlErrorAlertComponent,
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
  protected readonly lookups = inject(GlLookupStore);
  protected readonly currency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly types: AccrualType[] = ['accrued_revenue', 'accrued_expense', 'prepaid_expense', 'deferred_revenue'];
  protected readonly items = signal<Accrual[]>([]);
  protected readonly loading = signal(false);
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

  constructor() {
    // The API requires coverage_end after coverage_start.
    revalidateOnStartChange(this.form, 'coverage_start', 'coverage_end', this.destroyRef);
  }

  ngOnInit(): void {
    this.lookups.load();
    this.load();
  }

  protected setType(type: AccrualType | null): void {
    this.typeFilter.set(type);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getAccruals({ accrual_type: this.typeFilter() ?? undefined }).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
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
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(err);
        this.formErrors.set(applyServerErrors(this.form, err));
      },
    });
  }
}
