import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  Budget,
  BudgetLine,
  BudgetVarianceReport,
  GeneralLedgerApiService,
  GlFiscalYear,
  I18nService,
  PermissionsService,
  RollingForecastReport,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { GlLookupStore } from '../shared/gl-lookup.store';

@Component({
  selector: 'app-gl-budgets',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './gl-budgets.component.html',
})
export class GlBudgetsComponent implements OnInit {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly lookups = inject(GlLookupStore);
  protected readonly currency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly years = signal<GlFiscalYear[]>([]);
  protected readonly yearId = signal<string | null>(null);
  protected readonly budgets = signal<Budget[]>([]);
  protected readonly selected = signal<Budget | null>(null);
  protected readonly variance = signal<BudgetVarianceReport | null>(null);
  protected readonly forecast = signal<RollingForecastReport | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly isDraft = computed(() => this.selected()?.status === 'draft');

  protected readonly form = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    notes: this.fb.control(''),
  });
  protected readonly lines = this.fb.array([this.newLine()]);

  ngOnInit(): void {
    this.lookups.load();
    this.api.getFiscalYears().subscribe({ next: (res) => this.years.set(res.data ?? []) });
    this.loadBudgets();
  }

  protected selectYear(id: string | null): void {
    this.yearId.set(id);
    this.loadBudgets();
  }

  protected loadBudgets(): void {
    this.loading.set(true);
    this.api.getBudgets(this.yearId() ?? undefined).subscribe({
      next: (res) => {
        this.budgets.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openCreate(): void {
    this.form.reset();
    this.modalOpen.set(true);
  }

  protected create(): void {
    const yearId = this.yearId();
    if (this.form.invalid || !yearId) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.api.createBudget({ fiscal_year_id: yearId, name: value.name, notes: value.notes || null }).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.loadBudgets();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        applyServerErrors(this.form, err);
      },
    });
  }

  protected open(budget: Budget): void {
    this.variance.set(null);
    this.forecast.set(null);
    this.api.getBudget(budget.id).subscribe({
      next: (res) => {
        this.selected.set(res.data);
        this.lines.clear();
        for (const line of res.data.lines ?? []) {
          const group = this.newLine();
          group.setValue({
            account_id: line.account_id,
            cost_center_id: line.cost_center_id ?? '',
            period_number: line.period_number,
            amount: Number(line.amount),
          });
          this.lines.push(group);
        }
        if (this.lines.length === 0) {
          this.lines.push(this.newLine());
        }
        this.loadReports(res.data.id);
      },
    });
  }

  protected addLine(): void {
    this.lines.push(this.newLine());
  }

  protected removeLine(index: number): void {
    this.lines.removeAt(index);
  }

  protected saveLines(): void {
    const budget = this.selected();
    if (!budget || this.lines.invalid) {
      this.lines.markAllAsTouched();
      return;
    }
    const lines: BudgetLine[] = (this.lines as FormArray).getRawValue().map((l) => ({
      account_id: l.account_id,
      cost_center_id: l.cost_center_id || null,
      period_number: l.period_number,
      amount: l.amount,
    }));
    this.saving.set(true);
    this.api.replaceBudgetLines(budget.id, lines).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.selected.set(res.data);
        this.message.success(this.i18n.translate('GL.BUDGET_SAVED'));
        this.loadReports(budget.id);
      },
      error: () => this.saving.set(false),
    });
  }

  protected approve(): void {
    const budget = this.selected();
    if (budget) {
      this.api.approveBudget(budget.id).subscribe({
        next: (res) => {
          this.selected.set(res.data);
          this.loadBudgets();
        },
      });
    }
  }

  protected newVersion(): void {
    const budget = this.selected();
    if (budget) {
      this.api.newBudgetVersion(budget.id).subscribe({
        next: (res) => {
          this.loadBudgets();
          this.open(res.data);
        },
      });
    }
  }

  protected columns(rows: Record<string, string | null>[]): string[] {
    return rows.length > 0 ? Object.keys(rows[0]) : [];
  }

  private loadReports(id: string): void {
    this.api.getBudgetVariance(id).subscribe({ next: (res) => this.variance.set(res.data) });
    this.api.getBudgetRollingForecast(id).subscribe({ next: (res) => this.forecast.set(res.data) });
  }

  private newLine() {
    return this.fb.group({
      account_id: this.fb.control('', Validators.required),
      cost_center_id: this.fb.control(''),
      period_number: this.fb.control(1, [Validators.required, Validators.min(1), Validators.max(14)]),
      amount: this.fb.control(0, Validators.required),
    });
  }
}
