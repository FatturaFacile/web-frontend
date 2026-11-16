import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  ConsignmentLedgerWarehouse,
  I18nService,
  InventoryValuation,
  LOGISTICS_PERMISSIONS,
  LogisticsApiService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { warehouseTypeKey } from '../../logistics.ui';

@Component({
  selector: 'app-consignment',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzFormModule,
    NzIconModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './consignment.component.html',
  styleUrl: './consignment.component.scss',
})
export class ConsignmentComponent implements OnInit {
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(LogisticsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly perm = LOGISTICS_PERMISSIONS;
  protected readonly typeKey = warehouseTypeKey;
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly ledger = signal<ConsignmentLedgerWarehouse[]>([]);
  protected readonly valuation = signal<InventoryValuation | null>(null);

  protected readonly declareTarget = signal<ConsignmentLedgerWarehouse | null>(null);
  protected readonly declareForm = this.fb.group({
    period: this.fb.control<Date[]>([], Validators.required),
    lines: this.fb.array([this.newLine()]),
  });

  protected readonly productOptions = computed(() =>
    (this.declareTarget()?.rows ?? [])
      .filter((r) => r.residual_qty > 0)
      .map((r) => ({ value: r.product_id, label: `${r.sku ?? ''} — ${r.name ?? ''}` })),
  );

  protected get lines() {
    return this.declareForm.controls.lines;
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.api.consignmentLedger().subscribe({
      next: (res) => {
        this.ledger.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.api.inventoryValuation().subscribe((res) => this.valuation.set(res.data));
  }

  /** Consumption can only be declared on customer / vendor consignment warehouses. */
  protected canDeclare(warehouse: ConsignmentLedgerWarehouse): boolean {
    return (
      this.auth.can(LOGISTICS_PERMISSIONS.consignment) &&
      (warehouse.warehouse_type === 'customer_consignment' ||
        warehouse.warehouse_type === 'vendor_consignment')
    );
  }

  protected openDeclare(warehouse: ConsignmentLedgerWarehouse): void {
    this.declareForm.reset({ period: [] });
    this.lines.clear();
    this.lines.push(this.newLine());
    this.declareTarget.set(warehouse);
  }

  protected addLine(): void {
    this.lines.push(this.newLine());
  }

  protected removeLine(index: number): void {
    if (this.lines.length > 1) {
      this.lines.removeAt(index);
    }
  }

  protected declare(): void {
    const warehouse = this.declareTarget();
    if (!warehouse || this.declareForm.invalid) return;
    const v = this.declareForm.getRawValue();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    this.busy.set(true);
    this.api
      .declareConsumption({
        warehouse_id: warehouse.warehouse_id,
        period_start: iso(v.period[0]),
        period_end: iso(v.period[1]),
        lines: v.lines.map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity) })),
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.declareTarget.set(null);
          this.message.success(
            this.i18n.translate(
              res.data.direction === 'customer'
                ? 'LOGISTICS.CONSIGNMENT.INVOICE_CREATED'
                : 'LOGISTICS.CONSIGNMENT.PO_CREATED',
            ),
          );
          this.reload();
        },
        error: (err) => {
          this.busy.set(false);
          const apiMessage = (err as { error?: { message?: string } })?.error?.message;
          this.message.error(apiMessage ?? this.i18n.translate('LOGISTICS.ERRORS.GENERIC'));
        },
      });
  }

  private newLine() {
    return this.fb.group({
      product_id: this.fb.control('', Validators.required),
      quantity: this.fb.control(1, [Validators.required, Validators.min(0.0001)]),
    });
  }
}
