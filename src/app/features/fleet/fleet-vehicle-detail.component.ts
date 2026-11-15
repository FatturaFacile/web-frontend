import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { FleetApiService, FleetVehicle, FleetVehicleCosts, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { FleetAssignmentsComponent } from './fleet-assignments.component';
import { FleetDeadlinesComponent } from './fleet-deadlines.component';
import { FleetFinesComponent } from './fleet-fines.component';
import { FleetFuelComponent } from './fleet-fuel.component';
import { FleetServicesComponent } from './fleet-services.component';
import { FleetVehicleFormComponent } from './fleet-vehicle-form.component';
import { VEHICLE_STATUS_COLORS } from './fleet.util';

/** One vehicle: its data, cost of ownership and every record kept for it. */
@Component({
  selector: 'app-fleet-vehicle-detail',
  styleUrl: './fleet.scss',
  imports: [
    DecimalPipe,
    RouterLink,
    FleetAssignmentsComponent,
    FleetDeadlinesComponent,
    FleetFinesComponent,
    FleetFuelComponent,
    FleetServicesComponent,
    FleetVehicleFormComponent,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzStatisticModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="vehicle()?.license_plate ?? ''" [subtitle]="subtitle()">
      <a nz-button routerLink="/fleet/vehicles">{{ 'FLEET.BACK_TO_VEHICLES' | translate }}</a>
    </app-page-header>

    @if (vehicle(); as current) {
      <div class="toolbar">
        <nz-tag [nzColor]="statusColor()">{{ ('FLEET.STATUS_' + current.status.toUpperCase()) | translate }}</nz-tag>
        <nz-tag>{{ ('FLEET.OWNERSHIP_' + current.ownership.toUpperCase()) | translate }}</nz-tag>
        @if (current.current_assignment; as assignment) {
          <span class="muted">{{ 'FLEET.CURRENT_DRIVER' | translate }}: {{ assignment.employee?.full_name ?? assignment.driver_label }}</span>
        }
      </div>

      @if (costs(); as figures) {
        <div class="stats-grid">
          <nz-card><nz-statistic [nzTitle]="'FLEET.ODOMETER_KM' | translate" [nzValue]="(figures.odometer_km | number: '1.0-0') ?? ''"></nz-statistic></nz-card>
          <nz-card><nz-statistic [nzTitle]="'FLEET.RUNNING_COST' | translate" [nzValue]="(figures.running_cost | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
          <nz-card><nz-statistic [nzTitle]="'FLEET.TOTAL_COST_OF_OWNERSHIP' | translate" [nzValue]="(figures.total_cost_of_ownership | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
          <nz-card><nz-statistic [nzTitle]="'FLEET.COST_PER_KM' | translate" [nzValue]="figures.cost_per_km !== null ? ((figures.cost_per_km | number: '1.3-4') ?? '') : '-'"></nz-statistic></nz-card>
          <nz-card><nz-statistic [nzTitle]="'FLEET.AVERAGE_CONSUMPTION' | translate" [nzValue]="figures.average_consumption_per_100km !== null ? ((figures.average_consumption_per_100km | number: '1.1-2') ?? '') : '-'"></nz-statistic></nz-card>
        </div>
      }

      <nz-tabs>
        <nz-tab [nzTitle]="'FLEET.TAB_DETAILS' | translate">
          <nz-card class="main-card"><app-fleet-vehicle-form [vehicle]="current" (saved)="reload()"></app-fleet-vehicle-form></nz-card>
        </nz-tab>
        <nz-tab [nzTitle]="'FLEET.TAB_ASSIGNMENTS' | translate"><ng-template nzTabContent><app-fleet-assignments [vehicleId]="current.id"></app-fleet-assignments></ng-template></nz-tab>
        <nz-tab [nzTitle]="'FLEET.TAB_FUEL' | translate"><ng-template nzTabContent><app-fleet-fuel [vehicleId]="current.id"></app-fleet-fuel></ng-template></nz-tab>
        <nz-tab [nzTitle]="'FLEET.TAB_SERVICES' | translate"><ng-template nzTabContent><app-fleet-services [vehicleId]="current.id"></app-fleet-services></ng-template></nz-tab>
        <nz-tab [nzTitle]="'FLEET.TAB_DEADLINES' | translate"><ng-template nzTabContent><app-fleet-deadlines [vehicleId]="current.id"></app-fleet-deadlines></ng-template></nz-tab>
        <nz-tab [nzTitle]="'FLEET.TAB_FINES' | translate"><ng-template nzTabContent><app-fleet-fines [vehicleId]="current.id"></app-fleet-fines></ng-template></nz-tab>
      </nz-tabs>
    }
  `,
})
export class FleetVehicleDetailComponent implements OnInit {
  private readonly api = inject(FleetApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly vehicle = signal<FleetVehicle | null>(null);
  readonly costs = signal<FleetVehicleCosts | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  subtitle(): string {
    const vehicle = this.vehicle();
    return vehicle ? `${vehicle.make} ${vehicle.model}` : '';
  }

  statusColor(): string {
    return VEHICLE_STATUS_COLORS[this.vehicle()?.status ?? 'active'] ?? 'default';
  }

  reload(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.api.getVehicle(id).subscribe({
      next: (response) => this.vehicle.set(response.data),
      error: () => this.message.error(this.translate.instant('FLEET.ACTION_ERROR')),
    });
    this.api.getVehicleCosts(id).subscribe({
      next: (response) => this.costs.set(response.data),
      error: () => this.costs.set(null),
    });
  }
}
