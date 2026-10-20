import { Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { PageHeaderComponent, CurrencyFormatPipe, TranslatePipe } from '@shared';
import { OrderStore } from '../../state/order.store';

@Component({
  selector: 'app-order-list',
  imports: [
    DatePipe,
    NzTableModule,
    NzTagModule,
    NzSpinModule,
    NzAlertModule,
    NzCardModule,
    NzStatisticModule,
    NzGridModule,
    PageHeaderComponent,
    CurrencyFormatPipe,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'ORDERS.TITLE' | translate"
      [subtitle]="'ORDERS.SUBTITLE' | translate"
    />

    <div nz-row [nzGutter]="16" class="stats-row">
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="store.ordersCount()"
            [nzTitle]="'ORDERS.COUNT' | translate"
          />
        </nz-card>
      </div>
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="store.totalRevenue() | appCurrency"
            [nzTitle]="'ORDERS.REVENUE' | translate"
          />
        </nz-card>
      </div>
    </div>

    @if (store.error(); as error) {
      <nz-alert
        nzType="error"
        [nzMessage]="error"
        nzShowIcon
        class="order-alert"
      />
    }

    <nz-spin [nzSpinning]="store.isLoading()">
      <nz-table
        #orderTable
        [nzData]="store.orders()"
        [nzFrontPagination]="true"
        [nzPageSize]="10"
        class="orders-table"
      >
        <thead>
          <tr>
            <th>{{ 'ORDERS.COL_ID' | translate }}</th>
            <th>{{ 'ORDERS.COL_REF' | translate }}</th>
            <th>{{ 'ORDERS.COL_DATE' | translate }}</th>
            <th>{{ 'ORDERS.COL_ITEMS_COUNT' | translate }}</th>
            <th>{{ 'ORDERS.COL_TOTAL' | translate }}</th>
            <th>{{ 'ORDERS.COL_DETAIL' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (order of orderTable.data; track order.id) {
            <tr
              (click)="store.setSelectedOrderId(order.id)"
              [class.selected-row]="order.id === store.selectedOrderId()"
            >
              <td>{{ order.id }}</td>
              <td>
                <nz-tag nzColor="blue">{{ order.referenceNumber }}</nz-tag>
              </td>
              <td>{{ order.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ order.items.length }}</td>
              <td><strong>{{ order.totalAmount | appCurrency }}</strong></td>
              <td>
                <button
                  type="button"
                  class="select-btn"
                  (click)="store.setSelectedOrderId(order.id); $event.stopPropagation()"
                >
                  {{ 'COMMON.SELECT' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    @if (store.selectedOrder(); as selected) {
      <nz-card [nzTitle]="'ORDERS.SELECTED_TITLE' | translate" class="detail-card">
        <p><strong>ID:</strong> {{ selected.id }}</p>
        <p><strong>{{ 'ORDERS.COL_REF' | translate }}:</strong> {{ selected.referenceNumber }}</p>
        <p><strong>{{ 'COMMON.TOTAL' | translate }}:</strong> {{ selected.totalAmount | appCurrency }}</p>
        <h4>{{ 'ORDERS.ITEMS_LABEL' | translate }}</h4>
        <ul>
          @for (item of selected.items; track item.id) {
            <li>
              {{ item.productName }} - {{ item.quantity }} x {{ item.unitPrice | appCurrency }}
            </li>
          }
        </ul>
      </nz-card>
    }
  `,
  styles: `
    .stats-row {
      margin-bottom: 24px;
    }
    .order-alert {
      margin-bottom: 16px;
    }
    .orders-table {
      margin-top: 16px;
    }
    .selected-row {
      background-color: rgba(13, 148, 136, 0.12) !important;
    }
    .select-btn {
      padding: 4px 10px;
      font-size: 12px;
      border: 1px solid var(--border-color, #d9d9d9);
      border-radius: 4px;
      background: var(--bg-card, #fff);
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.2s;
    }
    .select-btn:hover {
      border-color: var(--primary-color, #0d9488);
      color: var(--primary-color, #0d9488);
    }
    .detail-card {
      margin-top: 24px;
    }
  `,
})
export class OrderListComponent implements OnInit {
  readonly store = inject(OrderStore);

  ngOnInit(): void {
    this.store.loadOrders();
  }
}
