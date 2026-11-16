import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  DISCREPANCY_RESOLUTIONS,
  DiscrepancyResolution,
  I18nService,
  LOGISTICS_PERMISSIONS,
  LogisticsApiService,
  LookupProduct,
  LookupWarehouse,
  StockTransferResource,
  TRANSFER_PURPOSES,
  TransferDiscrepancy,
  TransferPurpose,
  TransferStatus,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { TransferFacade } from '../../services/delivery-note.facade';
import {
  DISCREPANCY_COLOR,
  discrepancyKey,
  TRANSFER_STATUS_COLOR,
  transferPurposeKey,
  transferStatusKey,
} from '../../logistics.ui';

/** Warehouse type each transfer purpose must land in (mirrors StockTransferService on the API). */
const DESTINATION_TYPE: Partial<Record<TransferPurpose, string>> = {
  customer_consignment: 'customer_consignment',
  subcontracting: 'subcontractor',
  technician_van: 'mobile_van',
};

@Component({
  selector: 'app-transfers',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './transfers.component.html',
  styleUrl: './transfers.component.scss',
})
export class TransfersComponent implements OnInit {
  protected readonly facade = inject(TransferFacade);
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(LogisticsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly perm = LOGISTICS_PERMISSIONS;
  protected readonly statusColor = TRANSFER_STATUS_COLOR;
  protected readonly statusKey = transferStatusKey;
  protected readonly purposeKey = transferPurposeKey;
  protected readonly discrepancyColor = DISCREPANCY_COLOR;
  protected readonly discrepancyKey = discrepancyKey;

  protected readonly warehouses = signal<LookupWarehouse[]>([]);
  protected readonly products = signal<LookupProduct[]>([]);
  protected readonly busy = signal(false);

  // create drawer
  protected readonly createVisible = signal(false);
  protected readonly createForm = this.fb.group({
    purpose: this.fb.control<TransferPurpose>('inter_warehouse', Validators.required),
    origin_warehouse_id: this.fb.control('', Validators.required),
    destination_warehouse_id: this.fb.control('', Validators.required),
    lines: this.fb.array([this.newLine()]),
  });
  private readonly purpose = signal<TransferPurpose>('inter_warehouse');

  // detail drawer with the stepper
  protected readonly detail = signal<StockTransferResource | null>(null);
  protected readonly detailStep = computed(() => {
    switch (this.detail()?.status) {
      case 'in_transit':
        return 1;
      case 'received':
      case 'discrepancy_pending':
      case 'reconciled':
        return 2;
      default:
        return 0;
    }
  });
  protected readonly discrepancyOptions = computed(() =>
    DISCREPANCY_RESOLUTIONS.map((value) => ({
      value,
      label: this.i18n.translate(discrepancyKey(value)),
    })),
  );

  // receive modal
  protected readonly receiveTarget = signal<StockTransferResource | null>(null);
  protected readonly received = signal<Record<string, { qty: number; reason: string }>>({});

  protected readonly purposeOptions = computed(() =>
    TRANSFER_PURPOSES.map((value) => ({
      value,
      label: this.i18n.translate(transferPurposeKey(value)),
    })),
  );
  protected readonly originOptions = computed(() =>
    this.warehouses()
      .filter((w) => w.warehouse_type !== 'transit' && w.legal_owner_type === 'company')
      .map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })),
  );
  protected readonly destinationOptions = computed(() => {
    const expected = DESTINATION_TYPE[this.purpose()];
    return this.warehouses()
      .filter((w) =>
        expected
          ? w.warehouse_type === expected
          : !['transit', 'vendor_consignment'].includes(w.warehouse_type),
      )
      .map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }));
  });
  protected readonly productOptions = computed(() =>
    this.products().map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })),
  );

  protected get lines() {
    return this.createForm.controls.lines;
  }

  ngOnInit(): void {
    this.api.warehouses().subscribe((res) => this.warehouses.set(res.data));
    this.api.products().subscribe((res) => this.products.set(res.data));
    this.createForm.controls.purpose.valueChanges.subscribe((p) => {
      this.purpose.set(p);
      this.createForm.controls.destination_warehouse_id.setValue('');
    });
  }

  protected warehouseName(id: string | null): string {
    const w = this.warehouses().find((x) => x.id === id);
    return w ? `${w.code} — ${w.name}` : (id ?? '');
  }

  protected productName(id: string): string {
    const p = this.products().find((x) => x.id === id);
    return p ? `${p.sku} — ${p.name}` : id;
  }

  protected addLine(): void {
    this.lines.push(this.newLine());
  }

  protected removeLine(index: number): void {
    if (this.lines.length > 1) {
      this.lines.removeAt(index);
    }
  }

  protected openCreate(): void {
    this.createVisible.set(true);
  }

  protected create(): void {
    if (this.createForm.invalid) return;
    const v = this.createForm.getRawValue();
    this.busy.set(true);
    this.api
      .createTransfer({
        purpose: v.purpose,
        origin_warehouse_id: v.origin_warehouse_id,
        destination_warehouse_id: v.destination_warehouse_id,
        lines: v.lines.map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity) })),
      })
      .subscribe({
        next: () => {
          this.createVisible.set(false);
          this.done('LOGISTICS.TRANSFER.MESSAGES.CREATED');
        },
        error: (err) => this.fail(err),
      });
  }

  protected openDetail(transfer: StockTransferResource): void {
    this.api
      .getTransfer(transfer.id)
      .subscribe({ next: (res) => this.detail.set(res.data), error: (err) => this.fail(err) });
  }

  protected ship(transfer: StockTransferResource): void {
    this.busy.set(true);
    this.api.shipTransfer(transfer.id).subscribe({
      next: () => this.done('LOGISTICS.TRANSFER.MESSAGES.SHIPPED'),
      error: (err) => this.fail(err),
    });
  }

  protected cancel(transfer: StockTransferResource): void {
    this.busy.set(true);
    this.api.cancelTransfer(transfer.id).subscribe({
      next: () => this.done('LOGISTICS.TRANSFER.MESSAGES.CANCELLED'),
      error: (err) => this.fail(err),
    });
  }

  protected openReceive(transfer: StockTransferResource): void {
    this.api.getTransfer(transfer.id).subscribe({
      next: (res) => {
        const state: Record<string, { qty: number; reason: string }> = {};
        for (const line of res.data.lines ?? []) {
          state[line.id] = { qty: Number(line.shipped_qty), reason: '' };
        }
        this.received.set(state);
        this.receiveTarget.set(res.data);
      },
      error: (err) => this.fail(err),
    });
  }

  protected setReceived(lineId: string, qty: number | null): void {
    this.received.update((s) => ({ ...s, [lineId]: { ...s[lineId], qty: qty ?? 0 } }));
  }

  protected setReason(lineId: string, reason: string): void {
    this.received.update((s) => ({ ...s, [lineId]: { ...s[lineId], reason } }));
  }

  /** Quantity missing on a line while receiving (shipped - received); drives the discrepancy hint. */
  protected missing(lineId: string, shipped: number | string): number {
    return Math.max(0, Number(shipped) - (this.received()[lineId]?.qty ?? Number(shipped)));
  }

  protected hasDiscrepancy = computed(() => {
    const target = this.receiveTarget();
    return (target?.lines ?? []).some((l) => this.missing(l.id, l.shipped_qty) > 0);
  });

  protected confirmReceive(): void {
    const target = this.receiveTarget();
    if (!target) return;
    this.busy.set(true);
    this.api
      .receiveTransfer(
        target.id,
        (target.lines ?? []).map((l) => ({
          line_id: l.id,
          received_qty: this.received()[l.id]?.qty ?? Number(l.shipped_qty),
          discrepancy_reason: this.received()[l.id]?.reason || null,
        })),
      )
      .subscribe({
        next: () => {
          this.receiveTarget.set(null);
          this.done('LOGISTICS.TRANSFER.MESSAGES.RECEIVED');
        },
        error: (err) => this.fail(err),
      });
  }

  protected resolve(discrepancy: TransferDiscrepancy, resolution: DiscrepancyResolution): void {
    this.busy.set(true);
    this.api.resolveDiscrepancy(discrepancy.id, resolution).subscribe({
      next: () => {
        const current = this.detail();
        this.done('LOGISTICS.DISCREPANCY.MESSAGES.RESOLVED');
        if (current) this.openDetail(current);
      },
      error: (err) => this.fail(err),
    });
  }

  protected isActionable(status: TransferStatus): boolean {
    return status === 'draft' || status === 'in_transit' || status === 'discrepancy_pending';
  }

  private done(key: string): void {
    this.busy.set(false);
    this.message.success(this.i18n.translate(key));
    this.facade.reload();
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    const apiMessage = (err as { error?: { message?: string } })?.error?.message;
    this.message.error(apiMessage ?? this.i18n.translate('LOGISTICS.ERRORS.GENERIC'));
  }

  private newLine() {
    return this.fb.group({
      product_id: this.fb.control('', Validators.required),
      quantity: this.fb.control(1, [Validators.required, Validators.min(0.0001)]),
    });
  }
}
