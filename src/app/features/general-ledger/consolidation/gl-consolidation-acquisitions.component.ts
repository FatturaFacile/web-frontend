import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import {
  applyServerErrors,
  ConsolidationAcquisition,
  ConsolidationAcquisitionPayload,
  ConsolidationGroup,
  FairValueAccountType,
  GeneralLedgerConsolidationApiService,
  I18nService,
  PermissionsService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { memberName, nullable } from './gl-consolidation.util';

/** Acquisition records of the subsidiaries: cost, net assets, fair-value adjustments and goodwill impairments. */
@Component({
  selector: 'app-gl-consolidation-acquisitions',
  styleUrl: './gl-consolidation.scss',
  imports: [
    IconActionDirective,
    ModalActionsDirective,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    GlErrorAlertComponent,
    TranslatePipe,
  ],
  template: `
    <app-gl-error-alert [error]="error()" />
    <div class="toolbar">
      <span class="muted">{{ 'GL.CONS_ACQUISITIONS_HINT' | translate }}</span>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openCreate()" appIconAction="create"></button>
      }
    </div>
    <nz-table #table nzSize="small" [nzData]="acquisitions()" [nzLoading]="loading()" [nzShowPagination]="false" [nzScroll]="{ x: '760px' }">
      <thead>
        <tr>
          <th></th>
          <th>{{ 'GL.CONS_ENTITY' | translate }}</th>
          <th>{{ 'GL.CONS_ACQUISITION_DATE' | translate }}</th>
          <th class="num">{{ 'GL.CONS_COST' | translate }}</th>
          <th class="num">{{ 'GL.CONS_NET_ASSETS' | translate }}</th>
          <th class="num">{{ 'GL.CONS_ACQUIRED_PERCENTAGE' | translate }}</th>
          <th>{{ 'GL.COL_ACTIONS' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (item of table.data; track item.id) {
          <tr>
            <td [nzExpand]="expanded() === item.id" (nzExpandChange)="expanded.set(expanded() === item.id ? null : item.id)"></td>
            <td>{{ name(item.member_tenant_id) }}</td>
            <td>{{ item.acquisition_date }}</td>
            <td class="num">{{ item.cost ?? '' }}</td>
            <td class="num">{{ item.net_assets_at_acquisition }}</td>
            <td class="num">{{ item.acquired_percentage ?? '' }}</td>
            <td>
              @if (canWrite) {
                <div class="actions">
                  <button nz-button nzSize="small" type="button" (click)="openImpairment(item)">{{ 'GL.CONS_ADD_IMPAIRMENT' | translate }}</button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    appIconAction="delete"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'GL.CONFIRM_DELETE' | translate"
                    (nzOnConfirm)="remove(item)"
                  ></button>
                </div>
              }
            </td>
          </tr>
          <tr [nzExpand]="expanded() === item.id">
            <div class="section-title">{{ 'GL.CONS_FAIR_VALUE_ADJUSTMENTS' | translate }}</div>
            <nz-table nzSize="small" [nzData]="item.fair_value_adjustments ?? []" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'GL.CONS_GROUP_ACCOUNT_CODE' | translate }}</th>
                  <th>{{ 'GL.COL_NAME' | translate }}</th>
                  <th>{{ 'GL.CONS_FV_ACCOUNT_TYPE' | translate }}</th>
                  <th class="num">{{ 'GL.CONS_AMOUNT' | translate }}</th>
                  <th class="num">{{ 'GL.CONS_USEFUL_LIFE' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (adjustment of item.fair_value_adjustments ?? []; track adjustment.id) {
                  <tr>
                    <td>{{ adjustment.account_code }}</td>
                    <td>{{ adjustment.account_name }}</td>
                    <td>{{ 'GL.CONS_FV_TYPE_' + adjustment.account_type.toUpperCase() | translate }}</td>
                    <td class="num">{{ adjustment.amount }}</td>
                    <td class="num">{{ adjustment.useful_life_years ?? '' }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
            <div class="section-title">{{ 'GL.CONS_IMPAIRMENTS' | translate }}</div>
            <nz-table nzSize="small" [nzData]="item.impairments ?? []" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'GL.CONS_FISCAL_YEAR' | translate }}</th>
                  <th class="num">{{ 'GL.CONS_AMOUNT' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (impairment of item.impairments ?? []; track impairment.id) {
                  <tr>
                    <td>{{ impairment.fiscal_year }}</td>
                    <td class="num">{{ impairment.amount }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal
      [nzVisible]="modalOpen()"
      [nzTitle]="'GL.CONS_ACQUISITION_NEW' | translate"
      nzWidth="860px"
      [nzOkLoading]="saving()"
      (nzOnOk)="save()"
      (nzOnCancel)="modalOpen.set(false)"
      okAction="save"
    >
      <ng-container *nzModalContent>
        <app-gl-error-alert [error]="formError()" />
        @for (message of formErrors(); track message) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="message" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="ca-member">{{ 'GL.CONS_ENTITY' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.member_tenant_id.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <nz-select id="ca-member" formControlName="member_tenant_id">
                  @for (member of subsidiaries(); track member.id) {
                    <nz-option [nzValue]="member.member_tenant_id" [nzLabel]="member.name" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="ca-date">{{ 'GL.CONS_ACQUISITION_DATE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.acquisition_date.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <input id="ca-date" nz-input type="date" formControlName="acquisition_date" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ca-currency">{{ 'GL.CONS_INPUT_CURRENCY' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.input_currency.errors?.['serverError'] ?? ''">
                <input id="ca-currency" nz-input formControlName="input_currency" maxlength="3" />
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="ca-cost">{{ 'GL.CONS_COST' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.cost.errors?.['serverError'] ?? ''">
                <nz-input-number class="w-full" id="ca-cost" formControlName="cost" [nzPrecision]="4" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="ca-net">{{ 'GL.CONS_NET_ASSETS' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.net_assets_at_acquisition.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <nz-input-number class="w-full" id="ca-net" formControlName="net_assets_at_acquisition" [nzPrecision]="4" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ca-pct">{{ 'GL.CONS_ACQUIRED_PERCENTAGE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.acquired_percentage.errors?.['serverError'] ?? ''">
                <nz-input-number class="w-full" id="ca-pct" formControlName="acquired_percentage" [nzMin]="0.0001" [nzMax]="100" [nzPrecision]="4" />
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="ca-charges">{{ 'GL.CONS_EXPECTED_CHARGES' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.expected_future_charges.errors?.['serverError'] ?? ''">
                <nz-input-number class="w-full" id="ca-charges" formControlName="expected_future_charges" [nzMin]="0.0001" [nzPrecision]="4" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ca-release">{{ 'GL.CONS_PROVISION_RELEASE_YEARS' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.provision_release_years.errors?.['serverError'] ?? ('GL.CONS_PROVISION_YEARS_REQUIRED' | translate)">
                <nz-input-number class="w-full" id="ca-release" formControlName="provision_release_years" [nzMin]="1" [nzMax]="100" [nzPrecision]="0" />
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="ca-dt">{{ 'GL.CONS_RECOGNISE_DEFERRED_TAX' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-switch id="ca-dt" formControlName="recognise_deferred_tax" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ca-dt-rate">{{ 'GL.CONS_DEFERRED_TAX_RATE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.deferred_tax_rate.errors?.['serverError'] ?? ('GL.CONS_DEFERRED_TAX_RATE_REQUIRED' | translate)">
                <nz-input-number class="w-full" id="ca-dt-rate" formControlName="deferred_tax_rate" [nzMin]="0" [nzMax]="100" [nzPrecision]="4" />
              </nz-form-control>
            </nz-form-item>
          </div>

          <div class="toolbar">
            <strong>{{ 'GL.CONS_FAIR_VALUE_ADJUSTMENTS' | translate }}</strong>
            <span class="spacer"></span>
            <button nz-button nzSize="small" type="button" appIconAction="add" (click)="addAdjustment()"></button>
          </div>
          @for (row of adjustments.controls; track row; let index = $index) {
            <div class="form-row" [formGroup]="row">
              <nz-form-item>
                <nz-form-control [nzErrorTip]="'GL.REQUIRED' | translate">
                  <input nz-input formControlName="account_code" maxlength="40" [placeholder]="'GL.CONS_GROUP_ACCOUNT_CODE' | translate" [attr.aria-label]="'GL.CONS_GROUP_ACCOUNT_CODE' | translate" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-control>
                  <input nz-input formControlName="account_name" maxlength="255" [placeholder]="'GL.COL_NAME' | translate" [attr.aria-label]="'GL.COL_NAME' | translate" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-control>
                  <nz-select formControlName="account_type" [attr.aria-label]="'GL.CONS_FV_ACCOUNT_TYPE' | translate">
                    @for (type of fairValueTypes; track type) {
                      <nz-option [nzValue]="type" [nzLabel]="'GL.CONS_FV_TYPE_' + type.toUpperCase() | translate" />
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-control [nzErrorTip]="'GL.REQUIRED' | translate">
                  <nz-input-number class="w-full" formControlName="amount" [nzPrecision]="4" [attr.aria-label]="'GL.CONS_AMOUNT' | translate" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-control>
                  <nz-input-number class="w-full" formControlName="useful_life_years" [nzMin]="1" [nzMax]="100" [nzPrecision]="0" [attr.aria-label]="'GL.CONS_USEFUL_LIFE' | translate" />
                </nz-form-control>
              </nz-form-item>
              <button nz-button nzSize="small" nzDanger type="button" appIconAction="delete" (click)="removeAdjustment(index)"></button>
            </div>
          }
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="impairmentTarget() !== null"
      [nzTitle]="'GL.CONS_ADD_IMPAIRMENT' | translate"
      [nzOkLoading]="saving()"
      (nzOnOk)="saveImpairment()"
      (nzOnCancel)="impairmentTarget.set(null)"
      okAction="save"
    >
      <ng-container *nzModalContent>
        <app-gl-error-alert [error]="formError()" />
        @for (message of formErrors(); track message) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="message" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="impairmentForm">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ci-year">{{ 'GL.CONS_FISCAL_YEAR' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="impairmentForm.controls.fiscal_year.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
              <nz-input-number class="w-full" id="ci-year" formControlName="fiscal_year" [nzMin]="1900" [nzMax]="2200" [nzPrecision]="0" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="ci-amount">{{ 'GL.CONS_AMOUNT' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="impairmentForm.controls.amount.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
              <nz-input-number class="w-full" id="ci-amount" formControlName="amount" [nzMin]="0.0001" [nzPrecision]="4" />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class GlConsolidationAcquisitionsComponent implements OnInit {
  private readonly api = inject(GeneralLedgerConsolidationApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  readonly group = input.required<ConsolidationGroup>();

  protected readonly fairValueTypes: FairValueAccountType[] = ['asset', 'liability'];
  /** The parent is not acquired inside its own group. */
  protected readonly subsidiaries = computed(() => (this.group().members ?? []).filter((member) => !member.is_parent));
  protected readonly acquisitions = signal<ConsolidationAcquisition[]>([]);
  protected readonly expanded = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<unknown>(null);
  protected readonly formError = signal<unknown>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly impairmentTarget = signal<ConsolidationAcquisition | null>(null);

  protected readonly adjustments = this.fb.array([this.newAdjustment()]);
  protected readonly form = this.fb.group({
    member_tenant_id: this.fb.control('', Validators.required),
    acquisition_date: this.fb.control('', Validators.required),
    cost: this.fb.control<number | null>(null),
    net_assets_at_acquisition: this.fb.control<number | null>(null, Validators.required),
    acquired_percentage: this.fb.control<number | null>(null),
    expected_future_charges: this.fb.control<number | null>(null),
    provision_release_years: this.fb.control<number | null>(null),
    input_currency: this.fb.control('', [Validators.minLength(3), Validators.maxLength(3), Validators.pattern(/^[A-Za-z]*$/)]),
    recognise_deferred_tax: this.fb.control(false),
    deferred_tax_rate: this.fb.control<number | null>(null),
  });

  protected readonly impairmentForm = this.fb.group({
    fiscal_year: this.fb.control<number | null>(new Date().getFullYear(), [Validators.required, Validators.min(1900), Validators.max(2200)]),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.0001)]),
  });

  ngOnInit(): void {
    this.load();
  }

  protected name(tenantId: string): string {
    return memberName(this.group(), tenantId);
  }

  protected addAdjustment(): void {
    this.adjustments.push(this.newAdjustment());
  }

  protected removeAdjustment(index: number): void {
    this.adjustments.removeAt(index);
  }

  protected openCreate(): void {
    this.form.reset({ recognise_deferred_tax: false });
    this.adjustments.clear();
    this.openModal();
  }

  protected openImpairment(acquisition: ConsolidationAcquisition): void {
    this.impairmentForm.reset({ fiscal_year: new Date().getFullYear(), amount: null });
    this.formError.set(null);
    this.formErrors.set([]);
    this.impairmentTarget.set(acquisition);
  }

  protected save(): void {
    const value = this.form.getRawValue();
    // The API needs the years with the charges and the rate with the deferred tax: say so before the request.
    this.form.controls.provision_release_years.setErrors(value.expected_future_charges !== null && value.provision_release_years === null ? { required: true } : null);
    this.form.controls.deferred_tax_rate.setErrors(value.recognise_deferred_tax && value.deferred_tax_rate === null ? { required: true } : null);
    if (this.form.invalid || this.adjustments.invalid) {
      this.form.markAllAsTouched();
      this.adjustments.markAllAsTouched();
      return;
    }
    const payload: ConsolidationAcquisitionPayload = {
      member_tenant_id: value.member_tenant_id,
      acquisition_date: value.acquisition_date,
      cost: value.cost,
      net_assets_at_acquisition: value.net_assets_at_acquisition ?? 0,
      acquired_percentage: value.acquired_percentage,
      expected_future_charges: value.expected_future_charges,
      provision_release_years: value.provision_release_years,
      input_currency: value.input_currency ? value.input_currency.toUpperCase() : null,
      recognise_deferred_tax: value.recognise_deferred_tax,
      deferred_tax_rate: value.deferred_tax_rate,
      fair_value_adjustments: this.adjustments.getRawValue().map((row) => ({
        account_code: row.account_code,
        account_name: nullable(row.account_name),
        account_type: row.account_type,
        amount: row.amount ?? 0,
        useful_life_years: row.useful_life_years,
      })),
    };
    this.saving.set(true);
    this.api.createAcquisition(this.group().id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.message.success(this.i18n.translate('GL.CONS_SAVED'));
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formError.set(err);
        this.formErrors.set(applyServerErrors(this.form, err));
      },
    });
  }

  protected saveImpairment(): void {
    const target = this.impairmentTarget();
    if (!target || this.impairmentForm.invalid) {
      this.impairmentForm.markAllAsTouched();
      return;
    }
    const value = this.impairmentForm.getRawValue();
    this.saving.set(true);
    this.api.createGoodwillImpairment(target.id, { fiscal_year: value.fiscal_year ?? 0, amount: value.amount ?? 0 }).subscribe({
      next: () => {
        this.saving.set(false);
        this.impairmentTarget.set(null);
        this.expanded.set(target.id);
        this.message.success(this.i18n.translate('GL.CONS_SAVED'));
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formError.set(err);
        this.formErrors.set(applyServerErrors(this.impairmentForm, err));
      },
    });
  }

  protected remove(item: ConsolidationAcquisition): void {
    this.api.deleteAcquisition(item.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.CONS_DELETED'));
        this.load();
      },
      error: (err: unknown) => this.error.set(err),
    });
  }

  private openModal(): void {
    this.formError.set(null);
    this.formErrors.set([]);
    this.modalOpen.set(true);
  }

  private newAdjustment() {
    return this.fb.group({
      account_code: this.fb.control('', [Validators.required, Validators.maxLength(40)]),
      account_name: this.fb.control('', Validators.maxLength(255)),
      account_type: this.fb.control<FairValueAccountType>('asset', Validators.required),
      amount: this.fb.control<number | null>(null, Validators.required),
      useful_life_years: this.fb.control<number | null>(null),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.getAcquisitions(this.group().id).subscribe({
      next: (res) => {
        this.acquisitions.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err);
        this.loading.set(false);
      },
    });
  }
}
