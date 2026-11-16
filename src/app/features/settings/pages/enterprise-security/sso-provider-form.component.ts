import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { applyServerErrors, EnterpriseAuthApiService, SsoProvider, SsoTokenAuthMethod, TranslateService, UpsertSsoProviderPayload } from '@core';
import { TranslatePipe } from '@shared';
import { blankToNull, enterpriseErrorText, formatRoleMapping, parseRoleMapping } from './enterprise-security.util';

/**
 * OpenID Connect provider of the tenant. The client secret is write-only: the field is never filled from the API
 * (`has_client_secret` only says one is stored), it is sent when typed and cleared as soon as the save ends.
 */
@Component({
  selector: 'app-sso-provider-form',
  imports: [DatePipe, ReactiveFormsModule, NzAlertModule, NzButtonModule, NzCardModule, NzFormModule, NzInputModule, NzPopconfirmModule, NzSelectModule, NzSwitchModule, NzTagModule, TranslatePipe],
  template: `
    <nz-card [nzTitle]="'ENT_AUTH.SSO_TITLE' | translate" [nzLoading]="loading()" [nzExtra]="statusTpl">
      <ng-template #statusTpl>
        @if (provider(); as current) {
          <nz-tag [nzColor]="current.ready ? 'green' : 'orange'">{{ (current.ready ? 'ENT_AUTH.READY' : 'ENT_AUTH.NOT_READY') | translate }}</nz-tag>
        }
      </ng-template>

      <p>{{ 'ENT_AUTH.SSO_INTRO' | translate }}</p>
      @if (errorText(); as text) {
        <nz-alert nzType="error" [nzMessage]="text" nzShowIcon class="gap"></nz-alert>
      }
      @if (provider()?.discovered_at; as discoveredAt) {
        <p class="muted">{{ 'ENT_AUTH.SSO_DISCOVERED_AT' | translate }}: {{ discoveredAt | date: 'short' }}</p>
      }

      <form [formGroup]="form" nz-form nzLayout="vertical" (ngSubmit)="save()">
        <nz-form-item>
          <nz-form-label nzRequired nzFor="sso-name">{{ 'ENT_AUTH.NAME' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('name')">
            <input nz-input id="sso-name" formControlName="name" maxlength="120" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzRequired nzFor="sso-issuer">{{ 'ENT_AUTH.SSO_ISSUER' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('issuer')">
            <input nz-input id="sso-issuer" formControlName="issuer" type="url" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-control>
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label class="switch-row"><nz-switch formControlName="use_discovery"></nz-switch> {{ 'ENT_AUTH.SSO_USE_DISCOVERY' | translate }}</label>
          </nz-form-control>
        </nz-form-item>
        @if (!form.controls.use_discovery.value) {
          <nz-form-item>
            <nz-form-label nzFor="sso-auth-endpoint">{{ 'ENT_AUTH.SSO_AUTHORIZATION_ENDPOINT' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="serverError('authorization_endpoint')"><input nz-input id="sso-auth-endpoint" formControlName="authorization_endpoint" type="url" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="sso-token-endpoint">{{ 'ENT_AUTH.SSO_TOKEN_ENDPOINT' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="serverError('token_endpoint')"><input nz-input id="sso-token-endpoint" formControlName="token_endpoint" type="url" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="sso-jwks">{{ 'ENT_AUTH.SSO_JWKS_URI' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="serverError('jwks_uri')"><input nz-input id="sso-jwks" formControlName="jwks_uri" type="url" /></nz-form-control>
          </nz-form-item>
        }
        <nz-form-item>
          <nz-form-label nzRequired nzFor="sso-redirect">{{ 'ENT_AUTH.SSO_REDIRECT_URI' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('redirect_uri')"><input nz-input id="sso-redirect" formControlName="redirect_uri" type="url" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzRequired nzFor="sso-client-id">{{ 'ENT_AUTH.SSO_CLIENT_ID' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('client_id')"><input nz-input id="sso-client-id" formControlName="client_id" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="sso-client-secret">{{ 'ENT_AUTH.SSO_CLIENT_SECRET' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('client_secret')" [nzExtra]="(provider()?.has_client_secret ? 'ENT_AUTH.SECRET_STORED_HINT' : 'ENT_AUTH.SECRET_WRITE_ONLY_HINT') | translate">
            <input nz-input id="sso-client-secret" formControlName="client_secret" type="password" autocomplete="new-password" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="sso-auth-method">{{ 'ENT_AUTH.SSO_AUTH_METHOD' | translate }}</nz-form-label>
          <nz-form-control>
            <nz-select id="sso-auth-method" formControlName="token_endpoint_auth_method" nzAllowClear style="width: 280px">
              @for (method of authMethods; track method) {
                <nz-option [nzValue]="method" [nzLabel]="method"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="sso-end-session">{{ 'ENT_AUTH.SSO_END_SESSION_ENDPOINT' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('end_session_endpoint')"><input nz-input id="sso-end-session" formControlName="end_session_endpoint" type="url" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="sso-post-logout">{{ 'ENT_AUTH.SSO_POST_LOGOUT_REDIRECT_URI' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('post_logout_redirect_uri')"><input nz-input id="sso-post-logout" formControlName="post_logout_redirect_uri" type="url" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="sso-scopes">{{ 'ENT_AUTH.SSO_SCOPES' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('scopes')"><input nz-input id="sso-scopes" formControlName="scopes" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzRequired nzFor="sso-domains">{{ 'ENT_AUTH.ALLOWED_EMAIL_DOMAINS' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('allowed_email_domains')" [nzExtra]="'ENT_AUTH.ALLOWED_EMAIL_DOMAINS_HINT' | translate">
            <nz-select id="sso-domains" formControlName="allowed_email_domains" nzMode="tags" [nzTokenSeparators]="[',', ' ']" style="width: 100%"></nz-select>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="sso-role-claim">{{ 'ENT_AUTH.SSO_ROLE_CLAIM' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('role_claim')"><input nz-input id="sso-role-claim" formControlName="role_claim" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="sso-role-mapping">{{ 'ENT_AUTH.ROLE_MAPPING' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('role_mapping')" [nzExtra]="'ENT_AUTH.ROLE_MAPPING_HINT' | translate">
            <textarea nz-input id="sso-role-mapping" formControlName="role_mapping" rows="3"></textarea>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="sso-default-role">{{ 'ENT_AUTH.DEFAULT_ROLE' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="serverError('default_role')"><input nz-input id="sso-default-role" formControlName="default_role" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-control>
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label class="switch-row"><nz-switch formControlName="sync_role_on_login"></nz-switch> {{ 'ENT_AUTH.SYNC_ROLE_ON_LOGIN' | translate }}</label>
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label class="switch-row"><nz-switch formControlName="jit_provisioning"></nz-switch> {{ 'ENT_AUTH.JIT_PROVISIONING' | translate }}</label>
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label class="switch-row"><nz-switch formControlName="enabled"></nz-switch> {{ 'ENT_AUTH.ENABLED' | translate }}</label>
          </nz-form-control>
        </nz-form-item>

        <div class="actions">
          <button nz-button nzType="primary" type="submit" [nzLoading]="working()" [disabled]="form.invalid">{{ 'COMMON.SAVE' | translate }}</button>
          @if (provider()) {
            <button nz-button type="button" [disabled]="working()" (click)="testConnection()">{{ 'ENT_AUTH.TEST_CONNECTION' | translate }}</button>
            <button nz-button nzDanger type="button" [disabled]="working()" nz-popconfirm [nzPopconfirmTitle]="'ENT_AUTH.DELETE_PROVIDER_CONFIRM' | translate" (nzOnConfirm)="remove()">{{ 'COMMON.DELETE' | translate }}</button>
          }
        </div>
      </form>
    </nz-card>
  `,
  styles: `
    .gap { margin-bottom: 16px; display: block; }
    .muted { color: rgba(0, 0, 0, 0.65); }
    .switch-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
  `,
})
export class SsoProviderFormComponent implements OnInit {
  private readonly api = inject(EnterpriseAuthApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(FormBuilder);

  readonly authMethods: SsoTokenAuthMethod[] = ['client_secret_post', 'client_secret_basic'];
  readonly provider = signal<SsoProvider | null>(null);
  readonly loading = signal(false);
  readonly working = signal(false);
  readonly errorText = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    issuer: ['', [Validators.required]],
    use_discovery: true,
    authorization_endpoint: '',
    token_endpoint: '',
    jwks_uri: '',
    redirect_uri: ['', [Validators.required]],
    client_id: ['', [Validators.required]],
    client_secret: '',
    token_endpoint_auth_method: this.fb.control<SsoTokenAuthMethod | null>(null),
    end_session_endpoint: '',
    post_logout_redirect_uri: '',
    scopes: 'openid email profile',
    allowed_email_domains: this.fb.nonNullable.control<string[]>([], [Validators.required]),
    role_claim: '',
    role_mapping: '',
    default_role: '',
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
    this.api.getSsoProvider().subscribe({
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
    this.api.upsertSsoProvider(this.payload()).subscribe({
      next: (response) => {
        this.apply(response.data);
        this.working.set(false);
        this.message.success(this.translate.instant('ENT_AUTH.SAVED'));
      },
      error: (error: unknown) => {
        this.working.set(false);
        this.form.controls.client_secret.setValue('');
        const unmapped = applyServerErrors(this.form, error);
        this.errorText.set(unmapped[0] ?? enterpriseErrorText(error) ?? this.translate.instant('ENT_AUTH.ACTION_ERROR'));
      },
    });
  }

  /** Reads the discovery document of the issuer again: it fails when the issuer cannot be reached or is misconfigured. */
  testConnection(): void {
    this.working.set(true);
    this.errorText.set(null);
    this.api.refreshSsoDiscovery().subscribe({
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
    this.api.deleteSsoProvider().subscribe({
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

  /** The body of the FormRequest: an empty secret is omitted so the stored one is kept. */
  payload(): UpsertSsoProviderPayload {
    const value = this.form.getRawValue();
    const secret = value.client_secret.trim();

    return {
      name: value.name.trim(),
      issuer: value.issuer.trim(),
      use_discovery: value.use_discovery,
      authorization_endpoint: blankToNull(value.authorization_endpoint),
      token_endpoint: blankToNull(value.token_endpoint),
      jwks_uri: blankToNull(value.jwks_uri),
      redirect_uri: value.redirect_uri.trim(),
      client_id: value.client_id.trim(),
      ...(secret === '' ? {} : { client_secret: secret }),
      token_endpoint_auth_method: value.token_endpoint_auth_method,
      end_session_endpoint: blankToNull(value.end_session_endpoint),
      post_logout_redirect_uri: blankToNull(value.post_logout_redirect_uri),
      scopes: blankToNull(value.scopes) ?? 'openid',
      allowed_email_domains: value.allowed_email_domains,
      role_claim: blankToNull(value.role_claim),
      role_mapping: parseRoleMapping(value.role_mapping),
      default_role: blankToNull(value.default_role),
      sync_role_on_login: value.sync_role_on_login,
      jit_provisioning: value.jit_provisioning,
      enabled: value.enabled,
    };
  }

  private apply(provider: SsoProvider | null): void {
    this.provider.set(provider);
    if (!provider) {
      return;
    }

    this.form.reset({
      name: provider.name,
      issuer: provider.issuer,
      use_discovery: provider.discovered_at !== null,
      authorization_endpoint: provider.authorization_endpoint ?? '',
      token_endpoint: provider.token_endpoint ?? '',
      jwks_uri: provider.jwks_uri ?? '',
      redirect_uri: provider.redirect_uri,
      client_id: provider.client_id,
      client_secret: '',
      token_endpoint_auth_method: provider.token_endpoint_auth_method,
      end_session_endpoint: provider.end_session_endpoint ?? '',
      post_logout_redirect_uri: provider.post_logout_redirect_uri ?? '',
      scopes: provider.scopes,
      allowed_email_domains: provider.allowed_email_domains,
      role_claim: provider.role_claim ?? '',
      role_mapping: formatRoleMapping(provider.role_mapping),
      default_role: provider.default_role ?? '',
      sync_role_on_login: provider.sync_role_on_login,
      jit_provisioning: provider.jit_provisioning,
      enabled: provider.enabled,
    });
  }
}
