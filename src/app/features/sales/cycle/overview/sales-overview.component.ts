import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { AuthStore, BackorderLine, I18nService, SalesCycleApiService, SalesKpis } from '@core';
import {
  BaseTableComponent,
  MoneyPipe,
  PageHeaderComponent,
  TableColumnDef,
  TableQueryParams,
  TranslatePipe,
} from '@shared';
import { CycleBackordersFacade } from '../cycle.facades';
import { apiErrorText } from '../shared/sales-api-helpers';
import { SalesLookupsService } from '../shared/sales-lookups.service';
import { todayIso } from '../shared/sales-status';

/** Sales KPIs of a period and the backorder (open order lines still to be delivered). */
@Component({
  selector: 'app-sales-overview',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzStatisticModule,
    BaseTableComponent,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [CycleBackordersFacade],
  templateUrl: './sales-overview.component.html',
  styleUrl: '../shared/cycle-page.scss',
})
export class SalesOverviewComponent {
  protected readonly facade = inject(CycleBackordersFacade);
  private readonly api = inject(SalesCycleApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly lookups = inject(SalesLookupsService);
  protected readonly currency = inject(AuthStore).activeCurrency;

  protected readonly kpis = signal<SalesKpis | null>(null);
  protected readonly loadingKpis = signal(false);
  protected from = `${todayIso().substring(0, 4)}-01-01`;
  protected to = todayIso();

  private readonly orderTpl = viewChild<TemplateRef<{ $implicit: BackorderLine; value: unknown }>>('orderTpl');
  private readonly customerTpl = viewChild<TemplateRef<{ $implicit: BackorderLine; value: unknown }>>('customerTpl');
  private readonly valueTpl = viewChild<TemplateRef<{ $implicit: BackorderLine; value: unknown }>>('valueTpl');

  protected readonly columns = computed<TableColumnDef<BackorderLine>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'order_number', header: this.i18n.translate('SC.ORDERS.TITLE'), width: '150px', customCellTemplate: this.orderTpl() },
      { key: 'contact_id', header: this.i18n.translate('SC.COMMON.CUSTOMER'), customCellTemplate: this.customerTpl() },
      { key: 'description', header: this.i18n.translate('SC.LINES.DESCRIPTION') },
      { key: 'quantity_ordered', header: this.i18n.translate('SC.OVERVIEW.ORDERED'), width: '110px', align: 'right' },
      { key: 'quantity_delivered', header: this.i18n.translate('SC.LINES.DELIVERED'), width: '110px', align: 'right' },
      { key: 'quantity_open', header: this.i18n.translate('SC.ORDERS.OPEN_QTY'), width: '110px', align: 'right' },
      { key: 'quantity_reserved', header: this.i18n.translate('SC.OVERVIEW.RESERVED'), width: '110px', align: 'right' },
      { key: 'open_net_value', header: this.i18n.translate('SC.OVERVIEW.OPEN_VALUE'), width: '140px', align: 'right', customCellTemplate: this.valueTpl() },
    ];
  });

  constructor() {
    this.lookups.load();
    this.loadKpis();
  }

  protected loadKpis(): void {
    this.loadingKpis.set(true);
    this.api.getKpis({ from: this.from, to: this.to }).subscribe({
      next: (res) => {
        this.kpis.set(res.data);
        this.loadingKpis.set(false);
      },
      error: (err: unknown) => {
        this.loadingKpis.set(false);
        const text = apiErrorText(err);
        if (text) {
          this.message.error(text);
        }
      },
    });
  }

  protected onParamsChange(params: TableQueryParams): void {
    if (params.pageSize !== this.facade.pageSize()) {
      this.facade.setPageSize(params.pageSize);
    } else if (params.pageIndex !== this.facade.pageIndex()) {
      this.facade.setPage(params.pageIndex);
    }
  }

  /** Rates arrive as decimal strings; display them as received with a percent sign. */
  protected rate(value: string | null | undefined): string {
    return value === null || value === undefined ? '-' : `${value}%`;
  }
}
