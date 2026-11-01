import { Component, inject, OnInit, signal } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ConstructionApiService, ConstructionSite } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-construction',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  templateUrl: './construction.component.html',
})
export class ConstructionComponent implements OnInit {
  private readonly api = inject(ConstructionApiService);
  private readonly message = inject(NzMessageService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly sites = signal<ConstructionSite[]>([]);

  ngOnInit(): void {
    this.loadSites();
  }

  loadSites(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getSites().subscribe({
      next: (res) => {
        this.sites.set(res?.data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Errore nel caricamento cantieri');
        this.message.error('Errore nel caricamento dei cantieri edili');
        this.sites.set([]);
        this.loading.set(false);
      },
    });
  }
}
