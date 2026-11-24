import { Component, effect, inject, input, model, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { applyServerErrors, EquipmentPassport, I18nService, serverErrorMessage } from '@core';
import { TranslatePipe } from '@shared';
import { PassportStore } from '../../state/passport.store';

/** Edits the mutable data of an equipment passport: owner, installed firmware and contractual warranty. */
@Component({
  selector: 'app-edit-passport-dialog',
  imports: [ReactiveFormsModule, NzModalModule, NzFormModule, NzInputModule, NzInputNumberModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'RMA.PASSPORT.EDIT' | translate"
      [nzOkText]="'COMMON.SAVE' | translate"
      [nzCancelText]="'COMMON.CANCEL' | translate"
      [nzOkLoading]="store.saving()"
      (nzOnOk)="submit()"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="pp-owner">{{ 'RMA.PASSPORT.OWNER_CUSTOMER_ID' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('current_owner_customer_id')">
              <input nz-input id="pp-owner" formControlName="current_owner_customer_id" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="pp-firmware">{{ 'RMA.PASSPORT.FIRMWARE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('installed_firmware_version')">
              <input nz-input id="pp-firmware" formControlName="installed_firmware_version" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="pp-months">{{ 'RMA.PASSPORT.CONTRACT_MONTHS' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('contract_warranty_months')">
              <nz-input-number nzId="pp-months" formControlName="contract_warranty_months" [nzMin]="1" [nzMax]="240" [nzStep]="1" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="pp-clause">{{ 'RMA.PASSPORT.CLAUSE_REFERENCE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('contract_clause_reference')">
              <input nz-input id="pp-clause" formControlName="contract_clause_reference" />
            </nz-form-control>
          </nz-form-item>
          @for (msg of formErrors(); track msg) {
            <p class="rma-form-error" role="alert">{{ msg }}</p>
          }
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class EditPassportDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);
  readonly store = inject(PassportStore);

  readonly open = model(false);
  readonly passport = input.required<EquipmentPassport>();
  readonly formErrors = signal<string[]>([]);

  readonly form = this.fb.group({
    current_owner_customer_id: this.fb.control('', Validators.required),
    installed_firmware_version: this.fb.control(''),
    contract_warranty_months: this.fb.control<number | null>(null),
    contract_clause_reference: this.fb.control(''),
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        const p = this.passport();
        this.form.reset({
          current_owner_customer_id: p.current_owner_customer_id,
          installed_firmware_version: p.installed_firmware_version ?? '',
          contract_warranty_months: p.contract_warranty_months,
          contract_clause_reference: p.contract_clause_reference ?? '',
        });
        this.formErrors.set([]);
      }
    });
  }

  errorTip(path: string): string {
    return serverErrorMessage(this.form, path) ?? this.i18n.translate('COMMON.VALIDATION.REQUIRED');
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((c) => {
        c.markAsDirty();
        c.updateValueAndValidity();
      });
      return;
    }
    const v = this.form.getRawValue();
    const res = await this.store.updatePassport(this.passport().id, {
      current_owner_customer_id: v.current_owner_customer_id.trim(),
      installed_firmware_version: v.installed_firmware_version.trim() || null,
      contract_warranty_months: v.contract_warranty_months,
      contract_clause_reference: v.contract_clause_reference.trim() || null,
    });
    if (res.ok) {
      this.open.set(false);
      return;
    }
    this.formErrors.set(applyServerErrors(this.form, res.error));
  }
}
