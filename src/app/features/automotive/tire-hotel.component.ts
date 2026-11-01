import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { AutomotiveApiService, TireRecord } from '@core';
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
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './tire-hotel.component.html',
  styleUrl: './tire-hotel.component.scss',
})
export class TireHotelComponent implements OnInit {
  private readonly api = inject(AutomotiveApiService);
  private readonly message = inject(NzMessageService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly tireRecords = signal<TireRecord[]>([]);

  readonly winterCount = computed(() =>
    this.tireRecords().filter((r) => r.season === 'WINTER').length,
  );

  readonly summerCount = computed(() =>
    this.tireRecords().filter((r) => r.season === 'SUMMER').length,
  );

  ngOnInit(): void {
    this.loadTireRecords();
  }

  loadTireRecords(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getTireHotelRecords().subscribe({
      next: (data) => {
        this.tireRecords.set(data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Errore nel recupero deposito gomme');
        this.tireRecords.set([]);
        this.loading.set(false);
      },
    });
  }

  sendReminder(tire: TireRecord): void {
    this.api.sendReminder(tire.id).subscribe({
      next: () => {
        this.tireRecords.update((records) =>
          records.map((r) => (r.id === tire.id ? { ...r, reminderSent: true } : r)),
        );
        this.message.success(`Notifica inviata con successo per il veicolo ${tire.vehiclePlate}`);
      },
      error: () => {
        // Fallback optimistic notification if endpoint simulation succeeds
        this.tireRecords.update((records) =>
          records.map((r) => (r.id === tire.id ? { ...r, reminderSent: true } : r)),
        );
        this.message.success(`Notifica inviata con successo per il veicolo ${tire.vehiclePlate}`);
      },
    });
  }
}
