import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CpqApiService, CpqMarginResult, CpqSimulationMode, CpqSimulationResult } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';

/**
 * Industrial cost, net price and gross margin of a quote, with the discount and margin simulator. Cost and margin are
 * only shown to the roles that may see them: the API answers 403 to the others and the panel then says so.
 */
@Component({
  selector: 'app-cpq-margin-simulator',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    TranslatePipe,
  ],
  template: `
    <h3>{{ 'CPQ.MARGIN.TITLE' | translate }}</h3>
    <nz-spin [nzSpinning]="loading()">
      @if (hidden()) {
        <nz-alert nzType="info" nzShowIcon data-test="cost-hidden" [nzMessage]="'CPQ.MARGIN.HIDDEN' | translate" />
      } @else if (margin(); as m) {
        <div class="figures" data-test="figures">
          <nz-statistic [nzTitle]="'CPQ.MARGIN.INDUSTRIAL_COST' | translate" [nzValue]="m.totals.cost_total" />
          <nz-statistic [nzTitle]="'CPQ.MARGIN.LIST_PRICE' | translate" [nzValue]="m.totals.list_total" />
          <nz-statistic [nzTitle]="'CPQ.MARGIN.NET_PRICE' | translate" [nzValue]="m.totals.net_total" />
          <nz-statistic [nzTitle]="'CPQ.MARGIN.MARGIN_AMOUNT' | translate" [nzValue]="m.totals.margin_amount" />
          <nz-statistic
            [nzTitle]="'CPQ.MARGIN.MARGIN_PERCENT' | translate"
            [nzValue]="m.totals.margin_percent ?? '-'"
            [nzValueStyle]="marginStyle()"
          />
        </div>

        <h3>{{ 'CPQ.SIMULATOR.TITLE' | translate }}</h3>
        <form [formGroup]="form" (ngSubmit)="run()" class="simulator">
          <label for="sim-mode">{{ 'CPQ.SIMULATOR.MODE' | translate }}</label>
          <nz-select id="sim-mode" formControlName="mode">
            @for (mode of modes; track mode.value) {
              <nz-option [nzValue]="mode.value" [nzLabel]="mode.key | translate" />
            }
          </nz-select>
          <label for="sim-value">{{ 'CPQ.SIMULATOR.VALUE' | translate }}</label>
          <nz-input-number id="sim-value" formControlName="value" [nzMin]="0" [nzStep]="1" />
          <button nz-button nzType="primary" type="submit" data-test="simulate" [nzLoading]="simulating()" [disabled]="form.invalid">
            {{ 'CPQ.SIMULATOR.RUN' | translate }}
          </button>
        </form>

        @if (result(); as r) {
          <div class="figures" data-test="simulation">
            <nz-statistic [nzTitle]="'CPQ.SIMULATOR.DISCOUNT_NEEDED' | translate" [nzValue]="r.global_discount_percent + ' %'" />
            <nz-statistic [nzTitle]="'CPQ.MARGIN.NET_PRICE' | translate" [nzValue]="r.simulated.net_total" />
            <nz-statistic [nzTitle]="'CPQ.MARGIN.MARGIN_AMOUNT' | translate" [nzValue]="r.simulated.margin_amount" />
            <nz-statistic [nzTitle]="'CPQ.MARGIN.MARGIN_PERCENT' | translate" [nzValue]="r.simulated.margin_percent ?? '-'" />
          </div>
          @if (!r.achievable) {
            <nz-alert nzType="warning" nzShowIcon data-test="not-achievable" [nzMessage]="'CPQ.SIMULATOR.NOT_ACHIEVABLE' | translate" />
          }
        }
      }
    </nz-spin>
  `,
  styles: `
    .figures {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      margin-bottom: 16px;
    }
    .simulator {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
  `,
})
export class CpqMarginSimulatorComponent {
  private readonly api = inject(CpqApiService);
  private readonly fb = inject(FormBuilder);

  readonly quoteId = input.required<string>();

  protected readonly loading = signal(false);
  protected readonly simulating = signal(false);
  protected readonly hidden = signal(false);
  protected readonly margin = signal<CpqMarginResult | null>(null);
  protected readonly result = signal<CpqSimulationResult | null>(null);

  protected readonly modes: readonly { value: CpqSimulationMode; key: string }[] = [
    { value: 'discount_percent', key: 'CPQ.SIMULATOR.MODE_DISCOUNT' },
    { value: 'target_margin_percent', key: 'CPQ.SIMULATOR.MODE_TARGET_MARGIN' },
    { value: 'target_total_price', key: 'CPQ.SIMULATOR.MODE_TARGET_PRICE' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    mode: this.fb.nonNullable.control<CpqSimulationMode>('discount_percent'),
    value: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
  });

  protected readonly marginStyle = computed(() => {
    const percent = this.margin()?.totals.margin_percent;

    return percent !== null && percent !== undefined && Number(percent) < 0 ? { color: 'var(--ant-error-color, #cf1322)' } : {};
  });

  constructor() {
    effect(() => this.load(this.quoteId()));
  }

  protected run(): void {
    if (this.form.invalid) {
      return;
    }

    this.simulating.set(true);
    this.api.simulate(this.quoteId(), this.form.getRawValue()).subscribe({
      next: (res) => {
        this.result.set(res.data);
        this.simulating.set(false);
      },
      error: () => this.simulating.set(false),
    });
  }

  private load(quoteId: string): void {
    this.loading.set(true);
    this.hidden.set(false);
    this.margin.set(null);
    this.result.set(null);
    this.api.getMargin(quoteId).subscribe({
      next: (res) => {
        this.margin.set(res.data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.hidden.set(err.status === 403);
        this.loading.set(false);
      },
    });
  }
}
