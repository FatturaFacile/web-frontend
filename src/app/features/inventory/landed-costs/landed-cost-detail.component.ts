import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { map } from 'rxjs';
import {
  I18nService,
  InventoryRevaluation,
  InventoryValuationApiService,
  LandedCostDocument,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  ALLOCATION_KEY_LABELS,
  httpStatus,
  inventoryErrorKey,
  LANDED_COST_STATUS_LABELS,
  LANDED_COST_TYPE_LABELS,
  validationMessages,
} from '../shared/inventory-valuation.utils';

@Component({
  selector: 'app-landed-cost-detail',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './landed-cost-detail.component.html',
  styleUrl: '../shared/inventory-valuation.scss',
})
export class LandedCostDetailComponent {
  private readonly api = inject(InventoryValuationApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly statusLabels = LANDED_COST_STATUS_LABELS;
  protected readonly typeLabels = LANDED_COST_TYPE_LABELS;
  protected readonly keyLabels = ALLOCATION_KEY_LABELS;

  readonly id = signal<string | null>(null);
  readonly doc = signal<LandedCostDocument | null>(null);
  readonly loading = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly applying = signal(false);
  readonly reversing = signal(false);
  readonly revaluation = signal<InventoryRevaluation | null>(null);
  readonly reversal = signal<LandedCostDocument | null>(null);
  readonly reverseModalOpen = signal(false);
  readonly reverseErrors = signal<string[]>([]);

  readonly canApply = computed(() => this.doc()?.status === 'draft');
  readonly canReverse = computed(() => this.doc()?.status === 'applied');
  readonly busy = computed(() => this.applying() || this.reversing());
  readonly shownRevaluation = computed(() => this.revaluation() ?? this.doc()?.revaluation ?? null);
  /** Id of the reversal document generated from this one, when known. */
  readonly reversalId = computed(() => this.reversal()?.id ?? this.doc()?.reversed_by_id ?? null);

  private readonly receiptNumbers = computed(
    () => new Map((this.doc()?.receipts ?? []).map((r) => [r.receipt_id, r.receipt_number] as const)),
  );

  readonly reverseForm = this.fb.group({
    reason: this.fb.control('', [Validators.required, Validators.maxLength(500)]),
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        takeUntilDestroyed(),
      )
      .subscribe((id) => {
        this.id.set(id);
        this.revaluation.set(null);
        this.reversal.set(null);
        this.load();
      });
  }

  load(): void {
    const id = this.id();
    if (!id) {
      return;
    }
    this.loading.set(true);
    this.errorKey.set(null);
    this.api.getLandedCost(id).subscribe({
      next: (doc) => {
        this.doc.set(doc);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.doc.set(null);
        this.errorKey.set(inventoryErrorKey(err));
        this.loading.set(false);
      },
    });
  }

  apply(): void {
    const doc = this.doc();
    if (!doc || !this.canApply() || this.busy()) {
      return;
    }
    this.applying.set(true);
    this.api.applyLandedCost(doc.id).subscribe({
      next: (updated) => {
        this.applying.set(false);
        this.doc.set(updated);
        this.revaluation.set(updated.revaluation ?? null);
        this.message.success(this.i18n.translate('INVENTORY.LANDED_COSTS.APPLIED'));
      },
      error: (err: unknown) => {
        this.applying.set(false);
        this.notifyActionError(err);
        this.load();
      },
    });
  }

  openReverseModal(): void {
    this.reverseForm.reset({ reason: '' });
    this.reverseErrors.set([]);
    this.reverseModalOpen.set(true);
  }

  closeReverseModal(): void {
    this.reverseModalOpen.set(false);
  }

  reverse(): void {
    const doc = this.doc();
    if (!doc || !this.canReverse() || this.busy()) {
      return;
    }
    const reason = this.reverseForm.controls.reason.value.trim();
    if (this.reverseForm.invalid || !reason) {
      this.reverseForm.controls.reason.setErrors({ required: true });
      this.reverseForm.controls.reason.markAsDirty();
      return;
    }
    this.reversing.set(true);
    this.reverseErrors.set([]);
    this.api.reverseLandedCost(doc.id, { reason }).subscribe({
      next: (reversal) => {
        this.reversing.set(false);
        this.reverseModalOpen.set(false);
        this.reversal.set(reversal);
        this.message.success(this.i18n.translate('INVENTORY.LANDED_COSTS.REVERSED'));
        this.load();
      },
      error: (err: unknown) => {
        this.reversing.set(false);
        if (httpStatus(err) === 422) {
          const messages = validationMessages(err);
          this.reverseErrors.set(messages.length ? messages : [this.i18n.translate('INVENTORY.ERRORS.VALIDATION')]);
        } else {
          this.reverseModalOpen.set(false);
          this.load();
        }
      },
    });
  }

  receiptLabel(id: string): string {
    return this.receiptNumbers().get(id) || id;
  }

  openReversal(): void {
    const id = this.reversalId();
    if (id) {
      void this.router.navigate(['/inventory/landed-costs', id]);
    }
  }

  /** 4xx other than 422 are toasted by the global interceptor; 422 is not. */
  private notifyActionError(err: unknown): void {
    if (httpStatus(err) === 422) {
      const [first] = validationMessages(err);
      this.message.error(first ?? this.i18n.translate('INVENTORY.ERRORS.VALIDATION'));
    }
  }
}
