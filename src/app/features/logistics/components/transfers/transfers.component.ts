import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
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
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { TransferFacade } from '../../services/delivery-note.facade';
import {
  availableActions,
  isValidDestination,
  isValidOrigin,
  MOVEMENT_TYPE_FILTERS,
  MovementTypeFilter,
  movementTypeFromParams,
  movementTypeParams,
  outstandingQty,
  STATUS_FILTERS,
  StatusFilter,
  statusFilterFromParam,
  statusFilterParam,
  toQty,
  TransferAction,
} from '../../logistics.rules';
import {
  apiErrorMessage,
  DISCREPANCY_COLOR,
  discrepancyKey,
  movementTypeKey,
  statusFilterKey,
  TRANSFER_STATUS_COLOR,
  transferPurposeKey,
  transferStatusKey,
} from '../../logistics.ui';
import { TransferDispatchDrawerComponent } from './transfer-dispatch-drawer.component';
import { TransferReceiptModalComponent } from './transfer-receipt-modal.component';
import { TransferTrackerComponent } from './transfer-tracker.component';

@Component({
  selector: 'app-transfers',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    TransferDispatchDrawerComponent,
    TransferReceiptModalComponent,
    TransferTrackerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  // ---- list filters
  protected readonly movementType = computed(() =>
    movementTypeFromParams(this.facade.filterParams()),
  );
  protected readonly statusFilter = computed(() =>
    statusFilterFromParam(this.facade.filterParams().status),
  );
  protected readonly movementOptions = computed(() =>
    MOVEMENT_TYPE_FILTERS.map((value) => ({
      value,
      label: this.i18n.translate(movementTypeKey(value)),
    })),
  );
  protected readonly statusOptions = computed(() =>
    STATUS_FILTERS.map((value) => ({
      value,
      label: this.i18n.translate(statusFilterKey(value)),
    })),
  );

  /** Actions allowed per transfer: state machine combined with the user's RBAC. */
  protected readonly rowActions = computed(
    () =>
      new Map(
        this.facade
          .items()
          .map((t) => [t.id, availableActions(t, (p) => this.auth.can(p))] as const),
      ),
  );

  // ---- create drawer
  protected readonly createVisible = signal(false);
  protected readonly createForm = this.fb.group({
    purpose: this.fb.control<TransferPurpose>('inter_warehouse', Validators.required),
    origin_warehouse_id: this.fb.control('', Validators.required),
    destination_warehouse_id: this.fb.control('', Validators.required),
    notes: this.fb.control(''),
    lines: this.fb.array([this.newLine()]),
  });
  private readonly purpose = signal<TransferPurpose>('inter_warehouse');
  private readonly originId = signal('');

  // ---- detail drawer
  protected readonly detail = signal<StockTransferResource | null>(null);
  protected readonly detailActions = computed(() => {
    const d = this.detail();
    return d ? availableActions(d, (p) => this.auth.can(p)) : [];
  });
  protected readonly canResolve = computed(() =>
    this.auth.can(LOGISTICS_PERMISSIONS.approveTransfers),
  );
  protected readonly discrepancyOptions = computed(() =>
    DISCREPANCY_RESOLUTIONS.map((value) => ({
      value,
      label: this.i18n.translate(discrepancyKey(value)),
    })),
  );

  // ---- execution drawers
  protected readonly dispatchTarget = signal<StockTransferResource | null>(null);
  protected readonly receiveTarget = signal<StockTransferResource | null>(null);

  protected readonly purposeOptions = computed(() =>
    TRANSFER_PURPOSES.map((value) => ({
      value,
      label: this.i18n.translate(transferPurposeKey(value)),
    })),
  );
  protected readonly originOptions = computed(() => {
    const purpose = this.purpose();
    return this.warehouses()
      .filter((w) => isValidOrigin(purpose, w))
      .map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }));
  });
  protected readonly destinationOptions = computed(() => {
    const purpose = this.purpose();
    const origin = this.warehouses().find((w) => w.id === this.originId());
    return this.warehouses()
      .filter((w) => w.id !== origin?.id && isValidDestination(purpose, w, origin))
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
      this.createForm.controls.origin_warehouse_id.setValue('');
      this.createForm.controls.destination_warehouse_id.setValue('');
    });
    this.createForm.controls.origin_warehouse_id.valueChanges.subscribe((id) => {
      this.originId.set(id);
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

  protected outstanding(line: Parameters<typeof outstandingQty>[0]): number {
    return outstandingQty(line);
  }

  protected damaged(value: number | string | undefined): number {
    return toQty(value);
  }

  protected setMovementType(type: MovementTypeFilter | null): void {
    this.facade.setFilter(movementTypeParams(type));
  }

  protected setStatusFilter(filter: StatusFilter | null): void {
    this.facade.setFilter({ status: statusFilterParam(filter) });
  }

  protected can(actions: readonly TransferAction[] | undefined, action: TransferAction): boolean {
    return actions?.includes(action) ?? false;
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
        notes: v.notes.trim() === '' ? undefined : v.notes.trim(),
        lines: v.lines.map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity) })),
      })
      .subscribe({
        next: () => {
          this.createVisible.set(false);
          this.done('LOGISTICS.TRANSFER.MESSAGES.CREATED');
        },
        error: (err: unknown) => this.fail(err),
      });
  }

  protected openDetail(transfer: StockTransferResource): void {
    this.api.getTransfer(transfer.id).subscribe({
      next: (res) => this.detail.set(res.data),
      error: (err: unknown) => this.fail(err),
    });
  }

  /** Runs a workflow action; ship and receive open the execution drawers instead of acting directly. */
  protected run(action: TransferAction, transfer: StockTransferResource): void {
    switch (action) {
      case 'ship':
        this.load(transfer, (full) => this.dispatchTarget.set(full));
        return;
      case 'receive':
        this.load(transfer, (full) => this.receiveTarget.set(full));
        return;
      case 'resolve':
        this.openDetail(transfer);
        return;
      case 'approve':
        this.act(this.api.approveTransfer(transfer.id), 'LOGISTICS.TRANSFER.MESSAGES.APPROVED');
        return;
      case 'close':
        this.act(this.api.closeTransfer(transfer.id), 'LOGISTICS.TRANSFER.MESSAGES.CLOSED');
        return;
      case 'cancel':
        this.act(this.api.cancelTransfer(transfer.id), 'LOGISTICS.TRANSFER.MESSAGES.CANCELLED');
        return;
    }
  }

  protected onShipped(): void {
    this.dispatchTarget.set(null);
    this.afterChange();
  }

  protected onReceived(): void {
    this.receiveTarget.set(null);
    this.afterChange();
  }

  protected resolve(discrepancy: TransferDiscrepancy, resolution: DiscrepancyResolution): void {
    const current = this.detail();
    if (!current) return;
    this.act(
      this.api.resolveTransferDiscrepancy(current.id, discrepancy.id, resolution),
      'LOGISTICS.DISCREPANCY.MESSAGES.RESOLVED',
    );
  }

  private load(transfer: StockTransferResource, then: (full: StockTransferResource) => void): void {
    this.api.getTransfer(transfer.id).subscribe({
      next: (res) => then(res.data),
      error: (err: unknown) => this.fail(err),
    });
  }

  private act(request: Observable<unknown>, key: string): void {
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.message.success(this.i18n.translate(key));
        this.afterChange();
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  private afterChange(): void {
    this.busy.set(false);
    this.facade.reload();
    const current = this.detail();
    if (current) this.openDetail(current);
  }

  private done(key: string): void {
    this.busy.set(false);
    this.message.success(this.i18n.translate(key));
    this.facade.reload();
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    this.message.error(apiErrorMessage(err) ?? this.i18n.translate('LOGISTICS.ERRORS.GENERIC'));
  }

  private newLine() {
    return this.fb.group({
      product_id: this.fb.control('', Validators.required),
      quantity: this.fb.control(1, [Validators.required, Validators.min(0.0001)]),
    });
  }
}
