import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DateRangeParams, GeneralLedgerApiService, LedgerTrialBalance } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { GlLookupStore } from '../shared/gl-lookup.store';
import { currentYearEnd, currentYearStart, rangeEndsBeforeStart } from '../shared/gl-dates';

@Component({
  selector: 'app-gl-trial-balance',
  styleUrl: './gl-trial-balance.component.scss',
  imports: [FormsModule, NzButtonModule, NzInputModule, NzSelectModule, NzTableModule, NzTagModule, MoneyPipe, TranslatePipe],
  template: `
    <div class="filters">
      <label for="tb-from">{{ 'GL.FROM' | translate }}</label>
      <input class="date-input" id="tb-from" nz-input type="date" [(ngModel)]="from" />
      <label for="tb-to">{{ 'GL.TO' | translate }}</label>
      <input class="date-input" id="tb-to" nz-input type="date" [(ngModel)]="to" />
      <label for="tb-cfrom">{{ 'GL.COMPARE_FROM' | translate }}</label>
      <input class="date-input" id="tb-cfrom" nz-input type="date" [(ngModel)]="compareFrom" />
      <label for="tb-cto">{{ 'GL.COMPARE_TO' | translate }}</label>
      <input class="date-input" id="tb-cto" nz-input type="date" [(ngModel)]="compareTo" />
      <nz-select
        class="select-md"
        nzAllowClear
        [attr.aria-label]="'GL.COST_CENTER' | translate"
        [nzPlaceHolder]="'GL.COST_CENTER' | translate"
        [(ngModel)]="costCenterId"
      >
        @for (center of lookups.costCenters(); track center.id) {
          <nz-option [nzValue]="center.id" [nzLabel]="center.code + ' ' + center.name" />
        }
      </nz-select>
      <button nz-button nzType="primary" type="button" [disabled]="rangeInvalid()" [nzLoading]="loading()" (click)="load()">{{ 'GL.RUN_REPORT' | translate }}</button>
      @if (rangeInvalid()) {
        <span class="ant-form-item-explain-error" role="alert">{{ 'COMMON.VALIDATION.END_AFTER_START' | translate }}</span>
      }
    </div>

    @if (report(); as r) {
      <p>
        <nz-tag>{{ 'GL.REPORT_CURRENCY' | translate }}: {{ r.currency }}</nz-tag>
        <nz-tag [nzColor]="r.is_balanced ? 'green' : 'red'">{{ (r.is_balanced ? 'GL.BALANCED' : 'GL.NOT_BALANCED') | translate }}</nz-tag>
      </p>
      <nz-table nzSize="small" [nzData]="r.accounts" [nzPageSize]="50" [nzLoading]="loading()">
        <thead>
          <tr>
            <th>{{ 'GL.COL_ACCOUNT' | translate }}</th>
            <th nzAlign="right">{{ 'GL.COL_OPENING' | translate }}</th>
            <th nzAlign="right">{{ 'GL.COL_DEBIT' | translate }}</th>
            <th nzAlign="right">{{ 'GL.COL_CREDIT' | translate }}</th>
            <th nzAlign="right">{{ 'GL.COL_CLOSING' | translate }}</th>
            @if (r.compare_from) {
              <th nzAlign="right">{{ 'GL.COL_COMPARISON' | translate }} ({{ 'GL.COL_DEBIT' | translate }})</th>
              <th nzAlign="right">{{ 'GL.COL_COMPARISON' | translate }} ({{ 'GL.COL_CREDIT' | translate }})</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of r.accounts; track row.account_id) {
            <tr>
              <td>{{ row.account_code }} {{ row.account_name }}</td>
              <td nzAlign="right">{{ row.opening_balance | money: r.currency }}</td>
              <td nzAlign="right">{{ row.debit | money: r.currency }}</td>
              <td nzAlign="right">{{ row.credit | money: r.currency }}</td>
              <td nzAlign="right">{{ row.closing_balance | money: r.currency }}</td>
              @if (r.compare_from) {
                <td nzAlign="right">{{ row.comparison_debit | money: r.currency }}</td>
                <td nzAlign="right">{{ row.comparison_credit | money: r.currency }}</td>
              }
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
})
export class GlTrialBalanceComponent {
  private readonly api = inject(GeneralLedgerApiService);
  protected readonly lookups = inject(GlLookupStore);

  protected readonly report = signal<LedgerTrialBalance | null>(null);
  protected readonly loading = signal(false);
  protected rangeInvalid(): boolean {
    return rangeEndsBeforeStart(this.from, this.to) || rangeEndsBeforeStart(this.compareFrom, this.compareTo);
  }

  protected from = currentYearStart();
  protected to = currentYearEnd();
  protected compareFrom = '';
  protected compareTo = '';
  protected costCenterId: string | null = null;

  protected load(): void {
    const params: DateRangeParams = {
      from: this.from,
      to: this.to,
      compare_from: this.compareFrom || null,
      compare_to: this.compareTo || null,
      cost_center_id: this.costCenterId,
    };
    this.loading.set(true);
    this.api.getTrialBalanceReport(params).subscribe({
      next: (res) => {
        this.report.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
