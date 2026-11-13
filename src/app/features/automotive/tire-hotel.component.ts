import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { AutomotiveApiService, FetchGridModel, GridValue, TireHotelRecord, TranslateService } from '@core';
import { BaseTableComponent, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';

/** Translation keys of the tire seasons (the API stores summer, winter or all_season). */
const SEASON_KEYS: Record<string, string> = {
  winter: 'automotive.tireHotel.season.winter',
  summer: 'automotive.tireHotel.season.summer',
};

@Component({
  selector: 'app-tire-hotel',
  styleUrl: './tire-hotel.component.scss',
  imports: [
    BaseTableComponent,
    NzTagModule,
    NzCardModule,
    NzButtonModule,
    NzGridModule,
    NzStatisticModule,
    NzPopconfirmModule,
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './tire-hotel.component.html',
})
export class TireHotelComponent {
  private readonly api = inject(AutomotiveApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  /** Stored tire sets: paging, sorting, column filters and grouping run on the API. */
  readonly grid = new FetchGridModel<TireHotelRecord>((query) => this.api.listSeasonalSwitchPlan(query));
  readonly checkingOutId = signal<string | null>(null);

  /** Sets per season over the whole stored dataset (not only the loaded page). */
  private readonly seasonCounts = signal<GridValue[]>([]);

  readonly totalSets = this.grid.totalCount;
  readonly winterCount = computed(() => this.countOf('winter'));
  readonly summerCount = computed(() => this.countOf('summer'));

  private readonly plateTpl = viewChild<TemplateRef<{ $implicit: TireHotelRecord }>>('plateTpl');
  private readonly seasonTpl = viewChild<TemplateRef<{ $implicit: TireHotelRecord }>>('seasonTpl');
  private readonly brandTpl = viewChild<TemplateRef<{ $implicit: TireHotelRecord }>>('brandTpl');
  private readonly treadTpl = viewChild<TemplateRef<{ $implicit: TireHotelRecord }>>('treadTpl');
  private readonly rackTpl = viewChild<TemplateRef<{ $implicit: TireHotelRecord }>>('rackTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: TireHotelRecord }>>('statusTpl');

  readonly columns = computed<TableColumnDef<TireHotelRecord>[]>(() => [
    {
      key: 'license_plate',
      serverKey: 'vehicle.license_plate',
      header: 'TIRE_HOTEL.COL_PLATE_MODEL',
      valueGetter: (tire) => tire.license_plate ?? tire.vehicle_id,
      customCellTemplate: this.plateTpl(),
    },
    {
      key: 'season',
      header: 'TIRE_HOTEL.COL_SEASON',
      valueGetter: (tire) => this.seasonLabel(tire.season),
      valueLabel: (value) => this.seasonLabel(value),
      customCellTemplate: this.seasonTpl(),
    },
    { key: 'brand', header: 'TIRE_HOTEL.COL_SIZE_BRAND', customCellTemplate: this.brandTpl() },
    { key: 'front_left_tread_mm', header: 'TIRE_HOTEL.COL_TREAD', customCellTemplate: this.treadTpl() },
    { key: 'warehouse_shelf_location', header: 'TIRE_HOTEL.COL_RACK', customCellTemplate: this.rackTpl() },
    { key: 'status', header: 'TIRE_HOTEL.COL_STATUS', customCellTemplate: this.statusTpl() },
  ]);

  constructor() {
    this.refreshSeasonCounts();
  }

  loadTireRecords(): void {
    this.grid.reload();
    this.refreshSeasonCounts();
  }

  checkOut(tire: TireHotelRecord): void {
    this.checkingOutId.set(tire.id);
    this.api.checkOutTires(tire.id).subscribe({
      next: () => {
        this.checkingOutId.set(null);
        this.loadTireRecords();
        this.message.success(this.translate.instant('TIRE_HOTEL.CHECK_OUT_SUCCESS'));
      },
      error: () => {
        this.checkingOutId.set(null);
        this.message.error(this.translate.instant('TIRE_HOTEL.CHECK_OUT_ERROR'));
      },
    });
  }

  private seasonLabel(season: string): string {
    return this.translate.instant(SEASON_KEYS[season] ?? 'TIRE_HOTEL.SEASON_ALL');
  }

  private countOf(season: string): number {
    return this.seasonCounts().find((entry) => entry.value === season)?.count ?? 0;
  }

  private refreshSeasonCounts(): void {
    this.grid.loadValues('season').subscribe((values) => this.seasonCounts.set(values));
  }
}
