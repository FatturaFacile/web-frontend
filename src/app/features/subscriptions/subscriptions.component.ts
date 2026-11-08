import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  CreateSubscriptionPayload,
  isValidationError,
  SubscriptionApiService,
  SubscriptionContractFilterParams,
  SubscriptionContractResource,
  SubscriptionMetrics,
  SubscriptionPlanResource,
} from '@core';
import { MoneyPipe, PageHeaderComponent } from '@shared';

@Component({
  selector: 'app-subscriptions',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    NzBadgeModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzFormModule,
    NzModalModule,
    NzPopconfirmModule,
    NzIconModule,
    NzEmptyModule,
    NzSpaceModule,
    PageHeaderComponent,
    MoneyPipe,
  ],
  templateUrl: './subscriptions.component.html',
  styleUrl: './subscriptions.component.scss',
})
export class SubscriptionsComponent implements OnInit {
  private readonly subApi = inject(SubscriptionApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly authStore = inject(AuthStore);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly contracts = signal<SubscriptionContractResource[]>([]);
  readonly plans = signal<SubscriptionPlanResource[]>([]);
  readonly metrics = signal<SubscriptionMetrics | null>(null);
  readonly total = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(10);

  // Filters
  readonly searchTerm = signal('');
  readonly statusFilter = signal<string | null>(null);

  // Modals
  readonly createModalVisible = signal(false);
  readonly runningDunning = signal(false);

  readonly contractForm = this.fb.group({
    customer_id: this.fb.control('', [Validators.required]),
    plan_id: this.fb.control('', [Validators.required]),
    name: this.fb.control(''),
    start_date: this.fb.control('', [Validators.required]),
    quantity: this.fb.control<number>(1, [Validators.required, Validators.min(1)]),
    trial_days: this.fb.control<number>(0),
    auto_renew: this.fb.control<boolean>(true),
  });

  ngOnInit(): void {
    this.loadMetrics();
    this.loadPlans();
    this.loadContracts();
  }

  loadMetrics(): void {
    this.subApi.getMetrics().subscribe({
      next: (res) => this.metrics.set(res.data),
      error: () => this.metrics.set(null),
    });
  }

  loadPlans(): void {
    this.subApi.getPlans({ is_active: true }).subscribe({
      next: (res) => this.plans.set(res.data || []),
      error: () => this.plans.set([]),
    });
  }

  loadContracts(): void {
    this.loading.set(true);
    const params: SubscriptionContractFilterParams = {
      page: this.pageIndex(),
      per_page: this.pageSize(),
      search: this.searchTerm() || undefined,
      status: this.statusFilter() || undefined,
    };

    this.subApi.getContracts(params).subscribe({
      next: (res) => {
        this.contracts.set(res.data || []);
        this.total.set(res.meta?.total || (res.data || []).length);
        this.loading.set(false);
      },
      error: () => {
        this.contracts.set([]);
        this.total.set(0);
        this.loading.set(false);
      },
    });
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    this.pageIndex.set(params.pageIndex);
    this.pageSize.set(params.pageSize);
    this.loadContracts();
  }

  onSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchTerm.set(val);
    this.pageIndex.set(1);
    this.loadContracts();
  }

  onStatusChange(status: string | null): void {
    this.statusFilter.set(status);
    this.pageIndex.set(1);
    this.loadContracts();
  }

  openCreateModal(): void {
    this.contractForm.reset({
      customer_id: '',
      plan_id: this.plans()[0]?.id || '',
      name: '',
      start_date: new Date().toISOString().slice(0, 10),
      quantity: 1,
      trial_days: 0,
      auto_renew: true,
    });
    this.createModalVisible.set(true);
  }

  submitCreateContract(): void {
    if (this.contractForm.invalid) {
      this.contractForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formVal = this.contractForm.getRawValue();
    const payload: CreateSubscriptionPayload = {
      customer_id: formVal.customer_id,
      plan_id: formVal.plan_id,
      name: formVal.name || null,
      start_date: formVal.start_date,
      quantity: formVal.quantity,
      trial_days: formVal.trial_days || 0,
      auto_renew: formVal.auto_renew,
    };

    this.subApi.createContract(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.createModalVisible.set(false);
        this.message.success('Subscription contract created');
        this.loadContracts();
        this.loadMetrics();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (isValidationError(err)) {
          applyServerErrors(this.contractForm, err);
        }
      },
    });
  }

  activate(contract: SubscriptionContractResource): void {
    this.subApi.activateContract(contract.id).subscribe({
      next: () => {
        this.message.success('Subscription activated');
        this.loadContracts();
        this.loadMetrics();
      },
      error: () => undefined,
    });
  }

  pause(contract: SubscriptionContractResource): void {
    this.subApi.pauseContract(contract.id, { reason: 'Customer requested pause' }).subscribe({
      next: () => {
        this.message.info('Subscription paused');
        this.loadContracts();
        this.loadMetrics();
      },
      error: () => undefined,
    });
  }

  reactivate(contract: SubscriptionContractResource): void {
    this.subApi.reactivateContract(contract.id).subscribe({
      next: () => {
        this.message.success('Subscription resumed');
        this.loadContracts();
        this.loadMetrics();
      },
      error: () => undefined,
    });
  }

  billNow(contract: SubscriptionContractResource): void {
    this.subApi.billContract(contract.id).subscribe({
      next: () => {
        this.message.success('Invoice generated for current billing period');
        this.loadContracts();
      },
      error: () => undefined,
    });
  }

  cancel(contract: SubscriptionContractResource): void {
    this.modal.confirm({
      nzTitle: 'Cancel Subscription',
      nzContent: `Are you sure you want to cancel ${contract.contract_number}?`,
      nzOkText: 'Cancel Subscription',
      nzOkDanger: true,
      nzOnOk: () => {
        this.subApi.cancelContract(contract.id, { cancel_at_period_end: true }).subscribe({
          next: () => {
            this.message.success('Subscription scheduled for cancellation');
            this.loadContracts();
            this.loadMetrics();
          },
          error: () => undefined,
        });
      },
    });
  }

  triggerDunning(): void {
    this.runningDunning.set(true);
    this.subApi.runDunning().subscribe({
      next: () => {
        this.runningDunning.set(false);
        this.message.success('Automated dunning run executed');
      },
      error: () => {
        this.runningDunning.set(false);
        this.message.error('Failed to run dunning process');
      },
    });
  }

  getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'success';
      case 'trialing':
        return 'processing';
      case 'paused':
        return 'warning';
      case 'cancelled':
        return 'default';
      default:
        return 'cyan';
    }
  }
}
