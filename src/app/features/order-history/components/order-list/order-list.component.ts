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
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.scss',
})
export class OrderListComponent implements OnInit {
  readonly store = inject(OrderStore);

  ngOnInit(): void {
    this.store.loadOrders();
  }
}
