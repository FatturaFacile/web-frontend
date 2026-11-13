import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import {
  FetchGridModel,
  I18nService,
  PermissionsService,
  RevenueContract,
  SubscriptionApiService,
  SubscriptionBillingRun,
  SubscriptionRevenueForecast,
  UsageEvent,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { ContractChangesComponent } from './contract-changes.component';

const DECIMAL = /^\d+(\.\d{1,4})?$/;

/** Subscription contract changes, metered usage, billing runs and revenue recognition. */
@Component({
  selector: 'app-subscription-billing',
  styleUrl: './subscription-billing.scss',
  imports: [
    BaseTableComponent,
    IconActionDirective,
    ModalActionsDirective,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzModalModule,
    NzIconModule,
    NzInputModule,
    NzPopconfirmModule,
    NzTabsModule,
    ContractChangesComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './subscription-billing.component.html',
})
export class SubscriptionBillingComponent {
  private readonly api = inject(SubscriptionApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('subscriptions'));

  // Usage
  protected readonly usageGrid = new FetchGridModel<UsageEvent>((query) => this.api.getUsageEvents(query));
  protected readonly usageColumns = signal<TableColumnDef<UsageEvent>[]>([
    { key: 'metric_code', header: 'SUBX.USAGE.METRIC' },
    { key: 'subscription_item_id', header: 'SUBX.USAGE.ITEM_ID' },
    { key: 'quantity', header: 'SUBX.USAGE.QUANTITY', align: 'right' },
    { key: 'event_timestamp', header: 'SUBX.USAGE.TIMESTAMP' },
  ]);
  protected itemId = '';
  protected metricCode = '';
  protected usageQuantity = '';
  protected idempotencyKey = '';

  // Billing runs
  protected readonly runGrid = new FetchGridModel<SubscriptionBillingRun>((query) => this.api.getBillingRuns(query));
  protected readonly runColumns = signal<TableColumnDef<SubscriptionBillingRun>[]>([
    { key: 'execution_date', header: 'SUBX.RUNS.RUN_DATE' },
    { key: 'status', header: 'SUBX.COMMON.STATUS' },
    { key: 'successful_invoices_count', header: 'SUBX.RUNS.INVOICES', align: 'right' },
  ]);
  protected readonly selectedRun = signal<SubscriptionBillingRun | null>(null);
  /** Today (YYYY-MM-DD): the API accepts run_date and period_date up to today (before_or_equal:today). */
  protected readonly today = new Date().toLocaleDateString('en-CA');
  protected runDate = '';
  protected lookaheadDays = '';

  // Revenue
  protected readonly revenueGrid = new FetchGridModel<RevenueContract>((query) => this.api.getRevenueContracts(query));
  protected readonly revenueColumns = signal<TableColumnDef<RevenueContract>[]>([
    { key: 'contract_number', header: 'SUBX.REVENUE.CONTRACT_NUMBER' },
    { key: 'status', header: 'SUBX.COMMON.STATUS' },
    { key: 'inception_date', header: 'SUBX.REVENUE.INCEPTION_DATE' },
    { key: 'total_transaction_price', header: 'SUBX.REVENUE.TRANSACTION_PRICE', align: 'right' },
  ]);
  protected readonly forecast = signal<SubscriptionRevenueForecast | null>(null);
  protected periodDate = '';
  protected forecastMonths = '6';

  protected usageValid(): boolean {
    return this.itemId.trim().length > 0 && this.metricCode.trim().length > 0 && DECIMAL.test(this.usageQuantity);
  }

  protected recordUsage(): void {
    this.api
      .recordUsage({
        subscription_item_id: this.itemId.trim(),
        metric_code: this.metricCode.trim(),
        quantity: this.usageQuantity,
        idempotency_key: this.idempotencyKey.trim() || null,
      })
      .subscribe({
        next: () => {
          this.message.success(this.i18n.translate('SUBX.USAGE.RECORDED'));
          this.usageQuantity = '';
          this.idempotencyKey = '';
          this.usageGrid.reload();
        },
      });
  }

  protected get runDateInvalid(): boolean {
    return this.runDate > this.today;
  }

  protected get periodDateInvalid(): boolean {
    return this.periodDate > this.today;
  }

  protected runBilling(): void {
    if (this.runDateInvalid) {
      return;
    }
    this.api
      .runBilling({
        run_date: this.runDate || null,
        lookahead_days: this.lookaheadDays ? Number(this.lookaheadDays) : null,
      })
      .subscribe({
        next: () => {
          this.message.success(this.i18n.translate('SUBX.RUNS.DONE'));
          this.runGrid.reload();
        },
      });
  }

  protected viewRun(run: SubscriptionBillingRun): void {
    this.selectedRun.set(run);
    this.api.getBillingRun(run.id).subscribe({ next: (res) => this.selectedRun.set(res.data) });
  }

  protected runJson(): string {
    return JSON.stringify(this.selectedRun() ?? {}, null, 2);
  }

  constructor() {
    this.loadForecast();
  }

  protected loadForecast(): void {
    const months = Number(this.forecastMonths);
    this.api.getSubscriptionForecast(months > 0 ? months : undefined).subscribe({
      next: (res) => this.forecast.set(res.data),
    });
  }

  protected forecastJson(): string {
    return JSON.stringify(this.forecast() ?? {}, null, 2);
  }

  protected recognize(): void {
    if (this.periodDateInvalid) {
      return;
    }
    this.api.recognizeRevenue(this.periodDate || undefined).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('SUBX.REVENUE.RECOGNIZED'));
        this.revenueGrid.reload();
        this.loadForecast();
      },
    });
  }
}
