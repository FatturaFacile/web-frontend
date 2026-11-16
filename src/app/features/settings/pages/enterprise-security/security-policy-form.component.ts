import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { EnterpriseAuthApiService, SecurityPolicy, TranslateService, TwoFactorRequirement, UpdateSecurityPolicyPayload } from '@core';
import { TranslatePipe } from '@shared';
import { enterpriseErrorText } from './enterprise-security.util';

/** The per-tenant security policy: password rules, lockout, sessions, second factor requirement and SSO-only mode. */
@Component({
  selector: 'app-security-policy-form',
  imports: [ReactiveFormsModule, NzAlertModule, NzButtonModule, NzCardModule, NzFormModule, NzInputNumberModule, NzSelectModule, NzSwitchModule, TranslatePipe],
  template: `
    <form [formGroup]="form" nz-form nzLayout="vertical" (ngSubmit)="save()">
      @if (errorText(); as text) {
        <nz-alert nzType="error" [nzMessage]="text" nzShowIcon class="block"></nz-alert>
      }

      <nz-card [nzTitle]="'ENT_AUTH.POLICY_PASSWORD' | translate" [nzLoading]="loading()" class="block">
        <div formGroupName="password">
          <nz-form-item>
            <nz-form-label nzFor="pw-min-length">{{ 'ENT_AUTH.POLICY_MIN_LENGTH' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-input-number id="pw-min-length" formControlName="min_length" [nzMin]="8" [nzMax]="128"></nz-input-number>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-control>
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label class="switch-row"><nz-switch formControlName="require_mixed_case"></nz-switch> {{ 'ENT_AUTH.POLICY_MIXED_CASE' | translate }}</label>
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label class="switch-row"><nz-switch formControlName="require_numbers"></nz-switch> {{ 'ENT_AUTH.POLICY_NUMBERS' | translate }}</label>
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label class="switch-row"><nz-switch formControlName="require_symbols"></nz-switch> {{ 'ENT_AUTH.POLICY_SYMBOLS' | translate }}</label>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="pw-history">{{ 'ENT_AUTH.POLICY_HISTORY' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'ENT_AUTH.POLICY_HISTORY_HINT' | translate">
              <nz-input-number id="pw-history" formControlName="history_count" [nzMin]="0" [nzMax]="24"></nz-input-number>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="pw-max-age">{{ 'ENT_AUTH.POLICY_MAX_AGE' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'ENT_AUTH.POLICY_MAX_AGE_HINT' | translate">
              <nz-input-number id="pw-max-age" formControlName="max_age_days" [nzMin]="1" [nzMax]="730"></nz-input-number>
            </nz-form-control>
          </nz-form-item>
        </div>
      </nz-card>

      <nz-card [nzTitle]="'ENT_AUTH.POLICY_LOCKOUT' | translate" [nzLoading]="loading()" class="block">
        <div formGroupName="lockout">
          <nz-form-item>
            <nz-form-label nzFor="lockout-attempts">{{ 'ENT_AUTH.POLICY_LOCKOUT_ATTEMPTS' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'ENT_AUTH.POLICY_LOCKOUT_ATTEMPTS_HINT' | translate">
              <nz-input-number id="lockout-attempts" formControlName="max_attempts" [nzMin]="0" [nzMax]="20"></nz-input-number>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="lockout-minutes">{{ 'ENT_AUTH.POLICY_LOCKOUT_MINUTES' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-input-number id="lockout-minutes" formControlName="minutes" [nzMin]="1" [nzMax]="1440"></nz-input-number>
            </nz-form-control>
          </nz-form-item>
        </div>
      </nz-card>

      <nz-card [nzTitle]="'ENT_AUTH.POLICY_SESSION' | translate" [nzLoading]="loading()" class="block">
        <div formGroupName="session">
          <nz-form-item>
            <nz-form-label nzFor="session-idle">{{ 'ENT_AUTH.POLICY_IDLE_TIMEOUT' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'ENT_AUTH.POLICY_IDLE_TIMEOUT_HINT' | translate">
              <nz-input-number id="session-idle" formControlName="idle_timeout_minutes" [nzMin]="5" [nzMax]="1440"></nz-input-number>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="session-max">{{ 'ENT_AUTH.POLICY_MAX_SESSIONS' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'ENT_AUTH.POLICY_MAX_SESSIONS_HINT' | translate">
              <nz-input-number id="session-max" formControlName="max_concurrent_sessions" [nzMin]="1" [nzMax]="50"></nz-input-number>
            </nz-form-control>
          </nz-form-item>
        </div>
      </nz-card>

      <nz-card [nzTitle]="'ENT_AUTH.POLICY_TWO_FACTOR' | translate" [nzLoading]="loading()" class="block">
        <div formGroupName="two_factor">
          <nz-form-item>
            <nz-form-label nzFor="tf-require">{{ 'ENT_AUTH.POLICY_TWO_FACTOR_REQUIRE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select id="tf-require" formControlName="require_for" style="width: 280px">
                @for (mode of twoFactorModes; track mode) {
                  <nz-option [nzValue]="mode" [nzLabel]="'ENT_AUTH.POLICY_TWO_FACTOR_' + mode.toUpperCase() | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          @if (form.controls.two_factor.controls.require_for.value === 'roles') {
            <nz-form-item>
              <nz-form-label nzFor="tf-roles">{{ 'ENT_AUTH.POLICY_TWO_FACTOR_ROLE_LIST' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'ENT_AUTH.POLICY_TWO_FACTOR_ROLE_LIST_HINT' | translate">
                <nz-select id="tf-roles" formControlName="roles" nzMode="tags" [nzTokenSeparators]="[',']" style="width: 100%"></nz-select>
              </nz-form-control>
            </nz-form-item>
          }
        </div>
      </nz-card>

      <nz-card [nzTitle]="'ENT_AUTH.POLICY_SSO_ONLY' | translate" [nzLoading]="loading()" class="block">
        <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
        <label class="switch-row"><nz-switch formControlName="sso_only"></nz-switch> {{ 'ENT_AUTH.POLICY_SSO_ONLY_LABEL' | translate }}</label>
        <p class="muted">{{ 'ENT_AUTH.POLICY_SSO_ONLY_HINT' | translate }}</p>
        @if (!ssoReady()) {
          <nz-alert nzType="info" [nzMessage]="'ENT_AUTH.POLICY_SSO_NOT_READY' | translate" nzShowIcon></nz-alert>
        }
      </nz-card>

      <button nz-button nzType="primary" type="submit" [nzLoading]="saving()">{{ 'COMMON.SAVE' | translate }}</button>
    </form>
  `,
  styles: `
    .block { margin-bottom: 16px; display: block; }
    .switch-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .muted { color: var(--ff-color-text-secondary); }
  `,
})
export class SecurityPolicyFormComponent implements OnInit {
  private readonly api = inject(EnterpriseAuthApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(FormBuilder);

  readonly twoFactorModes: TwoFactorRequirement[] = ['none', 'all', 'roles'];
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly ssoReady = signal(false);
  readonly errorText = signal<string | null>(null);

  readonly form = this.fb.group({
    password: this.fb.group({
      min_length: this.fb.control<number | null>(12),
      require_mixed_case: this.fb.nonNullable.control(false),
      require_numbers: this.fb.nonNullable.control(false),
      require_symbols: this.fb.nonNullable.control(false),
      history_count: this.fb.control<number | null>(0),
      max_age_days: this.fb.control<number | null>(null),
    }),
    lockout: this.fb.group({
      max_attempts: this.fb.control<number | null>(0),
      minutes: this.fb.control<number | null>(15),
    }),
    session: this.fb.group({
      idle_timeout_minutes: this.fb.control<number | null>(null),
      max_concurrent_sessions: this.fb.control<number | null>(null),
    }),
    two_factor: this.fb.group({
      require_for: this.fb.nonNullable.control<TwoFactorRequirement>('none'),
      roles: this.fb.nonNullable.control<string[]>([]),
    }),
    sso_only: this.fb.nonNullable.control(false),
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPolicy().subscribe({
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
    this.saving.set(true);
    this.errorText.set(null);
    this.api.updatePolicy(this.payload()).subscribe({
      next: (response) => {
        this.apply(response.data);
        this.saving.set(false);
        this.message.success(this.translate.instant('ENT_AUTH.SAVED'));
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorText.set(enterpriseErrorText(error) ?? this.translate.instant('ENT_AUTH.ACTION_ERROR'));
      },
    });
  }

  payload(): UpdateSecurityPolicyPayload {
    const value = this.form.getRawValue();
    const twoFactor = value.two_factor;

    return {
      password: {
        min_length: value.password.min_length ?? undefined,
        require_mixed_case: value.password.require_mixed_case,
        require_numbers: value.password.require_numbers,
        require_symbols: value.password.require_symbols,
        history_count: value.password.history_count ?? undefined,
        max_age_days: value.password.max_age_days,
      },
      lockout: {
        max_attempts: value.lockout.max_attempts ?? undefined,
        minutes: value.lockout.minutes ?? undefined,
      },
      session: value.session,
      two_factor: { require_for: twoFactor.require_for, roles: twoFactor.require_for === 'roles' ? twoFactor.roles : [] },
      sso_only: value.sso_only,
    };
  }

  private apply(policy: SecurityPolicy): void {
    this.form.patchValue(policy);
    this.ssoReady.set(policy.sso_ready);
  }
}
