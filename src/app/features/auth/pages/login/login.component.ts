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
} from '@core';
import { TranslatePipe } from '@shared';
import { environment } from '@env';
import { LanguageSelectorComponent } from '../../components/language-selector.component';
import { ResendVerificationComponent } from '../../components/resend-verification.component';

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

  protected readonly isSubmitting = signal(false);
  protected readonly passwordVisible = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly needsVerification = signal(false);

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
        // Cookie-First SPA Authentication:
        // Laravel Sanctum relies strictly on HttpOnly session cookies (e.g. faturafaciledev-session).
        // Any returned bearer token (`res?.data?.token`) is intentionally ignored and never stored
        // in localStorage, sessionStorage, or IndexedDB to prevent XSS exfiltration.
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('ff_access_token');
          window.localStorage.removeItem('token');
          window.localStorage.removeItem('auth_token');
        }
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.removeItem('ff_access_token');
          window.sessionStorage.removeItem('token');
          window.sessionStorage.removeItem('auth_token');
        }
        if (res?.data?.tenant_id && typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('ff_active_tenant_id', res.data.tenant_id);
          window.localStorage.setItem('tenant_id', res.data.tenant_id);
        }
        this.authStore.login(res?.data?.tenant_id ?? undefined, res?.data?.user ?? null);
        void this.router.navigateByUrl(this.resolveReturnUrl());
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        this.handleError(err);
      },
    });
  }

  private handleError(err: unknown): void {
    if (isValidationError(err)) {
      const unmapped = applyServerErrors(this.loginForm, err);
      // Fall back to the inline alert when no field could be matched.
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
      this.errorMessage.set(this.forbiddenMessage(err));
      return;
    }
    // Other failures (network, 5xx) are already toasted by the error interceptor.
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
