import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { CrmPortalSettings, GapViewsApiService, I18nService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const SLUG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const HTTPS_URL = /^https:\/\/\S+$/;

function firstError(error: unknown): string | null {
  const body = (error as { error?: { message?: unknown; errors?: Record<string, unknown> } })
    ?.error;
  const first = Object.values(body?.errors ?? {})[0];
  if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  return typeof body?.message === 'string' ? body.message : null;
}

function blankToNull(value: string | null): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/** Branding and behaviour of the customer portal of the tenant (slug, domain, colours, support contacts, OTP, partial payments). */
@Component({
  selector: 'app-crm-portal-settings',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzSwitchModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'CRM.PORTAL_SETTINGS.TITLE' | translate"
      [subtitle]="'CRM.PORTAL_SETTINGS.SUBTITLE' | translate"
    />

    @if (loadError()) {
      <nz-alert
        nzType="error"
        nzShowIcon
        [nzMessage]="'CRM.PORTAL_SETTINGS.LOAD_ERROR' | translate"
      />
    }
    @if (formError()) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="formError()" />
    }

    <nz-card [nzLoading]="loading()">
      <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="save()">
        <nz-form-item>
          <nz-form-label nzFor="portal_slug">{{
            'CRM.PORTAL_SETTINGS.SLUG' | translate
          }}</nz-form-label>
          <nz-form-control [nzErrorTip]="'CRM.PORTAL_SETTINGS.SLUG_INVALID' | translate">
            <input nz-input id="portal_slug" formControlName="portal_slug" maxlength="63" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="custom_domain">{{
            'CRM.PORTAL_SETTINGS.CUSTOM_DOMAIN' | translate
          }}</nz-form-label>
          <nz-form-control>
            <input nz-input id="custom_domain" formControlName="custom_domain" maxlength="253" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="logo_url">{{
            'CRM.PORTAL_SETTINGS.LOGO_URL' | translate
          }}</nz-form-label>
          <nz-form-control [nzErrorTip]="'CRM.PORTAL_SETTINGS.HTTPS_REQUIRED' | translate">
            <input nz-input id="logo_url" formControlName="logo_url" maxlength="500" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="favicon_url">{{
            'CRM.PORTAL_SETTINGS.FAVICON_URL' | translate
          }}</nz-form-label>
          <nz-form-control [nzErrorTip]="'CRM.PORTAL_SETTINGS.HTTPS_REQUIRED' | translate">
            <input nz-input id="favicon_url" formControlName="favicon_url" maxlength="500" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="primary_color">{{
            'CRM.PORTAL_SETTINGS.PRIMARY_COLOR' | translate
          }}</nz-form-label>
          <nz-form-control [nzErrorTip]="'CRM.PORTAL_SETTINGS.COLOR_INVALID' | translate">
            <input
              nz-input
              id="primary_color"
              formControlName="primary_color"
              placeholder="#1677ff"
              maxlength="7"
            />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="secondary_color">{{
            'CRM.PORTAL_SETTINGS.SECONDARY_COLOR' | translate
          }}</nz-form-label>
          <nz-form-control [nzErrorTip]="'CRM.PORTAL_SETTINGS.COLOR_INVALID' | translate">
            <input
              nz-input
              id="secondary_color"
              formControlName="secondary_color"
              placeholder="#0050b3"
              maxlength="7"
            />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="support_email">{{
            'CRM.PORTAL_SETTINGS.SUPPORT_EMAIL' | translate
          }}</nz-form-label>
          <nz-form-control [nzErrorTip]="'CRM.PORTAL_SETTINGS.EMAIL_INVALID' | translate">
            <input
              nz-input
              id="support_email"
              type="email"
              formControlName="support_email"
              maxlength="254"
            />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="privacy_policy_url">{{
            'CRM.PORTAL_SETTINGS.PRIVACY_URL' | translate
          }}</nz-form-label>
          <nz-form-control [nzErrorTip]="'CRM.PORTAL_SETTINGS.HTTPS_REQUIRED' | translate">
            <input
              nz-input
              id="privacy_policy_url"
              formControlName="privacy_policy_url"
              maxlength="500"
            />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="require_otp">{{
            'CRM.PORTAL_SETTINGS.REQUIRE_OTP' | translate
          }}</nz-form-label>
          <nz-form-control>
            <nz-switch nzId="require_otp" formControlName="require_otp" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="allow_partial_payments">{{
            'CRM.PORTAL_SETTINGS.PARTIAL_PAYMENTS' | translate
          }}</nz-form-label>
          <nz-form-control>
            <nz-switch nzId="allow_partial_payments" formControlName="allow_partial_payments" />
          </nz-form-control>
        </nz-form-item>
        <button
          nz-button
          nzType="primary"
          type="submit"
          [disabled]="form.invalid"
          [nzLoading]="saving()"
        >
          {{ 'COMMON.SAVE' | translate }}
        </button>
      </form>
    </nz-card>
  `,
})
export class CrmPortalSettingsComponent implements OnInit {
  private readonly api = inject(GapViewsApiService);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    portal_slug: this.fb.control<string | null>(null, Validators.pattern(SLUG)),
    custom_domain: this.fb.control<string | null>(null),
    logo_url: this.fb.control<string | null>(null, Validators.pattern(HTTPS_URL)),
    favicon_url: this.fb.control<string | null>(null, Validators.pattern(HTTPS_URL)),
    primary_color: this.fb.control<string | null>(null, Validators.pattern(HEX_COLOR)),
    secondary_color: this.fb.control<string | null>(null, Validators.pattern(HEX_COLOR)),
    support_email: this.fb.control<string | null>(null, Validators.email),
    privacy_policy_url: this.fb.control<string | null>(null, Validators.pattern(HTTPS_URL)),
    require_otp: this.fb.nonNullable.control(false),
    allow_partial_payments: this.fb.nonNullable.control(false),
  });

  ngOnInit(): void {
    this.api.getPortalSettings().subscribe({
      next: (response) => {
        this.form.reset(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    const v = this.form.getRawValue();
    const payload: CrmPortalSettings = {
      portal_slug: blankToNull(v.portal_slug),
      custom_domain: blankToNull(v.custom_domain),
      logo_url: blankToNull(v.logo_url),
      favicon_url: blankToNull(v.favicon_url),
      primary_color: blankToNull(v.primary_color),
      secondary_color: blankToNull(v.secondary_color),
      support_email: blankToNull(v.support_email),
      privacy_policy_url: blankToNull(v.privacy_policy_url),
      require_otp: v.require_otp,
      allow_partial_payments: v.allow_partial_payments,
    };
    this.saving.set(true);
    this.formError.set(null);
    this.api.savePortalSettings(payload).subscribe({
      next: (response) => {
        this.saving.set(false);
        this.form.reset(response.data);
        this.message.success(this.i18n.translate('CRM.PORTAL_SETTINGS.SAVED'));
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.formError.set(
          firstError(error) ?? this.i18n.translate('CRM.PORTAL_SETTINGS.SAVE_FAILED'),
        );
      },
    });
  }
}
