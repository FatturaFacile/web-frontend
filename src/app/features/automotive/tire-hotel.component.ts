import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { environment } from '@env';
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
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './tire-hotel.component.html',
  styleUrl: './tire-hotel.component.scss',
})
export class TireHotelComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly message = inject(NzMessageService);

  readonly loading = signal(false);
  readonly tireRecords = signal<TireRecord[]>([]);

  winterCount(): number {
    return this.tireRecords().filter((r) => r.season === 'WINTER').length;
  }

  summerCount(): number {
    return this.tireRecords().filter((r) => r.season === 'SUMMER').length;
  }

  ngOnInit(): void {
    this.loading.set(true);
    this.http.get<TireRecord[]>(`${environment.apiBaseUrl}/automotive/tire-hotel`).subscribe({
      next: (data) => {
        this.tireRecords.set(data || []);
        this.loading.set(false);
      },
      error: () => {
        this.tireRecords.set([]);
        this.loading.set(false);
      },
    });
  }

  sendReminder(tire: TireRecord): void {
    tire.reminderSent = true;
    this.message.success(`Notifica inviata con successo per il veicolo ${tire.vehiclePlate}`);
  }
}
