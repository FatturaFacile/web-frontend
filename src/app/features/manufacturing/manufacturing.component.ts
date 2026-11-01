import { Component, inject, OnInit, signal } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ManufacturingApiService, ProductionOrder, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-manufacturing',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  templateUrl: './manufacturing.component.html',
})
export class ManufacturingComponent implements OnInit {
  private readonly api = inject(ManufacturingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly orders = signal<ProductionOrder[]>([]);

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getProductionOrders().subscribe({
      next: (res) => {
        this.orders.set(res?.data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || this.translate.instant('manufacturing.errors.loadFailed'));
        this.message.error(this.translate.instant('manufacturing.errors.loadFailedDetail'));
        this.orders.set([]);
        this.loading.set(false);
      },
    });
  }
}
