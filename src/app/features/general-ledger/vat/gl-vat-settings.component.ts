import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  applyServerErrors,
  AuthStore,
  GeneralLedgerFiscalApiService,
  I18nService,
  MwstBasis,
  PermissionsService,
  VatRegime,
  VatSettings,
  VatSettingsPayload,
} from '@core';
import { TranslatePipe } from '@shared';

type Periodicity = 'monthly' | 'quarterly' | 'semiannual';

/** Jurisdiction-aware VAT settings: Swiss MWST method, basis and Saldosteuersatz rates, or Italian LIPE periodicity, pro-rata and advance. */
@Component({
  selector: 'app-gl-vat-settings',
  styleUrl: '../localization/gl-localization.scss',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputNumberModule,
    NzSelectModule,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="(isSwiss() ? 'GL.VAT_SETTINGS_CH' : 'GL.VAT_SETTINGS_IT') | translate">
      @for (error of formErrors(); track error) {
        <nz-alert class="section" nzType="error" [nzMessage]="error" />
      }
      <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="save()">
        <nz-form-item>
          <nz-form-label>{{ (isSwiss() ? 'GL.VAT_PERIODICITY' : 'GL.VAT_LIPE_PERIODICITY') | translate }}</nz-form-label>
          <nz-form-control>
            <nz-select formControlName="periodicity" data-testid="periodicity">
              @for (option of periodicities(); track option) {
                <nz-option [nzValue]="option" [nzLabel]="'GL.VAT_PERIOD_' + option.toUpperCase() | translate" />
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>

        @if (isSwiss()) {
          <nz-form-item>
            <nz-form-label>{{ 'GL.VAT_MWST_METHOD' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="regime" data-testid="regime">
                @for (option of regimes; track option) {
                  <nz-option [nzValue]="option" [nzLabel]="'GL.VAT_REGIME_' + option.toUpperCase() | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'GL.VAT_MWST_BASIS' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="mwst_basis" data-testid="mwst-basis">
                @for (option of bases; track option) {
                  <nz-option [nzValue]="option" [nzLabel]="'GL.VAT_BASIS_' + option.toUpperCase() | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'GL.VAT_SSS_RATE_1' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-input-number formControlName="sss_rate_1" [nzMin]="0" [nzMax]="100" [nzStep]="0.1" [nzPrecision]="2" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'GL.VAT_SSS_RATE_2' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-input-number formControlName="sss_rate_2" [nzMin]="0" [nzMax]="100" [nzStep]="0.1" [nzPrecision]="2" />
            </nz-form-control>
          </nz-form-item>
        } @else {
          <nz-form-item>
            <nz-form-label>{{ 'GL.VAT_LIPE_PRORATA' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-input-number formControlName="lipe_prorata_percent" [nzMin]="0" [nzMax]="100" [nzStep]="1" [nzPrecision]="2" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'GL.VAT_LIPE_ADVANCE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-input-number formControlName="lipe_advance_amount" [nzMin]="0" [nzStep]="1" [nzPrecision]="2" />
            </nz-form-control>
          </nz-form-item>
        }

        @if (canWrite) {
          <button nz-button nzType="primary" type="submit" data-testid="save" [nzLoading]="saving()">
            {{ 'GL.VAT_SAVE' | translate }}
          </button>
        }
      </form>
    </nz-card>
  `,
})
export class GlVatSettingsComponent implements OnInit {
  private readonly api = inject(GeneralLedgerFiscalApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly authStore = inject(AuthStore);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly isSwiss = computed(() => this.authStore.activeJurisdiction() === 'CH');
  protected readonly periodicities = computed<Periodicity[]>(() =>
    this.isSwiss() ? ['monthly', 'quarterly', 'semiannual'] : ['monthly', 'quarterly'],
  );
  protected readonly regimes: VatRegime[] = ['effective', 'net_tax_rate', 'flat_tax_rate'];
  protected readonly bases: MwstBasis[] = ['agreed', 'received'];

  protected readonly saving = signal(false);
  protected readonly formErrors = signal<string[]>([]);

  protected readonly form = this.fb.group({
    periodicity: this.fb.control<Periodicity>('quarterly'),
    regime: this.fb.control<VatRegime>('effective'),
    mwst_basis: this.fb.control<MwstBasis>('agreed'),
    sss_rate_1: this.fb.control<number | null>(null),
    sss_rate_2: this.fb.control<number | null>(null),
    lipe_prorata_percent: this.fb.control<number | null>(null),
    lipe_advance_amount: this.fb.control<number | null>(null),
  });

  ngOnInit(): void {
    this.api.getVatSettings().subscribe({ next: (res) => this.apply(res.data) });
  }

  protected save(): void {
    this.saving.set(true);
    this.formErrors.set([]);
    this.api.updateVatSettings(this.payload()).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.apply(res.data);
        this.message.success(res.message || this.i18n.translate('GL.VAT_SETTINGS_SAVED'));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formErrors.set(applyServerErrors(this.form, err));
      },
    });
  }

  /** Only the fields of the active jurisdiction are sent. */
  private payload(): VatSettingsPayload {
    const value = this.form.getRawValue();
    if (this.isSwiss()) {
      return {
        periodicity: value.periodicity,
        regime: value.regime,
        mwst_basis: value.mwst_basis,
        sss_rate_1: decimal(value.sss_rate_1),
        sss_rate_2: decimal(value.sss_rate_2),
      };
    }
    return {
      periodicity: value.periodicity,
      lipe_prorata_percent: decimal(value.lipe_prorata_percent),
      lipe_advance_amount: decimal(value.lipe_advance_amount),
    };
  }

  private apply(settings: VatSettings): void {
    this.form.patchValue({
      periodicity: settings.periodicity ?? 'quarterly',
      regime: settings.regime ?? 'effective',
      mwst_basis: settings.mwst_basis ?? 'agreed',
      sss_rate_1: toNumber(settings.sss_rate_1),
      sss_rate_2: toNumber(settings.sss_rate_2),
      lipe_prorata_percent: toNumber(settings.lipe_prorata_percent),
      lipe_advance_amount: toNumber(settings.lipe_advance_amount),
    });
  }
}

function toNumber(value: string | null | undefined): number | null {
  return value === null || value === undefined || value === '' ? null : Number(value);
}

function decimal(value: number | null): string | null {
  return value === null ? null : value.toFixed(2);
}
