import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { DatePipe, formatDate } from '@angular/common';
import { Observable } from 'rxjs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { FetchGridModel, PaginatedResponse } from '@core';
import { Order } from '@domain/models/order.model';
import { ORDER_REPOSITORY } from '@domain/repositories/order.repository';
import {
  BaseTableComponent,
  CurrencyFormatPipe,
  PageHeaderComponent,
  TableColumnDef,
  TranslatePipe,
} from '@shared';

/** Order history: a server-driven grid over the sales orders (paging, sorting, filters and grouping on the API). */
@Component({
  selector: 'app-order-list',
  styleUrl: './order-list.component.scss',
  imports: [
    DatePipe,
    NzTagModule,
    NzCardModule,
    NzStatisticModule,
    NzGridModule,
    BaseTableComponent,
    PageHeaderComponent,
    CurrencyFormatPipe,
    TranslatePipe,
  ],
  templateUrl: './order-list.component.html',
})
export class OrderListComponent {
  private readonly repository = inject(ORDER_REPOSITORY);

  protected readonly grid = new FetchGridModel<Order>(
    (query) =>
      ((query as Record<string, unknown>)['grid_values']
        ? this.repository.getOrderColumnValues(query as Record<string, unknown>)
        : this.repository.getOrdersPage(query as Record<string, unknown>)) as unknown as Observable<
        PaginatedResponse<Order>
      >,
  );

  protected readonly selectedOrder = signal<Order | null>(null);

  /** Revenue over the whole dataset: the distinct gross totals of the orders weighted by their counts. */
  protected readonly totalRevenue = signal(0);

  private readonly referenceTpl = viewChild<TemplateRef<unknown>>('referenceTpl');
  private readonly createdAtTpl = viewChild<TemplateRef<unknown>>('createdAtTpl');
  private readonly totalTpl = viewChild<TemplateRef<unknown>>('totalTpl');

  protected readonly columns = computed<TableColumnDef<Order>[]>(() => [
    { key: 'id', header: 'ORDERS.COL_ID' },
    { key: 'referenceNumber', serverKey: 'order_number', header: 'ORDERS.COL_REF', customCellTemplate: this.referenceTpl() },
    {
      key: 'createdAt',
      serverKey: 'created_at',
      valueGetter: (row) => row.createdAt.toISOString(),
      valueLabel: (value) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : formatDate(date, 'dd/MM/yyyy HH:mm', 'en-GB');
      },
      header: 'ORDERS.COL_DATE',
      customCellTemplate: this.createdAtTpl(),
    },
    { key: 'items', serverKey: 'items_count', valueGetter: (row) => row.itemsCount ?? row.items.length, header: 'ORDERS.COL_ITEMS_COUNT' },
    { key: 'totalAmount', serverKey: 'total_gross', header: 'ORDERS.COL_TOTAL', align: 'right', customCellTemplate: this.totalTpl() },
  ]);

  constructor() {
    this.grid.loadValues('total_gross').subscribe((values) => {
      this.totalRevenue.set(
        values.reduce((sum, entry) => sum + (entry.value === null ? 0 : Number(entry.value)) * entry.count, 0),
      );
    });
  }

  /** Opens the detail of an order: the list rows carry no lines, so the order is read again with them. */
  protected select(order: Order): void {
    this.selectedOrder.set(order);
    this.repository.getOrderById(order.id).subscribe({
      next: (detail) => this.selectedOrder.set(detail),
      error: () => undefined,
    });
  }
}
