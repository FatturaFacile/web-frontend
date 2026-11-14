import { Component, computed, inject, input, OnInit, output, signal, TemplateRef, viewChild } from '@angular/core';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';

import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AssetApiService,
  AssetBookResource,
  DepreciationScheduleResource,
  FetchGridModel,
  FixedAssetResource,
  MaintenanceWorkOrderResource,
  QueryFilterParams,
} from '@core';
import { BaseTableComponent, MoneyPipe, ModalActionsDirective, TableColumnDef, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { TranslatePipe } from '@shared';

@Component({
  selector: 'app-asset-detail-drawer',
  styleUrl: './asset-detail-drawer.component.scss',
  imports: [
    BaseTableComponent,
    ModalActionsDirective,
    TranslatePipe,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    NzModalModule,
    NzTabsModule,
    NzDescriptionsModule,
    NzBadgeModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzIconModule,
    NzEmptyModule,
    MoneyPipe,
  ],
  templateUrl: './asset-detail-drawer.component.html',
})
export class AssetDetailDrawerComponent implements OnInit {
  asset = input.required<FixedAssetResource>();
  visible = input.required<boolean>();
  closed = output<void>();

  private readonly assetApi = inject(AssetApiService);


  readonly loadingBooks = signal(false);
  readonly books = signal<AssetBookResource[]>([]);

  /** Depreciation schedule of the asset, paged, sorted and filtered by the API. */
  readonly schedulesGrid = new FetchGridModel<DepreciationScheduleResource, QueryFilterParams>((query) =>
    this.assetApi.getDepreciationSchedules(this.asset().id, query),
  );

  /** Maintenance work orders of the asset (the API filters them by asset_id). */
  readonly workOrdersGrid = new FetchGridModel<MaintenanceWorkOrderResource, QueryFilterParams>((query) =>
    this.assetApi.getMaintenanceWorkOrders({ ...query, asset_id: this.asset().id } as QueryFilterParams),
  );

  private readonly periodTpl = viewChild<TemplateRef<{ $implicit: DepreciationScheduleResource; value: unknown }>>('periodTpl');
  private readonly scheduleLedgerTpl = viewChild<TemplateRef<{ $implicit: DepreciationScheduleResource; value: unknown }>>('scheduleLedgerTpl');
  private readonly openingTpl = viewChild<TemplateRef<{ $implicit: DepreciationScheduleResource; value: unknown }>>('openingTpl');
  private readonly depreciationTpl = viewChild<TemplateRef<{ $implicit: DepreciationScheduleResource; value: unknown }>>('depreciationTpl');
  private readonly closingTpl = viewChild<TemplateRef<{ $implicit: DepreciationScheduleResource; value: unknown }>>('closingTpl');
  private readonly accumulatedTpl = viewChild<TemplateRef<{ $implicit: DepreciationScheduleResource; value: unknown }>>('accumulatedTpl');
  private readonly scheduleStatusTpl = viewChild<TemplateRef<{ $implicit: DepreciationScheduleResource; value: unknown }>>('scheduleStatusTpl');
  private readonly woNumberTpl = viewChild<TemplateRef<{ $implicit: MaintenanceWorkOrderResource; value: unknown }>>('woNumberTpl');
  private readonly woTypeTpl = viewChild<TemplateRef<{ $implicit: MaintenanceWorkOrderResource; value: unknown }>>('woTypeTpl');
  private readonly woPriorityTpl = viewChild<TemplateRef<{ $implicit: MaintenanceWorkOrderResource; value: unknown }>>('woPriorityTpl');
  private readonly woStatusTpl = viewChild<TemplateRef<{ $implicit: MaintenanceWorkOrderResource; value: unknown }>>('woStatusTpl');
  private readonly woDateTpl = viewChild<TemplateRef<{ $implicit: MaintenanceWorkOrderResource; value: unknown }>>('woDateTpl');
  private readonly woCostTpl = viewChild<TemplateRef<{ $implicit: MaintenanceWorkOrderResource; value: unknown }>>('woCostTpl');

  protected readonly scheduleColumns = computed<TableColumnDef<DepreciationScheduleResource>[]>(() => [
    { key: 'period_code', header: 'assetDetailDrawer.lblPeriod', customCellTemplate: this.periodTpl() },
    { key: 'ledger_type', header: 'assetDetailDrawer.lblLedger', customCellTemplate: this.scheduleLedgerTpl() },
    { key: 'opening_book_value', header: 'assetDetailDrawer.lblOpeningValue', align: 'right', customCellTemplate: this.openingTpl() },
    { key: 'depreciation_amount', header: 'assetDetailDrawer.lblDeprAmount', align: 'right', customCellTemplate: this.depreciationTpl() },
    { key: 'closing_book_value', header: 'assetDetailDrawer.lblClosingValue', align: 'right', customCellTemplate: this.closingTpl() },
    { key: 'accumulated_depreciation', header: 'assetDetailDrawer.lblAccumulated', align: 'right', customCellTemplate: this.accumulatedTpl() },
    { key: 'status', header: 'assetDetailDrawer.lblStatus', customCellTemplate: this.scheduleStatusTpl() },
  ]);

  protected readonly workOrderColumns = computed<TableColumnDef<MaintenanceWorkOrderResource>[]>(() => [
    { key: 'work_order_number', header: 'assetDetailDrawer.lblWoNumber', customCellTemplate: this.woNumberTpl() },
    { key: 'maintenance_type', header: 'assetDetailDrawer.lblType', customCellTemplate: this.woTypeTpl() },
    { key: 'priority', header: 'assetDetailDrawer.lblPriority', customCellTemplate: this.woPriorityTpl() },
    { key: 'status', header: 'assetDetailDrawer.lblStatus', customCellTemplate: this.woStatusTpl() },
    { key: 'scheduled_date', header: 'assetDetailDrawer.lblScheduledDate', customCellTemplate: this.woDateTpl() },
    { key: 'total_cost', header: 'assetDetailDrawer.lblTotalCost', align: 'right', customCellTemplate: this.woCostTpl() },
  ]);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const id = this.asset().id;
    this.loadBooks(id);
  }

  loadBooks(assetId: string): void {
    this.loadingBooks.set(true);
    this.assetApi.getAssetBooks(assetId).subscribe({
      next: (res) => {
        this.books.set(res.data || []);
        this.loadingBooks.set(false);
      },
      error: () => {
        this.books.set([]);
        this.loadingBooks.set(false);
      },
    });
  }

  onClose(): void {
    this.closed.emit();
  }

  getLedgerTypeColor(type: string | null): string {
    switch (type?.toLowerCase()) {
      case 'statutory':
        return 'blue';
      case 'tax':
        return 'orange';
      case 'managerial':
      case 'internal':
        return 'purple';
      default:
        return 'default';
    }
  }
}
