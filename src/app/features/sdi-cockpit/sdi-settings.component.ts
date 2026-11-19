import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FpaDocumentsApiService, I18nService, PermissionsService, SdiConfiguration } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { reportHttpError } from '../hr/shared/hr-http.util';

type Draft = Omit<
  SdiConfiguration,
  'has_credentials' | 'has_certificate' | 'progressivo_invio_counter'
>;

/** SDI transmission and digital signature settings of the company (`/settings/sdi`). */
@Component({
  selector: 'app-sdi-settings',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  styles: [
    '.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-3); } label { display: block; margin-bottom: var(--space-1); } .row { display: flex; gap: var(--space-2); align-items: center; }',
  ],
  template: `
    <app-page-header
      [title]="'sdiSettings.title' | translate"
      [subtitle]="'sdiSettings.subtitle' | translate"
    />
    @if (draft(); as d) {
      <nz-card [nzTitle]="'sdiSettings.transmission' | translate">
        <div class="grid">
          <div>
            <label for="tcc">{{ 'sdiSettings.transmitterCountry' | translate }}</label><input
              id="tcc"
              nz-input
              maxlength="2"
              [ngModel]="d.transmitter_country_code"
              (ngModelChange)="patch('transmitter_country_code', $event)"
            />
          </div>
          <div>
            <label for="tfc">{{ 'sdiSettings.transmitterFiscalCode' | translate }}</label><input
              id="tfc"
              nz-input
              [ngModel]="d.transmitter_fiscal_code"
              (ngModelChange)="patch('transmitter_fiscal_code', $event)"
            />
          </div>
          <div>
            <label for="chan">{{ 'sdiSettings.channelType' | translate }}</label>
            <nz-select
              id="chan"
              style="width: 100%"
              nzAllowClear
              [ngModel]="d.channel_type"
              (ngModelChange)="patch('channel_type', $event)"
            >
              @for (c of channels; track c) {
                <nz-option
                  [nzValue]="c"
                  [nzLabel]="'sdiSettings.channel.' + c | translate"
                ></nz-option>
              }
            </nz-select>
          </div>
          <div>
            <label for="rc">{{ 'sdiSettings.defaultRecipientCode' | translate }}</label><input
              id="rc"
              nz-input
              maxlength="7"
              [ngModel]="d.default_codice_destinatario"
              (ngModelChange)="patch('default_codice_destinatario', $event)"
            />
          </div>
          <div>
            <label for="pec">{{ 'sdiSettings.pecAddress' | translate }}</label><input
              id="pec"
              nz-input
              type="email"
              [ngModel]="d.pec_address"
              (ngModelChange)="patch('pec_address', $event)"
            />
          </div>
          <div>
            <span class="label">{{ 'sdiSettings.progressive' | translate }}</span><strong
              data-testid="progressive"
              >{{ counter() }}</strong
            >
          </div>
        </div>
      </nz-card>
      <nz-card [nzTitle]="'sdiSettings.signature' | translate">
        <div class="grid">
          <div>
            <label for="sig">{{ 'sdiSettings.signatureMode' | translate }}</label>
            <nz-select
              id="sig"
              style="width: 100%"
              [ngModel]="d.signature_mode"
              (ngModelChange)="patch('signature_mode', $event)"
            >
              @for (m of modes; track m) {
                <nz-option
                  [nzValue]="m"
                  [nzLabel]="'sdiSettings.mode.' + m | translate"
                ></nz-option>
              }
            </nz-select>
          </div>
          @if (d.signature_mode === 'local_pkcs12') {
            <div>
              <label for="cert">{{ 'sdiSettings.certificate' | translate }}</label>
              <input
                id="cert"
                type="file"
                accept=".p12,.pfx"
                (change)="pickCertificate($event)"
                data-testid="certificate-file"
              />
              @if (hasCertificate()) {
                <small>{{ 'sdiSettings.certificateStored' | translate }}</small>
              }
            </div>
            <div>
              <label for="cpw">{{ 'sdiSettings.certificatePassword' | translate }}</label><input
                id="cpw"
                nz-input
                type="password"
                autocomplete="off"
                [ngModel]="password()"
                (ngModelChange)="password.set($event)"
              />
            </div>
          }
          <div class="row">
            <nz-switch
              [ngModel]="d.auto_sign_on_send"
              (ngModelChange)="patch('auto_sign_on_send', $event)"
            />
            {{ 'sdiSettings.autoSign' | translate }}
          </div>
          <div class="row">
            <nz-switch
              [ngModel]="d.legal_archiving_enabled"
              (ngModelChange)="patch('legal_archiving_enabled', $event)"
            />
            {{ 'sdiSettings.legalArchiving' | translate }}
          </div>
          <div class="row">
            <nz-switch
              [ngModel]="d.sandbox_simulator_enabled"
              (ngModelChange)="patch('sandbox_simulator_enabled', $event)"
            />
            {{ 'sdiSettings.sandbox' | translate }}
          </div>
        </div>
      </nz-card>
      @if (canWrite()) {
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="saving()"
          (click)="save()"
          data-testid="settings-save"
        >
          {{ 'sdiSettings.save' | translate }}
        </button>
      }
    }
  `,
})
export class SdiSettingsComponent implements OnInit {
  private readonly api = inject(FpaDocumentsApiService);
  private readonly permissions = inject(PermissionsService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly channels = ['pec', 'webservice_sdi', 'intermediary_api'] as const;
  protected readonly modes = ['none', 'local_pkcs12', 'remote_hsm_provider'] as const;
  protected readonly draft = signal<Draft | null>(null);
  protected readonly counter = signal(0);
  protected readonly hasCertificate = signal(false);
  protected readonly saving = signal(false);
  protected readonly password = signal('');
  private certificate: File | null = null;
  protected readonly canWrite = computed(() => this.permissions.canWrite('system'));

  ngOnInit(): void {
    this.api.settings().subscribe({
      next: (res) => this.apply(res.data),
      error: (error) => reportHttpError(error, this.message, this.i18n),
    });
  }

  protected patch<K extends keyof Draft>(key: K, value: Draft[K]): void {
    this.draft.update((d) => (d === null ? d : { ...d, [key]: value }));
  }

  protected pickCertificate(event: Event): void {
    this.certificate = (event.target as HTMLInputElement).files?.item(0) ?? null;
  }

  protected save(): void {
    const d = this.draft();
    if (d === null) {
      return;
    }
    this.saving.set(true);
    const request =
      this.certificate !== null && d.signature_mode === 'local_pkcs12'
        ? this.api.saveSettingsWithCertificate({ ...d }, this.certificate, this.password())
        : this.api.saveSettings(d);
    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.certificate = null;
        this.password.set('');
        this.apply(res.data);
        this.message.success(this.i18n.translate('sdiSettings.saved'));
      },
      error: (error) => {
        this.saving.set(false);
        reportHttpError(error, this.message, this.i18n);
      },
    });
  }

  private apply(data: SdiConfiguration): void {
    this.counter.set(data.progressivo_invio_counter);
    this.hasCertificate.set(data.has_certificate);
    const {
      has_credentials: _credentials,
      has_certificate: _certificate,
      progressivo_invio_counter: _counter,
      ...rest
    } = data;
    this.draft.set(rest);
  }
}
