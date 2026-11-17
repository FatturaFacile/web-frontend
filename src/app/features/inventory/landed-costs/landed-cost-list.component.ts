import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  GoodsReceiptSummary,
  InventoryValuationApiService,
  LANDED_COST_STATUSES,
  LandedCostStatus,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { LandedCostFacade } from '../shared/inventory-valuation.facades';
import {
  ALLOCATION_KEY_LABELS,
  LANDED_COST_STATUS_LABELS,
  LANDED_COST_TYPE_LABELS,
  toIsoDate,
} from '../shared/inventory-valuation.utils';

@Component({
  selector: 'app-landed-cost-list',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzIconModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [LandedCostFacade],
  templateUrl: './landed-cost-list.component.html',
  styleUrl: '../shared/inventory-valuation.scss',
})
export class LandedCostListComponent implements OnInit {
  protected readonly facade = inject(LandedCostFacade);
  private readonly api = inject(InventoryValuationApiService);

  protected readonly statuses = LANDED_COST_STATUSES;
  protected readonly statusLabels = LANDED_COST_STATUS_LABELS;
  protected readonly typeLabels = LANDED_COST_TYPE_LABELS;
  protected readonly keyLabels = ALLOCATION_KEY_LABELS;

  readonly receipts = signal<GoodsReceiptSummary[]>([]);
  readonly dateRange = signal<Date[]>([]);

  ngOnInit(): void {
    this.api.listGoodsReceipts({ per_page: 100 }).subscribe({
      next: (res) => this.receipts.set(res.data),
      error: () => this.receipts.set([]),
    });
  }

  setStatus(status: LandedCostStatus | null): void {
    this.facade.setFilter({ status: status ?? undefined });
  }

  setReceipt(id: string | null): void {
    this.facade.setFilter({ receipt_id: id ?? undefined });
  }

  setDateRange(range: Date[] | null): void {
    const [from, to] = range ?? [];
    this.dateRange.set(range ?? []);
    this.facade.setFilter({ from: toIsoDate(from), to: toIsoDate(to) });
  }
}
