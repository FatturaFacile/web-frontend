import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import {
  applyServerErrors,
  I18nService,
  PgLegalBasis,
  PgRopaActivity,
  PgRopaPayload,
  PrivacyGovernanceApiService,
} from '@core';
import { TranslatePipe } from '@shared';
import { pgErrorMessage, uniqueTags } from './privacy-governance.helpers';

export const PG_LEGAL_BASES: readonly PgLegalBasis[] = [
  'consent',
  'contract',
  'legal_obligation',
  'vital_interests',
  'public_interest',
  'legitimate_interest',
];

type TransferGroup = FormGroup<{
  country_code: FormControl<string>;
  adequacy_decision: FormControl<boolean>;
  safeguard_mechanism: FormControl<string>;
}>;

/** Create / edit drawer of a record of processing activities (RoPA) entry. */
@Component({
  selector: 'app-ropa-editor-drawer',
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    TranslatePipe,
  ],
  styles: `
    .transfer-row {
      display: grid;
      grid-template-columns: 90px auto 1fr auto;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }
    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      nzWidth="640"
      [nzTitle]="(activity() ? 'PRIVACY.ROPA.EDIT' : 'PRIVACY.ROPA.NEW') | translate"
      [nzFooter]="footer"
      (nzOnClose)="visible.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="save()" id="ropa-form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ropa-code">{{
              'PRIVACY.ROPA.CODE' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.activity_code.errors?.['serverError']">
              <input nz-input id="ropa-code" formControlName="activity_code" maxlength="50" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ropa-name">{{
              'PRIVACY.ROPA.NAME' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.activity_name.errors?.['serverError']">
              <input nz-input id="ropa-name" formControlName="activity_name" maxlength="190" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ropa-purpose">{{
              'PRIVACY.ROPA.PURPOSE' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="form.controls.purpose.errors?.['serverError']">
              <textarea nz-input id="ropa-purpose" rows="3" formControlName="purpose"></textarea>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ropa-basis">{{
              'PRIVACY.ROPA.LEGAL_BASIS' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="ropa-basis" formControlName="legal_basis">
                @for (basis of legalBases; track basis) {
                  <nz-option
                    [nzValue]="basis"
                    [nzLabel]="'PRIVACY.LEGAL_BASIS.' + basis | translate"
                  />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          @for (field of tagFields; track field.control) {
            <nz-form-item>
              <nz-form-label>{{ field.label | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select
                  nzMode="tags"
                  [formControl]="form.controls[field.control]"
                  [nzPlaceHolder]="'PRIVACY.ROPA.TAG_PLACEHOLDER' | translate"
                  [nzTokenSeparators]="[',']"
                />
              </nz-form-control>
            </nz-form-item>
          }

          <nz-form-item>
            <nz-form-label>{{ 'PRIVACY.ROPA.TRANSFERS' | translate }}</nz-form-label>
            <nz-form-control>
              @for (transfer of transfers.controls; track transfer; let i = $index) {
                <div class="transfer-row" [formGroup]="transfer">
                  <input
                    nz-input
                    formControlName="country_code"
                    maxlength="2"
                    [attr.aria-label]="'PRIVACY.ROPA.COUNTRY' | translate"
                    [placeholder]="'PRIVACY.ROPA.COUNTRY' | translate"
                  />
                  <span>
                    <nz-switch
                      formControlName="adequacy_decision"
                      [attr.aria-label]="'PRIVACY.ROPA.ADEQUACY' | translate"
                    />
                    {{ 'PRIVACY.ROPA.ADEQUACY' | translate }}
                  </span>
                  <input
                    nz-input
                    formControlName="safeguard_mechanism"
                    [attr.aria-label]="'PRIVACY.ROPA.SAFEGUARD' | translate"
                    [placeholder]="'PRIVACY.ROPA.SAFEGUARD' | translate"
                  />
                  <button nz-button nzDanger type="button" (click)="removeTransfer(i)">
                    {{ 'PRIVACY.COMMON.REMOVE' | translate }}
                  </button>
                </div>
              }
              <button nz-button type="button" (click)="addTransfer()">
                {{ 'PRIVACY.ROPA.ADD_TRANSFER' | translate }}
              </button>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzFor="ropa-retention">{{
              'PRIVACY.ROPA.RETENTION_MONTHS' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-input-number
                nzId="ropa-retention"
                formControlName="retention_period_months"
                [nzMin]="0"
                [nzMax]="1200"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="ropa-reference">{{
              'PRIVACY.ROPA.RETENTION_REFERENCE' | translate
            }}</nz-form-label>
            <nz-form-control>
              <input
                nz-input
                id="ropa-reference"
                formControlName="retention_legal_reference"
                maxlength="190"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'PRIVACY.ROPA.ACTIVE' | translate }}</nz-form-label>
            <nz-form-control><nz-switch formControlName="is_active" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
      <ng-template #footer>
        <div class="footer">
          <button nz-button type="button" (click)="visible.set(false)">
            {{ 'PRIVACY.COMMON.CANCEL' | translate }}
          </button>
          <button
            nz-button
            nzType="primary"
            type="submit"
            form="ropa-form"
            [nzLoading]="saving()"
            [disabled]="form.invalid"
          >
            {{ 'PRIVACY.COMMON.SAVE' | translate }}
          </button>
        </div>
      </ng-template>
    </nz-drawer>
  `,
})
export class RopaEditorDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(PrivacyGovernanceApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly visible = model(false);
  readonly activity = input<PgRopaActivity | null>(null);
  readonly saved = output<PgRopaActivity>();

  readonly legalBases = PG_LEGAL_BASES;
  readonly saving = signal(false);

  readonly tagFields = [
    { control: 'data_subject_categories', label: 'PRIVACY.ROPA.DATA_SUBJECTS' },
    { control: 'personal_data_categories', label: 'PRIVACY.ROPA.DATA_CATEGORIES' },
    { control: 'recipient_categories', label: 'PRIVACY.ROPA.RECIPIENTS' },
    { control: 'technical_organizational_measures', label: 'PRIVACY.ROPA.TOMS' },
  ] as const;

  readonly transfers = new FormArray<TransferGroup>([]);

  readonly form = this.fb.group({
    activity_code: ['', [Validators.required, Validators.maxLength(50)]],
    activity_name: ['', [Validators.required, Validators.maxLength(190)]],
    purpose: ['', Validators.required],
    legal_basis: ['contract' as PgLegalBasis, Validators.required],
    data_subject_categories: [[] as string[]],
    personal_data_categories: [[] as string[]],
    recipient_categories: [[] as string[]],
    technical_organizational_measures: [[] as string[]],
    retention_period_months: [null as number | null],
    retention_legal_reference: [''],
    is_active: [true],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.reset(this.activity());
      }
    });
  }

  addTransfer(value?: {
    country_code: string;
    adequacy_decision: boolean;
    safeguard_mechanism: string | null;
  }): void {
    this.transfers.push(
      this.fb.group({
        country_code: [
          value?.country_code ?? '',
          [Validators.required, Validators.minLength(2), Validators.maxLength(2)],
        ],
        adequacy_decision: [value?.adequacy_decision ?? false],
        safeguard_mechanism: [value?.safeguard_mechanism ?? ''],
      }),
    );
  }

  removeTransfer(index: number): void {
    this.transfers.removeAt(index);
  }

  save(): void {
    if (this.form.invalid || this.transfers.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const payload: PgRopaPayload = {
      ...raw,
      activity_code: raw.activity_code.trim(),
      data_subject_categories: uniqueTags(raw.data_subject_categories),
      personal_data_categories: uniqueTags(raw.personal_data_categories),
      recipient_categories: uniqueTags(raw.recipient_categories),
      technical_organizational_measures: uniqueTags(raw.technical_organizational_measures),
      retention_legal_reference: raw.retention_legal_reference.trim() || null,
      cross_border_transfers: this.transfers.getRawValue().map((transfer) => ({
        country_code: transfer.country_code.trim().toUpperCase(),
        adequacy_decision: transfer.adequacy_decision,
        safeguard_mechanism: transfer.safeguard_mechanism.trim() || null,
      })),
    };
    const current = this.activity();
    const request = current
      ? this.api.updateRopa(current.id, payload)
      : this.api.createRopa(payload);
    this.saving.set(true);
    request.subscribe({
      next: (response) => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('PRIVACY.COMMON.SAVED'));
        this.visible.set(false);
        this.saved.emit(response.data);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        applyServerErrors(this.form, err);
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.SAVE_FAILED')));
      },
    });
  }

  private reset(activity: PgRopaActivity | null): void {
    this.transfers.clear();
    this.form.reset({
      activity_code: activity?.activity_code ?? '',
      activity_name: activity?.activity_name ?? '',
      purpose: activity?.purpose ?? '',
      legal_basis: activity?.legal_basis ?? 'contract',
      data_subject_categories: activity?.data_subject_categories ?? [],
      personal_data_categories: activity?.personal_data_categories ?? [],
      recipient_categories: activity?.recipient_categories ?? [],
      technical_organizational_measures: activity?.technical_organizational_measures ?? [],
      retention_period_months: activity?.retention_period_months ?? null,
      retention_legal_reference: activity?.retention_legal_reference ?? '',
      is_active: activity?.is_active ?? true,
    });
    for (const transfer of activity?.cross_border_transfers ?? []) {
      this.addTransfer(transfer);
    }
  }
}
