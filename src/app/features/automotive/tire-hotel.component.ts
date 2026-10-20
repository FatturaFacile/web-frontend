import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzMessageService } from 'ng-zorro-antd/message';
import { PageHeaderComponent } from '@shared';

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
  ],
  template: `
    <app-page-header
      title="Hotel Pneumatici & Officina Gommista"
      subtitle="Stoccaggio stagionale pneumatici, rilevazione battistrada in mm, allocazione scaffali e richiamo cambio gomme"
    />

    <div nz-row [nzGutter]="16" class="kpi-row">
      <div nz-col [nzXs]="24" [nzSm]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="tireRecords().length"
            nzTitle="Treni Gomme Custoditi"
            [nzPrefix]="tireIcon"
          />
          <ng-template #tireIcon><i class="fa-solid fa-circle-dot fa-icon-spaced"></i></ng-template>
        </nz-card>
      </div>
      <div nz-col [nzXs]="24" [nzSm]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="winterCount()"
            nzTitle="Pneumatici Invernali in Custodia"
            [nzValueStyle]="{ color: '#1677ff' }"
          />
        </nz-card>
      </div>
      <div nz-col [nzXs]="24" [nzSm]="8">
        <nz-card>
          <nz-statistic
            [nzValue]="summerCount()"
            nzTitle="Pneumatici Estivi in Custodia"
            [nzValueStyle]="{ color: '#fa8c16' }"
          />
        </nz-card>
      </div>
    </div>

    <nz-card nzTitle="Registro Deposito Pneumatici">
      <nz-table
        #tireTable
        [nzData]="tireRecords()"
        [nzFrontPagination]="true"
        [nzPageSize]="10"
        nzSize="middle"
      >
        <thead>
          <tr>
            <th>Targa & Modello</th>
            <th>Cliente</th>
            <th>Stagione</th>
            <th>Misura & Marca</th>
            <th>Battistrada (mm) [Ant / Post]</th>
            <th>Scaffale / Locazione</th>
            <th>Data Deposito</th>
            <th>Promemoria Stagionale</th>
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
                  <nz-tag nzColor="blue"><i class="fa-solid fa-snowflake fa-icon-spaced"></i> Invernale</nz-tag>
                } @else {
                  <nz-tag nzColor="orange"><i class="fa-solid fa-sun fa-icon-spaced"></i> Estivo</nz-tag>
                }
              </td>
              <td>
                {{ tire.brandModel }}
                <div><small>DOT: {{ tire.dot }} • Cerchi: {{ tire.rimType }}</small></div>
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
                  <nz-tag nzColor="success"><i class="fa-solid fa-check fa-icon-spaced"></i> Inviato</nz-tag>
                } @else {
                  <button
                    nz-button
                    nzSize="small"
                    nzType="dashed"
                    (click)="sendReminder(tire)"
                  >
                    <i class="fa-solid fa-bell fa-icon-spaced"></i> Invia SMS/WhatsApp
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
      color: #595959;
    }
  `,
})
export class TireHotelComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly msg = inject(NzMessageService);

  readonly tireRecords = signal<TireRecord[]>([]);

  readonly winterCount = signal<number>(0);
  readonly summerCount = signal<number>(0);

  ngOnInit(): void {
    this.http.get<TireRecord[]>('/api/automotive/tire-hotel').subscribe({
      next: (data) => {
        this.tireRecords.set(data);
        this.winterCount.set(data.filter((d) => d.season === 'WINTER').length);
        this.summerCount.set(data.filter((d) => d.season === 'SUMMER').length);
      },
    });
  }

  sendReminder(tire: TireRecord): void {
    tire.reminderSent = true;
    this.msg.success(`Promemoria cambio gomme inviato con successo a ${tire.customerName} (${tire.vehiclePlate})`);
  }
}
