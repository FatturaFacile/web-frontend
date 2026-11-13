import { Component, inject, OnInit, signal } from '@angular/core';
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
  I18nService,
  PermissionsService,
  RibaBatchSummary,
  RibaOpenReceipt,
  RibaPortfolio,
  TreasuryOpsApiService,
} from '@core';
import { ModalActionsDirective, MoneyPipe, TranslatePipe, GridExportDirective, GridSortPipe } from '@shared';
import { downloadBlob } from '../../../general-ledger/shared/gl-dates';
import { TrLookupStore } from '../tr-lookup.store';

@Component({
  selector: 'app-tr-riba',
  styleUrl: './tr-riba.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
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

  protected readonly batches = signal<RibaBatchSummary[]>([]);
  protected readonly portfolio = signal<RibaPortfolio | null>(null);
  protected readonly loading = signal(false);
  protected readonly paidTarget = signal<RibaOpenReceipt | null>(null);
  protected readonly unpaidTarget = signal<RibaOpenReceipt | null>(null);

  protected paidAt = '';
  protected unpaidAt = '';
  protected unpaidReason = '';
  protected unpaidFee: number | null = null;

  ngOnInit(): void {
    this.banks.load();
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getRibaBatches().subscribe({
      next: (res) => {
        this.batches.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
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
