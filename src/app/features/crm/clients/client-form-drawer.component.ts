import { Component, DestroyRef, effect, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { IconActionDirective, ModalActionsDirective, TranslatePipe } from '@shared';
import {
  applyServerErrors,
  ClientApiService,
  ContactPayload,
  contactBillingAddress,
  ContactLegalType,
  ContactResource,
  ContactType,
  I18nService,
  serverErrorMessage,
} from '@core';

interface TextField {
  key:
    | 'company_name'
    | 'first_name'
    | 'last_name'
    | 'email'
    | 'phone'
    | 'vat_number'
    | 'fiscal_code'
    | 'uid_number'
    | 'sdi_code'
    | 'pec'
    | 'iban'
    | 'qr_iban';
  label: string;
}

const nullable = (v: string): string | null => v.trim() || null;

/** A value that is filled must have exactly this length (the SDI code is 7 characters or empty). */
function exactLengthWhenFilled(length: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    return value === '' || value.length === length ? null : { exactLength: { requiredLength: length } };
  };
}

@Component({
  selector: 'app-client-form-drawer',
  styleUrl: './client-form-drawer.component.scss',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    ModalActionsDirective,
    IconActionDirective,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzButtonModule,
    TranslatePipe,
  ],
  templateUrl: './client-form-drawer.component.html',
})
export class ClientFormDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(ClientApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly open = model(false);
  readonly contact = input<ContactResource | null>(null);
  readonly saved = output<void>();
  readonly saving = signal(false);
  /** True after the first attempt to save: the errors of the whole form are then shown. */
  readonly submitted = signal(false);
  /** The address is optional, but once one of its fields is filled street, postal code and city are required. */
  readonly addressStarted = signal(false);
  private readonly destroyRef = inject(DestroyRef);

  readonly legalTypeOptions: { label: string; value: ContactLegalType }[] = [
    { label: 'CRM.CLIENTS.LEGAL_TYPES.COMPANY', value: 'company' },
    { label: 'CRM.CLIENTS.LEGAL_TYPES.PERSON', value: 'person' },
  ];

  readonly typeOptions: { label: string; value: ContactType }[] = [
    { label: 'CRM.CLIENTS.TYPES.CLIENT', value: 'client' },
    { label: 'CRM.CLIENTS.TYPES.SUPPLIER', value: 'supplier' },
    { label: 'CRM.CLIENTS.TYPES.BOTH', value: 'both' },
    { label: 'CRM.CLIENTS.TYPES.LEAD', value: 'lead' },
  ];

  readonly textFields: TextField[] = [
    { key: 'company_name', label: 'CRM.CLIENTS.FORM.COMPANY_NAME' },
    { key: 'first_name', label: 'CRM.CLIENTS.FORM.FIRST_NAME' },
    { key: 'last_name', label: 'CRM.CLIENTS.FORM.LAST_NAME' },
    { key: 'email', label: 'CRM.CLIENTS.FORM.EMAIL' },
    { key: 'phone', label: 'CRM.CLIENTS.FORM.PHONE' },
    { key: 'vat_number', label: 'CRM.CLIENTS.FORM.VAT_NUMBER' },
    { key: 'fiscal_code', label: 'CRM.CLIENTS.FORM.FISCAL_CODE' },
    { key: 'uid_number', label: 'CRM.CLIENTS.FORM.UID' },
    { key: 'sdi_code', label: 'CRM.CLIENTS.FORM.SDI_CODE' },
    { key: 'pec', label: 'CRM.CLIENTS.FORM.PEC' },
    { key: 'iban', label: 'CRM.CLIENTS.FORM.IBAN' },
    { key: 'qr_iban', label: 'CRM.CLIENTS.FORM.QR_IBAN' },
  ];

  readonly addressFields = [
    { key: 'street', label: 'CRM.CLIENTS.FORM.STREET', required: true },
    { key: 'house_number', label: 'CRM.CLIENTS.FORM.HOUSE_NUMBER', required: false },
    { key: 'postal_code', label: 'CRM.CLIENTS.FORM.POSTAL_CODE', required: true },
    { key: 'city', label: 'CRM.CLIENTS.FORM.CITY', required: true },
    { key: 'state_canton', label: 'CRM.CLIENTS.FORM.STATE', required: false },
  ] as const;

  readonly form = this.fb.group({
    type: this.fb.control<ContactType>('client', Validators.required),
    legal_type: this.fb.control<ContactLegalType>('company', Validators.required),
    country: this.fb.control('CH', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]),
    company_name: this.fb.control('', [Validators.maxLength(255)]),
    first_name: this.fb.control('', [Validators.maxLength(100)]),
    last_name: this.fb.control('', [Validators.maxLength(100)]),
    email: this.fb.control('', [Validators.email, Validators.maxLength(255)]),
    phone: this.fb.control('', [Validators.maxLength(50)]),
    vat_number: this.fb.control('', [Validators.maxLength(30)]),
    fiscal_code: this.fb.control('', [Validators.maxLength(16)]),
    uid_number: this.fb.control('', [Validators.maxLength(20)]),
    sdi_code: this.fb.control('', [exactLengthWhenFilled(7)]),
    pec: this.fb.control('', [Validators.email, Validators.maxLength(255)]),
    iban: this.fb.control('', [Validators.maxLength(34)]),
    qr_iban: this.fb.control('', [Validators.maxLength(34)]),
    payment_terms_days: new FormControl<number | null>(30, [Validators.min(0)]),
    address: this.fb.group({
      street: this.fb.control(''),
      house_number: this.fb.control(''),
      postal_code: this.fb.control(''),
      city: this.fb.control(''),
      state_canton: this.fb.control(''),
    }),
  });

  constructor() {
    this.form.controls.address.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncAddressValidators());

    this.form.controls.legal_type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncLegalTypeValidators());
    this.syncLegalTypeValidators();

    effect(() => {
      if (!this.open()) {
        return;
      }
      const c = this.contact();
      this.submitted.set(false);
      this.form.reset();
      if (c) {
        const billing = contactBillingAddress(c);
        this.form.patchValue({
          type: c.type,
          legal_type: c.legal_type ?? (c.company_name ? 'company' : 'person'),
          country: c.country,
          company_name: c.company_name ?? '',
          first_name: c.first_name ?? '',
          last_name: c.last_name ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          vat_number: c.vat_number ?? '',
          fiscal_code: c.fiscal_code ?? '',
          uid_number: c.uid_number ?? '',
          sdi_code: c.sdi_code ?? '',
          pec: c.pec ?? '',
          iban: c.iban ?? '',
          qr_iban: c.qr_iban ?? '',
          payment_terms_days: c.payment_terms_days,
          address: {
            street: billing?.street ?? '',
            house_number: billing?.house_number ?? '',
            postal_code: billing?.postal_code ?? '',
            city: billing?.city ?? '',
            state_canton: billing?.state_canton ?? '',
          },
        });
      } else {
        this.form.patchValue({ type: 'client', legal_type: 'company', country: 'CH', payment_terms_days: 30 });
      }
    });
  }

  isCompany(): boolean {
    return this.form.controls.legal_type.value === 'company';
  }

  /** The company name is required for a company, the last name for a person; the other one is optional. */
  private syncLegalTypeValidators(): void {
    const { company_name, last_name } = this.form.controls;
    const company = this.isCompany();
    const base = (max: number) => [Validators.maxLength(max)];
    company_name.setValidators(company ? [Validators.required, ...base(255)] : base(255));
    last_name.setValidators(company ? base(100) : [Validators.required, ...base(100)]);
    company_name.updateValueAndValidity({ emitEvent: false });
    last_name.updateValueAndValidity({ emitEvent: false });
  }

  /** Whether the label of the field shows the required asterisk for the chosen kind of contact. */
  isRequiredField(key: string): boolean {
    return (key === 'company_name' && this.isCompany()) || (key === 'last_name' && !this.isCompany());
  }

  /** The fields shown for the chosen kind: a person has no company name. */
  visibleTextFields(): TextField[] {
    return this.textFields.filter((f) => f.key !== 'company_name' || this.isCompany());
  }

  private syncAddressValidators(): void {
    const address = this.form.controls.address;
    const started = Object.values(address.getRawValue()).some((value) => String(value ?? '').trim() !== '');
    if (started === this.addressStarted()) {
      return;
    }
    this.addressStarted.set(started);
    for (const key of ['street', 'postal_code', 'city'] as const) {
      const control = address.controls[key];
      if (started) {
        control.addValidators(Validators.required);
      } else {
        control.removeValidators(Validators.required);
      }
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  errorTip(path: string): string {
    const control = this.form.get(path);
    if (control?.hasError('maxlength') || control?.hasError('exactLength') || control?.hasError('pattern') || control?.hasError('min')) {
      return this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE');
    }
    if (control?.hasError('email')) {
      return this.i18n.translate('COMMON.VALIDATION.INVALID_EMAIL');
    }
    if (control?.hasError('required')) {
      return this.i18n.translate('COMMON.VALIDATION.REQUIRED');
    }
    return serverErrorMessage(this.form, path) ?? '';
  }

  submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const v = this.form.getRawValue();
    const hasAddress = !!(v.address.street.trim() && v.address.city.trim());
    const payload: ContactPayload = {
      type: v.type,
      legal_type: v.legal_type,
      country: v.country.toUpperCase(),
      company_name: v.legal_type === 'company' ? nullable(v.company_name) : null,
      first_name: nullable(v.first_name),
      last_name: nullable(v.last_name),
      email: nullable(v.email),
      phone: nullable(v.phone),
      vat_number: nullable(v.vat_number),
      fiscal_code: nullable(v.fiscal_code),
      uid_number: nullable(v.uid_number),
      sdi_code: nullable(v.sdi_code),
      pec: nullable(v.pec),
      iban: nullable(v.iban),
      qr_iban: nullable(v.qr_iban),
      payment_terms_days: v.payment_terms_days,
      address: hasAddress
        ? {
            street: v.address.street,
            house_number: nullable(v.address.house_number),
            postal_code: v.address.postal_code,
            city: v.address.city,
            state_canton: nullable(v.address.state_canton),
            country: v.country.toUpperCase(),
          }
        : null,
    };

    const current = this.contact();
    const request$ = current ? this.api.update(current.id, payload) : this.api.create(payload);
    this.saving.set(true);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(
          this.i18n.translate(
            current ? 'CRM.CLIENTS.MESSAGES.UPDATED' : 'CRM.CLIENTS.MESSAGES.CREATED',
          ),
        );
        this.open.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.form, err);
        unmapped.forEach((m) => this.message.error(m));
      },
    });
  }
}
