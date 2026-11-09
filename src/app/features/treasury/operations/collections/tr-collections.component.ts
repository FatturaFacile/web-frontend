import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthStore, DunningReadiness, I18nService, PermissionsService, ReceivableCollection, TreasuryOpsApiService } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';

@Component({
  selector: 'app-tr-collections',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './tr-collections.component.html',
})
export class TrCollectionsComponent implements OnInit {
  private readonly api = inject(TreasuryOpsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly currency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('treasury');

  protected readonly statuses = ['pending', 'partial', 'collected', 'overdue'];
  protected readonly items = signal<ReceivableCollection[]>([]);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly loading = signal(false);
  protected readonly aging = signal<{ key: string; value: string }[]>([]);
  protected readonly dunning = signal<DunningReadiness | null>(null);
  protected readonly recordTarget = signal<ReceivableCollection | null>(null);

  protected statusFilter: string | null = null;
  protected recordAmount: number | null = null;
  protected recordDate = '';

  ngOnInit(): void {
    this.load();
    this.api.getCollectionsAging().subscribe({
      next: (res) =>
        this.aging.set(
          Object.entries(res).map(([key, value]) => ({
            key,
            value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          })),
        ),
    });
    this.api.getDunningReadiness().subscribe({ next: (res) => this.dunning.set(res) });
  }

  protected load(page = 1): void {
    this.pageIndex.set(page);
    this.loading.set(true);
    this.api.getCollections({ status: this.statusFilter ?? undefined, page, per_page: 25 }).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.total.set(res.meta?.total ?? 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openRecord(item: ReceivableCollection): void {
    this.recordAmount = null;
    this.recordDate = '';
    this.recordTarget.set(item);
  }

  protected confirmRecord(): void {
    const target = this.recordTarget();
    if (!target || !this.recordAmount) {
      return;
    }
    this.api.recordCollection(target.id, { amount: this.recordAmount, collection_date: this.recordDate || null }).subscribe({
      next: () => {
        this.recordTarget.set(null);
        this.message.success(this.i18n.translate('TR.COLLECTION_RECORDED'));
        this.load(this.pageIndex());
      },
    });
  }
}
