import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ADDRESS_TYPES,
  AddressType,
  applyServerErrors,
  ClientApiService,
  ContactAddressRecord,
  I18nService,
} from '@core';
import { TranslatePipe } from '@shared';

/** Addresses of a customer: several per type (legal, billing, shipping, site), one default per type. */
@Component({
  selector: 'app-customer-360-addresses',
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    @for (group of groups(); track group.type) {
      <h4>{{ 'CRM.CUSTOMER360.ADDRESS_TYPE_' + group.type.toUpperCase() | translate }}</h4>
      @for (address of group.items; track address.id) {
        <div class="row">
          <span>
            {{ address.street }} {{ address.house_number }}, {{ address.postal_code }}
            {{ address.city }} ({{ address.country }})
          </span>
          @if (address.is_default) {
            <nz-tag nzColor="green">{{ 'CRM.CUSTOMER360.DEFAULT' | translate }}</nz-tag>
          } @else {
            <button nz-button nzSize="small" type="button" (click)="makeDefault(address)">
              {{ 'CRM.CUSTOMER360.SET_DEFAULT' | translate }}
            </button>
          }
          <button nz-button nzSize="small" nzDanger type="button" (click)="remove(address)">
            {{ 'COMMON.DELETE' | translate }}
          </button>
        </div>
      }
    } @empty {
      <nz-empty />
    }

    <form nz-form nzLayout="inline" [formGroup]="form" (ngSubmit)="add()" class="add">
      <nz-form-item>
        <nz-select formControlName="type" [attr.aria-label]="'CRM.CUSTOMER360.ADDRESS_TYPE' | translate">
          @for (type of types; track type) {
            <nz-option
              [nzValue]="type"
              [nzLabel]="'CRM.CUSTOMER360.ADDRESS_TYPE_' + type.toUpperCase() | translate"
            />
          }
        </nz-select>
      </nz-form-item>
      <nz-form-item>
        <input nz-input formControlName="street" [placeholder]="'CRM.CLIENTS.FORM.STREET' | translate" />
      </nz-form-item>
      <nz-form-item>
        <input nz-input formControlName="house_number" [placeholder]="'CRM.CLIENTS.FORM.HOUSE_NUMBER' | translate" />
      </nz-form-item>
      <nz-form-item>
        <input nz-input formControlName="postal_code" [placeholder]="'CRM.CLIENTS.FORM.POSTAL_CODE' | translate" />
      </nz-form-item>
      <nz-form-item>
        <input nz-input formControlName="city" [placeholder]="'CRM.CLIENTS.FORM.CITY' | translate" />
      </nz-form-item>
      <nz-form-item>
        <input nz-input formControlName="country" maxlength="2" [placeholder]="'CRM.CLIENTS.FORM.COUNTRY' | translate" />
      </nz-form-item>
      <button nz-button nzType="primary" type="submit" [disabled]="form.invalid" [nzLoading]="saving()">
        {{ 'CRM.CUSTOMER360.ADD_ADDRESS' | translate }}
      </button>
    </form>
  `,
  styles: `
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      padding: 4px 0;
    }
    .add {
      margin-top: 12px;
      gap: 8px;
    }
  `,
})
export class Customer360AddressesComponent implements OnInit {
  private readonly api = inject(ClientApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly contactId = input.required<string>();
  protected readonly types = ADDRESS_TYPES;
  protected readonly addresses = signal<ContactAddressRecord[]>([]);
  protected readonly saving = signal(false);

  /** Addresses grouped by type, in the order of the types; the default of a type comes first. */
  protected readonly groups = computed(() =>
    ADDRESS_TYPES.map((type) => ({
      type,
      items: this.addresses()
        .filter((address) => address.type === type)
        .sort((a, b) => Number(b.is_default) - Number(a.is_default)),
    })).filter((group) => group.items.length > 0),
  );

  protected readonly form = this.fb.group({
    type: this.fb.control<AddressType>('shipping', Validators.required),
    street: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    house_number: this.fb.control('', Validators.maxLength(20)),
    postal_code: this.fb.control('', [Validators.required, Validators.maxLength(20)]),
    city: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    country: this.fb.control('CH', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .addresses(this.contactId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (res) => this.addresses.set(res.data), error: () => this.addresses.set([]) });
  }

  protected add(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const first = !this.addresses().some((address) => address.type === value.type);
    this.saving.set(true);
    this.api
      .createAddress(this.contactId(), {
        ...value,
        house_number: value.house_number.trim() || null,
        country: value.country.toUpperCase(),
        // The first address of a type is its default.
        is_default: first,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.form.patchValue({ street: '', house_number: '', postal_code: '', city: '' });
          this.form.markAsUntouched();
          this.load();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          applyServerErrors(this.form, err).forEach((m) => this.message.error(m));
        },
      });
  }

  protected makeDefault(address: ContactAddressRecord): void {
    this.api.setDefaultAddress(this.contactId(), address.id).subscribe({
      next: () => this.load(),
      error: () => this.message.error(this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE')),
    });
  }

  protected remove(address: ContactAddressRecord): void {
    this.api.deleteAddress(this.contactId(), address.id).subscribe({
      next: () => this.load(),
      error: () => this.message.error(this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE')),
    });
  }
}
