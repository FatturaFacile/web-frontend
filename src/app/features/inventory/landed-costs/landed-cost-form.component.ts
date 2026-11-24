import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, map, of, switchMap } from 'rxjs';
import {
  AuthStore,
  GoodsReceiptSummary,
  I18nService,
  InventoryValuationApiService,
  LANDED_COST_ALLOCATION_KEYS,
  LANDED_COST_TYPES,
  LandedCostAllocationKey,
  LandedCostPayload,
  LandedCostPreview,
  LandedCostType,
  serverErrorMessage,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  ALLOCATION_KEY_LABELS,
  AMOUNT_PATTERN,
  isPositiveAmount,
  isZeroAmount,
  LANDED_COST_TYPE_LABELS,
  toIsoDate,
  validationMessages,
  bindServerErrors,
} from '../shared/inventory-valuation.utils';

/** Debounce applied to the live allocation preview. */
export const LANDED_COST_PREVIEW_DEBOUNCE_MS = 500;

function positiveAmount(control: AbstractControl<string>): ValidationErrors | null {
  const value = (control.value ?? '').trim();
  if (!value) {
    return null;
  }
  return isPositiveAmount(value) ? null : { positiveAmount: true };
}

function nonEmptyArray(control: AbstractControl<string[]>): ValidationErrors | null {
  return Array.isArray(control.value) && control.value.length > 0 ? null : { required: true };
}

@Component({
  selector: 'app-landed-cost-form',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './landed-cost-form.component.html',
  styleUrl: '../shared/inventory-valuation.scss',
})
export class LandedCostFormComponent implements OnInit {
  private readonly api = inject(InventoryValuationApiService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly costTypes = LANDED_COST_TYPES;
  protected readonly allocationKeys = LANDED_COST_ALLOCATION_KEYS;
  protected readonly typeLabels = LANDED_COST_TYPE_LABELS;
  protected readonly keyLabels = ALLOCATION_KEY_LABELS;
  protected readonly currencies = ['EUR', 'CHF'];
  protected readonly serverError = serverErrorMessage;
  protected readonly isZero = isZeroAmount;

  readonly receipts = signal<GoodsReceiptSummary[]>([]);
  readonly receiptsLoaded = signal(false);
  /** Without a receipts list the select accepts manually typed receipt ids. */
  readonly manualReceipts = computed(() => this.receiptsLoaded() && this.receipts().length === 0);
  readonly receiptNumbers = computed(
    () => new Map(this.receipts().map((r) => [r.id, r.receipt_number] as const)),
  );

  readonly saving = signal(false);
  readonly formErrors = signal<string[]>([]);

  readonly preview = signal<LandedCostPreview | null>(null);
  readonly previewLoading = signal(false);
  readonly previewErrors = signal<string[]>([]);

  readonly form = this.fb.group({
    document_date: this.fb.control<Date | null>(new Date(), [Validators.required]),
    cost_type: this.fb.control<LandedCostType>('freight', [Validators.required]),
    allocation_key: this.fb.control<LandedCostAllocationKey>('value', [Validators.required]),
    currency: this.fb.control<string>(this.authStore.activeCurrency(), [Validators.required]),
    total_amount: this.fb.control('', [Validators.required, Validators.pattern(AMOUNT_PATTERN), positiveAmount]),
    supplier_invoice_id: this.fb.control(''),
    notes: this.fb.control(''),
    receipt_ids: this.fb.control<string[]>([], [nonEmptyArray]),
  });

  constructor() {
    this.form.valueChanges
      .pipe(
        debounceTime(LANDED_COST_PREVIEW_DEBOUNCE_MS),
        map(() => this.buildPayload()),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap((payload) => {
          if (!payload) {
            this.preview.set(null);
            this.previewErrors.set([]);
            this.previewLoading.set(false);
            return EMPTY;
          }
          this.previewLoading.set(true);
          return this.api.previewLandedCost(payload).pipe(
            map((result) => ({ result, error: null as unknown })),
            catchError((error: unknown) => of({ result: null, error })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ result, error }) => {
        this.previewLoading.set(false);
        if (result) {
          this.preview.set(result);
          this.previewErrors.set([]);
        } else {
          this.preview.set(null);
          const messages = validationMessages(error);
          this.previewErrors.set(messages.length ? messages : [this.i18n.translate('INVENTORY.ERRORS.PREVIEW_FAILED')]);
        }
      });
  }

  ngOnInit(): void {
    this.api.listGoodsReceipts({ per_page: 100 }).subscribe({
      next: (res) => {
        this.receipts.set(res.data);
        this.receiptsLoaded.set(true);
      },
      error: () => {
        this.receipts.set([]);
        this.receiptsLoaded.set(true);
      },
    });
  }

  /** Payload for preview / create, or null while the draft is not valid. */
  buildPayload(): LandedCostPayload | null {
    if (this.form.invalid) {
      return null;
    }
    const v = this.form.getRawValue();
    const documentDate = toIsoDate(v.document_date);
    if (!documentDate) {
      return null;
    }
    return {
      document_date: documentDate,
      cost_type: v.cost_type,
      allocation_key: v.allocation_key,
      currency: v.currency,
      total_amount: v.total_amount.trim(),
      supplier_invoice_id: v.supplier_invoice_id.trim() || null,
      notes: v.notes.trim() || null,
      receipt_ids: [...v.receipt_ids],
    };
  }

  receiptLabel(id: string): string {
    return this.receiptNumbers().get(id) ?? id;
  }

  submit(): void {
    const payload = this.buildPayload();
    if (!payload) {
      Object.values(this.form.controls).forEach((c) => {
        c.markAsDirty();
        c.updateValueAndValidity({ emitEvent: false });
      });
      return;
    }
    this.saving.set(true);
    this.formErrors.set([]);
    this.api.createLandedCost(payload).subscribe({
      next: (doc) => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('INVENTORY.LANDED_COSTS.CREATED'));
        void this.router.navigate(['/inventory/landed-costs', doc.id]);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formErrors.set(bindServerErrors(this.form, err));
      },
    });
  }
}
