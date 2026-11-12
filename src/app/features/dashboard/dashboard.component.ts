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
import { PageHeaderComponent, TranslatePipe } from '@shared';

// Shown instead of 0 so that a missing metric is never mistaken for real data.
const KPI_PLACEHOLDER = '—';

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

@Component({
  selector: 'app-dashboard',
  imports: [
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
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  readonly authStore = inject(AuthStore);
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly invoiceApi = inject(InvoiceApiService);

  readonly loading = signal(true);
  readonly kpiSummary = signal<KpiSummary | null>(null);
  readonly recentInvoices = signal<InvoiceResource[]>([]);

  readonly revenueDisplay = computed(() =>
    this.formatAmount(this.kpiSummary()?.kpis?.total_revenue),
  );

  readonly receivablesDisplay = computed(() =>
    this.formatAmount(this.kpiSummary()?.kpis?.total_unpaid),
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

  private formatAmount(val: number | null | undefined): string {
    if (!isFiniteNumber(val)) return KPI_PLACEHOLDER;
    return this.authStore.activeCurrency() === 'EUR'
      ? `€ ${val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `CHF ${val.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
