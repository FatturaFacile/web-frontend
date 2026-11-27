import { DatePipe } from '@angular/common';
import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  EBILL_PAYLOAD_VERSIONS,
  EBILL_PROTOCOLS,
  EBILL_PROVIDERS,
  EBILL_WEBHOOK_AUTH_MODES,
  EbillPayloadVersion,
  EbillProtocol,
  EbillProvider,
  EbillSettingsPayload,
  EbillWebhookAuthMode,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { EbillSettingsStore } from './ebill-settings.store';
import { SWISS_EBILL_MODULE } from './swiss-ebill.util';

interface SettingsForm {
  ebill_enabled: boolean;
  biller_id: string;
  provider: EbillProvider;
  channel_protocol: EbillProtocol;
  api_base_url: string;
  client_id: string;
  client_secret: string;
  signing_certificate_pem: string;
  private_key_pem: string;
  webhook_auth_mode: EbillWebhookAuthMode;
  webhook_mtls_fingerprint: string;
  auto_send_on_invoice_issue: boolean;
  attach_courtesy_pdf: boolean;
  default_ebinterface_version: EbillPayloadVersion;
}

const BLANK_FORM: SettingsForm = {
  ebill_enabled: false,
  biller_id: '',
  provider: 'sandbox_simulator',
  channel_protocol: 'rest_json_xml',
  api_base_url: '',
  client_id: '',
  client_secret: '',
  signing_certificate_pem: '',
  private_key_pem: '',
  webhook_auth_mode: 'hmac_sha256',
  webhook_mtls_fingerprint: '',
  auto_send_on_invoice_issue: false,
  attach_courtesy_pdf: true,
  default_ebinterface_version: 'SIX eBill XML',
};

/** Swiss eBill settings: biller enrollment, SIX Paynet / PostFinance credentials, webhook endpoint and secret, delivery options and connection test. */
@Component({
  selector: 'app-ebill-settings',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [EbillSettingsStore],
  styleUrl: './swiss-ebill.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.SWISS_EBILL_SETTINGS' | translate"
      [subtitle]="'swissEbill.hint.lookup' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (!form().ebill_enabled) {
        <nz-alert
          class="feedback"
          nzType="info"
          nzShowIcon
          [nzMessage]="'swissEbill.empty.notConfigured' | translate"
        ></nz-alert>
      }

      <section class="panel">
        <h3>{{ 'swissEbill.section.connection' | translate }}</h3>
        <div class="grid">
          <label class="field switch" for="eb-enabled">
            <span>{{ 'swissEbill.field.ebillEnabled' | translate }}</span>
            <nz-switch
              nzId="eb-enabled"
              [ngModel]="form().ebill_enabled"
              (ngModelChange)="patch({ ebill_enabled: $event })"
              [nzDisabled]="!canWrite"
            ></nz-switch>
          </label>
          <label class="field" for="eb-biller">
            <span>{{ 'swissEbill.field.billerId' | translate }}</span>
            <input
              nz-input
              id="eb-biller"
              inputmode="numeric"
              maxlength="17"
              [ngModel]="form().biller_id"
              (ngModelChange)="patch({ biller_id: $event })"
              [disabled]="!canWrite"
            />
          </label>
          <label class="field" for="eb-provider">
            <span>{{ 'swissEbill.field.provider' | translate }}</span>
            <nz-select
              nzId="eb-provider"
              [ngModel]="form().provider"
              (ngModelChange)="patch({ provider: $event })"
              [nzDisabled]="!canWrite"
            >
              @for (provider of providers; track provider) {
                <nz-option
                  [nzValue]="provider"
                  [nzLabel]="'swissEbill.provider.' + provider | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="eb-protocol">
            <span>{{ 'swissEbill.field.protocol' | translate }}</span>
            <nz-select
              nzId="eb-protocol"
              [ngModel]="form().channel_protocol"
              (ngModelChange)="patch({ channel_protocol: $event })"
              [nzDisabled]="!canWrite"
            >
              @for (protocol of protocols; track protocol) {
                <nz-option
                  [nzValue]="protocol"
                  [nzLabel]="'swissEbill.protocol.' + protocol | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
        </div>
        @if (form().provider === 'sandbox_simulator') {
          <nz-alert
            nzType="warning"
            nzShowIcon
            [nzMessage]="'swissEbill.hint.sandbox' | translate"
          ></nz-alert>
        }
      </section>

      <section class="panel">
        <h3>{{ 'swissEbill.section.credentials' | translate }}</h3>
        <div class="grid">
          <label class="field wide" for="eb-url">
            <span>{{ 'swissEbill.field.apiBaseUrl' | translate }}</span>
            <input
              nz-input
              id="eb-url"
              type="url"
              [ngModel]="form().api_base_url"
              (ngModelChange)="patch({ api_base_url: $event })"
              [disabled]="!canWrite"
            />
          </label>
          <label class="field" for="eb-client">
            <span>{{ 'swissEbill.field.clientId' | translate }}</span>
            <input
              nz-input
              id="eb-client"
              autocomplete="off"
              [ngModel]="form().client_id"
              (ngModelChange)="patch({ client_id: $event })"
              [disabled]="!canWrite"
            />
          </label>
          <label class="field" for="eb-secret">
            <span>
              {{ 'swissEbill.field.clientSecret' | translate }}
              @if (store.settings()?.has_client_secret) {
                <nz-tag nzColor="green">{{ 'swissEbill.field.secretStored' | translate }}</nz-tag>
              }
            </span>
            <input
              nz-input
              id="eb-secret"
              type="password"
              autocomplete="new-password"
              [ngModel]="form().client_secret"
              (ngModelChange)="patch({ client_secret: $event })"
              [disabled]="!canWrite"
            />
          </label>
          <label class="field wide" for="eb-cert">
            <span>
              {{ 'swissEbill.field.signingCertificate' | translate }}
              @if (store.settings()?.has_signing_certificate) {
                <nz-tag nzColor="green">{{ 'swissEbill.field.secretStored' | translate }}</nz-tag>
              }
            </span>
            <textarea
              nz-input
              id="eb-cert"
              rows="4"
              class="pem"
              [ngModel]="form().signing_certificate_pem"
              (ngModelChange)="patch({ signing_certificate_pem: $event })"
              [disabled]="!canWrite"
            ></textarea>
            <input
              type="file"
              accept=".pem,.crt,.cer"
              (change)="readFile($event, 'signing_certificate_pem')"
              [disabled]="!canWrite"
            />
          </label>
          <label class="field wide" for="eb-key">
            <span>
              {{ 'swissEbill.field.privateKey' | translate }}
              @if (store.settings()?.has_private_key) {
                <nz-tag nzColor="green">{{ 'swissEbill.field.secretStored' | translate }}</nz-tag>
              }
            </span>
            <textarea
              nz-input
              id="eb-key"
              rows="4"
              class="pem"
              autocomplete="off"
              [ngModel]="form().private_key_pem"
              (ngModelChange)="patch({ private_key_pem: $event })"
              [disabled]="!canWrite"
            ></textarea>
            <input
              type="file"
              accept=".pem,.key"
              (change)="readFile($event, 'private_key_pem')"
              [disabled]="!canWrite"
            />
          </label>
        </div>
      </section>

      <section class="panel">
        <h3>{{ 'swissEbill.section.webhook' | translate }}</h3>
        <p class="hint">{{ 'swissEbill.hint.webhook' | translate }}</p>
        <div class="grid">
          <div class="field wide">
            <span>{{ 'swissEbill.field.webhookUrl' | translate }}</span>
            <div class="inline">
              <input nz-input readonly [value]="store.settings()?.webhook_url ?? ''" />
              <button
                nz-button
                type="button"
                data-test="copy-url"
                (click)="copy(store.settings()?.webhook_url ?? '')"
              >
                {{ 'swissEbill.action.copy' | translate }}
              </button>
            </div>
          </div>
          <div class="field wide">
            <span>{{ 'swissEbill.field.webhookSecret' | translate }}</span>
            <div class="inline">
              <input
                nz-input
                readonly
                [value]="
                  store.settings()?.webhook_secret ??
                  (store.settings()?.has_webhook_secret ? '••••••••••••' : '')
                "
              />
              @if (store.settings()?.webhook_secret; as secret) {
                <button nz-button type="button" data-test="copy-secret" (click)="copy(secret)">
                  {{ 'swissEbill.action.copy' | translate }}
                </button>
              }
              @if (canWrite) {
                <button
                  nz-button
                  type="button"
                  data-test="rotate"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'swissEbill.confirm.rotate.body' | translate"
                  (nzOnConfirm)="rotate()"
                >
                  {{ 'swissEbill.action.rotateSecret' | translate }}
                </button>
              }
            </div>
          </div>
          <label class="field" for="eb-auth">
            <span>{{ 'swissEbill.field.webhookAuthMode' | translate }}</span>
            <nz-select
              nzId="eb-auth"
              [ngModel]="form().webhook_auth_mode"
              (ngModelChange)="patch({ webhook_auth_mode: $event })"
              [nzDisabled]="!canWrite"
            >
              @for (mode of authModes; track mode) {
                <nz-option
                  [nzValue]="mode"
                  [nzLabel]="'swissEbill.webhookAuth.' + mode | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          @if (form().webhook_auth_mode === 'mutual_tls') {
            <label class="field" for="eb-fp">
              <span>{{ 'swissEbill.field.mtlsFingerprint' | translate }}</span>
              <input
                nz-input
                id="eb-fp"
                [ngModel]="form().webhook_mtls_fingerprint"
                (ngModelChange)="patch({ webhook_mtls_fingerprint: $event })"
                [disabled]="!canWrite"
              />
            </label>
          }
        </div>
      </section>

      <section class="panel">
        <h3>{{ 'swissEbill.section.delivery' | translate }}</h3>
        <div class="grid">
          <label class="field switch" for="eb-auto">
            <span>{{ 'swissEbill.field.autoSend' | translate }}</span>
            <nz-switch
              nzId="eb-auto"
              [ngModel]="form().auto_send_on_invoice_issue"
              (ngModelChange)="patch({ auto_send_on_invoice_issue: $event })"
              [nzDisabled]="!canWrite"
            ></nz-switch>
          </label>
          <label class="field switch" for="eb-pdf">
            <span>{{ 'swissEbill.field.attachPdf' | translate }}</span>
            <nz-switch
              nzId="eb-pdf"
              [ngModel]="form().attach_courtesy_pdf"
              (ngModelChange)="patch({ attach_courtesy_pdf: $event })"
              [nzDisabled]="!canWrite"
            ></nz-switch>
          </label>
          <label class="field" for="eb-version">
            <span>{{ 'swissEbill.field.ebinterfaceVersion' | translate }}</span>
            <nz-select
              nzId="eb-version"
              [ngModel]="form().default_ebinterface_version"
              (ngModelChange)="patch({ default_ebinterface_version: $event })"
              [nzDisabled]="!canWrite"
            >
              @for (version of versions; track version) {
                <nz-option
                  [nzValue]="version"
                  [nzLabel]="
                    (version === 'SIX eBill XML'
                      ? 'swissEbill.version.sixXml'
                      : 'swissEbill.version.ebinterface61'
                    ) | translate
                  "
                ></nz-option>
              }
            </nz-select>
          </label>
        </div>
      </section>

      @if (store.settings(); as settings) {
        <section class="panel">
          <div class="connection">
            <nz-tag
              [nzColor]="
                settings.connection_status === 'connected'
                  ? 'green'
                  : settings.connection_status === 'failed'
                    ? 'red'
                    : 'default'
              "
            >
              {{ 'swissEbill.connection.' + settings.connection_status | translate }}
            </nz-tag>
            @if (settings.last_connection_tested_at) {
              <span>
                {{ 'swissEbill.field.lastTested' | translate }}:
                {{ settings.last_connection_tested_at | date: 'short' }}
              </span>
            }
            @if (settings.last_connection_latency_ms !== null) {
              <span
                >{{ 'swissEbill.field.latency' | translate }}:
                {{ settings.last_connection_latency_ms }} ms</span
              >
            }
          </div>
          @if (store.connection(); as result) {
            <nz-alert
              data-test="connection-result"
              [nzType]="result.reachable && result.authenticated ? 'success' : 'error'"
              nzShowIcon
              [nzMessage]="
                (result.reachable && result.authenticated
                  ? 'swissEbill.alert.connectionOk'
                  : 'swissEbill.alert.connectionFailed'
                ) | translate
              "
              [nzDescription]="result.message + ' (' + result.latency_ms + ' ms)'"
            ></nz-alert>
          }
        </section>
      }

      <div class="actions">
        <button
          nz-button
          type="button"
          data-test="test"
          [nzLoading]="store.testing()"
          [disabled]="!canWrite || !store.settings()"
          (click)="test()"
        >
          {{ 'swissEbill.action.testConnection' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-test="save"
          [nzLoading]="store.saving()"
          [disabled]="!canWrite"
          (click)="save()"
        >
          {{ 'swissEbill.action.save' | translate }}
        </button>
      </div>
    </nz-spin>
  `,
})
export class EbillSettingsComponent implements OnInit {
  protected readonly store = inject(EbillSettingsStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(SWISS_EBILL_MODULE);
  protected readonly providers = EBILL_PROVIDERS;
  protected readonly protocols = EBILL_PROTOCOLS;
  protected readonly authModes = EBILL_WEBHOOK_AUTH_MODES;
  protected readonly versions = EBILL_PAYLOAD_VERSIONS;
  protected readonly form = signal<SettingsForm>({ ...BLANK_FORM });

  constructor() {
    // The form follows the stored settings; the secrets stay empty (empty keeps the stored one).
    effect(() => {
      const settings = this.store.settings();
      if (settings === null) {
        return;
      }
      this.form.set({
        ebill_enabled: settings.ebill_enabled,
        biller_id: settings.biller_id ?? '',
        provider: settings.provider,
        channel_protocol: settings.channel_protocol,
        api_base_url: settings.api_base_url ?? '',
        client_id: settings.client_id ?? '',
        client_secret: '',
        signing_certificate_pem: '',
        private_key_pem: '',
        webhook_auth_mode: settings.webhook_auth_mode,
        webhook_mtls_fingerprint: settings.webhook_mtls_fingerprint ?? '',
        auto_send_on_invoice_issue: settings.auto_send_on_invoice_issue,
        attach_courtesy_pdf: settings.attach_courtesy_pdf,
        default_ebinterface_version: settings.default_ebinterface_version,
      });
    });
  }

  ngOnInit(): void {
    void this.store.load();
  }

  protected patch(change: Partial<SettingsForm>): void {
    this.form.update((current) => ({ ...current, ...change }));
  }

  protected readFile(event: Event, field: 'signing_certificate_pem' | 'private_key_pem'): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    void file.text().then((text) => this.patch({ [field]: text }));
  }

  protected payload(): EbillSettingsPayload {
    const form = this.form();
    const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());
    const payload: EbillSettingsPayload = {
      ebill_enabled: form.ebill_enabled,
      biller_id: orNull(form.biller_id),
      provider: form.provider,
      channel_protocol: form.channel_protocol,
      api_base_url: orNull(form.api_base_url),
      client_id: orNull(form.client_id),
      webhook_auth_mode: form.webhook_auth_mode,
      webhook_mtls_fingerprint: orNull(form.webhook_mtls_fingerprint),
      auto_send_on_invoice_issue: form.auto_send_on_invoice_issue,
      attach_courtesy_pdf: form.attach_courtesy_pdf,
      default_ebinterface_version: form.default_ebinterface_version,
    };
    // A secret left empty is omitted so the stored one is kept.
    if (form.client_secret !== '') {
      payload.client_secret = form.client_secret;
    }
    if (form.signing_certificate_pem.trim() !== '') {
      payload.signing_certificate_pem = form.signing_certificate_pem;
    }
    if (form.private_key_pem.trim() !== '') {
      payload.private_key_pem = form.private_key_pem;
    }
    return payload;
  }

  protected async save(): Promise<void> {
    const outcome = await this.store.save(this.payload());
    if (outcome.ok) {
      this.message.success(this.i18n.instant('swissEbill.toast.settingsSaved'));
    } else {
      this.message.error(
        outcome.detail ?? this.i18n.instant(outcome.errorKey ?? 'swissEbill.error.unknown'),
      );
    }
  }

  protected async test(): Promise<void> {
    const outcome = await this.store.testConnection();
    if (outcome.ok) {
      const ok = this.store.connection();
      const key =
        ok?.reachable && ok.authenticated
          ? 'swissEbill.toast.connectionOk'
          : 'swissEbill.toast.connectionFailed';
      this.message[key === 'swissEbill.toast.connectionOk' ? 'success' : 'error'](
        this.i18n.instant(key),
      );
    } else {
      this.message.error(this.i18n.instant(outcome.errorKey ?? 'swissEbill.error.unknown'));
    }
  }

  protected async rotate(): Promise<void> {
    const outcome = await this.store.rotateSecret();
    if (outcome.ok) {
      this.message.warning(this.i18n.instant('swissEbill.toast.secretRotated'));
    } else {
      this.message.error(this.i18n.instant(outcome.errorKey ?? 'swissEbill.error.unknown'));
    }
  }

  protected copy(text: string): void {
    if (text === '') {
      return;
    }
    void navigator.clipboard
      .writeText(text)
      .then(() => this.message.success(this.i18n.instant('swissEbill.toast.copied')));
  }
}
