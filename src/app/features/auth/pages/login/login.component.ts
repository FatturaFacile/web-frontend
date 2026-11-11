import { Component, inject, signal } from '@angular/core';
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
  I18nService,
  isValidationError,
  LoginResult,
  SsoLoginService,
} from '@core';
import { TranslatePipe } from '@shared';
import { environment } from '@env';
import { purgeLegacyTokenKeys } from '@core/auth/token-storage.service';
import { LanguageSelectorComponent } from '../../components/language-selector.component';
import { ResendVerificationComponent } from '../../components/resend-verification.component';
import { TwoFactorSetupModalComponent } from '../../components/two-factor-setup-modal/two-factor-setup-modal.component';

const DEFAULT_RETURN_URL = '/sales/invoices';

/** Account recreated by the backend demo reset (`demo:reset` → `erp:bootstrap`); prefilled only in demo builds. */
const DEMO_CREDENTIALS = { email: 'admin@demo-group.com', password: 'Password123!' };

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzCheckboxModule,
    NzAlertModule,
    NzIconModule,
    LanguageSelectorComponent,
    ResendVerificationComponent,
    TwoFactorSetupModalComponent,
    TranslatePipe,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
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

  protected readonly isSubmitting = signal(false);
  protected readonly passwordVisible = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly needsVerification = signal(false);
  protected readonly isSsoStarting = signal(false);

  // 2FA Challenge & Setup State
  protected readonly isChallengeStep = signal(false);
  protected readonly challengeToken = signal('');
  protected readonly useRecoveryCode = signal(false);
  protected readonly showTwoFactorSetup = signal(false);

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

  protected readonly challengeForm = this.fb.group({
    code: this.fb.control(''),
    recoveryCode: this.fb.control(''),
  });

  protected onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    const { email, password, remember } = this.loginForm.getRawValue();
    this.errorMessage.set(null);
    this.needsVerification.set(false);
    this.isSubmitting.set(true);

    this.authApi.login({ email, password, remember: remember ?? false, tenant_id: '' }).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        const data = res?.data;

        // Two-factor authentication required
        if (data?.two_factor_required && data.challenge_token) {
          this.challengeToken.set(data.challenge_token);
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

  /** Looks up the single sign-on of the typed email address and sends the browser to its identity provider. */
  protected onSsoSubmit(): void {
    const email = this.loginForm.controls.email;
    if (email.invalid) {
      email.markAsTouched();
      return;
    }
    this.errorMessage.set(null);
    this.isSsoStarting.set(true);

    this.sso.signInWithEmail(email.value, this.route.snapshot.queryParamMap.get('returnUrl')).subscribe({
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

  protected onChallengeSubmit(): void {
    const isRecovery = this.useRecoveryCode();
    const { code, recoveryCode } = this.challengeForm.getRawValue();

    if (isRecovery && !recoveryCode.trim()) {
      this.errorMessage.set(this.i18n.translate('TWO_FACTOR.RECOVERY_CODE_INVALID'));
      return;
    }
    if (!isRecovery && !code.trim()) {
      this.errorMessage.set(this.i18n.translate('TWO_FACTOR.CODE_REQUIRED'));
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.authApi
      .twoFactorChallenge({
        challenge_token: this.challengeToken(),
        code: isRecovery ? undefined : code.trim(),
        recovery_code: isRecovery ? recoveryCode.trim() : undefined,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.processSuccessfulLogin(res.data);
        },
        error: (err: unknown) => {
          this.isSubmitting.set(false);
          if (authProblemOf(err) === AUTH_PROBLEM.TwoFactorCodeInvalid) {
            this.errorMessage.set(this.i18n.translate('TWO_FACTOR.CODE_INVALID'));
            return;
          }
          if (authProblemOf(err) === AUTH_PROBLEM.TwoFactorChallengeInvalid) {
            this.errorMessage.set(this.i18n.translate('TWO_FACTOR.CHALLENGE_EXPIRED'));
            this.cancelChallenge();
            return;
          }
          this.handleError(err);
        },
      });
  }

  protected cancelChallenge(): void {
    this.isChallengeStep.set(false);
    this.challengeToken.set('');
    this.challengeForm.reset();
    this.useRecoveryCode.set(false);
    this.errorMessage.set(null);
  }

  protected onTwoFactorSetupCompleted(): void {
    this.showTwoFactorSetup.set(false);
    void this.router.navigateByUrl(this.resolveReturnUrl());
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

    // If 2FA setup is required by tenant policy or user status
    if (data?.two_factor_setup_required) {
      this.showTwoFactorSetup.set(true);
      return;
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
    if (err instanceof HttpErrorResponse && err.status === 403) {
      if (authProblemOf(err) === AUTH_PROBLEM.TwoFactorSetupRequired) {
        this.showTwoFactorSetup.set(true);
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
