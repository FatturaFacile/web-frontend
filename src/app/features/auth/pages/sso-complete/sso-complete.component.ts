import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import {
  AuthApiService,
  AuthStore,
  DEFAULT_TRUSTED_DEVICE_DAYS,
  I18nService,
  LoginResult,
  SsoLoginService,
  TwoFactorMethod,
} from '@core';
import { purgeLegacyTokenKeys } from '@core/auth/token-storage.service';
import { TranslatePipe } from '@shared';
import { LanguageSelectorComponent } from '../../components/language-selector.component';
import { TwoFactorChallengeComponent } from '../../components/two-factor-challenge/two-factor-challenge.component';

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
  styleUrl: './sso-complete.component.scss',
  imports: [
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzSpinModule,
    LanguageSelectorComponent,
    TwoFactorChallengeComponent,
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
                <app-two-factor-challenge
                  [challengeToken]="challengeToken()"
                  [methods]="challengeMethods()"
                  [defaultMethod]="challengeDefaultMethod()"
                  [emailCodeSent]="challengeEmailSent()"
                  [trustedDevicesEnabled]="challengeTrustedDevices()"
                  [trustedDeviceDays]="challengeTrustedDays()"
                  (succeeded)="completeLogin($event)"
                  (restart)="onChallengeRestart($event)"
                />
              }
            }
          </div>
        </nz-card>
      </div>

    </main>
  `,
})
export class SsoCompleteComponent implements OnInit {
  private readonly authApi = inject(AuthApiService);
  private readonly authStore = inject(AuthStore);
  private readonly sso = inject(SsoLoginService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly state = signal<CompleteState>('loading');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly challengeToken = signal('');
  protected readonly challengeMethods = signal<readonly TwoFactorMethod[] | null>(null);
  protected readonly challengeDefaultMethod = signal<TwoFactorMethod | null>(null);
  protected readonly challengeEmailSent = signal(false);
  protected readonly challengeTrustedDevices = signal(false);
  protected readonly challengeTrustedDays = signal(DEFAULT_TRUSTED_DEVICE_DAYS);

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
          this.challengeToken.set(data.challenge_token);
          this.challengeMethods.set(data.methods ?? null);
          this.challengeDefaultMethod.set(data.default_method ?? null);
          this.challengeEmailSent.set(data.email_code_sent ?? false);
          this.challengeTrustedDevices.set(data.trusted_devices_enabled ?? false);
          this.challengeTrustedDays.set(data.trusted_device_days ?? DEFAULT_TRUSTED_DEVICE_DAYS);
          this.state.set('challenge');
          return;
        }
        this.completeLogin(data);
      },
      error: (err: unknown) => this.failFromError(err),
    });
  }

  /** The challenge cannot go on (expired, locked, too many attempts) or the user went back: the sign-in must restart. */
  protected onChallengeRestart(message: string | null): void {
    this.state.set('failed');
    this.errorMessage.set(message ?? this.i18n.translate('auth.mfa.challenge.expired'));
  }

  protected completeLogin(data?: LoginResult): void {
    // Cookie-only authentication: remove any bearer token an older version left in the browser.
    purgeLegacyTokenKeys();

    const activeTenantId = data?.active_tenant?.id ?? data?.tenant_id;
    if (activeTenantId && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('ff_active_tenant_id', activeTenantId);
      window.localStorage.setItem('tenant_id', activeTenantId);
    }

    this.authStore.login(activeTenantId ?? undefined, data?.user ?? null);

    // The tenant policy requires a second factor the user has not set up: the route guard sends the navigation to the
    // enrolment page until it is done.
    if (data?.two_factor_setup_required) {
      this.authStore.setTwoFactorSetupRequired(true);
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
