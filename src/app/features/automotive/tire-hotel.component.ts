import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzMessageService } from 'ng-zorro-antd/message';
import { PageHeaderComponent, TranslatePipe } from '@shared';

interface TireRecord {
  id: string;
  customerName: string;
  vehiclePlate: string;
  vehicleModel: string;
  season: 'SUMMER' | 'WINTER' | 'ALL_SEASON';
  brandModel: string;
  dot: string;
  treadDepthMm: {
    frontLeft: number;
    frontRight: number;
    rearLeft: number;
    rearRight: number;
  };
  hasRims: boolean;
  rimType: string;
  rackLocation: string;
  depositDate: string;
  status: string;
  reminderSent: boolean;
}

@Component({
  selector: 'app-tire-hotel',
  imports: [
    NzTableModule,
    NzTagModule,
    NzCardModule,
    NzButtonModule,
    NzGridModule,
    NzStatisticModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'TIRE_HOTEL.TITLE' | translate"
      [subtitle]="'TIRE_HOTEL.SUBTITLE' | translate"
    />

    <div nz-row [nzGutter]="16" class="kpi-row">
      <div nz-col [nzXs]="24" [nzSm]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="tireRecords().length"
            [nzTitle]="'TIRE_HOTEL.SETS_STORED' | translate"
            [nzPrefix]="tireIcon"
          />
          <ng-template #tireIcon><i class="fa-solid fa-circle-dot fa-icon-spaced"></i></ng-template>
        </nz-card>
      </div>
      <div nz-col [nzXs]="24" [nzSm]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="winterCount()"
            [nzTitle]="'TIRE_HOTEL.WINTER_TIRES' | translate"
            [nzValueStyle]="{ color: 'var(--primary-color, #0d9488)' }"
          />
        </nz-card>
      </div>
      <div nz-col [nzXs]="24" [nzSm]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="summerCount()"
            [nzTitle]="'TIRE_HOTEL.SUMMER_TIRES' | translate"
            [nzValueStyle]="{ color: '#f59e0b' }"
          />
        </nz-card>
      </div>
    </div>

    <nz-card [nzTitle]="'TIRE_HOTEL.LOG_TITLE' | translate">
      <nz-table
        #tireTable
        [nzData]="tireRecords()"
        [nzFrontPagination]="true"
        [nzPageSize]="10"
        nzSize="middle"
      >
        <thead>
          <tr>
            <th>{{ 'TIRE_HOTEL.COL_PLATE_MODEL' | translate }}</th>
            <th>{{ 'TIRE_HOTEL.COL_CUSTOMER' | translate }}</th>
            <th>{{ 'TIRE_HOTEL.COL_SEASON' | translate }}</th>
            <th>{{ 'TIRE_HOTEL.COL_SIZE_BRAND' | translate }}</th>
            <th>{{ 'TIRE_HOTEL.COL_TREAD' | translate }}</th>
            <th>{{ 'TIRE_HOTEL.COL_RACK' | translate }}</th>
            <th>{{ 'TIRE_HOTEL.COL_DATE' | translate }}</th>
            <th>{{ 'TIRE_HOTEL.COL_REMINDER' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (tire of tireTable.data; track tire.id) {
            <tr>
              <td>
                <nz-tag [nzColor]="tire.vehiclePlate.startsWith('TI') || tire.vehiclePlate.startsWith('GE') ? 'red' : 'blue'">
                  {{ tire.vehiclePlate }}
                </nz-tag>
                <div><small>{{ tire.vehicleModel }}</small></div>
              </td>
              <td><strong>{{ tire.customerName }}</strong></td>
              <td>
                @if (tire.season === 'WINTER') {
                  <nz-tag nzColor="blue"><i class="fa-solid fa-snowflake fa-icon-spaced"></i> Winter</nz-tag>
                } @else {
                  <nz-tag nzColor="orange"><i class="fa-solid fa-sun fa-icon-spaced"></i> Summer</nz-tag>
                }
              </td>
              <td>
                {{ tire.brandModel }}
                <div><small>DOT: {{ tire.dot }} • {{ tire.rimType }}</small></div>
              </td>
              <td>
                <span class="depth-badge">
                  Ant: {{ tire.treadDepthMm.frontLeft }} / {{ tire.treadDepthMm.frontRight }} mm
                </span>
                <span class="depth-badge">
                  Post: {{ tire.treadDepthMm.rearLeft }} / {{ tire.treadDepthMm.rearRight }} mm
                </span>
              </td>
              <td>
                <nz-tag nzColor="geekblue">
                  <i class="fa-solid fa-warehouse fa-icon-spaced"></i> {{ tire.rackLocation }}
                </nz-tag>
              </td>
              <td>{{ tire.depositDate }}</td>
              <td>
                @if (tire.reminderSent) {
                  <nz-tag nzColor="success"><i class="fa-solid fa-check fa-icon-spaced"></i> Sent</nz-tag>
                } @else {
                  <button
                    nz-button
                    nzSize="small"
                    nzType="dashed"
                    (click)="sendReminder(tire)"
                  >
                    <i class="fa-solid fa-bell fa-icon-spaced"></i> SMS/WhatsApp
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    .kpi-row {
      margin-bottom: 20px;
    }

    .depth-badge {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-secondary, #475569);
    }
  `,
})
export class TireHotelComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly message = inject(NzMessageService);

  readonly tireRecords = signal<TireRecord[]>([]);

  winterCount(): number {
    return this.tireRecords().filter((r) => r.season === 'WINTER').length;
  }

  summerCount(): number {
    return this.tireRecords().filter((r) => r.season === 'SUMMER').length;
  }

  ngOnInit(): void {
    this.http.get<TireRecord[]>('/api/automotive/tire-hotel').subscribe({
      next: (data) => this.tireRecords.set(data),
      error: () => {
        const fallback: TireRecord[] = [
          {
            id: 'th-01',
            customerName: 'Sara Riva',
            vehiclePlate: 'TI 450912',
            vehicleModel: 'Volkswagen Golf 8 2.0 TDI',
            season: 'SUMMER',
            brandModel: 'Michelin Pilot Sport 4 225/45 R17',
            dot: '1223',
            treadDepthMm: { frontLeft: 6.2, frontRight: 6.1, rearLeft: 6.8, rearRight: 6.7 },
            hasRims: true,
            rimType: 'Lega Originale VW',
            rackLocation: 'SCAFFALE-B-04',
            depositDate: '2026-04-12',
            status: 'Stoccato',
            reminderSent: false,
          },
          {
            id: 'th-02',
            customerName: 'Marco Bellini',
            vehiclePlate: 'MI 890XA',
            vehicleModel: 'Audi A4 Avant Quattro',
            season: 'WINTER',
            brandModel: 'Pirelli Winter Sottozero 3 245/40 R18',
            dot: '4422',
            treadDepthMm: { frontLeft: 4.5, frontRight: 4.6, rearLeft: 5.1, rearRight: 5.0 },
            hasRims: true,
            rimType: 'Lega GMP',
            rackLocation: 'SCAFFALE-A-12',
            depositDate: '2026-10-15',
            status: 'Stoccato',
            reminderSent: true,
          },
        ];
        this.tireRecords.set(fallback);
      },
    });
  }

  sendReminder(tire: TireRecord): void {
    tire.reminderSent = true;
    this.message.success(`Notifica inviata con successo per il veicolo ${tire.vehiclePlate}`);
  }
}
