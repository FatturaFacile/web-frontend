import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  CreatePurchaseOrderPayload,
  ProcurementApiService,
  PurchaseOrder,
  PurchaseOrderStatus,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-purchases',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CurrencyPipe,
    DatePipe,
    NzCardModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzGridModule,
    NzStatisticModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzFormModule,
    NzModalModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './purchases.component.html',
  styleUrl: './purchases.component.scss',
})
export class PurchasesComponent implements OnInit {
  protected readonly authStore = inject(AuthStore);
  private readonly procurementApi = inject(ProcurementApiService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly orders = signal<PurchaseOrder[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(10);
  readonly searchTerm = signal('');
  readonly selectedStatus = signal<PurchaseOrderStatus | undefined>(undefined);
  readonly createModalVisible = signal(false);

  readonly totalChfDisplay = computed(() => {
    const sum = this.orders()
      .filter((o) => o.currency === 'CHF')
      .reduce((acc, o) => acc + (o.total || 0), 0);
    return `CHF ${sum.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  });

  readonly totalEurDisplay = computed(() => {
    const sum = this.orders()
      .filter((o) => o.currency === 'EUR')
      .reduce((acc, o) => acc + (o.total || 0), 0);
    return `€ ${sum.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  });

  readonly orderForm = this.fb.group({
    supplier_name: this.fb.control('', [Validators.required]),
    channel: this.fb.control<'SDI' | 'QR-Bill' | 'Standard'>('QR-Bill', [Validators.required]),
    currency: this.fb.control<'CHF' | 'EUR'>('CHF', [Validators.required]),
    item_description: this.fb.control('', [Validators.required]),
    quantity: this.fb.control(1, [Validators.required, Validators.min(1)]),
    unit_price: this.fb.control(0, [Validators.required, Validators.min(0)]),
  });

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading.set(true);
    this.procurementApi
      .getPurchaseOrders({
        page: this.pageIndex(),
        per_page: this.pageSize(),
        search: this.searchTerm() || undefined,
        status: this.selectedStatus(),
      })
      .subscribe({
        next: (res) => {
          this.orders.set(res.data || []);
          this.total.set(res.meta?.total || (res.data || []).length);
          this.loading.set(false);
        },
        error: () => {
          this.orders.set([]);
          this.total.set(0);
          this.loading.set(false);
        },
      });
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    this.pageIndex.set(params.pageIndex);
    this.pageSize.set(params.pageSize);
    this.loadOrders();
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.pageIndex.set(1);
    this.loadOrders();
  }

  onStatusChange(status: PurchaseOrderStatus | undefined): void {
    this.selectedStatus.set(status);
    this.pageIndex.set(1);
    this.loadOrders();
  }

  submitApproval(order: PurchaseOrder): void {
    this.procurementApi.submitApproval(order.id).subscribe({
      next: () => {
        this.message.success(`Ordine ${order.order_number} sottomesso per approvazione`);
        this.loadOrders();
      },
    });
  }

  approve(order: PurchaseOrder): void {
    this.procurementApi.approvePurchaseOrder(order.id).subscribe({
      next: () => {
        this.message.success(`Ordine ${order.order_number} approvato`);
        this.loadOrders();
      },
    });
  }

  reject(order: PurchaseOrder): void {
    this.procurementApi.rejectPurchaseOrder(order.id, 'Rifiutato da operatore').subscribe({
      next: () => {
        this.message.success(`Ordine ${order.order_number} rifiutato`);
        this.loadOrders();
      },
    });
  }

  openCreateModal(): void {
    this.orderForm.reset({
      supplier_name: '',
      channel: this.authStore.activeJurisdiction() === 'CH' ? 'QR-Bill' : 'SDI',
      currency: this.authStore.activeCurrency(),
      item_description: '',
      quantity: 1,
      unit_price: 0,
    });
    this.createModalVisible.set(true);
  }

  submitCreateOrder(): void {
    if (this.orderForm.invalid) {
      this.orderForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formVal = this.orderForm.getRawValue();
    const payload: CreatePurchaseOrderPayload = {
      supplier_id: 'sup-' + Date.now(),
      supplier_name: formVal.supplier_name,
      channel: formVal.channel,
      currency: formVal.currency,
      issue_date: new Date().toISOString().slice(0, 10),
      items: [
        {
          description: formVal.item_description,
          quantity: formVal.quantity,
          unit_price: formVal.unit_price,
        },
      ],
    };

    this.procurementApi.createPurchaseOrder(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.createModalVisible.set(false);
        this.message.success('Ordine di acquisto creato con successo');
        this.loadOrders();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  statusColor(status: PurchaseOrderStatus): string {
    switch (status) {
      case 'approved':
      case 'received':
        return 'success';
      case 'pending_approval':
        return 'warning';
      case 'ordered':
        return 'blue';
      case 'rejected':
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  }

  statusLabel(status: PurchaseOrderStatus): string {
    switch (status) {
      case 'approved':
        return 'Approvato';
      case 'pending_approval':
        return 'In Approvazione';
      case 'ordered':
        return 'Ordinato';
      case 'received':
        return 'Ricevuto';
      case 'rejected':
        return 'Rifiutato';
      case 'cancelled':
        return 'Annullato';
      case 'draft':
      default:
        return 'Bozza';
    }
  }
}
