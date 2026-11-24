import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AnalyticsApiService,
  AnalyticsDesignedReport,
  AnalyticsExportFormat,
  AnalyticsReportResult,
  AnalyticsReportSpec,
  AnalyticsSemanticDataset,
  SettingsApiService,
  UserResource,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { downloadBlob } from '../general-ledger/shared/gl-dates';
import {
  analyticsErrorText,
  buildSpec,
  COMPARE_MODES,
  DesignerFilterRow,
  DesignerState,
  emptyDesignerState,
  PERIOD_PRESETS,
  stateFromSpec,
} from './analytics-designer.util';

const FORMAT_EXTENSIONS: Record<AnalyticsExportFormat, string> = { csv: 'csv', excel_csv: 'csv', xlsx: 'xlsx' };

/**
 * Report designer on the governed semantic layer: pick a dataset, its dimensions and measures, filters, sort,
 * period and comparison, run the report page by page, export it and save it (with sharing) as a designed report.
 */
@Component({
  selector: 'app-report-designer',
  styleUrl: './analytics-pages.scss',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'ANALYTICS_BI.DESIGNER_TITLE' | translate" [subtitle]="'ANALYTICS_BI.DESIGNER_SUBTITLE' | translate" />

    @if (errorText(); as text) {
      <nz-alert nzType="error" [nzMessage]="text" nzShowIcon class="block"></nz-alert>
    }

    <nz-card [nzTitle]="'ANALYTICS_BI.DESIGNER_SPEC' | translate" class="block">
      <div class="grid">
        <div class="field">
          <label for="designer-dataset">{{ 'ANALYTICS_BI.DATASET' | translate }}</label>
          <nz-select id="designer-dataset" [ngModel]="datasetKey()" (ngModelChange)="selectDataset($event)" [nzLoading]="loadingDatasets()" nzShowSearch>
            @for (item of datasets(); track item.key) {
              <nz-option [nzValue]="item.key" [nzLabel]="item.label"></nz-option>
            }
          </nz-select>
        </div>

        @if (dataset(); as current) {
          <div class="field">
            <label for="designer-dimensions">{{ 'ANALYTICS_BI.DIMENSIONS' | translate }}</label>
            <nz-select id="designer-dimensions" nzMode="multiple" [ngModel]="state().dimensions" (ngModelChange)="patch({ dimensions: $event })">
              @for (dimension of current.dimensions; track dimension.key) {
                <nz-option [nzValue]="dimension.key" [nzLabel]="dimension.label" [nzDisabled]="state().dimensions.length >= 4 && !state().dimensions.includes(dimension.key)"></nz-option>
              }
            </nz-select>
          </div>

          @if (dateGranularities().length > 0) {
            <div class="field">
              <label for="designer-granularity">{{ 'ANALYTICS_BI.GRANULARITY' | translate }}</label>
              <nz-select id="designer-granularity" [ngModel]="state().granularity" (ngModelChange)="patch({ granularity: $event })">
                @for (granularity of dateGranularities(); track granularity) {
                  <nz-option [nzValue]="granularity" [nzLabel]="('ANALYTICS_BI.GRANULARITY_' + granularity.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </div>
          }

          <div class="field">
            <label for="designer-measures">{{ 'ANALYTICS_BI.MEASURES' | translate }}</label>
            <nz-select id="designer-measures" nzMode="multiple" [ngModel]="state().measures" (ngModelChange)="patch({ measures: $event })">
              @for (measure of current.measures; track measure.key) {
                <nz-option [nzValue]="measure.key" [nzLabel]="measure.label" [nzDisabled]="state().measures.length >= 8 && !state().measures.includes(measure.key)"></nz-option>
              }
            </nz-select>
          </div>

          @if (current.supports_period) {
            <div class="field">
              <label for="designer-period">{{ 'ANALYTICS_BI.PERIOD' | translate }}</label>
              <nz-select id="designer-period" nzAllowClear [ngModel]="state().periodPreset" (ngModelChange)="patch({ periodPreset: $event })">
                @for (preset of periodPresets; track preset) {
                  <nz-option [nzValue]="preset" [nzLabel]="('ANALYTICS_BI.PERIOD_' + preset.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </div>
            <div class="field">
              <label for="designer-compare">{{ 'ANALYTICS_BI.COMPARE' | translate }}</label>
              <nz-select id="designer-compare" [ngModel]="state().compare" (ngModelChange)="patch({ compare: $event })">
                @for (mode of compareModes; track mode) {
                  <nz-option [nzValue]="mode" [nzLabel]="('ANALYTICS_BI.COMPARE_' + mode.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </div>
          }

          <div class="field">
            <label for="designer-sort">{{ 'ANALYTICS_BI.SORT' | translate }}</label>
            <div class="inline">
              <nz-select id="designer-sort" nzAllowClear [ngModel]="state().sortField" (ngModelChange)="patch({ sortField: $event })" style="min-width: 160px">
                @for (field of sortableFields(); track field.key) {
                  <nz-option [nzValue]="field.key" [nzLabel]="field.label"></nz-option>
                }
              </nz-select>
              <nz-select [ngModel]="state().sortDirection" (ngModelChange)="patch({ sortDirection: $event })" [attr.aria-label]="'ANALYTICS_BI.SORT_DIRECTION' | translate" style="width: 120px">
                <nz-option nzValue="asc" [nzLabel]="'ANALYTICS_BI.SORT_ASC' | translate"></nz-option>
                <nz-option nzValue="desc" [nzLabel]="'ANALYTICS_BI.SORT_DESC' | translate"></nz-option>
              </nz-select>
            </div>
          </div>

          <div class="field">
            <label for="designer-limit">{{ 'ANALYTICS_BI.LIMIT' | translate }}</label>
            <nz-input-number id="designer-limit" [ngModel]="state().limit" (ngModelChange)="patch({ limit: $event })" [nzMin]="1" [nzMax]="100000"></nz-input-number>
          </div>
        }
      </div>

      @if (dataset(); as current) {
        <h4>{{ 'ANALYTICS_BI.FILTERS' | translate }}</h4>
        @for (row of state().filters; track $index) {
          <div class="inline filter-row">
            <nz-select [ngModel]="row.field" (ngModelChange)="patchFilter($index, { field: $event, operator: '' })" [attr.aria-label]="'ANALYTICS_BI.FILTER_FIELD' | translate" style="min-width: 180px">
              @for (field of sortableFields(); track field.key) {
                <nz-option [nzValue]="field.key" [nzLabel]="field.label"></nz-option>
              }
            </nz-select>
            <nz-select [ngModel]="row.operator" (ngModelChange)="patchFilter($index, { operator: $event })" [attr.aria-label]="'ANALYTICS_BI.FILTER_OPERATOR' | translate" style="min-width: 140px">
              @for (operator of operatorsFor(row.field); track operator) {
                <nz-option [nzValue]="operator" [nzLabel]="operator"></nz-option>
              }
            </nz-select>
            <input nz-input [ngModel]="row.value" (ngModelChange)="patchFilter($index, { value: $event })" [attr.aria-label]="'ANALYTICS_BI.FILTER_VALUE' | translate" [placeholder]="'ANALYTICS_BI.FILTER_VALUE_HINT' | translate" style="min-width: 200px" />
            <button nz-button nzType="text" nzDanger type="button" (click)="removeFilter($index)" [attr.aria-label]="'COMMON.DELETE' | translate"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
          </div>
        }
        <button nz-button type="button" (click)="addFilter()" [disabled]="state().filters.length >= 20">{{ 'ANALYTICS_BI.ADD_FILTER' | translate }}</button>
        <span class="muted">{{ current.description }}</span>
      }

      <div class="actions">
        <button nz-button nzType="primary" type="button" [nzLoading]="running()" [disabled]="!canRun()" (click)="run(1)">{{ 'ANALYTICS_BI.RUN' | translate }}</button>
        <nz-select [(ngModel)]="exportFormat" [attr.aria-label]="'ANALYTICS_BI.FORMAT' | translate" style="width: 160px">
          @for (format of formats; track format) {
            <nz-option [nzValue]="format" [nzLabel]="('ANALYTICS_BI.FORMAT_' + format.toUpperCase()) | translate"></nz-option>
          }
        </nz-select>
        <button nz-button type="button" [disabled]="!canRun()" (click)="exportReport()">{{ 'ANALYTICS_BI.EXPORT' | translate }}</button>
        <button nz-button type="button" [disabled]="!canRun()" (click)="openSave()">{{ (editingId() ? 'ANALYTICS_BI.SAVE_CHANGES' : 'ANALYTICS_BI.SAVE_REPORT') | translate }}</button>
        @if (editingId()) {
          <button nz-button type="button" (click)="startNew()">{{ 'ANALYTICS_BI.NEW_REPORT' | translate }}</button>
        }
      </div>
    </nz-card>

    @if (result(); as current) {
      <nz-card [nzTitle]="'ANALYTICS_BI.RESULT' | translate" class="block">
        @if (current.meta.truncated) {
          <nz-alert nzType="warning" nzShowIcon class="block" [nzMessage]="'ANALYTICS_BI.TRUNCATED' | translate: { limit: current.meta.row_limit }"></nz-alert>
        }
        <nz-table
          #resultTable
          nzSize="small"
          [nzFrontPagination]="false"
          [nzData]="current.rows"
          [nzLoading]="running()"
          [nzTotal]="current.meta.total"
          [nzPageIndex]="current.meta.page"
          [nzPageSize]="current.meta.per_page"
          (nzPageIndexChange)="run($event)"
        >
          <thead>
            <tr>
              @for (column of current.columns; track column.key) {
                <th [class.num]="column.kind !== 'dimension'">{{ column.label }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of resultTable.data; track $index) {
              <tr>
                @for (column of current.columns; track column.key) {
                  <td [class.num]="column.kind !== 'dimension'">{{ cell(row[column.key]) }}</td>
                }
              </tr>
            }
          </tbody>
        </nz-table>
        @if (current.rows.length === 0 && !running()) {
          <nz-empty [nzNotFoundContent]="'ANALYTICS_BI.NO_ROWS' | translate"></nz-empty>
        }
      </nz-card>
    }

    <nz-card [nzTitle]="'ANALYTICS_BI.SAVED_REPORTS' | translate" class="block">
      <nz-table #reportsTable nzSize="small" [nzData]="reports()" [nzLoading]="loadingReports()" [nzPageSize]="10">
        <thead>
          <tr>
            <th>{{ 'COMMON.NAME' | translate }}</th>
            <th>{{ 'ANALYTICS_BI.DATASET' | translate }}</th>
            <th>{{ 'ANALYTICS_BI.SHARING' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (report of reportsTable.data; track report.id) {
            <tr>
              <td>{{ report.name }}</td>
              <td>{{ report.dataset }}</td>
              <td>
                @if (report.is_shared) {
                  <nz-tag nzColor="blue">{{ 'ANALYTICS_BI.SHARED_COMPANY' | translate }}</nz-tag>
                } @else if (report.shared_with.length > 0) {
                  <nz-tag nzColor="cyan">{{ 'ANALYTICS_BI.SHARED_USERS' | translate: { count: report.shared_with.length } }}</nz-tag>
                } @else if (!report.is_owner) {
                  <nz-tag>{{ 'ANALYTICS_BI.SHARED_WITH_ME' | translate }}</nz-tag>
                }
              </td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="link" type="button" (click)="load(report)">{{ 'ANALYTICS_BI.OPEN' | translate }}</button>
                  <button nz-button nzType="link" type="button" (click)="exportSaved(report)">{{ 'ANALYTICS_BI.EXPORT' | translate }}</button>
                  @if (report.is_owner) {
                    <button nz-button nzType="text" nzDanger type="button" nz-popconfirm [nzPopconfirmTitle]="'ANALYTICS_BI.DELETE_REPORT_CONFIRM' | translate" (nzOnConfirm)="remove(report)" [attr.aria-label]="'COMMON.DELETE' | translate"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loadingReports() && reports().length === 0) {
        <nz-empty [nzNotFoundContent]="'ANALYTICS_BI.NO_REPORTS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="saveVisible" [nzTitle]="'ANALYTICS_BI.SAVE_REPORT' | translate" [nzOkText]="'COMMON.SAVE' | translate" [nzCancelText]="'COMMON.CANCEL' | translate" [nzOkDisabled]="reportName().trim() === ''" [nzOkLoading]="saving()" (nzOnOk)="save()" (nzOnCancel)="saveVisible.set(false)">
      <ng-container *nzModalContent>
        @if (saveError(); as text) {
          <nz-alert nzType="error" [nzMessage]="text" nzShowIcon class="block"></nz-alert>
        }
        <div class="field">
          <label for="report-name">{{ 'COMMON.NAME' | translate }}</label>
          <input nz-input id="report-name" maxlength="150" [ngModel]="reportName()" (ngModelChange)="reportName.set($event)" />
        </div>
        <div class="field">
          <label for="report-description">{{ 'COMMON.DESCRIPTION' | translate }}</label>
          <textarea nz-input id="report-description" rows="2" maxlength="2000" [ngModel]="reportDescription()" (ngModelChange)="reportDescription.set($event)"></textarea>
        </div>
        <label for="report-designer-field" class="inline"><nz-switch nzId="report-designer-field" [ngModel]="reportShared()" (ngModelChange)="reportShared.set($event)"></nz-switch> {{ 'ANALYTICS_BI.SHARE_WITH_COMPANY' | translate }}</label>
        @if (!reportShared()) {
          <div class="field">
            <label for="report-shared-with">{{ 'ANALYTICS_BI.SHARE_WITH_USERS' | translate }}</label>
            <nz-select
              id="report-shared-with"
              nzMode="multiple"
              nzShowSearch
              [nzPlaceHolder]="'ANALYTICS_BI.SHARE_WITH_USERS_HINT' | translate"
              [ngModel]="reportSharedWith()"
              (ngModelChange)="reportSharedWith.set($event)"
            >
              @for (user of shareableUsers(); track user.id) {
                <nz-option [nzValue]="user.id" [nzLabel]="user.name + ' (' + user.email + ')'"></nz-option>
              }
            </nz-select>
          </div>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class ReportDesignerComponent implements OnInit {
  private readonly api = inject(AnalyticsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly settingsApi = inject(SettingsApiService);

  readonly periodPresets = PERIOD_PRESETS;
  readonly compareModes = COMPARE_MODES;
  readonly formats: AnalyticsExportFormat[] = ['csv', 'excel_csv', 'xlsx'];

  readonly datasets = signal<AnalyticsSemanticDataset[]>([]);
  readonly datasetKey = signal<string | null>(null);
  readonly state = signal<DesignerState>(emptyDesignerState());
  readonly result = signal<AnalyticsReportResult | null>(null);
  readonly reports = signal<AnalyticsDesignedReport[]>([]);
  readonly loadingDatasets = signal(false);
  readonly loadingReports = signal(false);
  readonly running = signal(false);
  readonly errorText = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly saveVisible = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly reportName = signal('');
  readonly reportDescription = signal('');
  readonly reportShared = signal(false);
  readonly reportSharedWith = signal<string[]>([]);
  readonly shareableUsers = signal<UserResource[]>([]);
  exportFormat: AnalyticsExportFormat = 'csv';

  readonly dataset = computed(() => this.datasets().find((item) => item.key === this.datasetKey()));
  readonly canRun = computed(() => this.dataset() !== undefined && this.state().measures.length > 0);
  readonly sortableFields = computed(() => {
    const current = this.dataset();
    return current ? [...current.dimensions, ...current.measures].map((field) => ({ key: field.key, label: field.label })) : [];
  });
  readonly dateGranularities = computed(() => {
    const current = this.dataset();
    const chosen = current?.dimensions.filter((dimension) => dimension.type === 'date' && this.state().dimensions.includes(dimension.key)) ?? [];
    return chosen[0]?.granularities ?? [];
  });

  ngOnInit(): void {
    this.loadingDatasets.set(true);
    this.api.getSemanticDatasets().subscribe({
      next: (response) => {
        this.datasets.set(response.data);
        this.loadingDatasets.set(false);
      },
      error: (error: unknown) => {
        this.loadingDatasets.set(false);
        this.errorText.set(analyticsErrorText(error) ?? this.translate.instant('ANALYTICS_BI.ACTION_ERROR'));
      },
    });
    this.loadReports();
  }

  patch(partial: Partial<DesignerState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }

  selectDataset(key: string | null): void {
    this.datasetKey.set(key);
    this.state.set(emptyDesignerState());
    this.result.set(null);
    this.editingId.set(null);
  }

  addFilter(): void {
    this.patch({ filters: [...this.state().filters, { field: '', operator: '', value: '' }] });
  }

  patchFilter(index: number, partial: Partial<DesignerFilterRow>): void {
    this.patch({ filters: this.state().filters.map((row, position) => (position === index ? { ...row, ...partial } : row)) });
  }

  removeFilter(index: number): void {
    this.patch({ filters: this.state().filters.filter((_, position) => position !== index) });
  }

  /** The operators the catalogue allows for a dimension; a measure takes the operators of its aggregate (HAVING). */
  operatorsFor(field: string): string[] {
    const dimension = this.dataset()?.dimensions.find((candidate) => candidate.key === field);
    if (dimension) {
      return dimension.operators ?? [];
    }

    return field === '' ? [] : ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'not_null'];
  }

  cell(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
  }

  run(page: number): void {
    if (!this.canRun() || !this.datasetKey()) {
      return;
    }

    this.running.set(true);
    this.errorText.set(null);
    this.api.runDesigner({ dataset: this.datasetKey() as string, spec: this.spec(), page, per_page: 50 }).subscribe({
      next: (response) => {
        this.result.set(response.data);
        this.running.set(false);
      },
      error: (error: unknown) => {
        this.running.set(false);
        this.errorText.set(analyticsErrorText(error) ?? this.translate.instant('ANALYTICS_BI.ACTION_ERROR'));
      },
    });
  }

  exportReport(): void {
    if (!this.canRun() || !this.datasetKey()) {
      return;
    }

    this.api.exportDesigner({ dataset: this.datasetKey() as string, spec: this.spec(), format: this.exportFormat }).subscribe({
      next: (blob) => downloadBlob(blob, `${this.datasetKey()}.${FORMAT_EXTENSIONS[this.exportFormat]}`),
      error: (error: unknown) => this.errorText.set(analyticsErrorText(error) ?? this.translate.instant('ANALYTICS_BI.ACTION_ERROR')),
    });
  }

  openSave(): void {
    this.saveError.set(null);
    if (this.shareableUsers().length === 0) {
      this.settingsApi.getTenantUsers().subscribe({
        next: (response) => this.shareableUsers.set(response.data.filter((user) => user.is_active)),
        error: () => this.shareableUsers.set([]),
      });
    }
    this.saveVisible.set(true);
  }

  save(): void {
    const dataset = this.datasetKey();
    if (!dataset || this.reportName().trim() === '') {
      return;
    }

    const payload = {
      name: this.reportName().trim(),
      description: this.reportDescription().trim() || null,
      dataset,
      spec: this.spec(),
      is_shared: this.reportShared(),
      shared_with: this.reportShared() ? [] : this.reportSharedWith(),
    };
    const id = this.editingId();
    const request = id ? this.api.updateDesignedReport(id, payload) : this.api.createDesignedReport(payload);

    this.saving.set(true);
    this.saveError.set(null);
    request.subscribe({
      next: (response) => {
        this.saving.set(false);
        this.saveVisible.set(false);
        this.editingId.set(response.data.id);
        this.message.success(this.translate.instant('ANALYTICS_BI.REPORT_SAVED'));
        this.loadReports();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.saveError.set(analyticsErrorText(error) ?? this.translate.instant('ANALYTICS_BI.ACTION_ERROR'));
      },
    });
  }

  load(report: AnalyticsDesignedReport): void {
    this.datasetKey.set(report.dataset);
    this.state.set(stateFromSpec(report.spec));
    this.editingId.set(report.is_owner ? report.id : null);
    this.reportName.set(report.name);
    this.reportDescription.set(report.description ?? '');
    this.reportShared.set(report.is_shared);
    this.reportSharedWith.set(report.is_owner ? [...report.shared_with] : []);
    this.run(1);
  }

  startNew(): void {
    this.editingId.set(null);
    this.reportName.set('');
    this.reportDescription.set('');
    this.reportShared.set(false);
    this.reportSharedWith.set([]);
    this.state.set(emptyDesignerState());
    this.result.set(null);
  }

  exportSaved(report: AnalyticsDesignedReport): void {
    this.api.exportDesignedReport(report.id, this.exportFormat).subscribe({
      next: (blob) => downloadBlob(blob, `${report.name}.${FORMAT_EXTENSIONS[this.exportFormat]}`),
      error: (error: unknown) => this.errorText.set(analyticsErrorText(error) ?? this.translate.instant('ANALYTICS_BI.ACTION_ERROR')),
    });
  }

  remove(report: AnalyticsDesignedReport): void {
    this.api.deleteDesignedReport(report.id).subscribe({
      next: () => {
        if (this.editingId() === report.id) {
          this.startNew();
        }
        this.message.success(this.translate.instant('ANALYTICS_BI.REPORT_DELETED'));
        this.loadReports();
      },
      error: (error: unknown) => this.errorText.set(analyticsErrorText(error) ?? this.translate.instant('ANALYTICS_BI.ACTION_ERROR')),
    });
  }

  private spec(): AnalyticsReportSpec {
    return buildSpec(this.state(), this.dataset());
  }

  private loadReports(): void {
    this.loadingReports.set(true);
    this.api.getDesignedReports().subscribe({
      next: (response) => {
        this.reports.set(response.data);
        this.loadingReports.set(false);
      },
      error: () => this.loadingReports.set(false),
    });
  }
}
