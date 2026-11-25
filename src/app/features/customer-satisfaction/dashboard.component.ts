import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CS_GRANULARITIES,
  CS_REPORT_FORMATS,
  CS_SURVEY_TYPES,
  CsAnalyticsFilters,
  CsGroupBy,
  CsReport,
  CsReportFormat,
  CsSurveyType,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AnalyticsStore } from './analytics.store';
import {
  formatKpi,
  npsColor,
  polyline,
  reportFilename,
  saveBlob,
  sentimentColor,
  trendPoints,
} from './customer-satisfaction.util';

const BREAKDOWN_DIMENSIONS: CsGroupBy[] = ['department', 'technician', 'product_line', 'branch'];

/**
 * The executive and ISO 9001:2015 § 9.1.2 dashboard: NPS (promoters, passives, detractors), CSAT, CES, response rate and the
 * closed-loop 24 hour SLA; the trend; the breakdown by department, technician, product line and branch; the sentiment of the
 * open comments; and the Management Review (Riesame della Direzione) reports with their CSV / JSON / printable export.
 */
@Component({
  selector: 'app-cs-dashboard',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [AnalyticsStore],
  styleUrl: './customer-satisfaction.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.CUSTOMER_SATISFACTION_DASHBOARD' | translate"
      [subtitle]="'customerSatisfaction.dashboard.subtitle' | translate"
    ></app-page-header>

    <div class="toolbar">
      <label class="field" for="cs-from">
        <span>{{ 'customerSatisfaction.field.from' | translate }}</span>
        <input nz-input id="cs-from" type="date" [(ngModel)]="from" />
      </label>
      <label class="field" for="cs-to">
        <span>{{ 'customerSatisfaction.field.to' | translate }}</span>
        <input nz-input id="cs-to" type="date" [(ngModel)]="to" />
      </label>
      <label class="field" for="cs-type">
        <span>{{ 'customerSatisfaction.field.surveyType' | translate }}</span>
        <nz-select nzId="cs-type" nzAllowClear [(ngModel)]="surveyType">
          @for (type of surveyTypes; track type) {
            <nz-option
              [nzValue]="type"
              [nzLabel]="'customerSatisfaction.surveyType.' + type | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="cs-department">
        <span>{{ 'customerSatisfaction.dimension.department' | translate }}</span>
        <input nz-input id="cs-department" [(ngModel)]="department" />
      </label>
      <label class="field" for="cs-branch">
        <span>{{ 'customerSatisfaction.dimension.branch' | translate }}</span>
        <input nz-input id="cs-branch" [(ngModel)]="branch" />
      </label>
      <label class="field" for="cs-product-line">
        <span>{{ 'customerSatisfaction.dimension.product_line' | translate }}</span>
        <input nz-input id="cs-product-line" [(ngModel)]="productLine" />
      </label>
      <button nz-button nzType="primary" type="button" data-test="apply" (click)="apply()">
        {{ 'customerSatisfaction.action.apply' | translate }}
      </button>
    </div>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.overview(); as overview) {
        <div class="kpi-grid" data-test="kpis">
          <div class="kpi">
            <div class="kpi-label">{{ 'customerSatisfaction.kpi.nps' | translate }}</div>
            <div class="kpi-value" data-test="nps-score">
              <nz-tag [nzColor]="npsColor(overview.kpis.nps.score)">{{
                formatKpi(overview.kpis.nps.score, 0)
              }}</nz-tag>
            </div>
            <div
              class="nps-bar"
              role="img"
              [attr.aria-label]="'customerSatisfaction.kpi.npsBreakdown' | translate"
            >
              <span class="promoters" [style.width.%]="overview.kpis.nps.promoters_pct"></span>
              <span class="passives" [style.width.%]="overview.kpis.nps.passives_pct"></span>
              <span class="detractors" [style.width.%]="overview.kpis.nps.detractors_pct"></span>
            </div>
            <div class="kpi-sub" data-test="nps-split">
              {{ 'customerSatisfaction.band.promoter' | translate }}
              {{ formatKpi(overview.kpis.nps.promoters_pct) }}% ·
              {{ 'customerSatisfaction.band.passive' | translate }}
              {{ formatKpi(overview.kpis.nps.passives_pct) }}% ·
              {{ 'customerSatisfaction.band.detractor' | translate }}
              {{ formatKpi(overview.kpis.nps.detractors_pct) }}%
            </div>
          </div>
          <div class="kpi">
            <div class="kpi-label">{{ 'customerSatisfaction.kpi.csat' | translate }}</div>
            <div class="kpi-value" data-test="csat">
              {{ formatKpi(overview.kpis.csat.positive_pct) }}%
            </div>
            <div class="kpi-sub">
              {{ 'customerSatisfaction.kpi.average' | translate }}
              {{ formatKpi(overview.kpis.csat.average, 2) }} ·
              {{ overview.kpis.csat.responses }}
              {{ 'customerSatisfaction.kpi.responses' | translate }}
            </div>
          </div>
          <div class="kpi">
            <div class="kpi-label">{{ 'customerSatisfaction.kpi.ces' | translate }}</div>
            <div class="kpi-value" data-test="ces">
              {{ formatKpi(overview.kpis.ces.average, 2) }}
            </div>
            <div class="kpi-sub">
              {{ 'customerSatisfaction.kpi.lowEffort' | translate }}
              {{ formatKpi(overview.kpis.ces.low_effort_rate) }}% ·
              {{ overview.kpis.ces.responses }}
              {{ 'customerSatisfaction.kpi.responses' | translate }}
            </div>
          </div>
          <div class="kpi">
            <div class="kpi-label">{{ 'customerSatisfaction.kpi.responseRate' | translate }}</div>
            <div class="kpi-value" data-test="response-rate">
              {{ formatKpi(overview.response_rate.rate) }}%
            </div>
            <div class="kpi-sub">
              {{ overview.response_rate.responded }} / {{ overview.response_rate.sent }}
            </div>
          </div>
          <div class="kpi">
            <div class="kpi-label">{{ 'customerSatisfaction.kpi.slaCompliance' | translate }}</div>
            <div class="kpi-value" data-test="sla">
              {{ formatKpi(overview.closed_loop.sla_compliance) }}%
            </div>
            <div class="kpi-sub">
              {{ 'customerSatisfaction.kpi.resolutionRate' | translate }}
              {{ formatKpi(overview.closed_loop.resolution_rate) }}%
            </div>
          </div>
          <div class="kpi">
            <div class="kpi-label">{{ 'customerSatisfaction.kpi.openCases' | translate }}</div>
            <div class="kpi-value" data-test="open-cases">{{ overview.closed_loop.open }}</div>
            <div class="kpi-sub">
              {{ 'customerSatisfaction.kpi.overdue' | translate }}
              {{ overview.closed_loop.open_overdue }}
            </div>
          </div>
        </div>
      }

      <section class="main-card">
        <div class="toolbar">
          <h3 class="section-title">{{ 'customerSatisfaction.section.trend' | translate }}</h3>
          <span class="spacer"></span>
          <nz-select
            class="field"
            [ngModel]="store.granularity()"
            [attr.aria-label]="'customerSatisfaction.field.granularity' | translate"
            (ngModelChange)="store.setGranularity($event)"
          >
            @for (granularity of granularities; track granularity) {
              <nz-option
                [nzValue]="granularity"
                [nzLabel]="'customerSatisfaction.granularity.' + granularity | translate"
              ></nz-option>
            }
          </nz-select>
        </div>
        @if (npsLine().length + csatLine().length + cesLine().length > 0) {
          <svg
            class="trend-chart"
            viewBox="0 0 600 160"
            preserveAspectRatio="none"
            role="img"
            data-test="trend"
            [attr.aria-label]="'customerSatisfaction.section.trend' | translate"
          >
            <line class="axis" x1="0" y1="159" x2="600" y2="159" />
            <polyline class="line-nps" [attr.points]="npsPolyline()" />
            <polyline class="line-csat" [attr.points]="csatPolyline()" />
            <polyline class="line-ces" [attr.points]="cesPolyline()" />
          </svg>
          <div class="legend">
            <span
              ><i class="swatch" style="background: #1677ff"></i
              >{{ 'customerSatisfaction.kpi.nps' | translate }}</span
            >
            <span
              ><i class="swatch" style="background: #52c41a"></i
              >{{ 'customerSatisfaction.kpi.csat' | translate }}</span
            >
            <span
              ><i class="swatch" style="background: #fa8c16"></i
              >{{ 'customerSatisfaction.kpi.ces' | translate }}</span
            >
            <span class="muted">{{ trendRange() }}</span>
          </div>
        } @else {
          <nz-empty [nzNotFoundContent]="'customerSatisfaction.empty.trend' | translate"></nz-empty>
        }
      </section>

      <section class="main-card">
        <div class="toolbar">
          <h3 class="section-title">{{ 'customerSatisfaction.section.breakdown' | translate }}</h3>
          <span class="spacer"></span>
          <nz-select
            class="field"
            [ngModel]="store.groupBy()"
            [attr.aria-label]="'customerSatisfaction.field.groupBy' | translate"
            (ngModelChange)="store.setGroupBy($event)"
          >
            @for (dimension of dimensions; track dimension) {
              <nz-option
                [nzValue]="dimension"
                [nzLabel]="'customerSatisfaction.dimension.' + dimension | translate"
              ></nz-option>
            }
          </nz-select>
        </div>
        <nz-table
          #table
          nzSize="small"
          [nzData]="store.breakdown()"
          [nzShowPagination]="false"
          [nzScroll]="{ x: '800px' }"
        >
          <thead>
            <tr>
              <th scope="col">{{ 'customerSatisfaction.field.dimension' | translate }}</th>
              <th scope="col" class="num">
                {{ 'customerSatisfaction.kpi.responses' | translate }}
              </th>
              <th scope="col" class="num">{{ 'customerSatisfaction.kpi.nps' | translate }}</th>
              <th scope="col" class="num">{{ 'customerSatisfaction.kpi.csat' | translate }} %</th>
              <th scope="col" class="num">{{ 'customerSatisfaction.kpi.ces' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.key ?? 'none') {
              <tr>
                <th scope="row">
                  {{ row.label ?? ('customerSatisfaction.field.unassigned' | translate) }}
                </th>
                <td class="num">{{ row.total }}</td>
                <td class="num">{{ formatKpi(row.nps.score, 0) }}</td>
                <td class="num">{{ formatKpi(row.csat.positive_pct) }}</td>
                <td class="num">{{ formatKpi(row.ces.average, 2) }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </section>

      @if (store.sentiment(); as sentiment) {
        <section class="main-card" data-test="sentiment">
          <h3 class="section-title">{{ 'customerSatisfaction.section.sentiment' | translate }}</h3>
          @if (sentiment.analyzed === 0) {
            <nz-empty
              [nzNotFoundContent]="'customerSatisfaction.empty.sentiment' | translate"
            ></nz-empty>
          } @else {
            <div class="chips">
              @for (label of sentimentLabels; track label) {
                <nz-tag [nzColor]="sentimentColor(label)">
                  {{ 'customerSatisfaction.sentiment.' + label | translate }}:
                  {{ sentiment.labels[label] }}
                </nz-tag>
              }
              <span class="muted">
                {{ 'customerSatisfaction.kpi.average' | translate }}
                {{ formatKpi(sentiment.average_score, 2) }}
              </span>
            </div>
            <div class="section-title">{{ 'customerSatisfaction.section.topics' | translate }}</div>
            <div class="chips">
              @for (topic of sentiment.topics; track topic.topic) {
                <nz-tag
                  >{{ 'customerSatisfaction.topic.' + topic.topic | translate }} ·
                  {{ topic.count }}</nz-tag
                >
              }
              @for (keyword of sentiment.keywords; track keyword.keyword) {
                <nz-tag nzColor="blue">{{ keyword.keyword }} · {{ keyword.count }}</nz-tag>
              }
            </div>
          }
        </section>
      }
    </nz-spin>

    <section class="main-card" data-test="reports">
      <h3 class="section-title">
        {{ 'customerSatisfaction.section.managementReview' | translate }}
      </h3>
      <p class="muted">{{ 'customerSatisfaction.hint.iso9001' | translate }}</p>
      <div class="form-grid">
        <label class="field" for="cs-report-title">
          <span>{{ 'customerSatisfaction.field.reportTitle' | translate }}</span>
          <input nz-input id="cs-report-title" maxlength="200" [(ngModel)]="reportTitle" />
        </label>
        <label class="field" for="cs-report-group">
          <span>{{ 'customerSatisfaction.field.groupBy' | translate }}</span>
          <nz-select nzId="cs-report-group" [(ngModel)]="reportGroupBy">
            <nz-option
              nzValue="overall"
              [nzLabel]="'customerSatisfaction.dimension.overall' | translate"
            ></nz-option>
            @for (dimension of dimensions; track dimension) {
              <nz-option
                [nzValue]="dimension"
                [nzLabel]="'customerSatisfaction.dimension.' + dimension | translate"
              ></nz-option>
            }
          </nz-select>
        </label>
      </div>
      <label class="field" for="cs-report-notes">
        <span>{{ 'customerSatisfaction.field.managementReviewNotes' | translate }}</span>
        <textarea
          nz-input
          id="cs-report-notes"
          rows="3"
          maxlength="8000"
          [(ngModel)]="reportNotes"
        ></textarea>
      </label>
      <p>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-test="generate-report"
          [nzLoading]="store.generating()"
          (click)="generate()"
        >
          {{ 'customerSatisfaction.action.generateReport' | translate }}
        </button>
      </p>

      <nz-table #reports nzSize="small" [nzData]="store.reports()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th scope="col">{{ 'customerSatisfaction.field.reportTitle' | translate }}</th>
            <th scope="col">{{ 'customerSatisfaction.field.period' | translate }}</th>
            <th scope="col" class="num">{{ 'customerSatisfaction.kpi.nps' | translate }}</th>
            <th scope="col" class="num">{{ 'customerSatisfaction.kpi.csat' | translate }} %</th>
            <th scope="col" class="num">
              {{ 'customerSatisfaction.kpi.slaCompliance' | translate }}
            </th>
            <th scope="col">{{ 'customerSatisfaction.field.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (report of reports.data; track report.id) {
            <tr>
              <th scope="row">
                {{ report.title }}
                <small class="muted">{{
                  'customerSatisfaction.dimension.' + report.group_by | translate
                }}</small>
              </th>
              <td>{{ report.period_from }} – {{ report.period_to }}</td>
              <td class="num">{{ formatKpi(report.headline.nps, 0) }}</td>
              <td class="num">{{ formatKpi(report.headline.csat_pct) }}</td>
              <td class="num">{{ formatKpi(report.headline.sla_compliance) }}</td>
              <td class="row-actions">
                @for (format of formats; track format) {
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [attr.data-test]="'export-' + format"
                    (click)="download(report, format)"
                  >
                    {{ 'customerSatisfaction.export.' + format | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </section>
  `,
})
export class DashboardComponent implements OnInit {
  protected readonly store = inject(AnalyticsStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly surveyTypes = CS_SURVEY_TYPES;
  protected readonly granularities = CS_GRANULARITIES;
  protected readonly formats = CS_REPORT_FORMATS;
  protected readonly dimensions = BREAKDOWN_DIMENSIONS;
  protected readonly sentimentLabels = ['positive', 'neutral', 'negative'] as const;
  protected readonly formatKpi = formatKpi;
  protected readonly npsColor = npsColor;
  protected readonly sentimentColor = sentimentColor;

  protected from = '';
  protected to = '';
  protected surveyType: CsSurveyType | null = null;
  protected department = '';
  protected branch = '';
  protected productLine = '';

  protected reportTitle = '';
  protected reportGroupBy: CsGroupBy = 'overall';
  protected reportNotes = '';

  /** NPS runs from -100 to 100, CSAT is a percentage, CES an average of 1-7: each is drawn on its own scale. */
  protected readonly npsLine = computed(() =>
    trendPoints(this.store.trend(), (kpis) => kpis.nps.score, -100, 100),
  );
  protected readonly csatLine = computed(() =>
    trendPoints(this.store.trend(), (kpis) => kpis.csat.positive_pct, 0, 100),
  );
  protected readonly cesLine = computed(() =>
    trendPoints(this.store.trend(), (kpis) => kpis.ces.average, 1, 7),
  );
  protected readonly npsPolyline = computed(() => polyline(this.npsLine()));
  protected readonly csatPolyline = computed(() => polyline(this.csatLine()));
  protected readonly cesPolyline = computed(() => polyline(this.cesLine()));
  protected readonly trendRange = computed(() => {
    const rows = this.store.trend();
    return rows.length === 0 ? '' : `${rows[0].bucket} → ${rows[rows.length - 1].bucket}`;
  });

  private readonly busy = signal(false);

  ngOnInit(): void {
    void this.store.loadAll();
  }

  protected filters(): CsAnalyticsFilters {
    const filters: CsAnalyticsFilters = {};
    if (this.from) filters.from = this.from;
    if (this.to) filters.to = this.to;
    if (this.surveyType) filters.survey_type = this.surveyType;
    if (this.department.trim()) filters.department_code = this.department.trim();
    if (this.branch.trim()) filters.branch_code = this.branch.trim();
    if (this.productLine.trim()) filters.product_line_code = this.productLine.trim();
    return filters;
  }

  protected apply(): void {
    void this.store.loadAll(this.filters());
  }

  protected async generate(): Promise<void> {
    const outcome = await this.store.generateReport({
      title: this.reportTitle.trim() || undefined,
      group_by: this.reportGroupBy,
      filters: this.filters(),
      management_review_notes: this.reportNotes.trim() || null,
    });
    if (outcome.ok) {
      this.message.success(this.i18n.instant('customerSatisfaction.message.reportGenerated'));
      this.reportTitle = '';
      this.reportNotes = '';
    } else {
      this.message.error(
        this.i18n.instant(outcome.errorKey ?? 'customerSatisfaction.error.generic'),
      );
    }
  }

  protected async download(report: CsReport, format: CsReportFormat): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    const { outcome, blob } = await this.store.exportReport(report.id, format);
    this.busy.set(false);
    if (blob !== null) {
      saveBlob(blob, reportFilename(report.title, format));
    } else {
      this.message.error(
        this.i18n.instant(outcome.errorKey ?? 'customerSatisfaction.error.generic'),
      );
    }
  }
}
