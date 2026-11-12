import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { AutomotiveApiService, AutomotiveVehicle, TireHotelRecord, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-tire-hotel',
  imports: [
    NzTableModule,
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
export class TireHotelComponent implements OnInit {
  private readonly api = inject(AutomotiveApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly tireRecords = signal<TireHotelRecord[]>([]);
  readonly vehicles = signal<AutomotiveVehicle[]>([]);
  readonly checkingOutId = signal<string | null>(null);

  readonly winterCount = computed(() =>
    this.tireRecords().filter((r) => r.season === 'winter').length,
  );

  readonly summerCount = computed(() =>
    this.tireRecords().filter((r) => r.season === 'summer').length,
  );

  ngOnInit(): void {
    this.loadTireRecords();
  }

  loadTireRecords(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      plan: this.api.getSeasonalSwitchPlan(),
      vehicles: this.api.getVehicles(),
    }).subscribe({
      next: ({ plan, vehicles }) => {
        this.tireRecords.set(plan.data ?? []);
        this.vehicles.set(vehicles.data?.data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || this.translate.instant('automotive.errors.loadFailed'));
        this.tireRecords.set([]);
        this.loading.set(false);
      },
    });
  }

  vehicleOf(tire: TireHotelRecord): AutomotiveVehicle | undefined {
    return this.vehicles().find((v) => v.id === tire.vehicle_id);
  }

  checkOut(tire: TireHotelRecord): void {
    this.checkingOutId.set(tire.id);
    this.api.checkOutTires(tire.id).subscribe({
      next: () => {
        this.tireRecords.update((records) => records.filter((r) => r.id !== tire.id));
        this.checkingOutId.set(null);
        this.message.success(this.translate.instant('TIRE_HOTEL.CHECK_OUT_SUCCESS'));
      },
      error: () => {
        this.checkingOutId.set(null);
        this.message.error(this.translate.instant('TIRE_HOTEL.CHECK_OUT_ERROR'));
      },
    });
  }
}
