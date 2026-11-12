import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  applyServerErrors,
  AssociationAreaApiService,
  AssociationAreaCard,
  AssociationAreaContactRequest,
  AssociationAreaProfile,
  I18nService,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { saveBlob } from './save-blob';

/** Profile of the selected person: contact data to edit and the membership card. */
@Component({
  selector: 'app-area-profile',
  styleUrl: './area-profile.component.scss',
  imports: [NzButtonModule, NzDescriptionsModule, NzFormModule, NzInputModule, NzTagModule, ReactiveFormsModule, TranslatePipe],
  template: `
    @if (person(); as profile) {
      <nz-descriptions nzBordered nzSize="small" [nzColumn]="2" [nzTitle]="'ASSOC_AREA.PROFILE' | translate">
        <nz-descriptions-item [nzTitle]="'ASSOC_AREA.NAME' | translate">{{ profile.first_name }} {{ profile.last_name }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'ASSOC_AREA.STATUS' | translate"><nz-tag>{{ profile.status }}</nz-tag></nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'ASSOC_AREA.BIRTH_DATE' | translate">{{ profile.birth_date }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'ASSOC_AREA.TAX_CODE' | translate">{{ profile.tax_code }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'ASSOC_AREA.EMERGENCY_CONTACT' | translate">{{ profile.emergency_contact }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'ASSOC_AREA.ALLERGIES' | translate">{{ profile.allergies }}</nz-descriptions-item>
      </nz-descriptions>

      <h3 class="area-section">{{ 'ASSOC_AREA.CONTACT' | translate }}</h3>
      <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="save()">
        <ng-template #fieldTip let-control>
          @if (control.errors?.['serverError']) {
            {{ control.errors['serverError'] }}
          } @else if (control.hasError('required')) {
            {{ 'COMMON.VALIDATION.REQUIRED' | translate }}
          } @else if (control.hasError('email')) {
            {{ 'COMMON.VALIDATION.INVALID_EMAIL' | translate }}
          } @else {
            {{ 'COMMON.VALIDATION.INVALID_VALUE' | translate }}
          }
        </ng-template>
        <nz-form-item>
          <nz-form-label nzFor="area-email">{{ 'ASSOC_AREA.EMAIL' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="fieldTip">
            <input nz-input id="area-email" type="email" formControlName="email" autocomplete="email" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="area-phone">{{ 'ASSOC_AREA.PHONE' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="fieldTip">
            <input nz-input id="area-phone" type="tel" formControlName="phone" autocomplete="tel" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="area-street" [nzRequired]="addressStarted()">{{ 'ASSOC_AREA.STREET' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="fieldTip">
            <input nz-input id="area-street" formControlName="street" autocomplete="address-line1" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="area-house-number">{{ 'ASSOC_AREA.HOUSE_NUMBER' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="fieldTip">
            <input nz-input id="area-house-number" formControlName="house_number" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="area-postal-code" [nzRequired]="addressStarted()">{{ 'ASSOC_AREA.POSTAL_CODE' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="fieldTip">
            <input nz-input id="area-postal-code" formControlName="postal_code" autocomplete="postal-code" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="area-city" [nzRequired]="addressStarted()">{{ 'ASSOC_AREA.CITY' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="fieldTip">
            <input nz-input id="area-city" formControlName="city" autocomplete="address-level2" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="area-canton">{{ 'ASSOC_AREA.STATE_CANTON' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="fieldTip">
            <input nz-input id="area-canton" formControlName="state_canton" />
          </nz-form-control>
        </nz-form-item>
        <button nz-button nzType="primary" type="submit" [nzLoading]="saving()">{{ 'ASSOC_AREA.SAVE' | translate }}</button>
      </form>

      <h3 class="area-section">{{ 'ASSOC_AREA.CARD' | translate }}</h3>
      @if (card(); as membership) {
        @if (membership.card_number) {
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="2">
            <nz-descriptions-item [nzTitle]="'ASSOC_AREA.CARD_NUMBER' | translate">{{ membership.card_number }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'ASSOC_AREA.STATUS' | translate"><nz-tag>{{ membership.status }}</nz-tag></nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'ASSOC_AREA.VALID_TO' | translate">{{ membership.valid_to }}</nz-descriptions-item>
          </nz-descriptions>
          <button nz-button class="area-gap" type="button" (click)="downloadCard(profile.id)">{{ 'ASSOC_AREA.DOWNLOAD_CARD' | translate }}</button>
        } @else {
          <p>{{ 'ASSOC_AREA.NO_CARD' | translate }}</p>
        }
      }
    }
  `,
})
export class AreaProfileComponent {
  private readonly api = inject(AssociationAreaApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly person = input.required<AssociationAreaProfile | null>();
  /** True when the person is the holder of the link, false for a minor in care. */
  readonly isSelf = input(true);
  readonly contact = input<{ email: string | null; phone: string | null } | null>(null);
  readonly updated = output<void>();

  protected readonly card = signal<AssociationAreaCard | null>(null);
  protected readonly saving = signal(false);
  protected readonly form = this.fb.group({
    email: ['', [Validators.email, Validators.maxLength(255)]],
    phone: ['', [Validators.maxLength(50)]],
    street: ['', [Validators.maxLength(255)]],
    house_number: ['', [Validators.maxLength(20)]],
    postal_code: ['', [Validators.maxLength(20)]],
    city: ['', [Validators.maxLength(255)]],
    state_canton: ['', [Validators.maxLength(50)]],
  });

  private readonly addressValidatorSync = this.form.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe(() => this.syncAddressValidators());

  /** The address is sent as a whole: once one of its fields is filled, street, postal code and city are required. */
  protected addressStarted(): boolean {
    const value = this.form.getRawValue();
    return [value.street, value.house_number, value.postal_code, value.city, value.state_canton].some(
      (part) => part.trim() !== '',
    );
  }

  private syncAddressValidators(): void {
    const started = this.addressStarted();
    for (const control of [this.form.controls.street, this.form.controls.postal_code, this.form.controls.city]) {
      if (started === control.hasValidator(Validators.required)) {
        continue;
      }
      if (started) {
        control.addValidators(Validators.required);
      } else {
        control.removeValidators(Validators.required);
      }
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  constructor() {
    effect(() => {
      const person = this.person();
      const contact = this.contact();
      this.form.patchValue({ email: contact?.email ?? person?.email ?? '', phone: contact?.phone ?? person?.phone ?? '' });
      if (person) {
        this.api.card(person.id).subscribe({ next: (res) => this.card.set(res.data), error: () => this.card.set(null) });
      }
    });
  }

  protected save(): void {
    const person = this.person();
    this.form.markAllAsTouched();
    if (!person || this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const payload: AssociationAreaContactRequest = { phone: value.phone || null };
    if (value.email) {
      payload.email = value.email;
    }
    if (value.street) {
      payload.address = {
        street: value.street,
        house_number: value.house_number || null,
        postal_code: value.postal_code,
        city: value.city,
        state_canton: value.state_canton || null,
      };
    }
    this.saving.set(true);
    const request = this.isSelf() ? this.api.updateContact(payload) : this.api.updateWardContact(person.id, payload);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('ASSOC_AREA.SAVED'));
        this.updated.emit();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.form, err);
        if (unmapped.length > 0) {
          this.message.error(unmapped[0]);
        }
      },
    });
  }

  protected downloadCard(memberId: string): void {
    this.api.cardPdf(memberId).subscribe((blob) => saveBlob(blob, 'membership-card.pdf'));
  }
}
