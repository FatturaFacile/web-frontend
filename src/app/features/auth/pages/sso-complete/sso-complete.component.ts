import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import {
  AUTH_PROBLEM,
  AuthApiService,
  authProblemOf,
  AuthStore,
  I18nService,
  LoginResult,
  SsoLoginService,
} from '@core';
import { purgeLegacyTokenKeys } from '@core/auth/token-storage.service';
import { TranslatePipe } from '@shared';
import { LanguageSelectorComponent } from '../../components/language-selector.component';
import { TwoFactorSetupModalComponent } from '../../components/two-factor-setup-modal/two-factor-setup-modal.component';

type CompleteState = 'loading' | 'challenge' | 'failed';

const DEFAULT_RETURN_URL = '/sales/invoices';

/**
 * Where a single sign-on lands: `/auth/sso/complete#code=...` (SAML: a single-use code, exchanged for the cookie
 * session) or `/auth/sso/complete?code=...&state=...` (OpenID Connect: posted to the callback; the redirect URI of the
 * tenant's provider must point here). Both are removed from the address bar at once; the page then behaves like
 * the password login (active tenant, return path, two-factor challenge). No token is ever stored.
 */
@Component({
  selector: 'app-sso-complete',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzSpinModule,
    LanguageSelectorComponent,
    TwoFactorSetupModalComponent,
    TranslatePipe,
  ],
  template: `
    <main class="login-wrapper">
      <div class="login-box">
        <app-language-selector />

        <header class="login-header text-center">
          <h1>Fattura <span class="facile-color">Facile</span></h1>
        </header>

        <nz-card [nzBordered]="false" class="login-card">
          <div aria-live="polite">
            @switch (state()) {
              @case ('loading') {
                <p class="text-center"><nz-spin nzSimple /> {{ 'SSO.COMPLETING' | translate }}</p>
              }
              @case ('failed') {
                <nz-alert
                  class="login-alert"
                  nzType="error"
                  nzShowIcon
                  [nzMessage]="'SSO.FAILED_TITLE' | translate"
                  [nzDescription]="errorMessage()"
                />
                <a nz-button nzType="primary" nzBlock routerLink="/login">{{
                  'AUTH.GO_TO_LOGIN' | translate
                }}</a>
              }
              @case ('challenge') {
                <h2>{{ 'TWO_FACTOR.CHALLENGE_TITLE' | translate }}</h2>
                <p>{{ 'TWO_FACTOR.CHALLENGE_SUBTITLE' | translate }}</p>
                @if (errorMessage(); as message) {
                  <nz-alert class="login-alert" nzType="error" nzShowIcon [nzMessage]="message" />
                }
                <form nz-form nzLayout="vertical" [formGroup]="challengeForm" (ngSubmit)="onChallengeSubmit()">
                  @if (!useRecoveryCode()) {
                    <nz-form-item>
                      <nz-form-label nzRequired nzFor="sso-challenge-code">{{
                        'TWO_FACTOR.APP_CODE' | translate
                      }}</nz-form-label>
                      <nz-form-control>
                        <input
                          nz-input
                          id="sso-challenge-code"
                          type="text"
                          inputmode="numeric"
                          formControlName="code"
                          placeholder="123456"
                          maxlength="16"
                          nzSize="large"
                          autocomplete="one-time-code"
                        />
                      </nz-form-control>
                    </nz-form-item>
                  } @else {
                    <nz-form-item>
                      <nz-form-label nzRequired nzFor="sso-challenge-recovery">{{
                        'TWO_FACTOR.RECOVERY_CODE' | translate
                      }}</nz-form-label>
                      <nz-form-control>
                        <input
                          nz-input
                          id="sso-challenge-recovery"
                          type="text"
                          formControlName="recoveryCode"
                          autocomplete="off"
                          maxlength="32"
                          nzSize="large"
                        />
                      </nz-form-control>
                    </nz-form-item>
                  }
                  <button nz-button nzType="link" type="button" (click)="useRecoveryCode.set(!useRecoveryCode())">
                    {{
                      (useRecoveryCode() ? 'TWO_FACTOR.USE_APP_CODE' : 'TWO_FACTOR.USE_RECOVERY_CODE') | translate
                    }}
                  </button>
                  <button
                    nz-button
                    nzType="primary"
                    nzSize="large"
                    nzBlock
                    type="submit"
                    [nzLoading]="isSubmitting()"
                  >
                    {{ 'TWO_FACTOR.CHALLENGE_SUBMIT' | translate }}
                  </button>
                  <a nz-button nzBlock routerLink="/login">{{ 'AUTH.BACK_TO_LOGIN' | translate }}</a>
                </form>
              }
            }
          </div>
        </nz-card>
      </div>

      <app-two-factor-setup-modal
        [(isVisible)]="showTwoFactorSetup"
        (completed)="onTwoFactorSetupCompleted()"
      />
    </main>
  `,
})
export class SsoCompleteComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly authStore = inject(AuthStore);
  private readonly sso = inject(SsoLoginService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly state = signal<CompleteState>('loading');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly useRecoveryCode = signal(false);
  protected readonly showTwoFactorSetup = signal(false);

  protected readonly challengeForm = this.fb.group({
    code: this.fb.control(''),
    recoveryCode: this.fb.control(''),
  });

  private challengeToken = '';
  private returnUrl: string | null = null;

  ngOnInit(): void {
    // The fragment goes out of the address bar before anything else happens.
    const code = this.sso.consumeSignInCode();
    const oidc = this.sso.consumeOidcParams();
    this.returnUrl = this.sso.takeReturnUrl();

    // SAML hands over a single-use code in the fragment; OpenID Connect returns `code` and `state` in the query.
    const request$ = code
      ? this.authApi.exchangeSsoCode(code)
      : oidc
        ? this.authApi.completeOidcSso(oidc.code, oidc.state)
        : null;

    if (request$ === null) {
      this.fail('SSO.NO_CODE_BODY');
      return;
    }

    request$.subscribe({
      next: (res) => {
        const data = res?.data;
        if (data?.two_factor_required && data.challenge_token) {
          this.challengeToken = data.challenge_token;
          this.state.set('challenge');
          return;
        }
        this.completeLogin(data);
      },
      error: (err: unknown) => this.failFromError(err),
    });
  }

  protected onChallengeSubmit(): void {
    const isRecovery = this.useRecoveryCode();
    const { code, recoveryCode } = this.challengeForm.getRawValue();

    if (isRecovery ? !recoveryCode.trim() : !code.trim()) {
      this.errorMessage.set(
        this.i18n.translate(isRecovery ? 'TWO_FACTOR.RECOVERY_CODE_INVALID' : 'TWO_FACTOR.CODE_REQUIRED'),
      );
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.authApi
      .twoFactorChallenge({
        challenge_token: this.challengeToken,
        code: isRecovery ? undefined : code.trim(),
        recovery_code: isRecovery ? recoveryCode.trim() : undefined,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.completeLogin(res.data);
        },
        error: (err: unknown) => {
          this.isSubmitting.set(false);
          const problem = authProblemOf(err);
          if (problem === AUTH_PROBLEM.TwoFactorCodeInvalid) {
            this.errorMessage.set(this.i18n.translate('TWO_FACTOR.CODE_INVALID'));
          } else if (problem === AUTH_PROBLEM.TwoFactorChallengeInvalid) {
            this.fail('TWO_FACTOR.CHALLENGE_EXPIRED');
          } else {
            this.failFromError(err);
          }
        },
      });
  }

  protected onTwoFactorSetupCompleted(): void {
    this.showTwoFactorSetup.set(false);
    void this.router.navigateByUrl(this.returnUrl ?? DEFAULT_RETURN_URL, { replaceUrl: true });
  }

  private completeLogin(data?: LoginResult): void {
    // Cookie-only authentication: remove any bearer token an older version left in the browser.
    purgeLegacyTokenKeys();

    const activeTenantId = data?.active_tenant?.id ?? data?.tenant_id;
    if (activeTenantId && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('ff_active_tenant_id', activeTenantId);
      window.localStorage.setItem('tenant_id', activeTenantId);
    }

    this.authStore.login(activeTenantId ?? undefined, data?.user ?? null);

    if (data?.two_factor_setup_required) {
      this.showTwoFactorSetup.set(true);
      return;
    }
    void this.router.navigateByUrl(this.returnUrl ?? DEFAULT_RETURN_URL, { replaceUrl: true });
  }

  private failFromError(err: unknown): void {
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    if (status === 401) {
      this.fail('SSO.FAILED_BODY');
    } else if (status === 400 || status === 419) {
      this.fail('SSO.SESSION_BODY');
    } else {
      this.state.set('failed');
      this.errorMessage.set(this.i18n.translate('ERRORS.GENERIC', { status }));
    }
  }

  private fail(key: string): void {
    this.state.set('failed');
    this.errorMessage.set(this.i18n.translate(key));
  }
}
