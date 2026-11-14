import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  contactDisplayName,
  DashboardApiService,
  InvoiceApiService,
  InvoiceResource,
  KpiSummary,
} from '@core';
import { PageHeaderComponent, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';

// Shown instead of 0 so that a missing metric is never mistaken for real data.
const KPI_PLACEHOLDER = '—';

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

@Component({
  selector: 'app-dashboard',
  styleUrl: './dashboard.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    RouterLink,
    CurrencyPipe,
    NzCardModule,
    NzGridModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzAlertModule,
    NzSpinModule,
    NzSkeletonModule,
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  readonly authStore = inject(AuthStore);
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly invoiceApi = inject(InvoiceApiService);

  readonly loading = signal(true);
  readonly kpiSummary = signal<KpiSummary | null>(null);
  readonly recentInvoices = signal<InvoiceResource[]>([]);

  // The tenant default currency sent by the API, not the one AuthStore derives from the country.
  private readonly currency = computed(() => this.kpiSummary()?.kpis?.active_currency || null);

  readonly revenueDisplay = computed(() =>
    this.formatAmount(this.kpiSummary()?.kpis?.total_revenue, this.currency()),
  );

  readonly receivablesDisplay = computed(() =>
    this.formatAmount(this.kpiSummary()?.kpis?.total_unpaid, this.currency()),
  );

  readonly invoicesCount = computed(() => {
    const val = this.kpiSummary()?.kpis?.invoices_count;
    return isFiniteNumber(val) ? val : KPI_PLACEHOLDER;
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    this.dashboardApi.getKpiSummary().subscribe({
      next: (res) => {
        this.kpiSummary.set(res?.data ?? null);
      },
      error: () => {
        this.kpiSummary.set(null);
      },
    });

    this.invoiceApi.list({ per_page: 5, page: 1 }).subscribe({
      next: (res) => {
        this.recentInvoices.set(res.data || []);
        this.loading.set(false);
      },
      error: () => {
        this.recentInvoices.set([]);
        this.loading.set(false);
      },
    });
  }

  contactName(item: InvoiceResource): string {
    const c = item.client || item.contact;
    if (!c) return '-';
    return contactDisplayName(c);
  }

  private formatAmount(val: number | null | undefined, currency: string | null): string {
    if (!isFiniteNumber(val) || !currency) return KPI_PLACEHOLDER;
    const digits = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    switch (currency) {
      case 'EUR':
        return `€ ${val.toLocaleString('it-IT', digits)}`;
      case 'CHF':
        return `CHF ${val.toLocaleString('de-CH', digits)}`;
      default:
        return `${currency} ${val.toLocaleString('it-IT', digits)}`;
    }
  }

  statusColor(status?: string): string {
    switch (status) {
      case 'paid':
        return 'success';
      case 'partially_paid':
      case 'issued':
        return 'processing';
      case 'overdue':
        return 'error';
      default:
        return 'default';
    }
  }
}
