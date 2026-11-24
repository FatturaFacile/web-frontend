import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { PlanningApiService, PlanningComparison, PlanningScenario, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './planning.util';

/** Two scenarios side by side: totals, gaps and capacity overload per item. */
@Component({
  selector: 'app-planning-compare',
  styleUrl: './planning.scss',
  imports: [DecimalPipe, FormsModule, RouterLink, PageHeaderComponent, TranslatePipe, NzButtonModule, NzCardModule, NzEmptyModule, NzSelectModule, NzTableModule],
  template: `
    <app-page-header [title]="'PLANNING.COMPARE_TITLE' | translate" [subtitle]="'PLANNING.COMPARE_SUBTITLE' | translate">
      <a nz-button routerLink="/planning/scenarios">{{ 'PLANNING.BACK_TO_SCENARIOS' | translate }}</a>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 300px" nzShowSearch [ngModel]="baseId()" (ngModelChange)="baseId.set($event)" [nzPlaceHolder]="'PLANNING.BASE_SCENARIO' | translate" [attr.aria-label]="'PLANNING.BASE_SCENARIO' | translate">
        @for (scenario of scenarios(); track scenario.id) {
          <nz-option [nzValue]="scenario.id" [nzLabel]="scenario.name"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 300px" nzShowSearch [ngModel]="otherId()" (ngModelChange)="otherId.set($event)" [nzPlaceHolder]="'PLANNING.OTHER_SCENARIO' | translate" [attr.aria-label]="'PLANNING.OTHER_SCENARIO' | translate">
        @for (scenario of scenarios(); track scenario.id) {
          <nz-option [nzValue]="scenario.id" [nzLabel]="scenario.name"></nz-option>
        }
      </nz-select>
      <button nz-button nzType="primary" [disabled]="!baseId() || !otherId() || baseId() === otherId()" (click)="compare()">{{ 'PLANNING.COMPARE' | translate }}</button>
    </div>

    @if (comparison(); as data) {
      <nz-card class="main-card">
        <nz-table #summary [nzData]="sides()" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PLANNING.NAME' | translate }}</th>
              <th class="num">{{ 'PLANNING.TOTAL_DEMAND' | translate }}</th>
              <th class="num">{{ 'PLANNING.TOTAL_SUPPLY' | translate }}</th>
              <th class="num">{{ 'PLANNING.TOTAL_GAP' | translate }}</th>
              <th class="num">{{ 'PLANNING.OVERLOADED_MONTHS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of summary.data; track row.id) {
              <tr>
                <td>{{ row.name }}</td>
                <td class="num">{{ row.totals.total_demand | number: '1.0-3' }}</td>
                <td class="num">{{ row.totals.total_supply | number: '1.0-3' }}</td>
                <td class="num">{{ row.totals.total_gap | number: '1.0-3' }}</td>
                <td class="num">{{ row.capacity.overloaded_count }}</td>
              </tr>
            }
            <tr>
              <td><strong>{{ 'PLANNING.DELTA' | translate }}</strong></td>
              <td class="num">{{ data.delta.total_demand | number: '1.0-3' }}</td>
              <td class="num">{{ data.delta.total_supply | number: '1.0-3' }}</td>
              <td class="num">{{ data.delta.total_gap | number: '1.0-3' }}</td>
              <td class="num">{{ data.delta.overloaded_periods }}</td>
            </tr>
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'PLANNING.BY_ITEM' | translate">
        <nz-table #itemTable [nzData]="data.items" nzSize="small" [nzPageSize]="25">
          <thead>
            <tr>
              <th>{{ 'PLANNING.ITEM' | translate }}</th>
              <th class="num">{{ 'PLANNING.DELTA_DEMAND' | translate }}</th>
              <th class="num">{{ 'PLANNING.DELTA_SUPPLY' | translate }}</th>
              <th class="num">{{ 'PLANNING.DELTA_GAP' | translate }}</th>
              <th class="num">{{ 'PLANNING.DELTA_SHORTAGE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of itemTable.data; track row.item_code) {
              <tr>
                <td>{{ row.item_code }} <span class="muted">{{ row.item_name }}</span></td>
                <td class="num">{{ row.delta.total_demand | number: '1.0-3' }}</td>
                <td class="num">{{ row.delta.total_supply | number: '1.0-3' }}</td>
                <td class="num">{{ row.delta.total_gap | number: '1.0-3' }}</td>
                <td class="num">{{ row.delta.max_shortage | number: '1.0-3' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.items.length === 0) {
          <nz-empty [nzNotFoundContent]="'PLANNING.NO_LINES' | translate"></nz-empty>
        }
      </nz-card>
    }
  `,
})
export class PlanningCompareComponent implements OnInit {
  private readonly api = inject(PlanningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly scenarios = signal<PlanningScenario[]>([]);
  readonly baseId = signal<string | null>(null);
  readonly otherId = signal<string | null>(null);
  readonly comparison = signal<PlanningComparison | null>(null);

  ngOnInit(): void {
    this.api.getScenarios({ per_page: 100 }).subscribe({
      next: (response) => this.scenarios.set(response.data),
      error: () => this.message.error(this.translate.instant('PLANNING.ACTION_ERROR')),
    });
  }

  sides(): PlanningComparison['base'][] {
    const data = this.comparison();
    return data ? [data.base, data.other] : [];
  }

  compare(): void {
    const base = this.baseId();
    const other = this.otherId();
    if (!base || !other) {
      return;
    }

    this.api.compareScenarios(base, other).subscribe({
      next: (response) => this.comparison.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
    });
  }
}
