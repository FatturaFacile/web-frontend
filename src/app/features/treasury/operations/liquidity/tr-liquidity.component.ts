import { Component, computed, DestroyRef, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
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
  FetchGridModel,
  ForecastScenario,
  I18nService,
  LiquidityForecast,
  PermissionsService,
  RecurringCashDirection,
  RecurringCashFrequency,
  RecurringCashItem,
  TreasuryOpsApiService,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, MoneyPipe, TableColumnDef, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';

@Component({
  selector: 'app-tr-liquidity',
  styleUrl: './tr-liquidity.component.scss',
  imports: [
    BaseTableComponent,
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
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
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly canWrite = inject(PermissionsService).canWrite('treasury');

  protected readonly directions: RecurringCashDirection[] = ['inflow', 'outflow'];
  protected readonly frequencies: RecurringCashFrequency[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

  protected readonly forecast = signal<LiquidityForecast | null>(null);
  /** Every scenario, offered by the forecast scenario selector (the grid below only holds one page). */
  protected readonly scenarios = signal<ForecastScenario[]>([]);

  /** Server-driven grids: paging, sorting, column filters and grouping run on the API. */
  protected readonly scenarioGrid = new FetchGridModel<ForecastScenario>((query) => this.api.getForecastScenarios(query));
  protected readonly recurringGrid = new FetchGridModel<RecurringCashItem>((query) => this.api.getRecurringItems(query));

  private readonly recurringAmountTpl = viewChild<TemplateRef<{ $implicit: RecurringCashItem; value: unknown }>>('recurringAmountTpl');

  protected readonly scenarioColumns = computed<TableColumnDef<ForecastScenario>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'code', header: this.i18n.translate('TR.CODE'), width: '160px' },
      { key: 'name', header: this.i18n.translate('TR.NAME') },
      { key: 'collection_delay_days', align: 'right', header: this.i18n.translate('TR.COLLECTION_DELAY'), width: '170px' },
      { key: 'disbursement_acceleration_days', align: 'right', header: this.i18n.translate('TR.DISBURSEMENT_ACCELERATION'), width: '190px' },
      { key: 'sales_growth_factor', align: 'right', header: this.i18n.translate('TR.SALES_GROWTH'), width: '150px' },
    ];
  });

  protected readonly recurringColumns = computed<TableColumnDef<RecurringCashItem>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'name', header: this.i18n.translate('TR.NAME') },
      {
        key: 'direction',
        valueLabel: (value) => this.i18n.translate('TR.DIRECTION_' + value.toUpperCase()),
        valueGetter: (row) => this.i18n.translate('TR.DIRECTION_' + row.direction.toUpperCase()),
        header: this.i18n.translate('TR.DIRECTION'),
        width: '130px',
      },
      { key: 'amount', align: 'right', header: this.i18n.translate('TR.AMOUNT'), width: '150px', customCellTemplate: this.recurringAmountTpl() },
      {
        key: 'frequency',
        valueLabel: (value) => this.i18n.translate('TR.FREQUENCY_' + value.toUpperCase()),
        valueGetter: (row) => this.i18n.translate('TR.FREQUENCY_' + row.frequency.toUpperCase()),
        header: this.i18n.translate('TR.FREQUENCY'),
        width: '140px',
      },
      { key: 'next_date', header: this.i18n.translate('TR.NEXT_DATE'), width: '130px' },
    ];
  });
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modal = signal<'scenario' | 'recurring' | null>(null);
  protected readonly formErrors = signal<string[]>([]);

  protected horizonDays = 60;
  protected currency = 'EUR';
  protected minimumBalance: number | null = null;
  protected selectedScenarios: string[] = [];

  protected readonly scenarioForm = this.fb.group({
    code: this.fb.control('', [Validators.required, Validators.maxLength(50), Validators.pattern(/^[A-Z0-9_]+$/)]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(150)]),
    description: this.fb.control('', Validators.maxLength(2000)),
    collection_delay_days: this.fb.control(0, [Validators.min(-365), Validators.max(365)]),
    disbursement_acceleration_days: this.fb.control(0, [Validators.min(-365), Validators.max(365)]),
    sales_growth_factor: this.fb.control(1, [Validators.min(0), Validators.max(5)]),
  });

  protected readonly recurringForm = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(150)]),
    category: this.fb.control('', Validators.maxLength(50)),
    direction: this.fb.control<RecurringCashDirection>('outflow', Validators.required),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    currency: this.fb.control('EUR', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]),
    frequency: this.fb.control<RecurringCashFrequency>('monthly', Validators.required),
    next_date: this.fb.control('', Validators.required),
    end_date: this.fb.control('', endsNotBefore('next_date')),
  });

  constructor() {
    // The API requires end_date on or after next_date.
    revalidateOnStartChange(this.recurringForm, 'next_date', 'end_date', inject(DestroyRef));
  }

  ngOnInit(): void {
    this.loadScenarioOptions();
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
    this.scenarioGrid.reload();
    this.loadScenarioOptions();
  }

  private loadScenarioOptions(): void {
    this.api.getForecastScenarios({ per_page: 200 }).subscribe({ next: (res) => this.scenarios.set(res.data ?? []) });
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
        next: () => this.done(() => this.recurringGrid.reload()),
        error: (err: unknown) => this.failed(err, this.recurringForm),
      });
  }

  protected removeRecurring(item: RecurringCashItem): void {
    this.api.deleteRecurringItem(item.id).subscribe({ next: () => this.recurringGrid.reload() });
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
