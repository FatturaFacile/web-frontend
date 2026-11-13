import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
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
import { AuthStore, DunningReadiness, FetchGridModel, I18nService, PermissionsService, QueryFilterParams, ReceivableCollection, TreasuryOpsApiService } from '@core';
import { BaseTableComponent, ModalActionsDirective, MoneyPipe, TableColumnDef, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';

@Component({
  selector: 'app-tr-collections',
  styleUrl: './tr-collections.component.scss',
  imports: [
    BaseTableComponent,
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    ModalActionsDirective,
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

  /** Server-driven grid of the collections: paging, sorting, column filters and grouping run on the API. */
  protected readonly grid = new FetchGridModel<ReceivableCollection, QueryFilterParams & { status?: string }>((query) => this.api.getCollections(query));

  private readonly amountTpl = viewChild<TemplateRef<{ $implicit: ReceivableCollection; value: unknown }>>('amountTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: ReceivableCollection; value: unknown }>>('statusTpl');

  protected readonly columns = computed<TableColumnDef<ReceivableCollection>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'due_date', header: this.i18n.translate('TR.DUE_DATE'), width: '120px' },
      { key: 'expected_amount', align: 'right', header: this.i18n.translate('TR.EXPECTED_AMOUNT'), width: '150px', customCellTemplate: this.amountTpl() },
      { key: 'collected_amount', align: 'right', header: this.i18n.translate('TR.COLLECTED_AMOUNT'), width: '150px', customCellTemplate: this.amountTpl() },
      { key: 'aging_bucket', header: this.i18n.translate('TR.AGING_BUCKET'), width: '130px' },
      { key: 'dunning_level', align: 'right', header: this.i18n.translate('TR.DUNNING_LEVEL'), width: '130px' },
      { key: 'status', header: this.i18n.translate('TR.STATUS'), width: '130px', customCellTemplate: this.statusTpl() },
    ];
  });
  protected readonly aging = signal<{ key: string; value: string }[]>([]);
  protected readonly dunning = signal<DunningReadiness | null>(null);
  protected readonly recordTarget = signal<ReceivableCollection | null>(null);

  protected statusFilter: string | null = null;
  protected recordAmount: number | null = null;
  protected recordDate = '';

  ngOnInit(): void {
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

  protected onStatusChange(status: string | null): void {
    this.statusFilter = status;
    this.grid.setFilter({ status: status ?? undefined });
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
        this.grid.reload();
      },
    });
  }
}
