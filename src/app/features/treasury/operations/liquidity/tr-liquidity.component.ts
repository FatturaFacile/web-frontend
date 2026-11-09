import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  ForecastScenario,
  LiquidityForecast,
  PermissionsService,
  RecurringCashDirection,
  RecurringCashFrequency,
  RecurringCashItem,
  TreasuryOpsApiService,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';

@Component({
  selector: 'app-tr-liquidity',
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
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './tr-liquidity.component.html',
})
export class TrLiquidityComponent implements OnInit {
  private readonly api = inject(TreasuryOpsApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly canWrite = inject(PermissionsService).canWrite('treasury');

  protected readonly directions: RecurringCashDirection[] = ['inflow', 'outflow'];
  protected readonly frequencies: RecurringCashFrequency[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

  protected readonly forecast = signal<LiquidityForecast | null>(null);
  protected readonly scenarios = signal<ForecastScenario[]>([]);
  protected readonly recurring = signal<RecurringCashItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modal = signal<'scenario' | 'recurring' | null>(null);
  protected readonly formErrors = signal<string[]>([]);

  protected horizonDays = 60;
  protected currency = 'EUR';
  protected minimumBalance: number | null = null;
  protected selectedScenarios: string[] = [];

  protected readonly scenarioForm = this.fb.group({
    code: this.fb.control('', [Validators.required, Validators.maxLength(50)]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    description: this.fb.control(''),
    collection_delay_days: this.fb.control(0),
    disbursement_acceleration_days: this.fb.control(0),
    sales_growth_factor: this.fb.control(1),
  });

  protected readonly recurringForm = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    category: this.fb.control(''),
    direction: this.fb.control<RecurringCashDirection>('outflow', Validators.required),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    currency: this.fb.control('EUR', Validators.required),
    frequency: this.fb.control<RecurringCashFrequency>('monthly', Validators.required),
    next_date: this.fb.control('', Validators.required),
    end_date: this.fb.control(''),
  });

  ngOnInit(): void {
    this.loadScenarios();
    this.loadRecurring();
  }

  protected loadForecast(): void {
    this.loading.set(true);
    this.api
      .getLiquidityForecast(
        { horizon_days: this.horizonDays, currency: this.currency, minimum_balance: this.minimumBalance },
        this.selectedScenarios,
      )
      .subscribe({
        next: (res) => {
          this.forecast.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected loadScenarios(): void {
    this.api.getForecastScenarios().subscribe({ next: (res) => this.scenarios.set(res.data ?? []) });
  }

  protected loadRecurring(): void {
    this.api.getRecurringItems().subscribe({ next: (res) => this.recurring.set(res.data ?? []) });
  }

  protected openModal(kind: 'scenario' | 'recurring'): void {
    this.formErrors.set([]);
    if (kind === 'scenario') {
      this.scenarioForm.reset({ collection_delay_days: 0, disbursement_acceleration_days: 0, sales_growth_factor: 1 });
    } else {
      this.recurringForm.reset({ direction: 'outflow', currency: 'EUR', frequency: 'monthly' });
    }
    this.modal.set(kind);
  }

  protected saveScenario(): void {
    if (this.scenarioForm.invalid) {
      this.scenarioForm.markAllAsTouched();
      return;
    }
    const value = this.scenarioForm.getRawValue();
    this.saving.set(true);
    this.api.createForecastScenario({ ...value, description: value.description || null }).subscribe({
      next: () => this.done(() => this.loadScenarios()),
      error: (err: unknown) => this.failed(err, this.scenarioForm),
    });
  }

  protected saveRecurring(): void {
    if (this.recurringForm.invalid) {
      this.recurringForm.markAllAsTouched();
      return;
    }
    const value = this.recurringForm.getRawValue();
    this.saving.set(true);
    this.api
      .createRecurringItem({
        ...value,
        amount: value.amount ?? 0,
        currency: value.currency.toUpperCase(),
        category: value.category || undefined,
        end_date: value.end_date || null,
      })
      .subscribe({
        next: () => this.done(() => this.loadRecurring()),
        error: (err: unknown) => this.failed(err, this.recurringForm),
      });
  }

  protected removeRecurring(item: RecurringCashItem): void {
    this.api.deleteRecurringItem(item.id).subscribe({ next: () => this.loadRecurring() });
  }

  private done(reload: () => void): void {
    this.saving.set(false);
    this.modal.set(null);
    reload();
  }

  private failed(err: unknown, form: Parameters<typeof applyServerErrors>[0]): void {
    this.saving.set(false);
    this.formErrors.set(applyServerErrors(form, err));
  }
}
