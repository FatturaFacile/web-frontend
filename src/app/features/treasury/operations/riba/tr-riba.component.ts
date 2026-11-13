import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  FetchGridModel,
  I18nService,
  PermissionsService,
  QueryFilterParams,
  RibaBatchSummary,
  RibaOpenReceipt,
  RibaPortfolio,
  TreasuryOpsApiService,
} from '@core';
import { BaseTableComponent, ModalActionsDirective, MoneyPipe, TableColumnDef, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { downloadBlob } from '../../../general-ledger/shared/gl-dates';
import { TrLookupStore } from '../tr-lookup.store';

@Component({
  selector: 'app-tr-riba',
  styleUrl: './tr-riba.component.scss',
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
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './tr-riba.component.html',
})
export class TrRibaComponent implements OnInit {
  private readonly api = inject(TreasuryOpsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly banks = inject(TrLookupStore);
  protected readonly canWrite = inject(PermissionsService).canWrite('treasury');

  /** Server-driven grid of the Ri.Ba. batches: paging, sorting, column filters and grouping run on the API. */
  protected readonly batchGrid = new FetchGridModel<RibaBatchSummary, QueryFilterParams & { status?: string; bank_account_id?: string }>(
    (query) => this.api.getRibaBatches(query),
  );

  private readonly batchAmountTpl = viewChild<TemplateRef<{ $implicit: RibaBatchSummary; value: unknown }>>('batchAmountTpl');
  private readonly batchStatusTpl = viewChild<TemplateRef<{ $implicit: RibaBatchSummary; value: unknown }>>('batchStatusTpl');

  protected readonly batchColumns = computed<TableColumnDef<RibaBatchSummary>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'batch_reference', valueGetter: (row) => row.batch_reference ?? row.id, header: this.i18n.translate('TR.REFERENCE') },
      {
        key: 'bank_account_id',
        serverKey: 'bankAccount.bank_name',
        valueGetter: (row) => this.banks.label(row.bank_account_id),
        header: this.i18n.translate('TR.BANK_ACCOUNT'),
      },
      { key: 'execution_date', header: this.i18n.translate('TR.EXECUTION_DATE'), width: '130px' },
      { key: 'item_count', align: 'right', header: this.i18n.translate('TR.ITEMS'), width: '100px' },
      { key: 'total_amount', align: 'right', header: this.i18n.translate('TR.TOTAL'), width: '150px', customCellTemplate: this.batchAmountTpl() },
      { key: 'status', header: this.i18n.translate('TR.STATUS'), width: '130px', customCellTemplate: this.batchStatusTpl() },
    ];
  });
  protected readonly portfolio = signal<RibaPortfolio | null>(null);
  protected readonly paidTarget = signal<RibaOpenReceipt | null>(null);
  protected readonly unpaidTarget = signal<RibaOpenReceipt | null>(null);

  protected paidAt = '';
  protected unpaidAt = '';
  protected unpaidReason = '';
  protected unpaidFee: number | null = null;

  ngOnInit(): void {
    this.banks.load();
    this.loadPortfolio();
  }

  protected load(): void {
    this.batchGrid.reload();
    this.loadPortfolio();
  }

  private loadPortfolio(): void {
    this.api.getRibaPortfolio().subscribe({ next: (res) => this.portfolio.set(res.data) });
  }

  protected statusEntries(portfolio: RibaPortfolio): { key: string; value: string }[] {
    return Object.entries(portfolio.by_status ?? {}).map(([key, value]) => ({
      key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    }));
  }

  protected exportBatch(batch: RibaBatchSummary): void {
    this.api.exportRibaBatch(batch.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('TR.RIBA_EXPORTED'));
        this.load();
      },
    });
  }

  protected downloadFile(batch: RibaBatchSummary): void {
    this.api.downloadRibaBatchFile(batch.id).subscribe({
      next: (blob) => downloadBlob(blob, `riba-${batch.batch_reference ?? batch.id}.txt`),
    });
  }

  protected openPaid(receipt: RibaOpenReceipt): void {
    this.paidAt = '';
    this.paidTarget.set(receipt);
  }

  protected confirmPaid(): void {
    const target = this.paidTarget();
    if (!target || !this.paidAt) {
      return;
    }
    this.api.markRibaReceiptPaid(target.id, this.paidAt).subscribe({
      next: () => {
        this.paidTarget.set(null);
        this.load();
      },
    });
  }

  protected openUnpaid(receipt: RibaOpenReceipt): void {
    this.unpaidAt = '';
    this.unpaidReason = '';
    this.unpaidFee = null;
    this.unpaidTarget.set(receipt);
  }

  protected confirmUnpaid(): void {
    const target = this.unpaidTarget();
    if (!target || !this.unpaidAt || !this.unpaidReason.trim()) {
      return;
    }
    this.api
      .markRibaReceiptUnpaid(target.id, { reason: this.unpaidReason.trim(), unpaid_at: this.unpaidAt, fee: this.unpaidFee })
      .subscribe({
        next: () => {
          this.unpaidTarget.set(null);
          this.load();
        },
      });
  }
}
