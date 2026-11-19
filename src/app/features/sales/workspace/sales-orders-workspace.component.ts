import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { statusColor, statusKey } from '../cycle/shared/sales-status';
import { SalesWorkspaceApiService } from './sales-workspace-api.service';
import { ORDER_TABS, OrderTab, percentOf, tabFilters } from './sales-workspace.logic';
import { WorkspaceOrder } from './sales-workspace.models';

/** Sales orders workspace: filter tabs, status badges and Allocated / Shipped / Invoiced progress bars. */
@Component({
  selector: 'app-sales-orders-workspace',
  imports: [
    DecimalPipe,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzProgressModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'SWK.ORDERS.TITLE' | translate"
      [subtitle]="'SWK.ORDERS.SUBTITLE' | translate"
    />

    <nz-card>
      <div class="toolbar">
        <nz-tabs [nzSelectedIndex]="tabIndex()" (nzSelectedIndexChange)="selectTab($event)">
          @for (t of tabs; track t) {
            <nz-tab [nzTitle]="'SWK.TAB.' + t.toUpperCase() | translate"></nz-tab>
          }
        </nz-tabs>
        <button nz-button nzType="primary" type="button" (click)="create()">
          <nz-icon nzType="plus" />{{ 'SWK.ORDERS.NEW' | translate }}
        </button>
      </div>

      <nz-table
        #table
        nzSize="small"
        [nzData]="orders()"
        [nzLoading]="loading()"
        [nzFrontPagination]="false"
        [nzTotal]="total()"
        [nzPageSize]="25"
        [nzPageIndex]="page()"
        (nzPageIndexChange)="changePage($event)"
      >
        <thead>
          <tr>
            <th>{{ 'SWK.COL.NUMBER' | translate }}</th>
            <th>{{ 'SWK.COL.CUSTOMER' | translate }}</th>
            <th>{{ 'SWK.COL.TYPE' | translate }}</th>
            <th>{{ 'SWK.COL.STATUS' | translate }}</th>
            <th>{{ 'SWK.COL.DATE' | translate }}</th>
            <th class="num">{{ 'SWK.COL.TOTAL' | translate }}</th>
            <th>{{ 'SWK.COL.ALLOCATED' | translate }}</th>
            <th>{{ 'SWK.COL.SHIPPED' | translate }}</th>
            <th>{{ 'SWK.COL.INVOICED' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (o of table.data; track o.id) {
            <tr>
              <td>
                <code>{{ o.order_number }}</code>
              </td>
              <td>{{ o.customer_name ?? o.contact_id }}</td>
              <td>{{ 'SWK.TYPE.' + o.order_type.toUpperCase() | translate }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(o.status)">{{
                  statusKey(o.status) | translate
                }}</nz-tag>
                @if (o.has_backorders) {
                  <nz-tag nzColor="gold">{{ 'SWK.ORDERS.BACKORDER' | translate }}</nz-tag>
                }
              </td>
              <td>{{ o.date }}</td>
              <td class="num">{{ o.total_amount | number: '1.2-2' }} {{ o.currency }}</td>
              <td class="bar">
                <nz-progress nzSize="small" [nzPercent]="percent(o.allocated_percentage)" />
              </td>
              <td class="bar">
                <nz-progress nzSize="small" [nzPercent]="percent(o.delivered_percentage)" />
              </td>
              <td class="bar">
                <nz-progress nzSize="small" [nzPercent]="percent(o.invoiced_percentage)" />
              </td>
              <td>
                <button nz-button nzSize="small" type="button" (click)="open(o)">
                  {{ 'SWK.ORDERS.OPEN' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .num {
      text-align: right;
      white-space: nowrap;
    }
    .bar {
      min-width: 110px;
    }
  `,
})
export class SalesOrdersWorkspaceComponent {
  private readonly api = inject(SalesWorkspaceApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tabs = ORDER_TABS;
  protected readonly tab = signal<OrderTab>('all');
  protected readonly orders = signal<WorkspaceOrder[]>([]);
  protected readonly loading = signal(false);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly statusColor = statusColor;
  protected readonly statusKey = statusKey;

  constructor() {
    this.load();
  }

  protected tabIndex(): number {
    return this.tabs.indexOf(this.tab());
  }

  protected percent(value: string): number {
    return Math.round(percentOf(value));
  }

  protected selectTab(index: number): void {
    this.tab.set(this.tabs[index] ?? 'all');
    this.page.set(1);
    this.load();
  }

  protected changePage(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected create(): void {
    void this.router.navigate(['/sales/workspace/orders/new']);
  }

  protected open(order: WorkspaceOrder): void {
    void this.router.navigate(['/sales/workspace/orders', order.id]);
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .listOrders({ ...tabFilters(this.tab()), page: this.page(), per_page: 25 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.orders.set(res.data);
          this.total.set(res.meta.total);
          this.loading.set(false);
        },
        error: () => {
          this.orders.set([]);
          this.loading.set(false);
        },
      });
  }
}
