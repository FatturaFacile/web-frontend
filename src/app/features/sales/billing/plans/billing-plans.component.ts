import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import {
  FormArray,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  BillingApiService,
  BillingPlan,
  BillingPlanFilterParams,
  BillingPlanItem,
  BillingPlanPayload,
  CoreOrder,
  FetchGridModel,
  I18nService,
  PermissionsService,
  SalesCycleApiService,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, MoneyPipe, PageHeaderComponent, TableColumnDef, TranslatePipe, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { DECIMAL_PATTERN, maxNumber } from '../../cycle/shared/document-lines-editor.component';
import { apiErrorText } from '../../cycle/shared/sales-api-helpers';
import { statusColor, todayIso } from '../../cycle/shared/sales-status';

/** Billing plans of sales orders: milestones invoiced one by one or run for every item due. */
@Component({
  selector: 'app-billing-plans',
  styleUrl: './billing-plans.component.scss',
  imports: [
    BaseTableComponent,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    ModalActionsDirective,
    IconActionDirective,
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './billing-plans.component.html',
})
export class BillingPlansComponent {
  private readonly api = inject(BillingApiService);
  private readonly salesApi = inject(SalesCycleApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly permissions = inject(PermissionsService);
  protected readonly currency = inject(AuthStore).activeCurrency;
  protected readonly canWrite = computed(() => this.permissions.canWrite('invoicing'));
  protected readonly statusColor = statusColor;

  protected readonly grid = new FetchGridModel<BillingPlan, BillingPlanFilterParams>((query) =>
    this.api.getBillingPlans(query),
  );
  protected readonly selected = signal<BillingPlan | null>(null);
  protected readonly drawerOpen = signal(false);
  protected readonly createOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly orders = signal<CoreOrder[]>([]);
  protected runUpTo = todayIso();

  protected readonly items: FormArray = this.fb.array([]);
  protected readonly form = this.fb.group({ sales_order_id: ['', Validators.required] });

  private readonly numberTpl = viewChild<TemplateRef<{ $implicit: BillingPlan; value: unknown }>>('numberTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: BillingPlan; value: unknown }>>('statusTpl');
  private readonly totalTpl = viewChild<TemplateRef<{ $implicit: BillingPlan; value: unknown }>>('totalTpl');
  private readonly billedTpl = viewChild<TemplateRef<{ $implicit: BillingPlan; value: unknown }>>('billedTpl');
  private readonly remainingTpl = viewChild<TemplateRef<{ $implicit: BillingPlan; value: unknown }>>('remainingTpl');

  protected readonly columns = computed<TableColumnDef<BillingPlan>[]>(() => {
    this.i18n.currentLanguage();
    const statusKey = (value: string) => this.i18n.translate('SC.PLANS.STATUS_' + value);
    return [
      { key: 'schedule_number', header: this.i18n.translate('SC.COMMON.NUMBER'), customCellTemplate: this.numberTpl() },
      { key: 'status', valueGetter: (row) => statusKey(row.status), valueLabel: statusKey, header: this.i18n.translate('SC.COMMON.STATUS'), customCellTemplate: this.statusTpl() },
      { key: 'total_amount', header: this.i18n.translate('SC.PLANS.TOTAL'), align: 'right', customCellTemplate: this.totalTpl() },
      { key: 'billed_amount', header: this.i18n.translate('SC.PLANS.BILLED'), align: 'right', customCellTemplate: this.billedTpl() },
      { key: 'remaining_amount', header: this.i18n.translate('SC.PLANS.REMAINING'), align: 'right', customCellTemplate: this.remainingTpl() },
      { key: 'next_billing_date', header: this.i18n.translate('SC.PLANS.NEXT_BILLING') },
    ];
  });

  protected filterStatus(status: string | null): void {
    this.grid.setFilter({ status: status ?? undefined });
  }

  protected view(plan: BillingPlan): void {
    this.selected.set(plan);
    this.drawerOpen.set(true);
    this.refresh(plan.id);
  }

  private refresh(id: string): void {
    this.api.getBillingPlan(id).subscribe({
      next: (res) => this.selected.set(res.data),
      error: (err: unknown) => this.message.error(apiErrorText(err)),
    });
  }

  protected openCreate(): void {
    this.form.reset({ sales_order_id: '' });
    this.items.clear();
    this.addItem();
    this.createOpen.set(true);
    this.salesApi.getOrders({ per_page: 100 }).subscribe({
      next: (res) => this.orders.set((res.data ?? []).filter((o) => o.status !== 'cancelled' && o.status !== 'draft')),
      error: () => this.orders.set([]),
    });
  }

  protected addItem(): void {
    this.items.push(
      this.fb.group({
        name: ['', [Validators.required, Validators.maxLength(150)]],
        percentage: ['', [Validators.pattern(DECIMAL_PATTERN), maxNumber(100)]],
        amount: ['', [Validators.pattern(DECIMAL_PATTERN)]],
        target_date: [todayIso(), Validators.required],
      }),
    );
  }

  protected removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index);
    }
  }

  protected canSubmit(): boolean {
    const rows = this.items.getRawValue() as Record<string, string>[];
    return (
      this.form.valid &&
      this.items.valid &&
      rows.every((r) => !!r['percentage'] !== !!r['amount'])
    );
  }

  protected submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    const payload: BillingPlanPayload = {
      sales_order_id: this.form.getRawValue().sales_order_id,
      items: (this.items.getRawValue() as Record<string, string>[]).map((r) => ({
        name: r['name'],
        percentage: r['percentage'] || null,
        amount: r['amount'] || null,
        target_date: r['target_date'],
      })),
    };
    this.saving.set(true);
    this.api.createBillingPlan(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.message.success(this.i18n.translate('SC.COMMON.SAVED'));
        this.grid.setPage(1);
        this.grid.reload();
        this.view(res.data);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.message.error(apiErrorText(err));
      },
    });
  }

  protected invoiceItem(plan: BillingPlan, item: BillingPlanItem): void {
    this.api.invoiceBillingPlanItem(plan.id, item.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('SC.BILLING.INVOICE_CREATED'));
        this.refresh(plan.id);
        this.grid.reload();
      },
      error: (err: unknown) => this.message.error(apiErrorText(err)),
    });
  }

  protected cancel(plan: BillingPlan): void {
    this.api.cancelBillingPlan(plan.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('SC.PLANS.CANCELLED'));
        this.refresh(plan.id);
        this.grid.reload();
      },
      error: (err: unknown) => this.message.error(apiErrorText(err)),
    });
  }

  protected runDue(): void {
    this.api.runBillingPlans(this.runUpTo).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('SC.PLANS.RUN_DONE'));
        this.grid.reload();
      },
      error: (err: unknown) => this.message.error(apiErrorText(err)),
    });
  }
}
