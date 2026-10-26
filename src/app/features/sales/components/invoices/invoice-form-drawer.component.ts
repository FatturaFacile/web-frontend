import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { TranslatePipe } from '@shared';
import {
  applyServerErrors,
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

/** Local-date `yyyy-MM-dd` (avoids UTC shifts of toISOString). */
function toIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

@Component({
  selector: 'app-invoice-form-drawer',
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
  template: `
    <nz-drawer [nzVisible]="open()" [nzTitle]="(template() ? 'SALES.INVOICES.DUPLICATE_TITLE' : 'SALES.INVOICES.NEW') | translate" [nzWidth]="1100" (nzOnClose)="open.set(false)">
      <ng-container *nzDrawerContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <div class="grid">
            <nz-form-item class="span-2">
              <nz-form-label nzRequired nzFor="contact_id">{{ 'SALES.INVOICES.FORM.CONTACT' | translate }}</nz-form-label>
              <nz-form-control nzHasFeedback [nzValidateStatus]="form.controls.contact_id" [nzErrorTip]="errorTip('contact_id')">
                <nz-select
                  id="contact_id"
                  formControlName="contact_id"
                  nzShowSearch
                  nzServerSearch
                  [nzPlaceHolder]="'SALES.INVOICES.FORM.CONTACT_PLACEHOLDER' | translate"
                  [nzOptions]="contactOptions()"
                  (nzOnSearch)="contactSearch.set($event)"
                />
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired nzFor="invoice_number">{{ 'SALES.INVOICES.FORM.NUMBER' | translate }}</nz-form-label>
              <nz-form-control nzHasFeedback [nzValidateStatus]="form.controls.invoice_number" [nzErrorTip]="errorTip('invoice_number')">
                <input nz-input id="invoice_number" formControlName="invoice_number" />
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired nzFor="invoice_type">{{ 'SALES.INVOICES.FORM.TYPE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('invoice_type')">
                <nz-select id="invoice_type" formControlName="invoice_type">
                  @for (o of typeOptions; track o.value) {
                    <nz-option [nzValue]="o.value" [nzLabel]="o.label | translate" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired nzFor="date">{{ 'SALES.INVOICES.FORM.DATE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('date')" [nzValidateStatus]="form.controls.date">
                <nz-date-picker id="date" formControlName="date" nzFormat="dd.MM.yyyy" />
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzFor="due_date">{{ 'SALES.INVOICES.FORM.DUE_DATE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('due_date')" [nzValidateStatus]="form.controls.due_date">
                <nz-date-picker id="due_date" formControlName="due_date" nzFormat="dd.MM.yyyy" />
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired nzFor="jurisdiction">{{ 'SALES.INVOICES.FORM.JURISDICTION' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('jurisdiction')">
                <nz-select id="jurisdiction" formControlName="jurisdiction">
                  @for (o of jurisdictionOptions; track o.value) {
                    <nz-option [nzValue]="o.value" [nzLabel]="o.label | translate" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired nzFor="currency">{{ 'SALES.INVOICES.FORM.CURRENCY' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('currency')">
                <nz-select id="currency" formControlName="currency" [nzOptions]="currencyOptions" />
              </nz-form-control>
            </nz-form-item>
          </div>

          <h4>{{ 'SALES.INVOICES.FORM.ITEMS' | translate }}</h4>
          <div formArrayName="items">
            @for (item of form.controls.items.controls; track item; let i = $index) {
              <div class="line" [formGroupName]="i">
                <nz-form-item class="desc">
                  <nz-form-label [nzFor]="'desc' + i" nzRequired>{{ 'SALES.INVOICES.ITEM.DESCRIPTION' | translate }}</nz-form-label>
                  <nz-form-control nzHasFeedback [nzValidateStatus]="item.controls.description" [nzErrorTip]="errorTip('items.' + i + '.description')">
                    <input nz-input [id]="'desc' + i" formControlName="description" />
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label [nzFor]="'qty' + i">{{ 'SALES.INVOICES.ITEM.QTY' | translate }}</nz-form-label>
                  <nz-form-control [nzErrorTip]="errorTip('items.' + i + '.quantity')" [nzValidateStatus]="item.controls.quantity">
                    <nz-input-number [id]="'qty' + i" formControlName="quantity" [nzMin]="0.01" />
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label [nzFor]="'price' + i">{{ 'SALES.INVOICES.ITEM.PRICE' | translate }}</nz-form-label>
                  <nz-form-control [nzErrorTip]="errorTip('items.' + i + '.unit_price')" [nzValidateStatus]="item.controls.unit_price">
                    <nz-input-number [id]="'price' + i" formControlName="unit_price" [nzMin]="0" [nzStep]="0.05" />
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label [nzFor]="'vat' + i">{{ 'SALES.INVOICES.ITEM.TAX_RATE' | translate }}</nz-form-label>
                  <nz-form-control [nzErrorTip]="errorTip('items.' + i + '.tax_rate')" [nzValidateStatus]="item.controls.tax_rate">
                    <nz-input-number [id]="'vat' + i" formControlName="tax_rate" [nzMin]="0" [nzMax]="100" [nzStep]="0.1" />
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label [nzFor]="'disc' + i">{{ 'SALES.INVOICES.ITEM.DISCOUNT' | translate }}</nz-form-label>
                  <nz-form-control>
                    <nz-input-number [id]="'disc' + i" formControlName="discount_percentage" [nzMin]="0" [nzMax]="100" />
                  </nz-form-control>
                </nz-form-item>
                <div class="calc">
                  <span class="calc-label">{{ 'SALES.INVOICES.ITEM.TAX_AMOUNT' | translate }}</span>
                  <span>{{ lines()[i].tax | currency: currency() : 'symbol' : '1.2-2' }}</span>
                </div>
                <div class="calc">
                  <span class="calc-label">{{ 'SALES.INVOICES.ITEM.SUBTOTAL' | translate }}</span>
                  <span>{{ lines()[i].sub | currency: currency() : 'symbol' : '1.2-2' }}</span>
                </div>
                <button
                  nz-button
                  nzType="text"
                  nzDanger
                  type="button"
                  class="remove"
                  [attr.aria-label]="'SALES.INVOICES.FORM.REMOVE_ITEM' | translate: { n: i + 1 }"
                  [disabled]="form.controls.items.length === 1"
                  (click)="removeItem(i)"
                >
                  <nz-icon nzType="minus-circle" />
                </button>
              </div>
            }
          </div>
          <button nz-button nzType="dashed" type="button" (click)="addItem()">
            <nz-icon nzType="plus" /> {{ 'SALES.INVOICES.FORM.ADD_ITEM' | translate }}
          </button>

          <nz-form-item class="notes">
            <nz-form-label nzFor="notes">{{ 'SALES.INVOICES.FORM.NOTES' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('notes')">
              <textarea nz-input id="notes" formControlName="notes" rows="2"></textarea>
            </nz-form-control>
          </nz-form-item>

          <dl class="totals">
            <dt>{{ 'SALES.INVOICES.TOTALS.NET' | translate }}</dt>
            <dd>{{ totals().net | currency: currency() : 'symbol' : '1.2-2' }}</dd>
            <dt>{{ 'SALES.INVOICES.TOTALS.VAT' | translate }}</dt>
            <dd>{{ totals().vat | currency: currency() : 'symbol' : '1.2-2' }}</dd>
            <dt>{{ 'SALES.INVOICES.TOTALS.GROSS' | translate }}</dt>
            <dd>
              <strong>{{ totals().gross | currency: currency() : 'symbol' : '1.2-2' }}</strong>
            </dd>
          </dl>

          <div class="actions">
            <button nz-button type="button" (click)="open.set(false)">{{ 'COMMON.CANCEL' | translate }}</button>
            <button nz-button nzType="primary" type="submit" [nzLoading]="saving()">{{ 'SALES.INVOICES.FORM.SUBMIT' | translate }}</button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      column-gap: 16px;
    }
    .span-2 {
      grid-column: span 2;
    }
    .line {
      display: grid;
      grid-template-columns: 3fr 1fr 1fr 1fr 1fr 1.2fr 1.2fr auto;
      gap: 8px;
      align-items: end;
    }
    .calc {
      display: flex;
      flex-direction: column;
      margin-bottom: 24px;
      text-align: right;
    }
    .calc-label {
      font-size: 12px;
      color: var(--text-secondary, #595959);
    }
    .remove {
      margin-bottom: 24px;
    }
    .notes {
      margin-top: 16px;
    }
    .totals {
      display: grid;
      grid-template-columns: 1fr auto;
      max-width: 280px;
      margin-left: auto;
    }
    .totals dd {
      margin: 0;
      text-align: right;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
  `,
})
export class InvoiceFormDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly invoiceApi = inject(InvoiceApiService);
  private readonly clientApi = inject(ClientApiService);
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
    invoice_number: this.fb.control('', Validators.required),
    date: new FormControl<Date | null>(null, Validators.required),
    due_date: new FormControl<Date | null>(null),
    currency: this.fb.control('CHF', Validators.required),
    jurisdiction: this.fb.control<Jurisdiction>('CH', Validators.required),
    notes: this.fb.control(''),
    items: this.fb.array<ItemGroup>([]),
  });

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

  private readonly formValue = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });
  protected readonly currency = computed(() => this.formValue().currency ?? 'CHF');
  protected readonly lines = computed(() =>
    (this.formValue().items ?? []).map((i) => {
      const sub = (i.quantity ?? 0) * (i.unit_price ?? 0) * (1 - (i.discount_percentage ?? 0) / 100);
      return { sub, tax: sub * ((i.tax_rate ?? 0) / 100) };
    }),
  );
  protected readonly totals = computed(() => {
    const net = this.lines().reduce((s, l) => s + l.sub, 0);
    const vat = this.lines().reduce((s, l) => s + l.tax, 0);
    return { net, vat, gross: net + vat };
  });

  constructor() {
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
      invoice_number: '',
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
        description: this.fb.control(item?.description ?? '', Validators.required),
        quantity: this.fb.control(item?.quantity ?? 1, [Validators.required, Validators.min(0.01)]),
        unit_price: this.fb.control(item?.unit_price ?? 0, [Validators.required, Validators.min(0)]),
        tax_rate: this.fb.control(item?.tax_rate ?? 8.1, [Validators.required, Validators.min(0)]),
        discount_percentage: this.fb.control(item?.discount_percentage ?? 0),
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
    if (control?.hasError('min')) {
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
      invoice_number: v.invoice_number,
      date: toIsoDate(v.date),
      due_date: v.due_date ? toIsoDate(v.due_date) : null,
      currency: v.currency,
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
        applyServerErrors(this.form, err).forEach((m) => this.message.error(m));
      },
    });
  }
}
