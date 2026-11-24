import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { firstValueFrom } from 'rxjs';
import {
  AuthStore,
  CrmExtensionApiService,
  I18nService,
  SalesPipelineApiService,
  type CrmSalesQuota,
  type SalesForecastDashboard,
  type SalesForecastGranularity,
  type SalesLossAnalysis,
  type SalesPipeline,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { LeadAssigneeSelectComponent } from '../leads/lead-assignee-select.component';

type PeriodScope = 'year' | 'q1' | 'q2' | 'q3' | 'q4';

/** Cap a progress bar at 100 % while the figure itself can exceed it. */
export function progressPercent(value: string | number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}

/**
 * Sales forecasting and quota tracking dashboard: monthly or quarterly buckets split into Pipeline, Best Case and
 * Commit alongside Closed Won / Lost, compared with the budget quota of every sales rep, the loss analysis for
 * retrospective BI, and the management of the quotas themselves.
 */
@Component({
  selector: 'app-sales-forecast',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzProgressModule,
    NzSegmentedModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    MoneyPipe,
    TranslatePipe,
    LeadAssigneeSelectComponent,
  ],
  template: `
    <div class="toolbar">
      <nz-segmented
        [nzOptions]="granularityOptions()"
        [ngModel]="granularity()"
        (ngModelChange)="setGranularity($event)"
        data-testid="granularity"
      />
      <nz-input-number
        class="filter"
        data-testid="year"
        [nzMin]="2000"
        [nzMax]="2100"
        [ngModel]="year()"
        (ngModelChange)="setYear($event)"
      />
      <nz-select
        class="filter"
        data-testid="scope"
        [ngModel]="scope()"
        (ngModelChange)="setScope($event)"
      >
        <nz-option nzValue="year" [nzLabel]="'SALESPIPE.WHOLE_YEAR' | translate" />
        <nz-option nzValue="q1" nzLabel="Q1" />
        <nz-option nzValue="q2" nzLabel="Q2" />
        <nz-option nzValue="q3" nzLabel="Q3" />
        <nz-option nzValue="q4" nzLabel="Q4" />
      </nz-select>
      <nz-select
        class="filter"
        nzAllowClear
        data-testid="pipeline"
        [ngModel]="pipelineId()"
        [nzPlaceHolder]="'SALESPIPE.PIPELINE' | translate"
        (ngModelChange)="setPipeline($event)"
      >
        @for (pipeline of pipelines(); track pipeline.id) {
          <nz-option [nzValue]="pipeline.id" [nzLabel]="pipeline.name" />
        }
      </nz-select>
    </div>

    @if (error()) {
      <nz-alert
        nzType="error"
        nzShowIcon
        data-testid="forecast-error"
        [nzMessage]="'SALESPIPE.LOAD_ERROR' | translate"
      />
    }

    <nz-spin [nzSpinning]="loading()">
      @if (dashboard(); as data) {
        <div class="stats" data-testid="forecast-stats">
          <nz-card
            ><nz-statistic
              [nzTitle]="'SALESPIPE.QUOTA' | translate"
              [nzValue]="+data.totals.quota | money: currency()"
          /></nz-card>
          <nz-card
            ><nz-statistic
              [nzTitle]="'SALESPIPE.CLOSED_WON' | translate"
              [nzValue]="+data.totals.closed_won | money: currency()"
          /></nz-card>
          <nz-card
            ><nz-statistic
              [nzTitle]="'SALESPIPE.COMMIT_FORECAST' | translate"
              [nzValue]="+data.totals.commit_forecast | money: currency()"
          /></nz-card>
          <nz-card
            ><nz-statistic
              [nzTitle]="'SALESPIPE.BEST_CASE_FORECAST' | translate"
              [nzValue]="+data.totals.best_case_forecast | money: currency()"
          /></nz-card>
          <nz-card
            ><nz-statistic
              [nzTitle]="'SALESPIPE.WEIGHTED_FORECAST' | translate"
              [nzValue]="+data.totals.weighted_forecast | money: currency()"
          /></nz-card>
          <nz-card>
            <nz-statistic
              [nzTitle]="'SALESPIPE.ATTAINMENT' | translate"
              [nzValue]="data.totals.attainment_percent + ' %'"
            />
            <nz-progress [nzPercent]="percent(data.totals.attainment_percent)" nzSize="small" />
          </nz-card>
        </div>

        <nz-card [nzTitle]="'SALESPIPE.PERIOD_BUCKETS' | translate">
          <nz-table
            #bucketTable
            [nzData]="data.buckets"
            [nzShowPagination]="false"
            nzSize="small"
            [nzScroll]="{ x: '900px' }"
            data-testid="bucket-table"
          >
            <thead>
              <tr>
                <th>{{ 'SALESPIPE.PERIOD' | translate }}</th>
                <th>{{ 'SALESPIPE.CAT_PIPELINE' | translate }}</th>
                <th>{{ 'SALESPIPE.CAT_BEST_CASE' | translate }}</th>
                <th>{{ 'SALESPIPE.CAT_COMMIT' | translate }}</th>
                <th>{{ 'SALESPIPE.CLOSED_WON' | translate }}</th>
                <th>{{ 'SALESPIPE.CLOSED_LOST' | translate }}</th>
                <th>{{ 'SALESPIPE.WEIGHTED' | translate }}</th>
                <th>{{ 'SALESPIPE.QUOTA' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (bucket of bucketTable.data; track bucket.key) {
                <tr>
                  <td>{{ bucket.label }}</td>
                  <td>{{ +bucket.pipeline | money: currency() }}</td>
                  <td>{{ +bucket.best_case | money: currency() }}</td>
                  <td>{{ +bucket.commit | money: currency() }}</td>
                  <td>{{ +bucket.closed_won | money: currency() }}</td>
                  <td>{{ +bucket.closed_lost | money: currency() }}</td>
                  <td>{{ +bucket.weighted_forecast | money: currency() }}</td>
                  <td>{{ +bucket.quota | money: currency() }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>

        <nz-card [nzTitle]="'SALESPIPE.REPS' | translate">
          <nz-table
            #repTable
            [nzData]="data.reps"
            [nzShowPagination]="false"
            nzSize="small"
            [nzScroll]="{ x: '900px' }"
            data-testid="rep-table"
          >
            <thead>
              <tr>
                <th>{{ 'SALESPIPE.OWNER' | translate }}</th>
                <th>{{ 'SALESPIPE.QUOTA' | translate }}</th>
                <th>{{ 'SALESPIPE.CLOSED_WON' | translate }}</th>
                <th>{{ 'SALESPIPE.COMMIT_FORECAST' | translate }}</th>
                <th>{{ 'SALESPIPE.WEIGHTED_FORECAST' | translate }}</th>
                <th>{{ 'SALESPIPE.ATTAINMENT' | translate }}</th>
                <th>{{ 'SALESPIPE.GAP' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (rep of repTable.data; track rep.user_id) {
                <tr>
                  <td>{{ rep.name || ('SALESPIPE.UNASSIGNED' | translate) }}</td>
                  <td>{{ +rep.quota | money: currency() }}</td>
                  <td>{{ +rep.closed_won | money: currency() }}</td>
                  <td>{{ +rep.commit_forecast | money: currency() }}</td>
                  <td>{{ +rep.weighted_forecast | money: currency() }}</td>
                  <td class="progress-cell">
                    <nz-progress
                      [nzPercent]="percent(rep.attainment_percent)"
                      nzSize="small"
                      [nzFormat]="percentFormat(rep.attainment_percent)"
                    />
                  </td>
                  <td>{{ +rep.gap_to_quota | money: currency() }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>
      } @else if (!loading() && !error()) {
        <p class="empty">{{ 'SALESPIPE.NO_DATA' | translate }}</p>
      }
    </nz-spin>

    @if (loss(); as analysis) {
      <nz-card [nzTitle]="'SALESPIPE.LOSS_ANALYSIS' | translate" data-testid="loss-analysis">
        <div class="loss-grid">
          <nz-table
            #reasonTable
            [nzData]="analysis.by_reason"
            [nzShowPagination]="false"
            nzSize="small"
          >
            <thead>
              <tr>
                <th>{{ 'SALESPIPE.LOSS_BY_REASON' | translate }}</th>
                <th>{{ 'SALESPIPE.COUNT' | translate }}</th>
                <th>{{ 'SALESPIPE.AMOUNT' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of reasonTable.data; track row.code) {
                <tr>
                  <td>{{ row.label }}</td>
                  <td>{{ row.count }}</td>
                  <td>{{ +row.amount | money: currency() }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
          <nz-table
            #competitorTable
            [nzData]="analysis.by_competitor"
            [nzShowPagination]="false"
            nzSize="small"
          >
            <thead>
              <tr>
                <th>{{ 'SALESPIPE.LOSS_BY_COMPETITOR' | translate }}</th>
                <th>{{ 'SALESPIPE.COUNT' | translate }}</th>
                <th>{{ 'SALESPIPE.AMOUNT' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of competitorTable.data; track row.competitor) {
                <tr>
                  <td>{{ row.competitor }}</td>
                  <td>{{ row.count }}</td>
                  <td>{{ +row.amount | money: currency() }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        </div>
      </nz-card>
    }

    <nz-card [nzTitle]="'SALESPIPE.QUOTAS' | translate" [nzExtra]="addQuota">
      <ng-template #addQuota>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-testid="quota-new"
          (click)="openQuota(null)"
        >
          {{ 'SALESPIPE.QUOTA_NEW' | translate }}
        </button>
      </ng-template>
      <nz-table
        #quotaTable
        [nzData]="quotas()"
        [nzShowPagination]="false"
        nzSize="small"
        [nzScroll]="{ x: '700px' }"
        data-testid="quota-table"
      >
        <thead>
          <tr>
            <th>{{ 'SALESPIPE.OWNER' | translate }}</th>
            <th>{{ 'SALESPIPE.QUOTA_START' | translate }}</th>
            <th>{{ 'SALESPIPE.QUOTA_END' | translate }}</th>
            <th>{{ 'SALESPIPE.QUOTA_TARGET' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (quota of quotaTable.data; track quota.id) {
            <tr>
              <td>{{ repName(quota.user_id) }}</td>
              <td>{{ quota.period_start }}</td>
              <td>{{ quota.period_end }}</td>
              <td>{{ +quota.target_amount | money: quota.currency }}</td>
              <td>
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  data-testid="quota-edit"
                  (click)="openQuota(quota)"
                >
                  {{ 'SALESPIPE.QUOTA_EDIT' | translate }}
                </button>
                <button
                  nz-button
                  nzSize="small"
                  nzDanger
                  type="button"
                  data-testid="quota-delete"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'SALESPIPE.DELETE_CONFIRM' | translate"
                  (nzOnConfirm)="deleteQuota(quota)"
                >
                  {{ 'SALESPIPE.DELETE' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="quotaModalOpen()"
      [nzTitle]="(editingQuota() ? 'SALESPIPE.QUOTA_EDIT' : 'SALESPIPE.QUOTA_NEW') | translate"
      [nzFooter]="quotaFooter"
      (nzOnCancel)="quotaModalOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="quotaForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SALESPIPE.QUOTA_USER' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'SALESPIPE.REQUIRED' | translate">
              <app-lead-assignee-select
                [label]="'SALESPIPE.QUOTA_USER' | translate"
                [value]="quotaForm.controls.user_id.value || null"
                (valueChange)="quotaForm.controls.user_id.setValue($event ?? '')"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SALESPIPE.QUOTA_START' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'SALESPIPE.REQUIRED' | translate">
              <input
                type="date"
                class="native-date"
                formControlName="period_start"
                data-testid="quota-start"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SALESPIPE.QUOTA_END' | translate }}</nz-form-label>
            <nz-form-control
              [nzErrorTip]="
                periodError()
                  ? ('SALESPIPE.QUOTA_PERIOD_INVALID' | translate)
                  : ('SALESPIPE.REQUIRED' | translate)
              "
              [nzValidateStatus]="periodError() ? 'error' : ''"
            >
              <input
                type="date"
                class="native-date"
                formControlName="period_end"
                data-testid="quota-end"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SALESPIPE.QUOTA_TARGET' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'SALESPIPE.REQUIRED' | translate">
              <nz-input-number
                formControlName="target_amount"
                [nzMin]="0"
                [nzStep]="1000"
                class="full"
                data-testid="quota-target"
              />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
    <ng-template #quotaFooter>
      <button nz-button type="button" (click)="quotaModalOpen.set(false)">
        {{ 'SALESPIPE.CANCEL' | translate }}
      </button>
      <button
        nz-button
        nzType="primary"
        type="button"
        data-testid="quota-save"
        [nzLoading]="quotaSaving()"
        (click)="saveQuota()"
      >
        {{ 'SALESPIPE.SAVE' | translate }}
      </button>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
      align-items: center;
    }
    .filter {
      min-width: 140px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
      margin-bottom: 12px;
    }
    nz-card {
      margin-bottom: 12px;
    }
    .loss-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }
    .progress-cell {
      min-width: 160px;
    }
    .native-date {
      width: 100%;
      padding: 4px 11px;
      min-height: 32px;
      border: 1px solid var(--ant-color-border, #d9d9d9);
      border-radius: 6px;
    }
    .full {
      width: 100%;
    }
    .empty {
      text-align: center;
      opacity: 0.6;
      margin: 24px 0;
    }
  `,
})
export class SalesForecastComponent implements OnInit {
  private readonly api = inject(SalesPipelineApiService);
  private readonly quotaApi = inject(CrmExtensionApiService);
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);
  private sequence = 0;

  readonly granularity = signal<SalesForecastGranularity>('quarter');
  readonly year = signal(new Date().getFullYear());
  readonly scope = signal<PeriodScope>('year');
  readonly pipelineId = signal<string | null>(null);
  readonly pipelines = signal<SalesPipeline[]>([]);
  readonly dashboard = signal<SalesForecastDashboard | null>(null);
  readonly loss = signal<SalesLossAnalysis | null>(null);
  readonly quotas = signal<CrmSalesQuota[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);

  readonly quotaModalOpen = signal(false);
  readonly quotaSaving = signal(false);
  readonly editingQuota = signal<CrmSalesQuota | null>(null);
  readonly quotaForm = this.fb.group({
    user_id: this.fb.control('', [Validators.required]),
    period_start: this.fb.control('', [Validators.required]),
    period_end: this.fb.control('', [Validators.required]),
    target_amount: this.fb.control(0, [Validators.required, Validators.min(0)]),
  });

  readonly currency = computed(
    () =>
      this.pipelines().find((pipeline) => pipeline.id === this.pipelineId())?.currency ??
      this.auth.activeCurrency(),
  );
  readonly percent = progressPercent;
  readonly granularityOptions = computed(() => {
    this.i18n.currentLanguage();
    return [
      { label: this.i18n.translate('SALESPIPE.GRAN_MONTH'), value: 'month' },
      { label: this.i18n.translate('SALESPIPE.GRAN_QUARTER'), value: 'quarter' },
    ];
  });

  ngOnInit(): void {
    void this.loadPipelines();
    void this.reload();
    void this.loadQuotas();
  }

  setGranularity(value: SalesForecastGranularity): void {
    this.granularity.set(value);
    void this.reload();
  }

  setYear(value: number | null): void {
    if (value !== null) {
      this.year.set(value);
      void this.reload();
    }
  }

  setScope(value: PeriodScope): void {
    this.scope.set(value);
    void this.reload();
  }

  setPipeline(value: string | null): void {
    this.pipelineId.set(value);
    void this.reload();
  }

  percentFormat(value: string): () => string {
    return () => `${value}%`;
  }

  repName(userId: string): string {
    return this.dashboard()?.reps.find((rep) => rep.user_id === userId)?.name || userId;
  }

  periodError(): boolean {
    const { period_start, period_end } = this.quotaForm.getRawValue();
    return period_start !== '' && period_end !== '' && period_end < period_start;
  }

  async reload(): Promise<void> {
    const ticket = ++this.sequence;
    this.loading.set(true);
    this.error.set(false);

    const quarter = this.scope() === 'year' ? null : Number(this.scope().slice(1));
    const filters = {
      granularity: this.granularity(),
      year: this.year(),
      quarter,
      pipeline_id: this.pipelineId(),
    };

    try {
      const [dashboard, loss] = await Promise.all([
        firstValueFrom(this.api.getForecastDashboard(filters)),
        firstValueFrom(
          this.api.getLossAnalysis({
            pipeline_id: this.pipelineId(),
            from: `${this.year()}-01-01`,
            to: `${this.year()}-12-31`,
          }),
        ),
      ]);
      if (ticket === this.sequence) {
        this.dashboard.set(dashboard);
        this.loss.set(loss);
      }
    } catch {
      if (ticket === this.sequence) {
        this.error.set(true);
      }
    } finally {
      if (ticket === this.sequence) {
        this.loading.set(false);
      }
    }
  }

  openQuota(quota: CrmSalesQuota | null): void {
    this.editingQuota.set(quota);
    this.quotaForm.reset({
      user_id: quota?.user_id ?? '',
      period_start: quota?.period_start.slice(0, 10) ?? `${this.year()}-01-01`,
      period_end: quota?.period_end.slice(0, 10) ?? `${this.year()}-03-31`,
      target_amount: quota ? Number(quota.target_amount) : 0,
    });
    this.quotaModalOpen.set(true);
  }

  async saveQuota(): Promise<void> {
    if (this.quotaForm.invalid || this.periodError()) {
      this.quotaForm.markAllAsTouched();
      return;
    }

    this.quotaSaving.set(true);
    const value = this.quotaForm.getRawValue();
    const payload = { ...value, currency: this.currency() };
    const editing = this.editingQuota();

    try {
      await firstValueFrom(
        editing
          ? this.quotaApi.updateSalesQuota(editing.id, payload)
          : this.quotaApi.createSalesQuota(payload),
      );
      this.quotaModalOpen.set(false);
      this.message.success(this.i18n.translate('SALESPIPE.QUOTA_SAVED'));
      await Promise.all([this.loadQuotas(), this.reload()]);
    } catch {
      // The HTTP interceptor already reports the validation error.
    } finally {
      this.quotaSaving.set(false);
    }
  }

  async deleteQuota(quota: CrmSalesQuota): Promise<void> {
    try {
      await firstValueFrom(this.quotaApi.deleteSalesQuota(quota.id));
      this.message.success(this.i18n.translate('SALESPIPE.QUOTA_DELETED'));
      await Promise.all([this.loadQuotas(), this.reload()]);
    } catch {
      // Reported by the HTTP interceptor.
    }
  }

  private async loadPipelines(): Promise<void> {
    try {
      this.pipelines.set(await firstValueFrom(this.api.listPipelines()));
    } catch {
      this.pipelines.set([]);
    }
  }

  private async loadQuotas(): Promise<void> {
    try {
      this.quotas.set((await firstValueFrom(this.quotaApi.getSalesQuotas())).data);
    } catch {
      this.quotas.set([]);
    }
  }
}
