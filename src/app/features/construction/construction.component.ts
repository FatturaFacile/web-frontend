import { Component, inject, OnInit, signal } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ConstructionApiService, ConstructionSite, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-construction',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  templateUrl: './construction.component.html',
})
export class ConstructionComponent implements OnInit {
  private readonly api = inject(ConstructionApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

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
        this.error.set(err?.message || this.translate.instant('construction.errors.loadFailed'));
        this.message.error(this.translate.instant('construction.errors.loadFailedDetail'));
        this.sites.set([]);
        this.loading.set(false);
      },
    });
  }
}
