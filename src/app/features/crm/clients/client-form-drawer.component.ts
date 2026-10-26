import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { TranslatePipe } from '@shared';
import {
  applyServerErrors,
  ClientApiService,
  ContactPayload,
  ContactResource,
  ContactType,
  I18nService,
  serverErrorMessage,
} from '@core';

interface TextField {
  key: 'company_name' | 'first_name' | 'last_name' | 'email' | 'phone' | 'vat_number' | 'fiscal_code' | 'uid_number' | 'sdi_code' | 'pec' | 'iban' | 'qr_iban';
  label: string;
}

const nullable = (v: string): string | null => v.trim() || null;

@Component({
  selector: 'app-client-form-drawer',
  imports: [
    ReactiveFormsModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzButtonModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      [nzTitle]="(contact() ? 'CRM.CLIENTS.EDIT_TITLE' : 'CRM.CLIENTS.NEW') | translate"
      [nzWidth]="560"
      (nzOnClose)="open.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="type">{{ 'CRM.CLIENTS.FORM.TYPE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select id="type" formControlName="type">
                @for (o of typeOptions; track o.value) {
                  <nz-option [nzValue]="o.value" [nzLabel]="o.label | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          @for (f of textFields; track f.key) {
            <nz-form-item>
              <nz-form-label [nzFor]="f.key">{{ f.label | translate }}</nz-form-label>
              <nz-form-control
                nzHasFeedback
                [nzValidateStatus]="form.controls[f.key]"
                [nzErrorTip]="errorTip(f.key)"
              >
                <input nz-input [id]="f.key" [formControlName]="f.key" />
              </nz-form-control>
            </nz-form-item>
          }

          <nz-form-item>
            <nz-form-label nzFor="payment_terms_days">{{ 'CRM.CLIENTS.FORM.PAYMENT_TERMS' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('payment_terms_days')">
              <nz-input-number id="payment_terms_days" formControlName="payment_terms_days" [nzMin]="0" />
            </nz-form-control>
          </nz-form-item>

          <div formGroupName="address">
            <h4>{{ 'CRM.CLIENTS.FORM.ADDRESS' | translate }}</h4>
            @for (a of addressFields; track a.key) {
              <nz-form-item>
                <nz-form-label [nzFor]="'address_' + a.key" [nzRequired]="a.required">{{ a.label | translate }}</nz-form-label>
                <nz-form-control
                  nzHasFeedback
                  [nzValidateStatus]="form.controls.address.controls[a.key]"
                  [nzErrorTip]="errorTip('address.' + a.key)"
                >
                  <input nz-input [id]="'address_' + a.key" [formControlName]="a.key" />
                </nz-form-control>
              </nz-form-item>
            }
          </div>

          <nz-form-item>
            <nz-form-label nzRequired nzFor="country">{{ 'CRM.CLIENTS.FORM.COUNTRY' | translate }}</nz-form-label>
            <nz-form-control nzHasFeedback [nzValidateStatus]="form.controls.country" [nzErrorTip]="errorTip('country')">
              <input nz-input id="country" formControlName="country" maxlength="2" />
            </nz-form-control>
          </nz-form-item>

          <div class="actions">
            <button nz-button type="button" (click)="open.set(false)">{{ 'COMMON.CANCEL' | translate }}</button>
            <button nz-button nzType="primary" type="submit" [nzLoading]="saving()">{{ 'COMMON.SAVE' | translate }}</button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
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
    country: this.fb.control('CH', [Validators.required, Validators.maxLength(2)]),
    company_name: this.fb.control(''),
    first_name: this.fb.control(''),
    last_name: this.fb.control(''),
    email: this.fb.control('', Validators.email),
    phone: this.fb.control(''),
    vat_number: this.fb.control(''),
    fiscal_code: this.fb.control(''),
    uid_number: this.fb.control(''),
    sdi_code: this.fb.control(''),
    pec: this.fb.control('', Validators.email),
    iban: this.fb.control(''),
    qr_iban: this.fb.control(''),
    payment_terms_days: new FormControl<number | null>(30),
    address: this.fb.group({
      street: this.fb.control(''),
      house_number: this.fb.control(''),
      postal_code: this.fb.control(''),
      city: this.fb.control(''),
      state_canton: this.fb.control(''),
    }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      const c = this.contact();
      this.form.reset();
      if (c) {
        this.form.patchValue({
          type: c.type,
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
            street: c.address?.street ?? '',
            house_number: c.address?.house_number ?? '',
            postal_code: c.address?.postal_code ?? '',
            city: c.address?.city ?? '',
            state_canton: c.address?.state_canton ?? '',
          },
        });
      } else {
        this.form.patchValue({ type: 'client', country: 'CH', payment_terms_days: 30 });
      }
    });
  }

  errorTip(path: string): string {
    const control = this.form.get(path);
    if (control?.hasError('email')) {
      return this.i18n.translate('COMMON.VALIDATION.INVALID_EMAIL');
    }
    if (control?.hasError('required')) {
      return this.i18n.translate('COMMON.VALIDATION.REQUIRED');
    }
    return serverErrorMessage(this.form, path) ?? '';
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const v = this.form.getRawValue();
    const hasAddress = !!(v.address.street.trim() && v.address.city.trim());
    const payload: ContactPayload = {
      type: v.type,
      country: v.country.toUpperCase(),
      company_name: nullable(v.company_name),
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
        this.message.success(this.i18n.translate(current ? 'CRM.CLIENTS.MESSAGES.UPDATED' : 'CRM.CLIENTS.MESSAGES.CREATED'));
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
