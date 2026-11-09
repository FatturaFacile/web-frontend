import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe, TitleCasePipe } from '@angular/common';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzGridModule } from 'ng-zorro-antd/grid';
import {
  AnalyticsApiService,
  AnalyticsKpiReport,
  AnalyticsPeriodPreset,
  AnalyticsReportDefinition,
  BreakdownEntry,
  DueCalendarEntry,
  RevenueComparisonData,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-analytics',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    CurrencyPipe,
    DecimalPipe,
    PercentPipe,
    TitleCasePipe,
    NzTabsModule,
    NzCardModule,
    NzButtonModule,
    NzTagModule,
    NzTableModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    NzAlertModule,
    NzSpinModule,
    NzStatisticModule,
    NzGridModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
})
export class AnalyticsComponent implements OnInit {
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);

  readonly selectedTab = signal<number>(0);
  readonly isLoading = signal<boolean>(false);
  readonly isActionLoading = signal<boolean>(false);

  // KPIs
  readonly kpiReport = signal<AnalyticsKpiReport | null>(null);
  readonly selectedPeriodPreset = signal<AnalyticsPeriodPreset>('month_to_date');
  readonly selectedCompare = signal<'none' | 'previous_period' | 'previous_year'>('previous_period');

  // Due Calendar
  readonly dueEntries = signal<DueCalendarEntry[]>([]);
  readonly filterDirection = signal<'all' | 'inflow' | 'outflow'>('all');
  readonly filterOverdueOnly = signal<boolean>(false);
  readonly dueCalendarSummary = computed(() => {
    const list = this.dueEntries();
    let totalInflow = 0;
    let totalOutflow = 0;
    let overdueCount = 0;

    for (const item of list) {
      if (item.direction === 'inflow') {
        totalInflow += item.amount;
      } else {
        totalOutflow += item.amount;
      }
      if (item.is_overdue) {
        overdueCount++;
      }
    }
    return {
      totalInflow,
      totalOutflow,
      netLiquidity: totalInflow - totalOutflow,
      overdueCount,
    };
  });

  readonly filteredDueEntries = computed(() => {
    let list = this.dueEntries();
    const dir = this.filterDirection();
    if (dir !== 'all') {
      list = list.filter((e) => e.direction === dir);
    }
    if (this.filterOverdueOnly()) {
      list = list.filter((e) => e.is_overdue);
    }
    return list;
  });

  // Revenue & Breakdown
  readonly revenueComparison = signal<RevenueComparisonData | null>(null);
  readonly selectedComparisonYear = signal<number>(new Date().getFullYear());
  readonly breakdownEntries = signal<BreakdownEntry[]>([]);
  readonly selectedDimension = signal<string>('category');

  // Custom Report Definitions
  readonly reportDefinitions = signal<AnalyticsReportDefinition[]>([]);
  readonly selectedReportResult = signal<AnalyticsKpiReport | null>(null);
  readonly isReportModalVisible = signal<boolean>(false);
  readonly editingReportId = signal<string | null>(null);

  // BI Data Feed
  readonly biFeedDataset = signal<string>('invoices');
  readonly biFeedData = signal<Record<string, unknown>[]>([]);
  readonly biFeedColumns = computed(() => {
    const data = this.biFeedData();
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  });

  readonly reportForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: [''],
    kpis: [['sales', 'margin'], [Validators.required]],
    period_preset: ['last_month', [Validators.required]],
    compare: ['previous_year'],
    is_shared: [false],
  });

  readonly availableKpis = [
    { label: 'Net Sales', value: 'sales' },
    { label: 'Purchases', value: 'purchases' },
    { label: 'Gross Margin', value: 'margin' },
    { label: 'Receivables Aging', value: 'receivables-aging' },
    { label: 'Payables Aging', value: 'payables-aging' },
    { label: 'Stock Valuation', value: 'stock-value' },
    { label: 'Project Margin', value: 'project-margin' },
    { label: 'HR Headcount', value: 'hr-headcount' },
  ];

  ngOnInit(): void {
    this.loadKpis();
    this.loadDueCalendar();
    this.loadRevenueComparison();
    this.loadBreakdown();
    this.loadReportDefinitions();
    this.loadBiFeed();
  }

  loadKpis(): void {
    this.isLoading.set(true);
    this.analyticsApi
      .getKpis({
        period_preset: this.selectedPeriodPreset(),
        compare: this.selectedCompare(),
      })
      .subscribe({
        next: (res) => {
          this.kpiReport.set(res.data);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  onPeriodChange(preset: AnalyticsPeriodPreset): void {
    this.selectedPeriodPreset.set(preset);
    this.loadKpis();
  }

  onCompareChange(compare: 'none' | 'previous_period' | 'previous_year'): void {
    this.selectedCompare.set(compare);
    this.loadKpis();
  }

  exportKpisCsv(): void {
    this.analyticsApi
      .exportKpisCsv({
        period_preset: this.selectedPeriodPreset(),
        compare: this.selectedCompare(),
      })
      .subscribe({
        next: (blob) => {
          this.downloadBlob(blob, `kpis-${this.selectedPeriodPreset()}.csv`);
          this.message.success('KPI export completed');
        },
        error: () => {
          this.message.error('Export failed');
        },
      });
  }

  loadDueCalendar(): void {
    this.analyticsApi.getDueCalendar().subscribe({
      next: (res) => {
        this.dueEntries.set(res.data || []);
      },
      error: () => undefined, // the error interceptor already notifies the user,
    });
  }

  loadRevenueComparison(): void {
    this.analyticsApi.getRevenueComparison(this.selectedComparisonYear()).subscribe({
      next: (res) => {
        this.revenueComparison.set(res.data);
      },
      error: () => undefined, // the error interceptor already notifies the user,
    });
  }

  loadBreakdown(): void {
    this.analyticsApi.getBreakdown(this.selectedDimension(), this.selectedComparisonYear()).subscribe({
      next: (res) => {
        this.breakdownEntries.set(res.data || []);
      },
      error: () => undefined, // the error interceptor already notifies the user,
    });
  }

  onDimensionChange(dim: string): void {
    this.selectedDimension.set(dim);
    this.loadBreakdown();
  }

  loadReportDefinitions(): void {
    this.analyticsApi.getReportDefinitions().subscribe({
      next: (res) => {
        this.reportDefinitions.set(res.data || []);
      },
      error: () => undefined, // the error interceptor already notifies the user,
    });
  }

  openCreateReportModal(): void {
    this.editingReportId.set(null);
    this.reportForm.reset({
      name: '',
      description: '',
      kpis: ['sales', 'margin'],
      period_preset: 'last_month',
      compare: 'previous_year',
      is_shared: false,
    });
    this.isReportModalVisible.set(true);
  }

  openEditReportModal(report: AnalyticsReportDefinition): void {
    this.editingReportId.set(report.id);
    this.reportForm.setValue({
      name: report.name,
      description: report.description || '',
      kpis: report.kpis,
      period_preset: report.period_preset,
      compare: report.compare || 'none',
      is_shared: report.is_shared,
    });
    this.isReportModalVisible.set(true);
  }

  closeReportModal(): void {
    this.isReportModalVisible.set(false);
  }

  saveReportDefinition(): void {
    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      return;
    }

    const payload = this.reportForm.value;
    const editingId = this.editingReportId();

    this.isActionLoading.set(true);
    if (editingId) {
      this.analyticsApi.updateReportDefinition(editingId, payload).subscribe({
        next: () => {
          this.isActionLoading.set(false);
          this.isReportModalVisible.set(false);
          this.message.success('Report updated successfully');
          this.loadReportDefinitions();
        },
        error: () => {
          this.isActionLoading.set(false);
          this.message.error('Failed to update report');
        },
      });
    } else {
      this.analyticsApi.createReportDefinition(payload).subscribe({
        next: () => {
          this.isActionLoading.set(false);
          this.isReportModalVisible.set(false);
          this.message.success('Report created successfully');
          this.loadReportDefinitions();
        },
        error: () => {
          this.isActionLoading.set(false);
          this.message.error('Failed to create report');
        },
      });
    }
  }

  deleteReportDefinition(report: AnalyticsReportDefinition): void {
    this.modal.confirm({
      nzTitle: 'Delete Report Definition',
      nzContent: `Are you sure you want to delete report "${report.name}"?`,
      nzOkText: 'Delete',
      nzOkDanger: true,
      nzOnOk: () => {
        this.analyticsApi.deleteReportDefinition(report.id).subscribe({
          next: () => {
            this.message.success('Report deleted');
            this.loadReportDefinitions();
          },
          error: () => {
            this.message.error('Failed to delete report');
          },
        });
      },
    });
  }

  runReport(report: AnalyticsReportDefinition): void {
    this.isActionLoading.set(true);
    this.analyticsApi.runReportDefinition(report.id).subscribe({
      next: (res) => {
        this.selectedReportResult.set(res.data);
        this.isActionLoading.set(false);
        this.message.success(`Report "${report.name}" executed successfully`);
      },
      error: () => {
        this.isActionLoading.set(false);
        this.message.error('Failed to execute report');
      },
    });
  }

  exportReportCsv(report: AnalyticsReportDefinition): void {
    this.analyticsApi.exportReportDefinition(report.id).subscribe({
      next: (blob) => {
        this.downloadBlob(blob, `${report.name.toLowerCase().replace(/\s+/g, '-')}.csv`);
        this.message.success('Export completed');
      },
      error: () => {
        this.message.error('Failed to export report');
      },
    });
  }

  loadBiFeed(): void {
    this.analyticsApi.getReportingFeed(this.biFeedDataset(), { top: 20, skip: 0 }).subscribe({
      next: (res) => {
        this.biFeedData.set(res.data || []);
      },
      error: () => undefined, // the error interceptor already notifies the user,
    });
  }

  onBiDatasetChange(dataset: string): void {
    this.biFeedDataset.set(dataset);
    this.loadBiFeed();
  }

  /**
   * Whether a KPI change is a loss. The server sends decimals as strings, so the sign is read from the text
   * and no floating point comparison is made.
   */
  isLoss(change: string | number | null | undefined): boolean {
    return String(change ?? '').trim().startsWith('-');
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
