import { Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { PageHeaderComponent, CurrencyFormatPipe } from '@shared';
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
  ],
  template: `
    <app-page-header
      title="Storico Ordini e Fatture"
      subtitle="Visualizza e gestisci l'elenco degli ordini recenti"
    />

    <div nz-row [nzGutter]="16" class="stats-row">
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="store.ordersCount()"
            nzTitle="Numero Ordini"
          />
        </nz-card>
      </div>
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="store.totalRevenue() | appCurrency"
            nzTitle="Fatturato Totale"
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
            <th>ID Ordine</th>
            <th>Codice Riferimento</th>
            <th>Data Creazione</th>
            <th>Numero Articoli</th>
            <th>Totale</th>
            <th>Dettaglio</th>
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
                  Seleziona
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    @if (store.selectedOrder(); as selected) {
      <nz-card nzTitle="Dettaglio Ordine Selezionato" class="detail-card">
        <p><strong>ID:</strong> {{ selected.id }}</p>
        <p><strong>Codice:</strong> {{ selected.referenceNumber }}</p>
        <p><strong>Totale:</strong> {{ selected.totalAmount | appCurrency }}</p>
        <h4>Articoli:</h4>
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
      background-color: #f0f7ff;
    }
    .select-btn {
      padding: 4px 8px;
      font-size: 12px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      background: #fff;
      cursor: pointer;
    }
    .select-btn:hover {
      border-color: #1677ff;
      color: #1677ff;
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
