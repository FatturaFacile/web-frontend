import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import {
  I18nService,
  PermissionsService,
  RevenueContract,
  SubscriptionApiService,
  SubscriptionBillingRun,
  SubscriptionRevenueForecast,
  UsageEvent,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { ContractChangesComponent } from './contract-changes.component';

const DECIMAL = /^\d+(\.\d{1,4})?$/;

/** Subscription contract changes, metered usage, billing runs and revenue recognition. */
@Component({
  selector: 'app-subscription-billing',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzIconModule,
    NzInputModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTabsModule,
    ContractChangesComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './subscription-billing.component.html',
  styleUrl: './subscription-billing.scss',
})
export class SubscriptionBillingComponent {
  private readonly api = inject(SubscriptionApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('subscriptions'));

  // Usage
  protected readonly usage = signal<UsageEvent[]>([]);
  protected itemId = '';
  protected metricCode = '';
  protected usageQuantity = '';
  protected idempotencyKey = '';

  // Billing runs
  protected readonly runs = signal<SubscriptionBillingRun[]>([]);
  protected readonly selectedRun = signal<SubscriptionBillingRun | null>(null);
  protected runDate = '';
  protected lookaheadDays = '';

  // Revenue
  protected readonly revenueContracts = signal<RevenueContract[]>([]);
  protected readonly forecast = signal<SubscriptionRevenueForecast | null>(null);
  protected periodDate = '';
  protected forecastMonths = '6';

  constructor() {
    this.loadUsage();
    this.loadRuns();
    this.loadRevenue();
  }

  protected loadUsage(): void {
    this.api.getUsageEvents({ per_page: 25 }).subscribe({ next: (res) => this.usage.set(res.data ?? []) });
  }

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
          this.loadUsage();
        },
      });
  }

  protected loadRuns(): void {
    this.api.getBillingRuns({ per_page: 25 }).subscribe({ next: (res) => this.runs.set(res.data ?? []) });
  }

  protected runBilling(): void {
    this.api
      .runBilling({
        run_date: this.runDate || null,
        lookahead_days: this.lookaheadDays ? Number(this.lookaheadDays) : null,
      })
      .subscribe({
        next: () => {
          this.message.success(this.i18n.translate('SUBX.RUNS.DONE'));
          this.loadRuns();
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

  protected loadRevenue(): void {
    this.api.getRevenueContracts({ per_page: 25 }).subscribe({ next: (res) => this.revenueContracts.set(res.data ?? []) });
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
    this.api.recognizeRevenue(this.periodDate || undefined).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('SUBX.REVENUE.RECOGNIZED'));
        this.loadRevenue();
      },
    });
  }
}
