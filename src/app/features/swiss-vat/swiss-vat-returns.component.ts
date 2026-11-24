import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  I18nService,
  PermissionsService,
  SwissVatFrequency,
  SwissVatMethod,
  SwissVatReturn,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { SwissVatStore } from './swiss-vat.store';
import { maxPeriodNumber, RETURN_STATUS_COLORS } from './swiss-vat.util';

/** Swiss VAT periodic returns dashboard & period calculation wizard (Effective & Saldosteuersatz). */
@Component({
  selector: 'app-swiss-vat-returns',
  imports: [
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputNumberModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'swissVat.title' | translate" [subtitle]="'swissVat.subtitle' | translate" />

    <div class="mb-4 flex flex-wrap gap-2">
      <a nz-button routerLink="/swiss-vat/returns" nzType="primary">{{ 'swissVat.tab.returns' | translate }}</a>
      <a nz-button routerLink="/swiss-vat/config">{{ 'swissVat.tab.config' | translate }}</a>
      <a nz-button routerLink="/swiss-vat/bezugsteuer">{{ 'swissVat.tab.bezugsteuer' | translate }}</a>
      <a nz-button routerLink="/swiss-vat/adjustments">{{ 'swissVat.tab.adjustments' | translate }}</a>
    </div>

    @if (store.config(); as cfg) {
      <nz-card class="mb-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
          <nz-statistic
            [nzTitle]="'swissVat.field.uidMwst' | translate"
            [nzValue]="cfg.uid_mwst ?? '—'"
          />
          <nz-statistic
            [nzTitle]="'swissVat.field.method' | translate"
            [nzValue]="('swissVat.method.' + cfg.accounting_method) | translate"
          />
          <nz-statistic
            [nzTitle]="'swissVat.field.basis' | translate"
            [nzValue]="('swissVat.basis.' + cfg.consideration_basis) | translate"
          />
          <nz-statistic
            [nzTitle]="'swissVat.field.frequency' | translate"
            [nzValue]="('swissVat.freq.' + cfg.reporting_frequency) | translate"
          />
        </div>
      </nz-card>
    }

    <nz-card [nzTitle]="'swissVat.action.calculate' | translate" class="mb-4">
      <div class="flex flex-wrap items-end gap-4">
        <label for="swiss-vat-returns-ctl-1" class="flex flex-col gap-1">
          <span>{{ 'swissVat.field.year' | translate }}</span>
          <nz-input-number nzId="swiss-vat-returns-ctl-1"
            data-testid="ch-vat-year"
            [nzMin]="2018"
            [nzMax]="2100"
            [ngModel]="year()"
            (ngModelChange)="year.set($event ?? year())"
          />
        </label>

        <label for="swiss-vat-returns-ctl-2" class="flex flex-col gap-1">
          <span>{{ 'swissVat.field.frequency' | translate }}</span>
          <nz-select nzId="swiss-vat-returns-ctl-2"
            data-testid="ch-vat-frequency"
            class="w-40"
            [ngModel]="periodType()"
            (ngModelChange)="onFrequencyChange($event)"
          >
            <nz-option nzValue="quarterly" [nzLabel]="'swissVat.freq.quarterly' | translate" />
            <nz-option nzValue="semiannual" [nzLabel]="'swissVat.freq.semiannual' | translate" />
            <nz-option nzValue="monthly" [nzLabel]="'swissVat.freq.monthly' | translate" />
          </nz-select>
        </label>

        <label for="swiss-vat-returns-ctl-3" class="flex flex-col gap-1">
          <span>{{ 'swissVat.field.period' | translate }}</span>
          <nz-input-number nzId="swiss-vat-returns-ctl-3"
            data-testid="ch-vat-period"
            [nzMin]="1"
            [nzMax]="maxPeriod()"
            [ngModel]="periodNumber()"
            (ngModelChange)="periodNumber.set($event ?? 1)"
          />
        </label>

        <label for="swiss-vat-returns-ctl-4" class="flex flex-col gap-1">
          <span>{{ 'swissVat.field.method' | translate }}</span>
          <nz-select nzId="swiss-vat-returns-ctl-4"
            data-testid="ch-vat-method"
            class="w-60"
            [ngModel]="method()"
            (ngModelChange)="method.set($event)"
          >
            <nz-option nzValue="effective" [nzLabel]="'swissVat.method.effective' | translate" />
            <nz-option nzValue="saldosteuersatz" [nzLabel]="'swissVat.method.saldosteuersatz' | translate" />
          </nz-select>
        </label>

        @if (canWrite()) {
          <button
            nz-button
            nzType="primary"
            type="button"
            data-testid="ch-vat-calculate-btn"
            [nzLoading]="store.saving()"
            (click)="calculate()"
          >
            {{ 'swissVat.action.calculate' | translate }}
          </button>
        }
      </div>
    </nz-card>

    <nz-card [nzTitle]="'NAV.SWISS_VAT_RETURNS' | translate">
      <nz-table
        #returnsTable
        [nzData]="store.returns()"
        [nzLoading]="store.loading()"
        [nzPageSize]="10"
      >
        <thead>
          <tr>
            <th>{{ 'swissVat.field.period' | translate }}</th>
            <th>{{ 'swissVat.field.method' | translate }}</th>
            <th>{{ 'swissVat.kpi.turnover' | translate }}</th>
            <th>{{ 'swissVat.kpi.outputTax' | translate }}</th>
            <th>{{ 'swissVat.kpi.inputTax' | translate }}</th>
            <th>{{ 'swissVat.kpi.payable' | translate }}</th>
            <th>{{ 'swissVat.quadratura.title' | translate }}</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (row of returnsTable.data; track row.id) {
            <tr>
              <td>
                <strong>{{ row.period_label }}</strong>
                <div class="text-xs opacity-70">{{ row.period_from }} — {{ row.period_to }}</div>
              </td>
              <td>{{ ('swissVat.method.' + row.accounting_method) | translate }}</td>
              <td>{{ row.box_200_total_turnover | money: row.currency }}</td>
              <td>{{ row.box_399_total_output_tax | money: row.currency }}</td>
              <td>{{ row.box_479_total_input_tax | money: row.currency }}</td>
              <td>
                @if (+row.box_510_credit_amount > 0) {
                  <nz-tag nzColor="green">-{{ row.box_510_credit_amount | money: row.currency }}</nz-tag>
                } @else {
                  <strong>{{ row.box_500_payable_amount | money: row.currency }}</strong>
                }
              </td>
              <td>
                <nz-tag [nzColor]="row.quadratura_passed ? 'green' : 'red'">
                  {{ row.quadratura_passed ? 'OK' : 'FAIL' }}
                </nz-tag>
              </td>
              <td>
                <nz-tag [nzColor]="statusColors[row.status]">
                  {{ ('swissVat.status.' + row.status) | translate }}
                </nz-tag>
              </td>
              <td>
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  (click)="openReconciliation(row)"
                >
                  {{ 'swissVat.action.openReconciliation' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class SwissVatReturnsComponent implements OnInit {
  readonly store = inject(SwissVatStore);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  readonly statusColors = RETURN_STATUS_COLORS;
  readonly year = signal(new Date().getFullYear());
  readonly periodType = signal<SwissVatFrequency>('quarterly');
  readonly periodNumber = signal(1);
  readonly method = signal<SwissVatMethod>('effective');
  readonly maxPeriod = computed(() => maxPeriodNumber(this.periodType()));
  readonly canWrite = computed(() => this.permissions.hasAccess('swiss_vat', 'write'));

  async ngOnInit(): Promise<void> {
    await this.store.loadReturns();
    const cfg = this.store.config();
    if (cfg) {
      this.periodType.set(cfg.reporting_frequency);
      this.method.set(cfg.accounting_method);
    }
  }

  onFrequencyChange(freq: SwissVatFrequency): void {
    this.periodType.set(freq);
    const max = maxPeriodNumber(freq);
    if (this.periodNumber() > max) {
      this.periodNumber.set(max);
    }
  }

  async calculate(): Promise<void> {
    try {
      const created = await this.store.calculateReturn({
        fiscal_year: this.year(),
        period_type: this.periodType(),
        period_number: this.periodNumber(),
        accounting_method: this.method(),
      });
      this.message.success(`${created.period_label} — ${this.i18n.translate('swissVat.status.' + created.status)}`);
    } catch {
      this.message.error(this.i18n.translate('swissVat.quadratura.failed'));
    }
  }

  openReconciliation(row: SwissVatReturn): void {
    void this.router.navigate(['/swiss-vat/reconciliation', row.id]);
  }
}
