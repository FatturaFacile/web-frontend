import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  applyServerErrors,
  AUTH_PROBLEM,
  AuthApiService,
  authProblemOf,
  AuthStore,
  clearTrustedDeviceToken,
  DEFAULT_TRUSTED_DEVICE_DAYS,
  getTrustedDeviceToken,
  SupportedLanguage,
  I18nService,
  IamApiService,
  isValidationError,
  LoginResult,
  PasskeyUnavailableError,
  SsoLoginService,
  TwoFactorMethod,
  WebAuthnService,
} from '@core';
import { TranslatePipe } from '@shared';
import { AuthFooterComponent } from '../../components/auth-footer.component';
import { ThemeSelectorComponent } from '../../components/theme-selector.component';
import { environment } from '@env';
import { firstValueFrom } from 'rxjs';
import { purgeLegacyTokenKeys } from '@core/auth/token-storage.service';
import { ResendVerificationComponent } from '../../components/resend-verification.component';
import { TwoFactorChallengeComponent } from '../../components/two-factor-challenge/two-factor-challenge.component';

const DEFAULT_RETURN_URL = '/sales/invoices';

/** Account recreated by the backend demo reset (`demo:reset` → `erp:bootstrap`); prefilled only in demo builds. */
const DEMO_CREDENTIALS = { email: 'admin@demo-group.com', password: 'Password123!' };

@Component({
  selector: 'app-login',
  styleUrl: './login.component.scss',
  imports: [
    AuthFooterComponent,
    ThemeSelectorComponent,
    ReactiveFormsModule,
    RouterLink,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzCheckboxModule,
    NzAlertModule,
    NzIconModule,
    ResendVerificationComponent,
    TwoFactorChallengeComponent,
    TranslatePipe,
  ],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly sso = inject(SsoLoginService);
  private readonly webauthn = inject(WebAuthnService);
  private readonly iam = inject(IamApiService);
  private readonly destroyRef = inject(DestroyRef);

  // Footer & Language
  protected readonly currentLang = this.i18n.currentLanguage;

  protected readonly isSubmitting = signal(false);
  protected readonly passwordVisible = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly needsVerification = signal(false);
  protected readonly isSsoStarting = signal(false);
  protected readonly passkeySupported = signal(this.webauthn.isSupported());
  protected readonly isPasskeyStarting = signal(false);
  private autofill: AbortController | null = null;

  // 2FA Challenge & Setup State
  protected readonly isChallengeStep = signal(false);
  protected readonly challengeToken = signal('');
  protected readonly challengeMethods = signal<readonly TwoFactorMethod[] | null>(null);
  protected readonly challengeDefaultMethod = signal<TwoFactorMethod | null>(null);
  protected readonly challengeEmailSent = signal(false);
  protected readonly challengeSmsSent = signal(false);
  protected readonly challengeTrustedDevices = signal(false);
  protected readonly challengeTrustedDays = signal(DEFAULT_TRUSTED_DEVICE_DAYS);

  protected readonly loginForm = this.fb.group({
    email: this.fb.control(environment.demoMode ? DEMO_CREDENTIALS.email : '', [
      Validators.required,
      Validators.email,
    ]),
    password: this.fb.control(environment.demoMode ? DEMO_CREDENTIALS.password : '', [
      Validators.required,
      Validators.minLength(6),
    ]),
    remember: this.fb.control(false),
  });

  constructor() {
    void this.startPasskeyAutofill();
    this.destroyRef.onDestroy(() => this.autofill?.abort());
  }

  protected setLanguage(lang: SupportedLanguage): void {
    this.authStore.setLocale(lang);
  }

  protected onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    const { email, password, remember } = this.loginForm.getRawValue();
    this.errorMessage.set(null);
    this.needsVerification.set(false);
    this.isSubmitting.set(true);

    // A device remembered after an earlier challenge skips the second factor while the token is valid.
    const trustedDeviceToken = getTrustedDeviceToken(email);

    this.authApi
      .login({
        email,
        password,
        remember: remember ?? false,
        tenant_id: '',
        ...(trustedDeviceToken ? { trusted_device_token: trustedDeviceToken } : {}),
      })
      .subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        const data = res?.data;

        // Two-factor authentication required
        if (data?.two_factor_required && data.challenge_token) {
          if (trustedDeviceToken) {
            // The API did not accept the remembered device (expired or revoked): forget it.
            clearTrustedDeviceToken(email);
          }
          this.challengeToken.set(data.challenge_token);
          this.challengeMethods.set(data.methods ?? null);
          this.challengeDefaultMethod.set(data.default_method ?? null);
          this.challengeEmailSent.set(data.email_code_sent ?? false);
          this.challengeSmsSent.set(data.sms_code_sent ?? false);
          this.challengeTrustedDevices.set(data.trusted_devices_enabled ?? false);
          this.challengeTrustedDays.set(data.trusted_device_days ?? DEFAULT_TRUSTED_DEVICE_DAYS);
          this.isChallengeStep.set(true);
          return;
        }

        this.processSuccessfulLogin(data);
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        this.handleError(err);
      },
    });
  }

  /** "Sign in with a passkey": the browser asks for a passkey and the biometric or PIN check (discoverable credential, no email needed). */
  protected onPasskeySignIn(): void {
    this.autofill?.abort();
    void this.completePasskeyLogin(false);
  }

  /** Offers the passkeys in the autofill of the email field when the browser supports conditional mediation. */
  private async startPasskeyAutofill(): Promise<void> {
    if (!(await this.webauthn.isConditionalSupported())) {
      return;
    }
    this.autofill = new AbortController();
    await this.completePasskeyLogin(true, this.autofill.signal);
  }

  private async completePasskeyLogin(conditional: boolean, signal?: AbortSignal): Promise<void> {
    if (!conditional) {
      this.isPasskeyStarting.set(true);
    }
    this.errorMessage.set(null);
    try {
      const begun = await firstValueFrom(this.iam.beginPasskeyLogin());
      const credential = await this.webauthn.get(begun.data.options as never, conditional, signal);
      const result = await firstValueFrom(this.iam.finishPasskeyLogin(begun.data.ceremony_id, credential));
      this.processSuccessfulLogin(result.data as LoginResult);
    } catch (err) {
      if (err instanceof PasskeyUnavailableError) {
        if (err.reason !== 'cancelled') {
          this.errorMessage.set(this.i18n.translate('IAM.PASSKEY_UNAVAILABLE'));
        }
      } else if (err instanceof HttpErrorResponse && err.status === 401) {
        this.errorMessage.set(this.i18n.translate('IAM.PASSKEY_REJECTED'));
      } else {
        this.handleError(err);
      }
    } finally {
      this.isPasskeyStarting.set(false);
    }
  }

  /** Looks up the single sign-on of the typed email address and sends the browser to its identity provider. */
  protected onSsoSubmit(): void {
    const email = this.loginForm.controls.email;
    if (email.invalid) {
      email.markAsTouched();
      return;
    }
    this.errorMessage.set(null);
    this.isSsoStarting.set(true);

    this.sso
      .signInWithEmail(email.value, this.route.snapshot.queryParamMap.get('returnUrl'))
      .subscribe({
        next: (leaving) => {
          if (!leaving) {
            this.isSsoStarting.set(false);
            this.errorMessage.set(this.i18n.translate('SSO.UNAVAILABLE'));
          }
        },
        error: () => {
          this.isSsoStarting.set(false);
          this.errorMessage.set(this.i18n.translate('SSO.START_FAILED'));
        },
      });
  }

  /** The challenge component signed the user in: finish like the password login does. */
  protected onChallengeSucceeded(data: LoginResult): void {
    this.processSuccessfulLogin(data);
  }

  /** The challenge cannot go on (expired, locked, too many attempts) or the user went back: show the password step. */
  protected onChallengeRestart(message: string | null): void {
    this.isChallengeStep.set(false);
    this.challengeToken.set('');
    this.challengeMethods.set(null);
    this.challengeDefaultMethod.set(null);
    this.challengeEmailSent.set(false);
    this.challengeSmsSent.set(false);
    this.errorMessage.set(message);
  }

  private processSuccessfulLogin(data?: LoginResult): void {
    // Cookie-only authentication: remove any bearer token an older version left in the browser
    purgeLegacyTokenKeys();

    const activeTenantId = data?.active_tenant?.id ?? data?.tenant_id;
    if (activeTenantId && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('ff_active_tenant_id', activeTenantId);
      window.localStorage.setItem('tenant_id', activeTenantId);
    }

    this.authStore.login(activeTenantId ?? undefined, data?.user ?? null);

    // The tenant policy requires a second factor the user has not set up: the route guard sends every navigation to the
    // enrolment page until it is done.
    if (data?.two_factor_setup_required) {
      this.authStore.setTwoFactorSetupRequired(true);
    }

    void this.router.navigateByUrl(this.resolveReturnUrl());
  }

  private handleError(err: unknown): void {
    if (isValidationError(err)) {
      const unmapped = applyServerErrors(this.loginForm, err);
      this.errorMessage.set(unmapped[0] ?? null);
      return;
    }
    if (err instanceof HttpErrorResponse && err.status === 401) {
      const body: unknown = err.error;
      const apiMessage =
        typeof body === 'object' && body !== null && 'message' in body
          ? String((body as { message: unknown }).message)
          : null;
      this.errorMessage.set(apiMessage ?? this.i18n.translate('AUTH.INVALID_CREDENTIALS'));
      return;
    }
    if (err instanceof HttpErrorResponse && err.status === 423) {
      this.errorMessage.set(this.i18n.translate('auth.mfa.error.account_locked'));
      return;
    }
    if (err instanceof HttpErrorResponse && err.status === 403) {
      if (authProblemOf(err) === AUTH_PROBLEM.TwoFactorSetupRequired) {
        this.authStore.setTwoFactorSetupRequired(true);
        void this.router.navigateByUrl(this.resolveReturnUrl());
        return;
      }
      this.errorMessage.set(this.forbiddenMessage(err));
      return;
    }
    this.message.error(
      this.i18n.translate('ERRORS.GENERIC', {
        status: err instanceof HttpErrorResponse ? err.status : 0,
      }),
    );
  }

  private forbiddenMessage(err: HttpErrorResponse): string {
    switch (authProblemOf(err)) {
      case AUTH_PROBLEM.EmailNotVerified:
        this.needsVerification.set(true);
        return this.i18n.translate('AUTH.EMAIL_NOT_VERIFIED');
      case AUTH_PROBLEM.TenantApprovalPending:
        return this.i18n.translate('AUTH.APPROVAL_PENDING');
      case AUTH_PROBLEM.TenantAccessRejected:
        return this.i18n.translate('AUTH.ACCESS_REJECTED');
      default: {
        const body = err.error as { detail?: unknown } | null;
        return typeof body?.detail === 'string'
          ? body.detail
          : this.i18n.translate('ERRORS.GENERIC', { status: err.status });
      }
    }
  }

  /** `returnUrl` is honoured only for same-app relative paths (open-redirect guard). */
  private resolveReturnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    return url?.startsWith('/') && !url.startsWith('//') ? url : DEFAULT_RETURN_URL;
  }
}
