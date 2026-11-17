import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  applyServerErrors,
  EquipmentComponent,
  I18nService,
  RmaOrder,
  serverErrorMessage,
} from '@core';
import { TranslatePipe } from '@shared';
import { ActionResult } from '../../state/action-result';
import { RmaDetailStore } from '../../state/rma-detail.store';

type ReplacedRow = FormGroup<{
  old_component_id: FormControl<string | null>;
  new_component_serial: FormControl<string>;
  component_product_id: FormControl<string>;
}>;

/** Repair completion: replaced components update the as-maintained genealogy. */
@Component({
  selector: 'app-rma-complete-repair-dialog',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzButtonModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'RMA.ACTIONS.COMPLETE_REPAIR' | translate"
      [nzWidth]="720"
      [nzOkText]="'COMMON.CONFIRM' | translate"
      [nzCancelText]="'COMMON.CANCEL' | translate"
      [nzOkLoading]="store.busy()"
      (nzOnOk)="submit()"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <h4>{{ 'RMA.REPAIR.REPLACED_COMPONENTS' | translate }}</h4>
          <div formArrayName="replaced_components">
            @for (row of form.controls.replaced_components.controls; track row; let i = $index) {
              <div class="rma-row-grid" [formGroupName]="i">
                <nz-form-item>
                  <nz-form-label nzRequired [nzFor]="'cr-old-' + i">{{
                    'RMA.REPAIR.OLD_COMPONENT' | translate
                  }}</nz-form-label>
                  <nz-form-control
                    [nzErrorTip]="errorTip('replaced_components.' + i + '.old_component_id')"
                  >
                    <nz-select [nzId]="'cr-old-' + i" formControlName="old_component_id">
                      @for (c of components(); track c.id) {
                        <nz-option
                          [nzValue]="c.id"
                          [nzLabel]="c.position + ' - ' + c.component_serial"
                        />
                      }
                    </nz-select>
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label nzRequired [nzFor]="'cr-new-' + i">{{
                    'RMA.REPAIR.NEW_SERIAL' | translate
                  }}</nz-form-label>
                  <nz-form-control
                    [nzErrorTip]="errorTip('replaced_components.' + i + '.new_component_serial')"
                  >
                    <input nz-input [id]="'cr-new-' + i" formControlName="new_component_serial" />
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label [nzFor]="'cr-product-' + i">{{
                    'RMA.FIELDS.PRODUCT_ID' | translate
                  }}</nz-form-label>
                  <nz-form-control>
                    <input
                      nz-input
                      [id]="'cr-product-' + i"
                      formControlName="component_product_id"
                    />
                  </nz-form-control>
                </nz-form-item>
                <button
                  nz-button
                  nzDanger
                  type="button"
                  class="rma-row-remove"
                  (click)="form.controls.replaced_components.removeAt(i)"
                  [attr.aria-label]="'RMA.ACTIONS.REMOVE_ROW' | translate"
                >
                  <i class="fa-solid fa-trash" aria-hidden="true"></i>
                </button>
              </div>
            }
          </div>
          <button
            nz-button
            nzType="dashed"
            type="button"
            [disabled]="components().length === 0"
            (click)="addRow()"
          >
            <i class="fa-solid fa-plus" aria-hidden="true"></i>&nbsp;{{
              'RMA.REPAIR.ADD_REPLACEMENT' | translate
            }}
          </button>
          <nz-form-item>
            <nz-form-label nzFor="cr-firmware">{{
              'RMA.PASSPORT.FIRMWARE' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('installed_firmware_version')">
              <input nz-input id="cr-firmware" formControlName="installed_firmware_version" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="cr-test">{{ 'RMA.REPAIR.TEST_NOTES' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('test_notes')">
              <textarea nz-input id="cr-test" rows="3" formControlName="test_notes"></textarea>
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
export class CompleteRepairDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);
  readonly store = inject(RmaDetailStore);

  readonly open = model(false);
  /** Current (as-maintained) components of the passport. */
  readonly components = input<EquipmentComponent[]>([]);
  readonly finished = output<ActionResult<RmaOrder>>();
  readonly formErrors = signal<string[]>([]);

  readonly form = this.fb.group({
    replaced_components: this.fb.array<ReplacedRow>([]),
    installed_firmware_version: this.fb.control(''),
    test_notes: this.fb.control(''),
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset();
        this.form.controls.replaced_components.clear();
        this.formErrors.set([]);
      }
    });
  }

  addRow(): void {
    this.form.controls.replaced_components.push(
      this.fb.group({
        old_component_id: this.fb.control<string | null>(null, Validators.required),
        new_component_serial: this.fb.control('', Validators.required),
        component_product_id: this.fb.control(''),
      }),
    );
  }

  errorTip(path: string): string {
    return serverErrorMessage(this.form, path) ?? this.i18n.translate('COMMON.VALIDATION.REQUIRED');
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.controls.replaced_components.controls.forEach((g) =>
        Object.values(g.controls).forEach((c) => {
          c.markAsDirty();
          c.updateValueAndValidity();
        }),
      );
      return;
    }
    const v = this.form.getRawValue();
    const res = await this.store.completeRepair({
      replaced_components: v.replaced_components.map((r) => ({
        old_component_id: r.old_component_id ?? '',
        new_component_serial: r.new_component_serial.trim(),
        component_product_id: r.component_product_id.trim() || null,
      })),
      installed_firmware_version: v.installed_firmware_version.trim() || null,
      test_notes: v.test_notes.trim() || null,
    });
    if (!res.ok && res.status === 422) {
      this.formErrors.set(applyServerErrors(this.form, res.error));
      return;
    }
    this.open.set(false);
    this.finished.emit(res);
  }
}
