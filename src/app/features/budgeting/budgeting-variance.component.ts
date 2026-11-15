import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BUDGET_VARIANCE_GROUPS, BudgetingApiService, BudgetVariance, BudgetVarianceGroup, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { apiErrorText } from './budgeting.util';

/** Budget versus actual of a version: the actuals come from the general ledger. */
@Component({
  selector: 'app-budgeting-variance',
  styleUrl: './budgeting.scss',
  imports: [DecimalPipe, FormsModule, TranslatePipe, NzCardModule, NzEmptyModule, NzSelectModule, NzTableModule, NzTagModule],
  template: `
    <div class="toolbar">
      <nz-select style="width: 220px" [ngModel]="groupBy()" (ngModelChange)="groupBy.set($event); load()" [attr.aria-label]="'BUDGETING.GROUP_BY' | translate">
        @for (value of groups; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('BUDGETING.GROUP_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 220px" [ngModel]="throughPeriod()" (ngModelChange)="throughPeriod.set($event); load()" [attr.aria-label]="'BUDGETING.THROUGH_PERIOD' | translate">
        @for (period of periods; track period) {
          <nz-option [nzValue]="period" [nzLabel]="('BUDGETING.THROUGH_PERIOD_N' | translate: { period: period })"></nz-option>
        }
      </nz-select>
    </div>

    @if (variance(); as data) {
      <div class="stats-grid">
        <nz-card>{{ 'BUDGETING.BUDGET' | translate }}: <strong>{{ data.totals.budget | number: '1.2-2' }}</strong></nz-card>
        <nz-card>{{ 'BUDGETING.ACTUAL' | translate }}: <strong>{{ data.totals.actual | number: '1.2-2' }}</strong></nz-card>
        <nz-card>{{ 'BUDGETING.VARIANCE' | translate }}: <strong>{{ data.totals.variance | number: '1.2-2' }}</strong></nz-card>
        <nz-card>{{ 'BUDGETING.ADVERSE' | translate }}: <strong class="row-overdue">{{ data.totals.adverse | number: '1.2-2' }}</strong></nz-card>
        <nz-card>{{ 'BUDGETING.FAVORABLE' | translate }}: <strong class="row-ok">{{ data.totals.favorable | number: '1.2-2' }}</strong></nz-card>
      </div>

      <nz-card class="main-card">
        <nz-table #table [nzData]="data.rows" nzSize="small" [nzPageSize]="50">
          <thead>
            <tr>
              <th>{{ 'BUDGETING.GROUP_' + data.group_by.toUpperCase() | translate }}</th>
              <th class="num">{{ 'BUDGETING.BUDGET' | translate }}</th>
              <th class="num">{{ 'BUDGETING.ACTUAL' | translate }}</th>
              <th class="num">{{ 'BUDGETING.VARIANCE' | translate }}</th>
              <th class="num">{{ 'BUDGETING.VARIANCE_PERCENT' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.key) {
              <tr>
                <td>{{ row.code }} <span class="muted">{{ row.label }}</span></td>
                <td class="num">{{ row.budget | number: '1.2-2' }}</td>
                <td class="num">{{ row.actual | number: '1.2-2' }}</td>
                <td class="num" [class.row-overdue]="!row.is_favorable" [class.row-ok]="row.is_favorable && row.status !== 'on_budget'">{{ row.variance | number: '1.2-2' }}</td>
                <td class="num">{{ row.variance_percent !== null ? (row.variance_percent | number: '1.1-1') + '%' : '' }}</td>
                <td><nz-tag [nzColor]="row.status === 'on_budget' ? 'default' : row.is_favorable ? 'green' : 'red'">{{ ('BUDGETING.VARIANCE_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.rows.length === 0) {
          <nz-empty [nzNotFoundContent]="'BUDGETING.NO_DATA' | translate"></nz-empty>
        }
      </nz-card>
    }
  `,
})
export class BudgetingVarianceComponent {
  private readonly api = inject(BudgetingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly versionId = input.required<string>();
  /** Bumped by the parent when the lines changed. */
  readonly refresh = input(0);

  readonly groups = BUDGET_VARIANCE_GROUPS;
  readonly periods = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  readonly groupBy = signal<BudgetVarianceGroup>('account');
  readonly throughPeriod = signal(12);
  readonly variance = signal<BudgetVariance | null>(null);

  constructor() {
    effect(() => {
      this.versionId();
      this.refresh();
      this.load();
    });
  }

  load(): void {
    this.api.getVariance(this.versionId(), this.throughPeriod(), this.groupBy()).subscribe({
      next: (response) => this.variance.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }
}
