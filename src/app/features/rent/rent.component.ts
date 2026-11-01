import { Component, inject, OnInit, signal } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzMessageService } from 'ng-zorro-antd/message';
import { RentApiService, RentalVehicle } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-rent',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  templateUrl: './rent.component.html',
})
export class RentComponent implements OnInit {
  private readonly api = inject(RentApiService);
  private readonly message = inject(NzMessageService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly vehicles = signal<RentalVehicle[]>([]);

  ngOnInit(): void {
    this.loadVehicles();
  }

  loadVehicles(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getVehicles().subscribe({
      next: (res) => {
        this.vehicles.set(res?.data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Errore nel caricamento parco veicoli');
        this.message.error('Errore nel caricamento dei veicoli a noleggio');
        this.vehicles.set([]);
        this.loading.set(false);
      },
    });
  }
}
