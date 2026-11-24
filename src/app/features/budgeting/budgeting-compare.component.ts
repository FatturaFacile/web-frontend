import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import {
  BUDGET_VARIANCE_GROUPS,
  BudgetingApiService,
  BudgetScenarioComparison,
  BudgetVarianceGroup,
  BudgetVersion,
  TranslateService,
} from '@core';
import { TranslatePipe } from '@shared';
import { apiErrorText } from './budgeting.util';

/** Scenario compare: the budget of this version against the budget of another version (budget against forecast, for example). */
@Component({
  selector: 'app-budgeting-compare',
  styleUrl: './budgeting.scss',
  imports: [DecimalPipe, FormsModule, TranslatePipe, NzCardModule, NzEmptyModule, NzSelectModule, NzTableModule],
  template: `
    <div class="toolbar">
      <nz-select style="width: 280px" [ngModel]="scenarioId()" (ngModelChange)="scenarioId.set($event); load()" [nzPlaceHolder]="'BUDGETING.COMPARE_PICK' | translate" [attr.aria-label]="'BUDGETING.COMPARE_WITH' | translate">
        @for (version of candidates(); track version.id) {
          <nz-option [nzValue]="version.id" [nzLabel]="version.name + ' (' + version.fiscal_year + ')'"></nz-option>
        }
      </nz-select>
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

    @if (comparison(); as data) {
      <div class="stats-grid">
        <nz-card>{{ 'BUDGETING.COMPARE_BASE' | translate }}: <strong>{{ data.totals.base | number: '1.2-2' }}</strong></nz-card>
        <nz-card>{{ 'BUDGETING.COMPARE_SCENARIO' | translate }}: <strong>{{ data.totals.scenario | number: '1.2-2' }}</strong></nz-card>
        <nz-card>{{ 'BUDGETING.COMPARE_DELTA' | translate }}: <strong>{{ data.totals.delta | number: '1.2-2' }}</strong></nz-card>
      </div>

      <nz-card class="main-card">
        <nz-table #table [nzData]="data.rows" nzSize="small" [nzPageSize]="50">
          <thead>
            <tr>
              <th>{{ 'BUDGETING.GROUP_' + data.group_by.toUpperCase() | translate }}</th>
              <th class="num">{{ 'BUDGETING.COMPARE_BASE' | translate }}</th>
              <th class="num">{{ 'BUDGETING.COMPARE_SCENARIO' | translate }}</th>
              <th class="num">{{ 'BUDGETING.COMPARE_DELTA' | translate }}</th>
              <th class="num">{{ 'BUDGETING.VARIANCE_PERCENT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.key) {
              <tr>
                <td>{{ row.code }} <span class="muted">{{ row.label }}</span></td>
                <td class="num">{{ row.base | number: '1.2-2' }}</td>
                <td class="num">{{ row.scenario | number: '1.2-2' }}</td>
                <td class="num">{{ row.delta | number: '1.2-2' }}</td>
                <td class="num">{{ row.delta_percent !== null ? (row.delta_percent | number: '1.1-1') + '%' : '' }}</td>
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
export class BudgetingCompareComponent implements OnInit {
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
  readonly scenarioId = signal<string | null>(null);
  readonly candidates = signal<BudgetVersion[]>([]);
  readonly comparison = signal<BudgetScenarioComparison | null>(null);

  constructor() {
    effect(() => {
      this.versionId();
      this.refresh();
      this.load();
    });
  }

  ngOnInit(): void {
    this.api.getVersions().subscribe({
      next: (response) => this.candidates.set(response.data.filter((version) => version.id !== this.versionId())),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  load(): void {
    const scenario = this.scenarioId();

    if (scenario === null || scenario === this.versionId()) {
      this.comparison.set(null);
      return;
    }

    this.api.compareScenarios(this.versionId(), scenario, this.throughPeriod(), this.groupBy()).subscribe({
      next: (response) => this.comparison.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }
}
