import { Component, computed, DestroyRef, effect, inject, input, model, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { TranslatePipe } from '@shared';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';
import { hasSharedRuleError, validationTipKey } from '@shared/utils/validation-tip';
import {
  applyServerErrors,
  CatalogApiService,
  ClientApiService,
  contactDisplayName,
  I18nService,
  InvoiceDetailResource,
  InvoiceItemResource,
  CreateInvoicePayload,
  InvoiceApiService,
  InvoiceType,
  Jurisdiction,
  serverErrorMessage,
} from '@core';

type ItemGroup = FormGroup<{
  description: FormControl<string>;
  quantity: FormControl<number>;
  unit_price: FormControl<number>;
  tax_rate: FormControl<number>;
  discount_percentage: FormControl<number>;
}>;

/** Whether a 422 carries a validation error on the `exchange_rate` field. */
function hasExchangeRateError(err: unknown): boolean {
  return (
    err instanceof HttpErrorResponse && err.status === 422 && !!(err.error as { errors?: Record<string, unknown> })?.errors?.['exchange_rate']
  );
}

/** Local-date `yyyy-MM-dd` (avoids UTC shifts of toISOString). */
function toIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

@Component({
  selector: 'app-invoice-form-drawer',
  styleUrl: './invoice-form-drawer.component.scss',
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzDatePickerModule,
    NzButtonModule,
    NzIconModule,
    TranslatePipe,
  ],
  templateUrl: './invoice-form-drawer.component.html',
})
export class InvoiceFormDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly invoiceApi = inject(InvoiceApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly open = model(false);
  /** When set, the form is pre-populated from this invoice (client-side duplication). */
  readonly template = input<InvoiceDetailResource | null>(null);
  readonly saved = output<void>();
  readonly saving = signal(false);

  readonly typeOptions: { label: string; value: InvoiceType }[] = [
    { label: 'SALES.INVOICES.TYPES.STANDARD', value: 'standard' },
    { label: 'SALES.INVOICES.TYPES.SDI_ELECTRONIC', value: 'sdi_electronic' },
    { label: 'SALES.INVOICES.TYPES.CH_QR_BILL', value: 'ch_qr_bill' },
    { label: 'SALES.INVOICES.TYPES.CREDIT_NOTE', value: 'credit_note' },
    { label: 'SALES.INVOICES.TYPES.PROFORMA', value: 'proforma' },
  ];
  readonly jurisdictionOptions: { label: string; value: Jurisdiction }[] = [
    { label: 'SALES.INVOICES.JURISDICTIONS.IT', value: 'IT' },
    { label: 'SALES.INVOICES.JURISDICTIONS.CH', value: 'CH' },
  ];
  readonly currencyOptions = [
    { label: 'CHF', value: 'CHF' },
    { label: 'EUR', value: 'EUR' },
  ];

  readonly form = this.fb.group({
    contact_id: this.fb.control('', Validators.required),
    invoice_type: this.fb.control<InvoiceType>('standard', Validators.required),
    date: new FormControl<Date | null>(null, Validators.required),
    due_date: new FormControl<Date | null>(null, endsNotBefore('date', { dateOnly: true })),
    payment_term_id: this.fb.control(''),
    currency: this.fb.control('CHF', Validators.required),
    jurisdiction: this.fb.control<Jurisdiction>('CH', Validators.required),
    notes: this.fb.control('', Validators.maxLength(2000)),
    items: this.fb.array<ItemGroup>([]),
  });

  /** Payment terms of the catalog: the server derives the due date and the installments from the chosen one. */
  protected readonly paymentTerms = toSignal(
    this.catalogApi.getPaymentTerms().pipe(
      map((res) => res.data),
      catchError(() => of([])),
    ),
    { initialValue: [] },
  );

  protected readonly contactSearch = signal('');
  private readonly fetchedContacts = toSignal(
    toObservable(this.contactSearch).pipe(
      debounceTime(250),
      distinctUntilChanged(),
      startWith(''),
      switchMap((search) =>
        this.clientApi.list({ search, per_page: 20 }).pipe(
          map((res) => res.data.map((c) => ({ label: contactDisplayName(c), value: c.id }))),
          catchError(() => of([])),
        ),
      ),
    ),
    { initialValue: [] },
  );
  protected readonly contactOptions = computed(() => {
    const fetched = this.fetchedContacts();
    const tpl = this.template();
    const id = tpl?.contact?.id ?? tpl?.contact_id;
    if (!id || fetched.some((o) => o.value === id)) {
      return fetched;
    }
    return [{ label: tpl?.contact ? contactDisplayName(tpl.contact) : id, value: id }, ...fetched];
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    {
      initialValue: this.form.getRawValue(),
    },
  );
  protected readonly currency = computed(() => this.formValue().currency ?? 'CHF');
  protected readonly lines = computed(() =>
    (this.formValue().items ?? []).map((i) => {
      const sub =
        (i.quantity ?? 0) * (i.unit_price ?? 0) * (1 - (i.discount_percentage ?? 0) / 100);
      return { sub, tax: sub * ((i.tax_rate ?? 0) / 100) };
    }),
  );
  protected readonly totals = computed(() => {
    const net = this.lines().reduce((s, l) => s + l.sub, 0);
    const vat = this.lines().reduce((s, l) => s + l.tax, 0);
    return { net, vat, gross: net + vat };
  });

  constructor() {
    // The API requires due_date >= date (after_or_equal:date): re-check it when the invoice date changes.
    revalidateOnStartChange(this.form, 'date', 'due_date', inject(DestroyRef));
    effect(() => {
      if (this.open()) {
        this.reset();
      }
    });
  }

  private reset(): void {
    const tpl = this.template();
    const currency = tpl?.currency ?? 'CHF';
    this.form.reset({
      contact_id: tpl?.contact?.id ?? tpl?.contact_id ?? '',
      invoice_type: tpl?.invoice_type ?? 'standard',
      payment_term_id: tpl?.payment_term_id ?? '',
      currency,
      jurisdiction: tpl?.jurisdiction ?? (currency === 'EUR' ? 'IT' : 'CH'),
      notes: tpl?.notes ?? '',
      date: new Date(),
      due_date: null,
    });
    this.form.controls.items.clear();
    if (tpl?.items?.length) {
      tpl.items.forEach((i) => this.addItem(i));
    } else {
      this.addItem();
    }
  }

  addItem(item?: InvoiceItemResource): void {
    this.form.controls.items.push(
      this.fb.group({
        description: this.fb.control(item?.description ?? '', [Validators.required, Validators.maxLength(1000)]),
        quantity: this.fb.control(item?.quantity ?? 1, [Validators.required, Validators.min(0.01)]),
        unit_price: this.fb.control(item?.unit_price ?? 0, [
          Validators.required,
          Validators.min(0),
        ]),
        tax_rate: this.fb.control(item?.tax_rate ?? 8.1, [Validators.required, Validators.min(0), Validators.max(100)]),
        discount_percentage: this.fb.control(item?.discount_percentage ?? 0, [Validators.min(0), Validators.max(100)]),
      }),
    );
  }
  removeItem(index: number): void {
    this.form.controls.items.removeAt(index);
  }

  errorTip(path: string): string {
    const control = this.form.get(path);
    if (control?.hasError('required')) {
      return this.i18n.translate('COMMON.VALIDATION.REQUIRED');
    }
    if (hasSharedRuleError(control)) {
      return this.i18n.translate(validationTipKey(control));
    }
    if (control?.hasError('min') || control?.hasError('max') || control?.hasError('maxlength')) {
      return this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE');
    }
    return serverErrorMessage(this.form, path) ?? '';
  }

  submit(): void {
    this.form.markAllAsTouched();
    this.form.controls.items.controls.forEach((g) => g.markAllAsTouched());
    const v = this.form.getRawValue();
    if (this.form.invalid || !v.date) {
      return;
    }
    const payload: CreateInvoicePayload = {
      contact_id: v.contact_id,
      invoice_type: v.invoice_type,
      date: toIsoDate(v.date),
      due_date: v.due_date ? toIsoDate(v.due_date) : null,
      currency: v.currency,
      payment_term_id: v.payment_term_id || null,
      jurisdiction: v.jurisdiction,
      notes: v.notes.trim() || null,
      items: v.items,
    };
    this.saving.set(true);
    this.invoiceApi.create(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('SALES.INVOICES.MESSAGES.CREATED'));
        this.open.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        // Laravel keys the invoice date as `date`, matching the control name.
        const unmapped = applyServerErrors(this.form, err);
        if (hasExchangeRateError(err)) {
          // No rate of the currency for the invoice date: say so instead of the bare server text.
          this.message.error(
            this.i18n.translate('SALES.INVOICES.ERRORS.NO_EXCHANGE_RATE', {
              currency: v.currency,
              date: toIsoDate(v.date as Date),
            }),
          );
          return;
        }
        unmapped.forEach((m) => this.message.error(m));
      },
    });
  }
}
