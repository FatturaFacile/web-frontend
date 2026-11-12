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
})
export class DashboardComponent implements OnInit {
  readonly authStore = inject(AuthStore);
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly invoiceApi = inject(InvoiceApiService);

  readonly loading = signal(true);
  readonly kpiSummary = signal<KpiSummary | null>(null);
  readonly recentInvoices = signal<InvoiceResource[]>([]);

  readonly revenueDisplay = computed(() => {
    const kpi = this.kpiSummary();
    const curr = this.authStore.activeCurrency();
    const val = kpi?.revenue_month ?? 0;
    return curr === 'EUR'
      ? `€ ${val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `CHF ${val.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  });

  readonly receivablesDisplay = computed(() => {
    const kpi = this.kpiSummary();
    const curr = this.authStore.activeCurrency();
    const val = kpi?.open_receivables ?? 0;
    return curr === 'EUR'
      ? `€ ${val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `CHF ${val.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  });

  readonly pendingCount = computed(() => {
    return this.kpiSummary()?.pending_invoices_count ?? 0;
  });

  readonly alertsCount = computed(() => {
    return this.kpiSummary()?.active_alerts_count ?? 0;
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    this.dashboardApi.getKpiSummary().subscribe({
      next: (res) => {
        this.kpiSummary.set(res.data);
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
