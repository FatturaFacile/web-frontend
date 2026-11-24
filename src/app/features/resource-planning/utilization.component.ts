import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  TranslateService,
  UTILIZATION_GROUP_BYS,
  UtilizationGroupBy,
  UtilizationRow,
  UtilizationTarget,
  UtilizationTargetPayload,
} from '@core';
import { PageHeaderComponent, TranslatePipe, RadioControlDirective } from '@shared';
import { UtilizationStore } from './utilization.store';
import { formatHours, formatPercent, utilizationStatusColor } from './resource-planning.util';

export type TargetScope = 'tenant' | 'department' | 'cost_center';

/** The payload of the target editor: the scope decides which id is sent, the other stays null. */
export function targetPayload(
  scope: TargetScope,
  scopeId: string | null,
  percent: number,
): UtilizationTargetPayload | null {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return null;
  }
  if (scope === 'tenant') {
    return { department_id: null, cost_center_id: null, target_percent: percent };
  }
  if (scopeId === null) {
    return null;
  }
  return scope === 'department'
    ? { department_id: scopeId, cost_center_id: null, target_percent: percent }
    : { department_id: null, cost_center_id: scopeId, target_percent: percent };
}

/**
 * Billable utilization (Mod 079): actual (committed billable hours over net capacity), forecast (committed plus
 * tentative) and the target, by resource, department or cost center, with the editor of the targets.
 */
@Component({
  selector: 'app-resource-utilization',
  imports: [
    RadioControlDirective,
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzProgressModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
  ],
  providers: [UtilizationStore],
  template: `
    <app-page-header
      [title]="'resourcePlanning.utilization.title' | translate"
      [subtitle]="'resourcePlanning.utilization.subtitle' | translate"
    ></app-page-header>

    <div class="toolbar">
      <nz-radio-group
        [ngModel]="store.groupBy()"
        (ngModelChange)="setGroupBy($event)"
        nzButtonStyle="solid"
        [attr.aria-label]="'resourcePlanning.utilization.groupBy' | translate"
      >
        @for (groupBy of groupBys; track groupBy) {
          <label [attr.for]="'utilization-field-4-' + $index" appRadioControl nz-radio-button [nzValue]="groupBy">{{
            'resourcePlanning.utilization.group.' + groupBy | translate
          }}</label>
        }
      </nz-radio-group>
      <label class="date-field">
        <span>{{ 'resourcePlanning.utilization.from' | translate }}</span>
        <input nz-input type="date" [ngModel]="store.from()" (ngModelChange)="setFrom($event)" />
      </label>
      <label class="date-field">
        <span>{{ 'resourcePlanning.utilization.to' | translate }}</span>
        <input nz-input type="date" [ngModel]="store.to()" (ngModelChange)="setTo($event)" />
      </label>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.totals(); as totals) {
        <section class="stats" [attr.aria-label]="'resourcePlanning.utilization.summary' | translate">
          <nz-statistic
            [nzValue]="totals.actual_billable_percent"
            nzSuffix="%"
            [nzTitle]="'resourcePlanning.utilization.actual' | translate"
          ></nz-statistic>
          <nz-statistic
            [nzValue]="totals.forecast_billable_percent"
            nzSuffix="%"
            [nzTitle]="'resourcePlanning.utilization.forecast' | translate"
          ></nz-statistic>
          <nz-statistic
            [nzValue]="totals.target_percent"
            nzSuffix="%"
            [nzTitle]="'resourcePlanning.utilization.target' | translate"
          ></nz-statistic>
          <nz-statistic
            [nzValue]="totals.gap_percent"
            nzSuffix="%"
            [nzTitle]="'resourcePlanning.utilization.gap' | translate"
            [nzValueStyle]="totals.gap_percent < 0 ? { color: '#cf1322' } : { color: '#389e0d' }"
          ></nz-statistic>
          <nz-statistic
            [nzValue]="totals.net_available_hours"
            nzSuffix="h"
            [nzTitle]="'resourcePlanning.utilization.net' | translate"
          ></nz-statistic>
        </section>

        @if (store.belowTarget().length > 0) {
          <nz-alert
            class="feedback"
            nzType="warning"
            nzShowIcon
            [nzMessage]="
              'resourcePlanning.utilization.belowTargetAlert'
                | translate: { count: store.belowTarget().length }
            "
          ></nz-alert>
        }

        <nz-table
          #table
          nzSize="small"
          [nzData]="store.rows()"
          [nzFrontPagination]="false"
          [nzShowPagination]="false"
        >
          <thead>
            <tr>
              <th scope="col">{{ 'resourcePlanning.utilization.name' | translate }}</th>
              <th scope="col" class="num">{{ 'resourcePlanning.utilization.net' | translate }}</th>
              <th scope="col" class="num">
                {{ 'resourcePlanning.utilization.committed' | translate }}
              </th>
              <th scope="col" class="num">
                {{ 'resourcePlanning.utilization.tentative' | translate }}
              </th>
              <th scope="col" class="num">
                {{ 'resourcePlanning.utilization.internal' | translate }}
              </th>
              <th scope="col" class="bars">
                {{ 'resourcePlanning.utilization.actualVsForecast' | translate }}
              </th>
              <th scope="col" class="num">{{ 'resourcePlanning.utilization.target' | translate }}</th>
              <th scope="col" class="num">{{ 'resourcePlanning.utilization.gap' | translate }}</th>
              <th scope="col">{{ 'resourcePlanning.utilization.status' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.key_id ?? row.key_name) {
              <tr>
                <th scope="row">{{ row.key_name }}</th>
                <td class="num">{{ hours(row.net_available_hours) }}</td>
                <td class="num">{{ hours(row.billable_committed_hours) }}</td>
                <td class="num">{{ hours(row.tentative_booked_hours) }}</td>
                <td class="num">{{ hours(row.internal_booked_hours) }}</td>
                <td class="bars">
                  <nz-progress
                    nzSize="small"
                    nzStrokeColor="#2f54eb"
                    [nzPercent]="clamp(row.actual_billable_percent)"
                    [nzShowInfo]="false"
                    [attr.aria-label]="'resourcePlanning.utilization.actual' | translate"
                  ></nz-progress>
                  <nz-progress
                    nzSize="small"
                    nzStrokeColor="#adc6ff"
                    [nzPercent]="clamp(row.forecast_billable_percent)"
                    [nzShowInfo]="false"
                    [attr.aria-label]="'resourcePlanning.utilization.forecast' | translate"
                  ></nz-progress>
                  <small class="muted"
                    >{{ percent(row.actual_billable_percent) }} /
                    {{ percent(row.forecast_billable_percent) }}</small
                  >
                </td>
                <td class="num">{{ percent(row.target_percent) }}</td>
                <td class="num" [class.negative]="row.gap_percent < 0">
                  {{ percent(row.gap_percent) }}
                </td>
                <td>
                  <nz-tag [nzColor]="statusColor(row)">{{
                    'resourcePlanning.utilization.status.' + row.status | translate
                  }}</nz-tag>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (store.rows().length === 0) {
          <nz-empty [nzNotFoundContent]="'resourcePlanning.utilization.empty' | translate"></nz-empty>
        }
      }
    </nz-spin>

    <nz-card
      class="targets"
      [nzTitle]="'resourcePlanning.utilization.targets.title' | translate"
    >
      <div class="editor">
        <label for="utilization-field-3" class="field">
          <span>{{ 'resourcePlanning.utilization.targets.scope' | translate }}</span>
          <nz-select nzId="utilization-field-3" [ngModel]="scope()" (ngModelChange)="setScope($event)">
            <nz-option
              nzValue="tenant"
              [nzLabel]="'resourcePlanning.utilization.targets.tenant' | translate"
            ></nz-option>
            <nz-option
              nzValue="department"
              [nzLabel]="'resourcePlanning.utilization.targets.department' | translate"
            ></nz-option>
            <nz-option
              nzValue="cost_center"
              [nzLabel]="'resourcePlanning.utilization.targets.costCenter' | translate"
            ></nz-option>
          </nz-select>
        </label>
        @if (scope() !== 'tenant') {
          <label for="utilization-field-2" class="field">
            <span>{{ 'resourcePlanning.utilization.targets.entity' | translate }}</span>
            <nz-select nzId="utilization-field-2" nzShowSearch [ngModel]="scopeId()" (ngModelChange)="scopeId.set($event ?? null)">
              @for (option of scopeOptions(); track option.id) {
                <nz-option [nzValue]="option.id" [nzLabel]="option.name"></nz-option>
              }
            </nz-select>
          </label>
        }
        <label for="utilization-field" class="field">
          <span>{{ 'resourcePlanning.utilization.targets.percent' | translate }}</span>
          <nz-input-number nzId="utilization-field"
            [nzMin]="0"
            [nzMax]="100"
            [nzStep]="1"
            [ngModel]="percentValue()"
            (ngModelChange)="percentValue.set($event ?? 0)"
          ></nz-input-number>
        </label>
        <button
          nz-button
          nzType="primary"
          [nzLoading]="store.saving()"
          [disabled]="payload() === null"
          (click)="saveTarget()"
        >
          {{ 'resourcePlanning.utilization.targets.save' | translate }}
        </button>
      </div>

      <ul class="target-list">
        @if (store.tenantTarget(); as tenant) {
          <li>
            <strong>{{ 'resourcePlanning.utilization.targets.tenant' | translate }}</strong>
            {{ percent(tenant.target_percent) }}
          </li>
        } @else if (store.defaultTarget() !== null) {
          <li>
            <strong>{{ 'resourcePlanning.utilization.targets.tenant' | translate }}</strong>
            {{ percent(store.defaultTarget() ?? 0) }}
          </li>
        }
        @for (target of store.targets(); track target.id) {
          @if (target.department_id || target.cost_center_id) {
            <li>
              <strong>{{ targetName(target) }}</strong> {{ percent(target.target_percent) }}
            </li>
          }
        }
      </ul>
    </nz-card>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 16px;
    }

    .date-field,
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    .feedback {
      margin-bottom: 12px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .num {
      text-align: right;
      white-space: nowrap;
    }

    .bars {
      min-width: 220px;
    }

    .muted {
      color: var(--ant-text-color-secondary, #595959);
    }

    .negative {
      color: var(--ant-error-color, #cf1322);
    }

    .targets {
      margin-top: 24px;
    }

    .editor {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 16px;
    }

    .target-list {
      margin: 16px 0 0;
      padding-left: 18px;
    }
  `,
})
export class UtilizationComponent implements OnInit {
  readonly store = inject(UtilizationStore);
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);

  readonly groupBys = UTILIZATION_GROUP_BYS;

  readonly scope = signal<TargetScope>('tenant');
  readonly scopeId = signal<string | null>(null);
  readonly percentValue = signal(75);

  readonly scopeOptions = computed(() =>
    this.scope() === 'department' ? this.store.departments() : this.store.costCenters(),
  );
  readonly payload = computed(() =>
    targetPayload(this.scope(), this.scopeId(), this.percentValue()),
  );

  ngOnInit(): void {
    void this.store.init();
  }

  setGroupBy(groupBy: UtilizationGroupBy): void {
    void this.store.setGroupBy(groupBy);
  }

  setFrom(from: string): void {
    if (from && from <= this.store.to()) {
      void this.store.setRange(from, this.store.to());
    }
  }

  setTo(to: string): void {
    if (to && to >= this.store.from()) {
      void this.store.setRange(this.store.from(), to);
    }
  }

  setScope(scope: TargetScope): void {
    this.scope.set(scope);
    this.scopeId.set(null);
  }

  async saveTarget(): Promise<void> {
    const payload = this.payload();
    if (payload === null) {
      return;
    }
    if (await this.store.saveTarget(payload)) {
      this.message.success(this.translate.instant('resourcePlanning.utilization.targets.saved'));
    } else {
      this.message.error(this.translate.instant(this.store.error() ?? 'resourcePlanning.saveError'));
    }
  }

  targetName(target: UtilizationTarget): string {
    const options = target.department_id ? this.store.departments() : this.store.costCenters();
    const id = target.department_id ?? target.cost_center_id;
    return options.find((option) => option.id === id)?.name ?? (id ?? '').slice(0, 8);
  }

  clamp(percent: number): number {
    return Math.max(0, Math.min(100, Math.round(percent)));
  }

  statusColor(row: UtilizationRow): string {
    return utilizationStatusColor(row.status);
  }

  hours(value: number): string {
    return formatHours(value);
  }

  percent(value: number): string {
    return formatPercent(value);
  }
}
