import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  AuthApiService,
  AuthStore,
  I18nService,
  isValidationError,
} from '@core';
import { TranslatePipe } from '@shared';
import { environment } from '@env';

const DEFAULT_RETURN_URL = '/sales/invoices';

/** Account recreated by the backend demo reset (`demo:reset` → `erp:bootstrap`); prefilled only in demo builds. */
const DEMO_CREDENTIALS = { email: 'admin@demo-group.com', password: 'Password123!' };

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzCheckboxModule,
    NzAlertModule,
    NzIconModule,
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
    this.isSubmitting.set(true);

    this.authApi.login({ email, password, remember: remember ?? false, tenant_id: '' }).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
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
    // Other failures (network, 5xx) are already toasted by the error interceptor.
    this.message.error(
      this.i18n.translate('ERRORS.GENERIC', {
        status: err instanceof HttpErrorResponse ? err.status : 0,
      }),
    );
  }

  /** `returnUrl` is honoured only for same-app relative paths (open-redirect guard). */
  private resolveReturnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    return url?.startsWith('/') && !url.startsWith('//') ? url : DEFAULT_RETURN_URL;
  }
}
