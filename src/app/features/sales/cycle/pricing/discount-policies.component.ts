import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  DiscountPolicy,
  DiscountPolicyPayload,
  DiscountType,
  I18nService,
  PermissionsService,
  PriceLookupResult,
  SalesCycleApiService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { DECIMAL_PATTERN, maxNumber } from '../shared/document-lines-editor.component';
import { apiErrorText, hasAnyRole, SALES_MANAGER_ROLES } from '../shared/sales-api-helpers';
import { SalesLookupsService } from '../shared/sales-lookups.service';
import { todayIso } from '../shared/sales-status';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';

/** Discount policies (priority, stackable, auto-apply, customer) and the price lookup of a product. */
@Component({
  selector: 'app-discount-policies',
  styleUrl: './discount-policies.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    ModalActionsDirective,
    IconActionDirective,
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './discount-policies.component.html',
})
export class DiscountPoliciesComponent implements OnInit {
  private readonly api = inject(SalesCycleApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authStore = inject(AuthStore);
  private readonly permissions = inject(PermissionsService);
  protected readonly lookups = inject(SalesLookupsService);
  protected readonly canWrite = computed(
    () => this.permissions.canWrite('invoicing') && hasAnyRole(this.authStore.activeRoles(), SALES_MANAGER_ROLES),
  );

  protected readonly policies = signal<DiscountPolicy[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<DiscountPolicy | null>(null);
  protected readonly discountTypes: DiscountType[] = ['percentage', 'fixed_amount'];

  protected readonly rules: FormArray = this.fb.array([]);
  protected readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    discount_type: ['percentage' as DiscountType, Validators.required],
    value: ['', [Validators.required, Validators.pattern(DECIMAL_PATTERN)]],
    min_order_amount: ['', [Validators.pattern(DECIMAL_PATTERN)]],
    min_quantity: ['', [Validators.pattern(DECIMAL_PATTERN)]],
    valid_from: [''],
    valid_to: ['', endsNotBefore('valid_from', { dateOnly: true })],
    // priority is optional for the API (sometimes|integer)
    priority: [100 as number | null, [Validators.min(0), Validators.max(100000)]],
    is_stackable: [true],
    auto_apply: [false],
    is_active: [true],
    contact_id: [''],
  });

  // Price lookup
  protected priceProductId: string | null = null;
  protected priceContactId: string | null = null;
  protected priceQuantity = '1';
  protected readonly priceResult = signal<PriceLookupResult | null>(null);
  protected readonly priceEntries = computed(() => Object.entries(this.priceResult() ?? {}));

  constructor() {
    // The API requires valid_to on or after valid_from.
    revalidateOnStartChange(this.form, 'valid_from', 'valid_to', inject(DestroyRef));
  }

  ngOnInit(): void {
    this.lookups.load();
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getDiscountPolicies().subscribe({
      next: (res) => {
        this.policies.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private ruleGroup(rule?: Partial<Record<string, string | null>>) {
    return this.fb.group({
      product_id: [rule?.['product_id'] ?? ''],
      contact_id: [rule?.['contact_id'] ?? ''],
      min_threshold: [rule?.['min_threshold'] ?? '', [Validators.pattern(DECIMAL_PATTERN)]],
      discount_percent: [rule?.['discount_percent'] ?? '', [Validators.pattern(DECIMAL_PATTERN), maxNumber(100)]],
      discount_fixed_amount: [rule?.['discount_fixed_amount'] ?? '', [Validators.pattern(DECIMAL_PATTERN)]],
    });
  }

  protected addRule(): void {
    this.rules.push(this.ruleGroup());
  }

  protected removeRule(index: number): void {
    this.rules.removeAt(index);
  }

  protected open(policy: DiscountPolicy | null): void {
    this.editing.set(policy);
    this.form.reset({
      code: policy?.code ?? '',
      name: policy?.name ?? '',
      discount_type: policy?.discount_type ?? 'percentage',
      value: policy?.value ?? '',
      min_order_amount: policy?.min_order_amount ?? '',
      min_quantity: policy?.min_quantity ?? '',
      valid_from: policy?.valid_from?.substring(0, 10) ?? '',
      valid_to: policy?.valid_to?.substring(0, 10) ?? '',
      priority: policy?.priority ?? 100,
      is_stackable: policy?.is_stackable ?? true,
      auto_apply: policy?.auto_apply ?? false,
      is_active: policy?.is_active ?? true,
      contact_id: policy?.contact_id ?? '',
    });
    this.rules.clear();
    for (const rule of policy?.rules ?? []) {
      this.rules.push(
        this.ruleGroup({
          product_id: rule.product_id,
          contact_id: rule.contact_id,
          min_threshold: rule.min_threshold === null || rule.min_threshold === undefined ? '' : String(rule.min_threshold),
          discount_percent: rule.discount_percent === null || rule.discount_percent === undefined ? '' : String(rule.discount_percent),
          discount_fixed_amount:
            rule.discount_fixed_amount === null || rule.discount_fixed_amount === undefined ? '' : String(rule.discount_fixed_amount),
        }),
      );
    }
    this.modalOpen.set(true);
  }

  protected serverError(field: string): string {
    const error = this.form.get(field)?.errors?.['serverError'];
    return typeof error === 'string' ? error : '';
  }

  protected submit(): void {
    if (this.form.invalid || this.rules.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: DiscountPolicyPayload = {
      code: v.code,
      name: v.name,
      discount_type: v.discount_type,
      value: v.value,
      min_order_amount: v.min_order_amount || null,
      min_quantity: v.min_quantity || null,
      valid_from: v.valid_from || null,
      valid_to: v.valid_to || null,
      is_active: v.is_active,
      priority: v.priority ?? undefined,
      is_stackable: v.is_stackable,
      auto_apply: v.auto_apply,
      contact_id: v.contact_id || null,
      rules: (this.rules.getRawValue() as Record<string, string>[]).map((r) => ({
        product_id: r['product_id'] || null,
        contact_id: r['contact_id'] || null,
        min_threshold: r['min_threshold'] || null,
        discount_percent: r['discount_percent'] || null,
        discount_fixed_amount: r['discount_fixed_amount'] || null,
      })),
    };
    const current = this.editing();
    this.saving.set(true);
    const request = current ? this.api.updateDiscountPolicy(current.id, payload) : this.api.createDiscountPolicy(payload);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.message.success(this.i18n.translate('SC.COMMON.SAVED'));
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.form, err);
        const text = unmapped[0] ?? apiErrorText(err);
        if (text) {
          this.message.error(text);
        }
      },
    });
  }

  protected remove(policy: DiscountPolicy): void {
    this.api.deleteDiscountPolicy(policy.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('SC.COMMON.DELETED'));
        this.load();
      },
      error: (err: unknown) => this.message.error(apiErrorText(err)),
    });
  }

  protected lookupPrice(): void {
    if (!this.priceProductId) {
      return;
    }
    this.api
      .getPrice({
        product_id: this.priceProductId,
        contact_id: this.priceContactId,
        quantity: this.priceQuantity || null,
        date: todayIso(),
      })
      .subscribe({
        next: (res) => this.priceResult.set(res.data),
        error: (err: unknown) => {
          this.priceResult.set(null);
          this.message.error(apiErrorText(err));
        },
      });
  }

  protected display(value: unknown): string {
    return value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-');
  }
}
