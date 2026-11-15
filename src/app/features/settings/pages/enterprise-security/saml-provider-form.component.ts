import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { applyServerErrors, EnterpriseAuthApiService, SamlProvider, TranslateService, UpsertSamlProviderPayload } from '@core';
import { TranslatePipe } from '@shared';
import { blankToNull, enterpriseErrorText, formatRoleMapping, parseCertificates, parseRoleMapping } from './enterprise-security.util';

/**
 * SAML 2.0 provider of the tenant. The service provider private key is write-only: the field is never filled from
 * the API (`has_sp_signing_key` only says one is stored), it is sent with its certificate when typed and cleared
 * as soon as the save ends. The service provider values of the tenant are shown to be copied into the identity provider.
 */
@Component({
  selector: 'app-saml-provider-form',
  imports: [DatePipe, ReactiveFormsModule, NzAlertModule, NzButtonModule, NzCardModule, NzDescriptionsModule, NzFormModule, NzInputModule, NzPopconfirmModule, NzSelectModule, NzSwitchModule, NzTagModule, TranslatePipe],
  template: `
    <nz-card [nzTitle]="'ENT_AUTH.SAML_TITLE' | translate" [nzLoading]="loading()" [nzExtra]="statusTpl">
      <ng-template #statusTpl>
        @if (provider(); as current) {
          <nz-tag [nzColor]="current.ready ? 'green' : 'orange'">{{ (current.ready ? 'ENT_AUTH.READY' : 'ENT_AUTH.NOT_READY') | translate }}</nz-tag>
        }
      </ng-template>

      <p>{{ 'ENT_AUTH.SAML_INTRO' | translate }}</p>
      @if (errorText(); as text) {
        <nz-alert nzType="error" [nzMessage]="text" nzShowIcon class="gap"></nz-alert>
      }

      @if (provider(); as current) {
        <nz-descriptions class="gap" nzBordered nzSize="small" [nzColumn]="1" [nzTitle]="'ENT_AUTH.SAML_SP_VALUES' | translate">
          <nz-descriptions-item [nzTitle]="'ENT_AUTH.SAML_SP_ENTITY_ID' | translate"><code>{{ current.sp.entity_id }}</code></nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'ENT_AUTH.SAML_SP_ACS_URL' | translate"><code>{{ current.sp.acs_url }}</code></nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'ENT_AUTH.SAML_SP_SLO_URL' | translate"><code>{{ current.sp.slo_url }}</code></nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'ENT_AUTH.SAML_SP_METADATA_URL' | translate"><code>{{ current.sp.metadata_url }}</code></nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'ENT_AUTH.SAML_CERTIFICATES_COUNT' | translate">{{ current.idp_certificates_count }}</nz-descriptions-item>
          @if (current.metadata_refreshed_at) {
            <nz-descriptions-item [nzTitle]="'ENT_AUTH.SAML_METADATA_REFRESHED_AT' | translate">{{ current.metadata_refreshed_at | date: 'short' }}</nz-descriptions-item>
          }
        </nz-descriptions>
      }

      <form [formGroup]="form" nz-form nzLayout="vertical" (ngSubmit)="save()">
        <nz-form-item>
          <nz-form-label nzRequired nzFor="saml-name">{{ 'ENT_AUTH.NAME' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('name')"><input nz-input id="saml-name" formControlName="name" maxlength="120" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="saml-metadata-url">{{ 'ENT_AUTH.SAML_METADATA_URL' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('idp_metadata_url')" [nzExtra]="'ENT_AUTH.SAML_METADATA_URL_HINT' | translate"><input nz-input id="saml-metadata-url" formControlName="idp_metadata_url" type="url" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="saml-metadata-xml">{{ 'ENT_AUTH.SAML_METADATA_XML' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('idp_metadata_xml')"><textarea nz-input id="saml-metadata-xml" formControlName="idp_metadata_xml" rows="4"></textarea></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="saml-entity-id">{{ 'ENT_AUTH.SAML_IDP_ENTITY_ID' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('idp_entity_id')"><input nz-input id="saml-entity-id" formControlName="idp_entity_id" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="saml-sso-url">{{ 'ENT_AUTH.SAML_IDP_SSO_URL' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('idp_sso_url')"><input nz-input id="saml-sso-url" formControlName="idp_sso_url" type="url" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="saml-slo-url">{{ 'ENT_AUTH.SAML_IDP_SLO_URL' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('idp_slo_url')"><input nz-input id="saml-slo-url" formControlName="idp_slo_url" type="url" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="saml-certificates">{{ 'ENT_AUTH.SAML_IDP_CERTIFICATES' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('idp_certificates')" [nzExtra]="'ENT_AUTH.SAML_IDP_CERTIFICATES_HINT' | translate"><textarea nz-input id="saml-certificates" formControlName="idp_certificates" rows="4"></textarea></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="saml-email-attr">{{ 'ENT_AUTH.SAML_EMAIL_ATTRIBUTE' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('email_attribute')"><input nz-input id="saml-email-attr" formControlName="email_attribute" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="saml-name-attr">{{ 'ENT_AUTH.SAML_NAME_ATTRIBUTE' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('name_attribute')"><input nz-input id="saml-name-attr" formControlName="name_attribute" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="saml-role-attr">{{ 'ENT_AUTH.SAML_ROLE_ATTRIBUTE' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('role_attribute')"><input nz-input id="saml-role-attr" formControlName="role_attribute" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="saml-role-mapping">{{ 'ENT_AUTH.ROLE_MAPPING' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('role_mapping')" [nzExtra]="'ENT_AUTH.ROLE_MAPPING_HINT' | translate"><textarea nz-input id="saml-role-mapping" formControlName="role_mapping" rows="3"></textarea></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="saml-default-role">{{ 'ENT_AUTH.DEFAULT_ROLE' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('default_role')"><input nz-input id="saml-default-role" formControlName="default_role" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzRequired nzFor="saml-domains">{{ 'ENT_AUTH.ALLOWED_EMAIL_DOMAINS' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('allowed_email_domains')" [nzExtra]="'ENT_AUTH.ALLOWED_EMAIL_DOMAINS_HINT' | translate">
            <nz-select id="saml-domains" formControlName="allowed_email_domains" nzMode="tags" [nzTokenSeparators]="[',', ' ']" style="width: 100%"></nz-select>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="saml-sp-key">{{ 'ENT_AUTH.SAML_SP_PRIVATE_KEY' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('sp_private_key')" [nzExtra]="(provider()?.has_sp_signing_key ? 'ENT_AUTH.SECRET_STORED_HINT' : 'ENT_AUTH.SECRET_WRITE_ONLY_HINT') | translate">
            <textarea nz-input id="saml-sp-key" formControlName="sp_private_key" rows="3" autocomplete="off" spellcheck="false"></textarea>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="saml-sp-cert">{{ 'ENT_AUTH.SAML_SP_CERTIFICATE' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('sp_certificate')"><textarea nz-input id="saml-sp-cert" formControlName="sp_certificate" rows="3" spellcheck="false"></textarea></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-control>
            <label class="switch-row"><nz-switch formControlName="sync_role_on_login"></nz-switch> {{ 'ENT_AUTH.SYNC_ROLE_ON_LOGIN' | translate }}</label>
            <label class="switch-row"><nz-switch formControlName="jit_provisioning"></nz-switch> {{ 'ENT_AUTH.JIT_PROVISIONING' | translate }}</label>
            <label class="switch-row"><nz-switch formControlName="enabled"></nz-switch> {{ 'ENT_AUTH.ENABLED' | translate }}</label>
          </nz-form-control>
        </nz-form-item>

        <div class="actions">
          <button nz-button nzType="primary" type="submit" [nzLoading]="working()" [disabled]="form.invalid">{{ 'COMMON.SAVE' | translate }}</button>
          @if (provider()) {
            <button nz-button type="button" [disabled]="working() || !provider()?.idp_metadata_url" (click)="testConnection()">{{ 'ENT_AUTH.SAML_REFRESH_METADATA' | translate }}</button>
            <button nz-button nzDanger type="button" [disabled]="working()" nz-popconfirm [nzPopconfirmTitle]="'ENT_AUTH.DELETE_PROVIDER_CONFIRM' | translate" (nzOnConfirm)="remove()">{{ 'COMMON.DELETE' | translate }}</button>
          }
        </div>
      </form>
    </nz-card>
  `,
  styles: `
    .gap { margin-bottom: 16px; display: block; }
    .switch-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
  `,
})
export class SamlProviderFormComponent implements OnInit {
  private readonly api = inject(EnterpriseAuthApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(FormBuilder);

  readonly provider = signal<SamlProvider | null>(null);
  readonly loading = signal(false);
  readonly working = signal(false);
  readonly errorText = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    idp_metadata_url: '',
    idp_metadata_xml: '',
    idp_entity_id: '',
    idp_sso_url: '',
    idp_slo_url: '',
    idp_certificates: '',
    email_attribute: '',
    name_attribute: '',
    role_attribute: '',
    role_mapping: '',
    default_role: '',
    allowed_email_domains: this.fb.nonNullable.control<string[]>([], [Validators.required]),
    sp_private_key: '',
    sp_certificate: '',
    sync_role_on_login: false,
    jit_provisioning: false,
    enabled: false,
  });

  ngOnInit(): void {
    this.load();
  }

  serverError(path: string): string | undefined {
    const error = this.form.get(path)?.errors?.['serverError'];
    return typeof error === 'string' ? error : undefined;
  }

  load(): void {
    this.loading.set(true);
    this.api.getSamlProvider().subscribe({
      next: (response) => {
        this.apply(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorText.set(enterpriseErrorText(error) ?? this.translate.instant('ENT_AUTH.ACTION_ERROR'));
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      return;
    }

    this.working.set(true);
    this.errorText.set(null);
    this.api.upsertSamlProvider(this.payload()).subscribe({
      next: (response) => {
        this.apply(response.data);
        this.working.set(false);
        this.message.success(this.translate.instant('ENT_AUTH.SAVED'));
      },
      error: (error: unknown) => {
        this.working.set(false);
        this.form.patchValue({ sp_private_key: '' });
        const unmapped = applyServerErrors(this.form, error);
        this.errorText.set(unmapped[0] ?? enterpriseErrorText(error) ?? this.translate.instant('ENT_AUTH.ACTION_ERROR'));
      },
    });
  }

  /** Fetches the identity provider metadata again from its URL: it fails when the URL cannot be reached or the metadata is unusable. */
  testConnection(): void {
    this.working.set(true);
    this.errorText.set(null);
    this.api.refreshSamlMetadata().subscribe({
      next: (response) => {
        this.apply(response.data);
        this.working.set(false);
        this.message.success(this.translate.instant('ENT_AUTH.CONNECTION_OK'));
      },
      error: (error: unknown) => {
        this.working.set(false);
        this.errorText.set(enterpriseErrorText(error) ?? this.translate.instant('ENT_AUTH.CONNECTION_FAILED'));
      },
    });
  }

  remove(): void {
    this.working.set(true);
    this.api.deleteSamlProvider().subscribe({
      next: () => {
        this.working.set(false);
        this.form.reset();
        this.apply(null);
        this.message.success(this.translate.instant('ENT_AUTH.PROVIDER_REMOVED'));
      },
      error: (error: unknown) => {
        this.working.set(false);
        this.errorText.set(enterpriseErrorText(error) ?? this.translate.instant('ENT_AUTH.ACTION_ERROR'));
      },
    });
  }

  /** The body of the FormRequest: an empty private key and certificate are omitted so the stored pair is kept. */
  payload(): UpsertSamlProviderPayload {
    const value = this.form.getRawValue();
    const key = value.sp_private_key.trim();
    const certificate = value.sp_certificate.trim();

    return {
      name: value.name.trim(),
      idp_metadata_url: blankToNull(value.idp_metadata_url),
      idp_metadata_xml: blankToNull(value.idp_metadata_xml),
      idp_entity_id: blankToNull(value.idp_entity_id),
      idp_sso_url: blankToNull(value.idp_sso_url),
      idp_slo_url: blankToNull(value.idp_slo_url),
      idp_certificates: parseCertificates(value.idp_certificates),
      email_attribute: blankToNull(value.email_attribute),
      name_attribute: blankToNull(value.name_attribute),
      role_attribute: blankToNull(value.role_attribute),
      role_mapping: parseRoleMapping(value.role_mapping),
      default_role: blankToNull(value.default_role),
      allowed_email_domains: value.allowed_email_domains,
      ...(key === '' && certificate === '' ? {} : { sp_private_key: blankToNull(key), sp_certificate: blankToNull(certificate) }),
      sync_role_on_login: value.sync_role_on_login,
      jit_provisioning: value.jit_provisioning,
      enabled: value.enabled,
    };
  }

  private apply(provider: SamlProvider | null): void {
    this.provider.set(provider);
    if (!provider) {
      return;
    }

    this.form.reset({
      name: provider.name,
      idp_metadata_url: provider.idp_metadata_url ?? '',
      idp_metadata_xml: '',
      idp_entity_id: provider.idp_entity_id ?? '',
      idp_sso_url: provider.idp_sso_url ?? '',
      idp_slo_url: provider.idp_slo_url ?? '',
      idp_certificates: '',
      email_attribute: provider.email_attribute ?? '',
      name_attribute: provider.name_attribute ?? '',
      role_attribute: provider.role_attribute ?? '',
      role_mapping: formatRoleMapping(provider.role_mapping),
      default_role: provider.default_role ?? '',
      allowed_email_domains: provider.allowed_email_domains,
      sp_private_key: '',
      sp_certificate: '',
      sync_role_on_login: provider.sync_role_on_login,
      jit_provisioning: provider.jit_provisioning,
      enabled: provider.enabled,
    });
  }
}
