import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { startWith } from 'rxjs';
import {
  EXM_PAYMENT_METHODS,
  ExmCategory,
  ExmJurisdiction,
  ExmLine,
  ExmLinePayload,
  ExmOcr,
  ExmPaymentMethod,
  ExmViolation,
} from '@core';
import { TranslatePipe } from '@shared';
import { today, toNumber } from './expense-management.util';
import { ViolationBadgesComponent } from './violation-badges.component';

/** Values the workbench fills from the OCR of a receipt. */
export interface LinePrefill {
  ocr: ExmOcr;
  receiptId: string;
}

/**
 * The form of an expense line: shared by the line drawer and the receipt workbench. It shows the violations the server
 * reported for the line plus the hints it can compute alone (a cash meal in Italy, a missing receipt, a future date),
 * so the submitter sees the problem while typing.
 */
@Component({
  selector: 'app-exm-line-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    ReactiveFormsModule,
    TranslatePipe,
    ViolationBadgesComponent,
  ],
  template: `
    <form [formGroup]="form" class="form" (ngSubmit)="submit()">
      @if (errorKey(); as error) {
        <nz-alert nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
      }
      @if (violations().length > 0 || hints().length > 0) {
        <div class="badges" role="status">
          <app-exm-violation-badges [violations]="violations()"></app-exm-violation-badges>
          <app-exm-violation-badges [violations]="hints()"></app-exm-violation-badges>
        </div>
      }

      <label for="exm-line-date">{{ 'expenseManagement.field.expenseDate' | translate }}</label>
      <input nz-input id="exm-line-date" type="date" formControlName="expense_date" />

      <label for="exm-line-category">{{ 'expenseManagement.field.category' | translate }}</label>
      <nz-select nzId="exm-line-category" nzShowSearch formControlName="category_id">
        @for (category of categories(); track category.id) {
          <nz-option
            [nzValue]="category.id"
            [nzLabel]="'expenseManagement.category.' + category.code | translate"
          ></nz-option>
        }
      </nz-select>

      <label for="exm-line-merchant">{{ 'expenseManagement.field.merchant' | translate }}</label>
      <input nz-input id="exm-line-merchant" formControlName="merchant_name" maxlength="160" />

      <label for="exm-line-taxid">{{ 'expenseManagement.field.merchantTaxId' | translate }}</label>
      <input nz-input id="exm-line-taxid" formControlName="merchant_tax_id" maxlength="40" />

      <label for="exm-line-description">{{
        'expenseManagement.field.description' | translate
      }}</label>
      <input nz-input id="exm-line-description" formControlName="description" maxlength="255" />

      <div class="row">
        <div>
          <label for="exm-line-amount">{{ 'expenseManagement.field.amount' | translate }}</label>
          <input
            nz-input
            id="exm-line-amount"
            type="number"
            step="0.01"
            min="0"
            formControlName="original_amount"
          />
        </div>
        <div>
          <label for="exm-line-currency">{{
            'expenseManagement.field.currency' | translate
          }}</label>
          <input
            nz-input
            id="exm-line-currency"
            formControlName="original_currency"
            maxlength="3"
          />
        </div>
      </div>

      @if (foreignCurrency()) {
        <label for="exm-line-rate">{{ 'expenseManagement.field.exchangeRate' | translate }}</label>
        <input
          nz-input
          id="exm-line-rate"
          type="number"
          step="0.000001"
          min="0"
          formControlName="exchange_rate"
        />
      }

      <div class="row">
        <div>
          <label for="exm-line-vat-rate">{{ 'expenseManagement.field.vatRate' | translate }}</label>
          <input
            nz-input
            id="exm-line-vat-rate"
            type="number"
            step="0.01"
            min="0"
            formControlName="vat_rate"
          />
        </div>
        <div>
          <label for="exm-line-vat">{{ 'expenseManagement.field.vatAmount' | translate }}</label>
          <input
            nz-input
            id="exm-line-vat"
            type="number"
            step="0.01"
            min="0"
            formControlName="vat_amount"
          />
        </div>
      </div>

      <label for="exm-line-method">{{ 'expenseManagement.field.paymentMethod' | translate }}</label>
      <nz-select nzId="exm-line-method" formControlName="payment_method">
        @for (method of methods; track method) {
          <nz-option
            [nzValue]="method"
            [nzLabel]="'expenseManagement.paymentMethod.' + method | translate"
          ></nz-option>
        }
      </nz-select>

      @if (outOfPocket()) {
        <label class="switch" for="exm-line-cash">
          <nz-switch nzId="exm-line-cash" formControlName="paid_in_cash"></nz-switch>
          <span>{{ 'expenseManagement.field.paidInCash' | translate }}</span>
        </label>
      }

      <label class="switch" for="exm-line-billable">
        <nz-switch nzId="exm-line-billable" formControlName="billable_to_customer"></nz-switch>
        <span>{{ 'expenseManagement.field.billable' | translate }}</span>
      </label>

      <div class="actions">
        <button nz-button type="button" (click)="cancelled.emit()">
          {{ 'expenseManagement.action.cancel' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="submit"
          [disabled]="form.invalid || saving()"
          [nzLoading]="saving()"
        >
          {{ 'expenseManagement.action.save' | translate }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .form {
      display: grid;
      gap: 6px;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .switch {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }
  `,
})
export class LineFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly categories = input<readonly ExmCategory[]>([]);
  readonly currency = input('EUR');
  readonly jurisdiction = input<ExmJurisdiction>('IT');
  /** The line being edited, null for a new one. */
  readonly line = input<ExmLine | null>(null);
  /** The OCR of a scanned receipt, which fills the empty form. */
  readonly prefill = input<LinePrefill | null>(null);
  /** Violations the server reported (duplicates of the scan, the line's own). */
  readonly reported = input<readonly ExmViolation[]>([]);
  readonly saving = input(false);
  readonly errorKey = input<string | null>(null);

  readonly saved = output<ExmLinePayload>();
  readonly cancelled = output<void>();

  protected readonly methods: readonly ExmPaymentMethod[] = EXM_PAYMENT_METHODS;

  protected readonly form = this.fb.nonNullable.group({
    expense_date: [today(), Validators.required],
    category_id: ['', Validators.required],
    merchant_name: ['', Validators.required],
    merchant_tax_id: [''],
    description: [''],
    original_amount: [0, [Validators.required, Validators.min(0.01)]],
    original_currency: [
      'EUR',
      [Validators.required, Validators.minLength(3), Validators.maxLength(3)],
    ],
    exchange_rate: [1],
    vat_rate: [0],
    vat_amount: [0],
    payment_method: ['employee_out_of_pocket' as ExmPaymentMethod, Validators.required],
    paid_in_cash: [false],
    billable_to_customer: [false],
  });

  private readonly value = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    {
      initialValue: this.form.getRawValue(),
    },
  );

  protected readonly violations = computed(() => this.line()?.policy_violations ?? this.reported());

  protected readonly outOfPocket = computed(
    () => this.value().payment_method === 'employee_out_of_pocket',
  );

  protected readonly foreignCurrency = computed(
    () => (this.value().original_currency ?? '').toUpperCase() !== this.currency().toUpperCase(),
  );

  /** Hints computed in the browser: the server decides, these only warn earlier. */
  protected readonly hints = computed<ExmViolation[]>(() => {
    const value = this.value();
    const category = this.categories().find((item) => item.id === value.category_id);
    const hints: ExmViolation[] = [];
    const known = new Set(this.violations().map((violation) => violation.code));
    const push = (violation: ExmViolation) => {
      if (!known.has(violation.code)) {
        hints.push(violation);
      }
    };

    if (
      this.jurisdiction() === 'IT' &&
      value.payment_method === 'employee_out_of_pocket' &&
      value.paid_in_cash &&
      category &&
      (category.is_meal || category.is_lodging || category.is_transport)
    ) {
      push({ code: 'non_traceable_payment', severity: 'warning' });
    }
    if (category?.requires_receipt && !this.receiptPresent()) {
      push({ code: 'receipt_required', severity: 'warning' });
    }
    if ((value.expense_date ?? '') > today()) {
      push({ code: 'future_date', severity: 'blocking' });
    }
    return hints;
  });

  private readonly receiptPresent = computed(
    () => (this.line()?.has_receipt ?? false) || this.prefill() !== null,
  );

  constructor() {
    effect(() => {
      const line = this.line();
      if (line) {
        this.form.reset({
          expense_date: line.expense_date,
          category_id: line.category_id,
          merchant_name: line.merchant_name ?? '',
          merchant_tax_id: line.merchant_tax_id ?? '',
          description: line.description ?? '',
          original_amount: toNumber(line.original_amount),
          original_currency: line.original_currency,
          exchange_rate: toNumber(line.exchange_rate ?? 1),
          vat_rate: toNumber(line.vat_rate),
          vat_amount: toNumber(line.vat_amount),
          payment_method: line.payment_method,
          paid_in_cash: !line.is_traceable_payment,
          billable_to_customer: line.billable_to_customer,
        });
      }
    });

    effect(() => {
      const prefill = this.prefill();
      if (prefill) {
        const { ocr } = prefill;
        this.form.patchValue({
          merchant_name: ocr.merchant_name ?? '',
          expense_date: ocr.expense_date ?? today(),
          original_currency: ocr.currency ?? this.currency(),
          original_amount: toNumber(ocr.total_amount),
          vat_amount: toNumber(ocr.vat_amount),
          vat_rate: toNumber(ocr.vat_rate),
        });
      }
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const payload: ExmLinePayload = {
      expense_date: value.expense_date,
      category_id: value.category_id,
      merchant_name: value.merchant_name,
      merchant_tax_id: value.merchant_tax_id || null,
      description: value.description || null,
      original_amount: value.original_amount,
      original_currency: value.original_currency.toUpperCase(),
      exchange_rate: this.foreignCurrency() ? value.exchange_rate : null,
      exchange_rate_date: this.foreignCurrency() ? value.expense_date : null,
      vat_rate: value.vat_rate,
      vat_amount: value.vat_amount,
      payment_method: value.payment_method,
      billable_to_customer: value.billable_to_customer,
      receipt_id: this.prefill()?.receiptId ?? this.line()?.receipt_id ?? null,
    };
    // Only an out-of-pocket expense can be paid in cash; a card payment is always traceable.
    payload.is_traceable_payment =
      value.payment_method === 'employee_out_of_pocket' ? !value.paid_in_cash : true;
    this.saved.emit(payload);
  }
}
