import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { forkJoin } from 'rxjs';
import { FsmApiService, FsmWorkOrder } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

export type ReportFilter = 'all' | 'to_invoice' | 'invoiced';

const FILTERS: readonly ReportFilter[] = ['all', 'to_invoice', 'invoiced'];

/**
 * Service reports of the field service. A report is signed on the technician device and belongs to a work order, so
 * the page lists the work orders that carry one (completed and invoiced) and opens their detail to view the report,
 * download the PDF or convert it to an invoice.
 */
@Component({
  selector: 'app-service-reports',
  imports: [RouterLink, NzAlertModule, NzButtonModule, NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  templateUrl: './service-reports.component.html',
  styleUrl: './service-reports.component.scss',
})
export class ServiceReportsComponent implements OnInit {
  private readonly api = inject(FsmApiService);

  protected readonly filters = FILTERS;
  protected readonly filter = signal<ReportFilter>('all');
  protected readonly orders = signal<FsmWorkOrder[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);

  protected readonly visible = computed(() => {
    switch (this.filter()) {
      case 'to_invoice':
        return this.orders().filter((o) => o.status === 'completed' && !o.invoice_id);
      case 'invoiced':
        return this.orders().filter((o) => o.status === 'invoiced' || !!o.invoice_id);
      default:
        return this.orders();
    }
  });

  ngOnInit(): void {
    this.load();
  }

  protected setFilter(value: ReportFilter): void {
    this.filter.set(value);
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    forkJoin([this.api.listWorkOrders({ status: 'completed' }), this.api.listWorkOrders({ status: 'invoiced' })]).subscribe({
      next: ([completed, invoiced]) => {
        const merged = [...completed.data, ...invoiced.data].sort((a, b) =>
          (b.actual_completion ?? b.scheduled_end ?? '').localeCompare(a.actual_completion ?? a.scheduled_end ?? ''),
        );
        this.orders.set(merged);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }
}
