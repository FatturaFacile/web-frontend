import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  BillingApiService,
  CoreOrder,
  CustomerAging,
  CustomerCreditProfile,
  CustomerLedgerEntry,
  I18nService,
  SalesCycleApiService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import {
  apiErrorText,
  CREDIT_MANAGER_ROLES,
  creditHoldIdOf,
  hasAnyRole,
  isForbidden,
} from '../shared/sales-api-helpers';
import { SalesLookupsService } from '../shared/sales-lookups.service';

const DECIMAL = /^\d+(\.\d{1,2})?$/;

/** Credit profile of a customer (limit, exposure, hold), its ledger statement and aging buckets. */
@Component({
  selector: 'app-customer-credit',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './customer-credit.component.html',
  styleUrl: '../shared/cycle-page.scss',
})
export class CustomerCreditComponent implements OnInit {
  private readonly api = inject(BillingApiService);
  private readonly ordersApi = inject(SalesCycleApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly authStore = inject(AuthStore);
  protected readonly lookups = inject(SalesLookupsService);
  protected readonly currency = this.authStore.activeCurrency;
  protected readonly canManage = computed(() => hasAnyRole(this.authStore.activeRoles(), CREDIT_MANAGER_ROLES));

  protected customerId: string | null = null;
  protected newLimit = '';
  protected readonly profile = signal<CustomerCreditProfile | null>(null);
  protected readonly statement = signal<CustomerLedgerEntry[]>([]);
  protected readonly aging = signal<[string, unknown][]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly forbidden = signal(false);
  /** Orders of the customer parked by the credit check. */
  protected readonly heldOrders = signal<CoreOrder[]>([]);
  protected readonly releasingId = signal<string | null>(null);

  ngOnInit(): void {
    this.lookups.load();
  }

  protected load(customerId: string | null): void {
    this.customerId = customerId;
    this.profile.set(null);
    this.statement.set([]);
    this.aging.set([]);
    this.heldOrders.set([]);
    this.forbidden.set(false);
    if (!customerId) {
      return;
    }
    this.loadHeldOrders(customerId);
    this.loading.set(true);
    this.api.getCustomerCredit(customerId).subscribe({
      next: (res) => {
        this.profile.set(res.data);
        this.newLimit = res.data.credit_limit;
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.forbidden.set(isForbidden(err));
      },
    });
    this.api.getCustomerStatement(customerId, { per_page: 50 }).subscribe({
      next: (res) => this.statement.set(res.data ?? []),
      error: () => this.statement.set([]),
    });
    this.api.getCustomerAging(customerId).subscribe({
      next: (res) => this.aging.set(Object.entries(res.data ?? ({} as CustomerAging))),
      error: () => this.aging.set([]),
    });
  }

  private loadHeldOrders(customerId: string): void {
    this.ordersApi.getOrders({ status: 'on_hold', contact_id: customerId, per_page: 50 }).subscribe({
      next: (res) => this.heldOrders.set(res.data ?? []),
      error: () => this.heldOrders.set([]),
    });
  }

  /** Id of the hold of an order on hold; without it the order cannot be released from here. */
  protected holdIdOf(order: CoreOrder): string | null {
    return creditHoldIdOf(order);
  }

  /** Releases the credit hold of an order (same endpoint as the order detail): managers only, 403 otherwise. */
  protected releaseHold(order: CoreOrder): void {
    const holdId = this.holdIdOf(order);
    if (!holdId || !this.customerId) {
      return;
    }
    const customerId = this.customerId;
    this.releasingId.set(order.id);
    this.api.releaseCreditHold(holdId).subscribe({
      next: () => {
        this.releasingId.set(null);
        this.message.success(this.i18n.translate('SC.ORDERS.HOLD_RELEASED'));
        this.load(customerId);
      },
      error: (err: unknown) => {
        this.releasingId.set(null);
        this.message.error(
          isForbidden(err) ? this.i18n.translate('SC.CREDIT.FORBIDDEN') : apiErrorText(err),
        );
      },
    });
  }

  protected limitValid(): boolean {
    return DECIMAL.test(this.newLimit);
  }

  protected saveLimit(): void {
    if (!this.customerId || !this.limitValid()) {
      return;
    }
    this.saving.set(true);
    this.api.setCustomerCreditLimit(this.customerId, this.newLimit).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.profile.set(res.data);
        this.message.success(this.i18n.translate('SC.CREDIT.LIMIT_SAVED'));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.message.error(
          isForbidden(err) ? this.i18n.translate('SC.CREDIT.FORBIDDEN') : apiErrorText(err),
        );
      },
    });
  }

  protected display(value: unknown): string {
    return value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-');
  }
}
