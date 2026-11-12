import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CrmApiService, CrmForecast, CrmReport, I18nService, PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { toTimestamp } from '@shared/utils/date-validators';

const DECIMAL = /^\d+(\.\d{1,2})?$/;

/** CRM reports (pipeline, conversion, activities) and sales forecasts that can be locked. */
@Component({
  selector: 'app-crm-reports',
  styleUrl: './crm-reports.component.scss',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzInputModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './crm-reports.component.html',
})
export class CrmReportsComponent {
  private readonly api = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('crm'));

  protected from = '';
  protected to = '';
  protected readonly pipeline = signal<CrmReport | null>(null);
  protected readonly conversion = signal<CrmReport | null>(null);
  protected readonly activities = signal<CrmReport | null>(null);
  protected readonly loading = signal(false);

  protected readonly forecasts = signal<CrmForecast[]>([]);
  protected forecastPeriod = '';
  protected quota = '';

  constructor() {
    this.runReports();
    this.loadForecasts();
  }

  /** Mirrors `to: after_or_equal:from` of the report endpoints. */
  protected endsBeforeStart(): boolean {
    const start = toTimestamp(this.from);
    const end = toTimestamp(this.to);
    return start !== null && end !== null && end < start;
  }

  protected runReports(): void {
    if (this.endsBeforeStart()) {
      return;
    }
    const params = { from: this.from || null, to: this.to || null };
    this.loading.set(true);
    this.api.getPipelineReport(params).subscribe({
      next: (res) => this.pipeline.set(res.data),
      error: () => this.pipeline.set(null),
    });
    this.api.getConversionReport(params).subscribe({
      next: (res) => this.conversion.set(res.data),
      error: () => this.conversion.set(null),
    });
    this.api.getActivitiesReport(params).subscribe({
      next: (res) => {
        this.activities.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.activities.set(null);
        this.loading.set(false);
      },
    });
  }

  protected loadForecasts(): void {
    this.api.getForecasts({ per_page: 50 }).subscribe({
      next: (res) => this.forecasts.set(res.data ?? []),
      error: () => this.forecasts.set([]),
    });
  }

  protected canGenerate(): boolean {
    return this.forecastPeriod.trim().length > 0 && (!this.quota || DECIMAL.test(this.quota));
  }

  protected generate(): void {
    this.api
      .generateForecast({ period: this.forecastPeriod.trim(), quota_amount: this.quota || null })
      .subscribe({
        next: () => {
          this.message.success(this.i18n.translate('CRMX.REPORTS.FORECAST_GENERATED'));
          this.loadForecasts();
        },
      });
  }

  protected lock(forecast: CrmForecast): void {
    this.api.lockForecast(forecast.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CRMX.REPORTS.FORECAST_LOCKED'));
        this.loadForecasts();
      },
    });
  }

  protected entries(report: CrmReport | null): [string, unknown][] {
    return Object.entries(report ?? {});
  }

  protected display(value: unknown): string {
    return value !== null && typeof value === 'object' ? JSON.stringify(value, null, 1) : String(value ?? '-');
  }
}
