import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService, PermissionsService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { ProjectBillingApiService } from './project-billing-api.service';
import { WipMethod, WipRun, WipRunResult } from './project-billing.models';
import {
  toCents,
  fromCents,
  WIP_METHOD_KEYS,
  WIP_NATURE_KEYS,
  wipNature,
} from './project-billing.utils';

/**
 * Period-end work in progress dashboard (Mod 081, lavori in corso su ordinazione): runs the valuation of every open
 * project at a period end date and shows, per project, the cost-to-cost ratio, the revenue recognised against the
 * revenue billed, the resulting contract asset or liability and the reference of the general ledger entry.
 */
@Component({
  selector: 'app-wip-valuation',
  styles: `
    :host {
      display: block;
    }
    .wip-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .wip-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .wip-kpi {
      font-size: 20px;
      font-weight: 600;
    }
    .wip-num {
      text-align: right;
      white-space: nowrap;
    }
    .wip-muted {
      color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.45));
    }
  `,
  imports: [
    FormsModule,
    RouterLink,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'PROJECT_BILLING.WIP_TITLE' | translate"
      [subtitle]="'PROJECT_BILLING.WIP_SUBTITLE' | translate"
    />
    <p>
      <a routerLink="/projects">{{ 'PRJ.BACK_TO_PROJECTS' | translate }}</a>
    </p>

    <div class="wip-toolbar">
      <label for="wip-date">{{ 'PROJECT_BILLING.WIP_PERIOD_END' | translate }}</label>
      <input
        id="wip-date"
        nz-input
        type="date"
        data-testid="wip-date"
        [ngModel]="periodEnd()"
        (ngModelChange)="changePeriod($event)"
        style="width: 170px"
      />
      <nz-select
        data-testid="wip-method"
        [ngModel]="method()"
        (ngModelChange)="method.set($event)"
        style="width: 280px"
      >
        <nz-option [nzValue]="null" [nzLabel]="'PROJECT_BILLING.WIP_METHOD_DEFAULT' | translate" />
        @for (option of methods; track option) {
          <nz-option [nzValue]="option" [nzLabel]="methodKey(option) | translate" />
        }
      </nz-select>
      @if (canWrite) {
        <button
          nz-button
          nzType="primary"
          type="button"
          data-testid="wip-run"
          [nzLoading]="busy()"
          (click)="run()"
        >
          {{ 'PROJECT_BILLING.WIP_RUN' | translate }}
        </button>
      }
    </div>

    @if (error()) {
      <nz-alert
        class="mb-4"
        nzType="error"
        nzShowIcon
        [nzMessage]="'PROJECT_BILLING.LOAD_ERROR' | translate"
      />
    }

    @if (result()?.skipped?.length) {
      <nz-alert
        class="mb-4"
        nzType="warning"
        nzShowIcon
        data-testid="wip-skipped"
        [nzMessage]="
          'PROJECT_BILLING.WIP_SKIPPED' | translate: { count: result()?.skipped?.length ?? 0 }
        "
      />
    }

    <nz-spin [nzSpinning]="loading()">
      <div class="wip-summary" data-testid="wip-summary">
        <nz-card nzSize="small" [nzTitle]="'PROJECT_BILLING.WIP_RECOGNIZED' | translate"
          ><div class="wip-kpi">{{ totals().recognized | money: 'EUR' }}</div></nz-card
        >
        <nz-card nzSize="small" [nzTitle]="'PROJECT_BILLING.WIP_BILLED' | translate"
          ><div class="wip-kpi">{{ totals().billed | money: 'EUR' }}</div></nz-card
        >
        <nz-card nzSize="small" [nzTitle]="'PROJECT_BILLING.WIP_ASSET' | translate"
          ><div class="wip-kpi" data-testid="wip-assets">
            {{ totals().assets | money: 'EUR' }}
          </div></nz-card
        >
        <nz-card nzSize="small" [nzTitle]="'PROJECT_BILLING.WIP_LIABILITY' | translate"
          ><div class="wip-kpi" data-testid="wip-liabilities">
            {{ totals().liabilities | money: 'EUR' }}
          </div></nz-card
        >
      </div>

      @if (runs().length === 0) {
        <nz-empty
          data-testid="wip-empty"
          [nzNotFoundContent]="'PROJECT_BILLING.WIP_EMPTY' | translate"
        />
      } @else {
        <nz-table
          #table
          nzSize="small"
          [nzData]="runs()"
          [nzShowPagination]="false"
          data-testid="wip-table"
        >
          <thead>
            <tr>
              <th>{{ 'PROJECT_BILLING.COL_PROJECT' | translate }}</th>
              <th>{{ 'PROJECT_BILLING.WIP_METHOD' | translate }}</th>
              <th class="wip-num">{{ 'PROJECT_BILLING.WIP_RATIO' | translate }}</th>
              <th class="wip-num">{{ 'PROJECT_BILLING.WIP_RECOGNIZED' | translate }}</th>
              <th class="wip-num">{{ 'PROJECT_BILLING.WIP_BILLED' | translate }}</th>
              <th class="wip-num">{{ 'PROJECT_BILLING.WIP_DIFF' | translate }}</th>
              <th class="wip-num">{{ 'PROJECT_BILLING.WIP_LOSS' | translate }}</th>
              <th>{{ 'PROJECT_BILLING.WIP_GL' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (item of table.data; track item.id) {
              <tr [attr.data-testid]="'wip-row-' + item.project_id">
                <td>
                  <a [routerLink]="['/projects', item.project_id, 'billing']">{{
                    item.project_id
                  }}</a>
                </td>
                <td>
                  {{ methodKey(item.valuation_method) | translate }}
                  <nz-tag>{{ item.accounting_standard }}</nz-tag>
                </td>
                <td class="wip-num">{{ ratio(item) }}%</td>
                <td class="wip-num">{{ item.recognized_revenue_to_date | money: 'EUR' }}</td>
                <td class="wip-num">{{ item.billed_to_date | money: 'EUR' }}</td>
                <td class="wip-num">
                  {{ item.wip_asset_or_deferred_revenue_diff | money: 'EUR' }}
                  <nz-tag [nzColor]="natureColor(item)">{{ natureKey(item) | translate }}</nz-tag>
                </td>
                <td class="wip-num">{{ item.expected_loss_provision | money: 'EUR' }}</td>
                <td>{{ item.gl_journal_entry_id ?? '-' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-spin>
  `,
})
export class WipValuationComponent implements OnInit {
  private readonly api = inject(ProjectBillingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('projects');

  protected readonly methods: WipMethod[] = [
    'cost_to_cost_percentage_of_completion',
    'completed_contract',
    'milestone_progress',
  ];
  protected readonly periodEnd = signal(new Date().toISOString().slice(0, 10));
  protected readonly method = signal<WipMethod | null>(null);
  protected readonly runs = signal<WipRun[]>([]);
  protected readonly result = signal<WipRunResult | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal(false);

  /** Recognised and billed revenue, and the contract assets and liabilities of the runs of the period. */
  protected readonly totals = computed(() => {
    let recognized = 0;
    let billed = 0;
    let assets = 0;
    let liabilities = 0;

    for (const item of this.runs()) {
      const diff = toCents(item.wip_asset_or_deferred_revenue_diff);
      recognized += toCents(item.recognized_revenue_to_date);
      billed += toCents(item.billed_to_date);
      assets += Math.max(diff, 0);
      liabilities += Math.max(-diff, 0);
    }

    return {
      recognized: fromCents(recognized),
      billed: fromCents(billed),
      assets: fromCents(assets),
      liabilities: fromCents(liabilities),
    };
  });

  ngOnInit(): void {
    this.load();
  }

  protected methodKey(method: WipMethod): string {
    return WIP_METHOD_KEYS[method];
  }

  protected natureKey(item: WipRun): string {
    return WIP_NATURE_KEYS[wipNature(item.wip_asset_or_deferred_revenue_diff)];
  }

  protected natureColor(item: WipRun): string {
    const nature = wipNature(item.wip_asset_or_deferred_revenue_diff);

    return nature === 'contract_asset'
      ? 'blue'
      : nature === 'contract_liability'
        ? 'orange'
        : 'default';
  }

  /** Cost-to-cost (or milestone) completion as a percentage with two decimals. */
  protected ratio(item: WipRun): string {
    return (Number(item.completion_ratio) * 100).toFixed(2);
  }

  protected changePeriod(date: string): void {
    this.periodEnd.set(date);
    this.load();
  }

  protected run(): void {
    this.busy.set(true);
    this.api
      .runWip({ period_end_date: this.periodEnd(), valuation_method: this.method() })
      .subscribe({
        next: (response) => {
          this.busy.set(false);
          this.result.set(response.data);
          this.message.success(
            this.i18n.translate('PROJECT_BILLING.WIP_DONE', { count: response.data.runs.length }),
          );
          this.load();
        },
        error: () => {
          this.busy.set(false);
          this.message.error(this.i18n.translate('PROJECT_BILLING.SAVE_ERROR'));
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api.wipRuns({ periodEndDate: this.periodEnd() }).subscribe({
      next: (response) => {
        this.runs.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }
}
