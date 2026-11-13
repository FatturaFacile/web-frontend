import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
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
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  CreateSubscriptionPayload,
  FetchGridModel,
  isValidationError,
  SubscriptionApiService,
  SubscriptionContractFilterParams,
  SubscriptionContractResource,
  SubscriptionMetrics,
  SubscriptionPlanResource,
  TranslateService,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, MoneyPipe, PageHeaderComponent, TableColumnDef } from '@shared';
import { TranslatePipe } from '@shared';

@Component({
  selector: 'app-subscriptions',
  styleUrl: './subscriptions.component.scss',
  imports: [
    BaseTableComponent,
    IconActionDirective,
    ModalActionsDirective,
    TranslatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzStatisticModule,
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
})
export class SubscriptionsComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly subApi = inject(SubscriptionApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly authStore = inject(AuthStore);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly plans = signal<SubscriptionPlanResource[]>([]);
  readonly metrics = signal<SubscriptionMetrics | null>(null);

  protected readonly grid = new FetchGridModel<SubscriptionContractResource, SubscriptionContractFilterParams>((query) =>
    this.subApi.getContracts(query),
  );

  private readonly numberTpl = viewChild<TemplateRef<unknown>>('numberTpl');
  private readonly customerTpl = viewChild<TemplateRef<unknown>>('customerTpl');
  private readonly planTpl = viewChild<TemplateRef<unknown>>('planTpl');
  private readonly statusTpl = viewChild<TemplateRef<unknown>>('statusTpl');
  private readonly mrrTpl = viewChild<TemplateRef<unknown>>('mrrTpl');
  private readonly periodTpl = viewChild<TemplateRef<unknown>>('periodTpl');

  protected readonly columns = computed<TableColumnDef<SubscriptionContractResource>[]>(() => [
    { key: 'subscription_number', header: 'subscriptions.lblContract', customCellTemplate: this.numberTpl() },
    {
      key: 'customer_name',
      serverKey: 'customer.name',
      valueGetter: (row) => row.customer_name || row.customer_id,
      header: 'subscriptions.lblCustomer',
      customCellTemplate: this.customerTpl(),
    },
    {
      key: 'plan_name',
      serverKey: 'plan.name',
      valueGetter: (row) => row.plan_name ?? '',
      header: 'subscriptions.lblPlan',
      customCellTemplate: this.planTpl(),
    },
    { key: 'status', header: 'subscriptions.lblStatus', customCellTemplate: this.statusTpl() },
    { key: 'mrr', header: 'subscriptions.lblMrr', align: 'right', customCellTemplate: this.mrrTpl() },
    { key: 'current_period_start', header: 'subscriptions.lblCurrentPeriod', customCellTemplate: this.periodTpl() },
  ]);

  // Modals
  readonly createModalVisible = signal(false);
  readonly runningDunning = signal(false);

  readonly contractForm = this.fb.group({
    customer_id: this.fb.control('', [Validators.required]),
    plan_id: this.fb.control('', [Validators.required]),
    name: this.fb.control('', [Validators.maxLength(255)]),
    start_date: this.fb.control('', [Validators.required]),
    quantity: this.fb.control<number>(1, [Validators.min(1), Validators.max(1000000)]),
    trial_days: this.fb.control<number>(0, [Validators.min(0), Validators.max(730)]),
    auto_renew: this.fb.control<boolean>(true),
  });

  ngOnInit(): void {
    this.loadMetrics();
    this.loadPlans();
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

  onSearch(event: Event): void {
    const search = (event.target as HTMLInputElement).value;
    this.grid.setFilter({ search: search || undefined });
  }

  onStatusChange(status: string | null): void {
    this.grid.setFilter({ status: status ?? undefined });
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
        this.message.success(this.translate.instant('subscriptions.msgSubscriptionContractCreated'));
        this.grid.reload();
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
        this.message.success(this.translate.instant('subscriptions.msgSubscriptionActivated'));
        this.grid.reload();
        this.loadMetrics();
      },
      error: () => undefined,
    });
  }

  pause(contract: SubscriptionContractResource): void {
    this.subApi.pauseContract(contract.id, { reason: 'Customer requested pause' }).subscribe({
      next: () => {
        this.message.info(this.translate.instant('subscriptions.msgSubscriptionPaused'));
        this.grid.reload();
        this.loadMetrics();
      },
      error: () => undefined,
    });
  }

  reactivate(contract: SubscriptionContractResource): void {
    this.subApi.reactivateContract(contract.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('subscriptions.msgSubscriptionResumed'));
        this.grid.reload();
        this.loadMetrics();
      },
      error: () => undefined,
    });
  }

  billNow(contract: SubscriptionContractResource): void {
    this.subApi.billContract(contract.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('subscriptions.msgInvoiceGeneratedForCurrentBillingPeriod'));
        this.grid.reload();
      },
      error: () => undefined,
    });
  }

  cancel(contract: SubscriptionContractResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('subscriptions.dlgCancelSubscription'),
      nzContent: this.translate.instant('subscriptions.dlgAreYouSureYouWantTo', { contract_number: contract.subscription_number }),
      nzOkText: this.translate.instant('subscriptions.dlgCancelSubscription'),
      nzOkDanger: true,
      nzOnOk: () => {
        this.subApi.cancelContract(contract.id, { cancel_at_period_end: true }).subscribe({
          next: () => {
            this.message.success(this.translate.instant('subscriptions.msgSubscriptionScheduledForCancellation'));
            this.grid.reload();
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
        this.message.success(this.translate.instant('subscriptions.msgAutomatedDunningRunExecuted'));
      },
      error: () => {
        this.runningDunning.set(false);
        this.message.error(this.translate.instant('subscriptions.msgFailedToRunDunningProcess'));
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
