import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  AuthStore,
  BillingApiService,
  CoreOrder,
  CoreQuote,
  I18nService,
  OrderAvailability,
  PermissionsService,
  SalesCycleApiService,
} from '@core';
import {
  BaseTableComponent,
  IconActionDirective,
  ModalActionsDirective,
  MoneyPipe,
  PageHeaderComponent,
  TableColumnDef,
  TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { CycleOrdersFacade } from '../cycle.facades';
import { DeliveryNoteFormModalComponent, DeliveryNoteSource } from '../shared/delivery-note-form-modal.component';
import { DocumentFormModalComponent } from '../shared/document-form-modal.component';
import { DocumentLinesViewComponent } from '../shared/document-lines-view.component';
import { apiErrorText, CREDIT_MANAGER_ROLES, creditHoldIdOf, hasAnyRole } from '../shared/sales-api-helpers';
import { SalesLookupsService } from '../shared/sales-lookups.service';
import { statusColor, statusKey } from '../shared/sales-status';
import { OrderBillingMode, OrderBillingModalComponent } from './order-billing-modal.component';

const ORDER_STATUSES = ['draft', 'on_hold', 'confirmed', 'in_production', 'shipped', 'completed', 'cancelled'];
const FULFILLABLE = ['confirmed', 'approved', 'in_production', 'shipped'];

@Component({
  selector: 'app-cycle-orders',
  styleUrl: './orders.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    ModalActionsDirective,
    IconActionDirective,
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    BaseTableComponent,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    DeliveryNoteFormModalComponent,
    DocumentFormModalComponent,
    DocumentLinesViewComponent,
    OrderBillingModalComponent,
  ],
  providers: [CycleOrdersFacade],
  templateUrl: './orders.component.html',
})
export class CycleOrdersComponent {
  protected readonly facade = inject(CycleOrdersFacade);
  private readonly api = inject(SalesCycleApiService);
  private readonly billingApi = inject(BillingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly lookups = inject(SalesLookupsService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('invoicing'));
  private readonly authStore = inject(AuthStore);
  protected readonly canReleaseHold = computed(() =>
    hasAnyRole(this.authStore.activeRoles(), CREDIT_MANAGER_ROLES),
  );

  protected readonly statuses = ORDER_STATUSES;
  protected readonly statusColor = statusColor;
  protected readonly statusKey = statusKey;

  protected readonly selected = signal<CoreOrder | null>(null);
  protected readonly drawerOpen = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<CoreOrder | null>(null);
  protected readonly ddtOpen = signal(false);
  protected readonly billingOpen = signal(false);
  protected readonly billingMode = signal<OrderBillingMode>('partial');
  protected readonly cancelOpen = signal(false);
  protected readonly working = signal(false);
  protected readonly availability = signal<OrderAvailability | null>(null);
  protected cancelReason = '';
  protected warehouseId: string | null = null;

  private readonly numberTpl = viewChild<TemplateRef<{ $implicit: CoreOrder; value: unknown }>>('numberTpl');
  private readonly customerTpl = viewChild<TemplateRef<{ $implicit: CoreOrder; value: unknown }>>('customerTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: CoreOrder; value: unknown }>>('statusTpl');
  private readonly inventoryTpl = viewChild<TemplateRef<{ $implicit: CoreOrder; value: unknown }>>('inventoryTpl');
  private readonly totalTpl = viewChild<TemplateRef<{ $implicit: CoreOrder; value: unknown }>>('totalTpl');

  protected readonly columns = computed<TableColumnDef<CoreOrder>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'order_number', header: this.i18n.translate('SC.COMMON.NUMBER'), width: '150px', customCellTemplate: this.numberTpl() },
      { key: 'contact', serverKey: 'contact.name', valueGetter: (row) => this.lookups.contactName(row.contact_id, row.contact), header: this.i18n.translate('SC.COMMON.CUSTOMER'), customCellTemplate: this.customerTpl() },
      { key: 'date', header: this.i18n.translate('SC.COMMON.DATE'), width: '120px' },
      { key: 'status', valueGetter: (row) => this.i18n.translate(this.statusKey(row.status)), valueLabel: (value) => this.i18n.translate(this.statusKey(value)), header: this.i18n.translate('SC.COMMON.STATUS'), width: '140px', customCellTemplate: this.statusTpl() },
      { key: 'inventory_status', valueGetter: (row) => this.i18n.translate(this.statusKey(row.inventory_status)), valueLabel: (value) => this.i18n.translate(this.statusKey(value)), header: this.i18n.translate('SC.ORDERS.INVENTORY'), width: '160px', customCellTemplate: this.inventoryTpl() },
      { key: 'billing_status', header: this.i18n.translate('SC.ORDERS.BILLING'), width: '130px' },
      { key: 'total_gross', header: this.i18n.translate('SC.COMMON.TOTAL'), width: '140px', align: 'right', customCellTemplate: this.totalTpl() },
    ];
  });

  constructor() {
    this.lookups.load();
  }

  /** The credit hold of the order (`credit_hold_id` or the active entry of `holds`), when the API exposes it. */
  protected activeHoldId(order: CoreOrder): string | null {
    return creditHoldIdOf(order);
  }

  protected canFulfil(order: CoreOrder): boolean {
    return FULFILLABLE.includes(order.status);
  }

  protected view(order: CoreOrder): void {
    this.selected.set(order);
    this.availability.set(null);
    this.drawerOpen.set(true);
    this.refresh(order.id);
  }

  private refresh(id: string): void {
    this.api.getOrder(id).subscribe({
      next: (res) => this.selected.set(res.data),
      error: (err: unknown) => this.message.error(apiErrorText(err)),
    });
  }

  protected create(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected edit(order: CoreOrder): void {
    this.editing.set(order);
    this.formOpen.set(true);
  }

  protected onSaved(order: CoreOrder | CoreQuote): void {
    this.message.success(this.i18n.translate('SC.COMMON.SAVED'));
    this.facade.reload();
    if (this.drawerOpen()) {
      this.view(order as CoreOrder);
    }
  }

  protected ddtSource(order: CoreOrder): DeliveryNoteSource {
    return { kind: 'order', id: order.id, items: order.items ?? [] };
  }

  protected openBilling(mode: OrderBillingMode): void {
    this.billingMode.set(mode);
    this.billingOpen.set(true);
  }

  protected afterAction(order: CoreOrder): void {
    this.facade.reload();
    this.refresh(order.id);
  }

  protected confirm(order: CoreOrder): void {
    this.run(this.api.confirmOrder(order.id), order, (res) => {
      const confirmed = res.data as CoreOrder;
      this.message[confirmed.status === 'on_hold' ? 'warning' : 'success'](
        this.i18n.translate(confirmed.status === 'on_hold' ? 'SC.ORDERS.ON_HOLD_RESULT' : 'SC.ORDERS.CONFIRMED'),
      );
    });
  }

  protected reserve(order: CoreOrder): void {
    this.run(this.api.reserveOrder(order.id, this.warehouseId ?? undefined), order, () =>
      this.message.success(this.i18n.translate('SC.ORDERS.RESERVED')),
    );
  }

  protected loadAvailability(order: CoreOrder): void {
    this.api.getOrderAvailability(order.id, this.warehouseId ?? undefined).subscribe({
      next: (res) => this.availability.set(res.data),
      error: (err: unknown) => this.message.error(apiErrorText(err)),
    });
  }

  protected releaseHold(order: CoreOrder): void {
    const holdId = this.activeHoldId(order);
    if (!holdId) {
      return;
    }
    this.run(this.billingApi.releaseCreditHold(holdId), order, () =>
      this.message.success(this.i18n.translate('SC.ORDERS.HOLD_RELEASED')),
    );
  }

  protected openCancel(): void {
    this.cancelReason = '';
    this.cancelOpen.set(true);
  }

  protected submitCancel(order: CoreOrder): void {
    if (!this.cancelReason.trim()) {
      return;
    }
    this.run(this.api.cancelOrder(order.id, this.cancelReason.trim()), order, () => {
      this.cancelOpen.set(false);
      this.message.success(this.i18n.translate('SC.ORDERS.CANCELLED'));
    });
  }

  protected invoiceWhole(order: CoreOrder): void {
    this.run(this.api.invoiceOrder(order.id), order, () =>
      this.message.success(this.i18n.translate('SC.BILLING.INVOICE_CREATED')),
    );
  }

  protected remove(order: CoreOrder): void {
    this.run(this.api.deleteOrder(order.id), order, () => {
      this.drawerOpen.set(false);
      this.message.success(this.i18n.translate('SC.COMMON.DELETED'));
    });
  }

  private run(
    request: Observable<ApiResponse<unknown>>,
    order: CoreOrder,
    onSuccess: (res: ApiResponse<unknown>) => void,
  ): void {
    this.working.set(true);
    request.subscribe({
      next: (res) => {
        this.working.set(false);
        onSuccess(res);
        this.afterAction(order);
      },
      error: (err: unknown) => {
        this.working.set(false);
        const text = apiErrorText(err);
        if (text) {
          this.message.error(text);
        }
      },
    });
  }
}
