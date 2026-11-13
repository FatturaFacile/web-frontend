import { Component, inject, input, OnInit, output, signal } from '@angular/core';
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
  FixedAssetResource,
  MaintenanceWorkOrderResource,
} from '@core';
import { MoneyPipe, ModalActionsDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { TranslatePipe } from '@shared';

@Component({
  selector: 'app-asset-detail-drawer',
  styleUrl: './asset-detail-drawer.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    ModalActionsDirective,
    TranslatePipe,
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

  readonly loadingSchedules = signal(false);
  readonly schedules = signal<DepreciationScheduleResource[]>([]);

  readonly loadingWorkOrders = signal(false);
  readonly workOrders = signal<MaintenanceWorkOrderResource[]>([]);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const id = this.asset().id;
    this.loadBooks(id);
    this.loadSchedules(id);
    this.loadWorkOrders();
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

  loadSchedules(assetId: string): void {
    this.loadingSchedules.set(true);
    this.assetApi.getDepreciationSchedules(assetId).subscribe({
      next: (res) => {
        this.schedules.set(res.data || []);
        this.loadingSchedules.set(false);
      },
      error: () => {
        this.schedules.set([]);
        this.loadingSchedules.set(false);
      },
    });
  }

  loadWorkOrders(): void {
    this.loadingWorkOrders.set(true);
    this.assetApi.getMaintenanceWorkOrders().subscribe({
      next: (res) => {
        this.workOrders.set(res.data || []);
        this.loadingWorkOrders.set(false);
      },
      error: () => {
        this.workOrders.set([]);
        this.loadingWorkOrders.set(false);
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
