import { DatePipe, DecimalPipe, KeyValuePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  I18nService,
  InventoryBook,
  InventoryBookExport,
  InventoryBookParams,
  InventoryValuationApiService,
  InventoryWarehouseOption,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { InventoryBookExportFacade } from '../shared/inventory-valuation.facades';
import {
  httpStatus,
  inventoryErrorKey,
  isZeroAmount,
  saveDownloadedFile,
  serverMessage,
  toIsoDate,
  VALUATION_METHOD_LABELS,
} from '../shared/inventory-valuation.utils';

@Component({
  selector: 'app-inventory-book',
  imports: [
    DatePipe,
    DecimalPipe,
    KeyValuePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzIconModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [InventoryBookExportFacade],
  templateUrl: './inventory-book.component.html',
  styleUrl: '../shared/inventory-valuation.scss',
})
export class InventoryBookComponent implements OnInit {
  private readonly api = inject(InventoryValuationApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly exports = inject(InventoryBookExportFacade);

  protected readonly methodLabels: Partial<Record<string, string>> = VALUATION_METHOD_LABELS;

  readonly year = signal(new Date().getFullYear() - 1);
  readonly asOf = signal<Date | null>(null);
  readonly warehouseId = signal<string | null>(null);
  readonly requireClosed = signal(false);
  readonly warehouses = signal<InventoryWarehouseOption[]>([]);

  readonly book = signal<InventoryBook | null>(null);
  readonly loading = signal(false);
  readonly error = signal<{ key: string; detail: string | null } | null>(null);
  readonly downloadingCsv = signal(false);
  readonly creatingExport = signal(false);
  readonly downloadingExportId = signal<string | null>(null);

  readonly hasDifference = computed(() => {
    const book = this.book();
    return !!book && !isZeroAmount(book.reconciliation?.difference);
  });

  ngOnInit(): void {
    this.api.listWarehouses().subscribe({
      next: (list) => this.warehouses.set(list),
      error: () => this.warehouses.set([]),
    });
  }

  params(): InventoryBookParams {
    return {
      year: this.year(),
      as_of: toIsoDate(this.asOf()),
      warehouse_id: this.warehouseId() ?? undefined,
      require_closed: this.requireClosed() || undefined,
    };
  }

  generate(): void {
    if (!this.year()) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.getBook(this.params()).subscribe({
      next: (book) => {
        this.book.set(book);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.book.set(null);
        this.error.set({ key: this.bookErrorKey(err), detail: serverMessage(err) });
        this.loading.set(false);
      },
    });
  }

  downloadCsv(): void {
    if (this.downloadingCsv()) {
      return;
    }
    this.downloadingCsv.set(true);
    this.api.downloadBookCsv(this.params()).subscribe({
      next: (file) => {
        this.downloadingCsv.set(false);
        saveDownloadedFile(file);
      },
      error: () => {
        // Non-422 errors are already toasted by the HTTP interceptor.
        this.downloadingCsv.set(false);
      },
    });
  }

  createExport(): void {
    if (this.creatingExport()) {
      return;
    }
    this.creatingExport.set(true);
    this.api.createBookExport(this.year()).subscribe({
      next: () => {
        this.creatingExport.set(false);
        this.message.success(this.i18n.translate('INVENTORY.BOOK.EXPORT_CREATED'));
        this.exports.reload();
      },
      error: (err: unknown) => {
        this.creatingExport.set(false);
        if (httpStatus(err) === 403) {
          this.exports.forbidden.set(true);
        } else if (httpStatus(err) === 422) {
          this.message.error(serverMessage(err) ?? this.i18n.translate('INVENTORY.ERRORS.VALIDATION'));
        }
      },
    });
  }

  downloadExport(item: InventoryBookExport): void {
    if (this.downloadingExportId()) {
      return;
    }
    this.downloadingExportId.set(item.id);
    this.api.downloadBookExport(item).subscribe({
      next: (file) => {
        this.downloadingExportId.set(null);
        saveDownloadedFile(file);
      },
      error: (err: unknown) => {
        this.downloadingExportId.set(null);
        if (httpStatus(err) === 403) {
          this.exports.forbidden.set(true);
        }
      },
    });
  }

  private bookErrorKey(err: unknown): string {
    switch (httpStatus(err)) {
      case 422:
        return 'INVENTORY.BOOK.ERROR_YEAR';
      case 409:
        return 'INVENTORY.BOOK.ERROR_OPEN_PERIOD';
      default:
        return inventoryErrorKey(err);
    }
  }
}
