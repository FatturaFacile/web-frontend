import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import {
  FREQUENCIES,
  JURISDICTIONS,
  PreservationConfigurationUpdate,
  PROVIDERS,
  TestConnectionResult,
} from './digital-preservation.models';
import { DigitalPreservationStore } from './digital-preservation.store';
import { apiMessage } from './digital-preservation.utils';

/** Legal and connector configuration: jurisdiction, preservation officer, RFC 3161 TSA, schedule and conservator. */
@Component({
  selector: 'app-preservation-configuration',
  styleUrl: './digital-preservation.scss',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
  ],
  template: `
    <form
      nz-form
      nzLayout="vertical"
      [formGroup]="form"
      (ngSubmit)="save()"
      data-testid="configuration-form"
    >
      <nz-form-item>
        <nz-form-label nzFor="cfg-jurisdiction">{{
          'PRESERVATION.JURISDICTION' | translate
        }}</nz-form-label>
        <nz-form-control>
          <nz-select id="cfg-jurisdiction" formControlName="jurisdiction">
            @for (j of jurisdictions; track j) {
              <nz-option
                [nzValue]="j"
                [nzLabel]="'PRESERVATION.JURISDICTION_' + j | translate"
              ></nz-option>
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label nzFor="cfg-officer">{{
          'PRESERVATION.OFFICER_NAME' | translate
        }}</nz-form-label>
        <nz-form-control>
          <input
            nz-input
            id="cfg-officer"
            formControlName="preservation_officer_name"
            maxlength="190"
          />
        </nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label nzFor="cfg-officer-tax">{{
          'PRESERVATION.OFFICER_TAX_CODE' | translate
        }}</nz-form-label>
        <nz-form-control>
          <input
            nz-input
            id="cfg-officer-tax"
            formControlName="preservation_officer_tax_code"
            maxlength="32"
          />
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label nzFor="cfg-tsa">{{ 'PRESERVATION.TSA_URL' | translate }}</nz-form-label>
        <nz-form-control [nzExtra]="'PRESERVATION.TSA_HINT' | translate">
          <input
            nz-input
            id="cfg-tsa"
            type="url"
            formControlName="tsa_url"
            placeholder="https://"
          />
        </nz-form-control>
      </nz-form-item>
      <div formGroupName="tsa_credentials" class="filters">
        <input
          nz-input
          style="width: 220px"
          formControlName="username"
          autocomplete="off"
          [placeholder]="'PRESERVATION.TSA_USERNAME' | translate"
          [attr.aria-label]="'PRESERVATION.TSA_USERNAME' | translate"
        />
        <input
          nz-input
          style="width: 220px"
          type="password"
          formControlName="password"
          autocomplete="new-password"
          [placeholder]="
            (store.configuration()?.has_tsa_credentials
              ? 'PRESERVATION.SECRET_SET'
              : 'PRESERVATION.TSA_PASSWORD'
            ) | translate
          "
          [attr.aria-label]="'PRESERVATION.TSA_PASSWORD' | translate"
        />
      </div>

      <nz-form-item>
        <nz-form-label nzFor="cfg-frequency">{{
          'PRESERVATION.AUTO_SEAL' | translate
        }}</nz-form-label>
        <nz-form-control>
          <nz-select id="cfg-frequency" formControlName="auto_seal_frequency">
            @for (f of frequencies; track f) {
              <nz-option
                [nzValue]="f"
                [nzLabel]="'PRESERVATION.FREQUENCY_' + f.toUpperCase() | translate"
              ></nz-option>
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label nzFor="cfg-retention">{{
          'PRESERVATION.RETENTION_YEARS' | translate
        }}</nz-form-label>
        <nz-form-control [nzExtra]="'PRESERVATION.RETENTION_HINT' | translate">
          <nz-input-number
            id="cfg-retention"
            formControlName="default_retention_years"
            [nzMin]="10"
            [nzMax]="50"
          ></nz-input-number>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label nzFor="cfg-provider">{{
          'PRESERVATION.PROVIDER' | translate
        }}</nz-form-label>
        <nz-form-control>
          <nz-select id="cfg-provider" formControlName="provider" data-testid="provider-select">
            @for (p of providers; track p) {
              <nz-option
                [nzValue]="p"
                [nzLabel]="'PRESERVATION.PROVIDER_' + p.toUpperCase() | translate"
              ></nz-option>
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>

      @if (providerValue() !== 'local_worm') {
        <div formGroupName="credentials" class="filters" data-testid="provider-credentials">
          <input
            nz-input
            style="width: 260px"
            formControlName="endpoint"
            type="url"
            [placeholder]="'PRESERVATION.CRED_ENDPOINT' | translate"
            [attr.aria-label]="'PRESERVATION.CRED_ENDPOINT' | translate"
          />
          <input
            nz-input
            style="width: 200px"
            formControlName="client_id"
            autocomplete="off"
            [placeholder]="'PRESERVATION.CRED_CLIENT_ID' | translate"
            [attr.aria-label]="'PRESERVATION.CRED_CLIENT_ID' | translate"
          />
          <input
            nz-input
            style="width: 220px"
            formControlName="client_secret"
            type="password"
            autocomplete="new-password"
            [placeholder]="
              (store.configuration()?.has_credentials
                ? 'PRESERVATION.SECRET_SET'
                : 'PRESERVATION.CRED_CLIENT_SECRET'
              ) | translate
            "
            [attr.aria-label]="'PRESERVATION.CRED_CLIENT_SECRET' | translate"
          />
        </div>
      }

      <nz-form-item>
        <nz-form-label nzFor="cfg-active">{{ 'PRESERVATION.ACTIVE' | translate }}</nz-form-label>
        <nz-form-control>
          <nz-switch id="cfg-active" formControlName="is_active"></nz-switch>
        </nz-form-control>
      </nz-form-item>

      <div class="toolbar">
        <button
          nz-button
          nzType="primary"
          type="submit"
          data-testid="save-configuration"
          [disabled]="form.invalid"
          [nzLoading]="store.busy()"
        >
          {{ 'PRESERVATION.SAVE' | translate }}
        </button>
        <button
          nz-button
          type="button"
          data-testid="test-connection"
          [nzLoading]="store.busy()"
          (click)="test()"
        >
          {{ 'PRESERVATION.TEST_CONNECTION' | translate }}
        </button>
      </div>
    </form>

    @if (testResult(); as t) {
      <nz-alert
        data-testid="test-connection-result"
        [nzType]="t.ok ? 'success' : 'error'"
        nzShowIcon
        [nzMessage]="
          (t.ok ? 'PRESERVATION.CONNECTION_OK' : 'PRESERVATION.CONNECTION_FAILED') | translate
        "
        [nzDescription]="t.message"
      ></nz-alert>
    }
  `,
})
export class PreservationConfigurationComponent implements OnInit {
  protected readonly store = inject(DigitalPreservationStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly jurisdictions = JURISDICTIONS;
  protected readonly providers = PROVIDERS;
  protected readonly frequencies = FREQUENCIES;
  protected readonly testResult = signal<TestConnectionResult | null>(null);

  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly form = this.fb.group({
    jurisdiction: this.fb.control<string>('IT'),
    provider: this.fb.control<string>('local_worm'),
    preservation_officer_name: this.fb.control(''),
    preservation_officer_tax_code: this.fb.control(''),
    tsa_url: this.fb.control('', [Validators.pattern(/^(https:\/\/\S+)?$/)]),
    tsa_credentials: this.fb.group({ username: [''], password: [''] }),
    credentials: this.fb.group({ endpoint: [''], client_id: [''], client_secret: [''] }),
    auto_seal_frequency: this.fb.control<string>('monthly'),
    default_retention_years: this.fb.control(10, [Validators.min(10), Validators.required]),
    is_active: this.fb.control(true),
  });
  protected readonly providerValue = toSignal(
    this.form.controls.provider.valueChanges.pipe(map((v) => v)),
    { initialValue: this.form.controls.provider.value },
  );

  constructor() {
    effect(() => {
      const cfg = this.store.configuration();
      if (cfg) {
        this.form.patchValue({
          jurisdiction: cfg.jurisdiction,
          provider: cfg.provider,
          preservation_officer_name: cfg.preservation_officer_name ?? '',
          preservation_officer_tax_code: cfg.preservation_officer_tax_code ?? '',
          tsa_url: cfg.tsa_url ?? '',
          auto_seal_frequency: cfg.auto_seal_frequency,
          default_retention_years: cfg.default_retention_years,
          is_active: cfg.is_active,
        });
      }
    });
  }

  ngOnInit(): void {
    this.store.loadConfiguration().subscribe();
  }

  /** Secrets are write-only: they are sent only when typed, and cleared from the form after saving. */
  protected save(): void {
    const v = this.form.getRawValue();
    const tsa = this.filled(v.tsa_credentials);
    const creds = v.provider === 'local_worm' ? null : this.filled(v.credentials);
    const payload = {
      jurisdiction: v.jurisdiction,
      provider: v.provider,
      preservation_officer_name: v.preservation_officer_name || null,
      preservation_officer_tax_code: v.preservation_officer_tax_code || null,
      tsa_url: v.tsa_url || null,
      auto_seal_frequency: v.auto_seal_frequency,
      default_retention_years: v.default_retention_years,
      is_active: v.is_active,
      ...(tsa ? { tsa_credentials: tsa } : {}),
      ...(creds ? { credentials: creds } : {}),
    } as PreservationConfigurationUpdate;

    this.store.saveConfiguration(payload).subscribe({
      next: () => {
        this.form.controls.tsa_credentials.reset();
        this.form.controls.credentials.reset();
        this.message.success(this.i18n.instant('PRESERVATION.CONFIG_SAVED'));
      },
      error: (err: unknown) =>
        this.message.error(apiMessage(err, this.i18n.instant('PRESERVATION.CONFIG_FAILED'))),
    });
  }

  protected test(): void {
    this.store.testConnection().subscribe({
      next: (res) => this.testResult.set(res.data),
      error: () =>
        this.testResult.set({
          ok: false,
          message: this.i18n.instant('PRESERVATION.CONNECTION_ERROR'),
          provider: '',
        }),
    });
  }

  private filled(group: Record<string, string>): Record<string, string> | null {
    const entries = Object.entries(group).filter(([, value]) => value !== '');
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  }
}
