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

const DEFAULT_RETURN_URL = '/sales/invoices';

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
  template: `
    <main class="login-wrapper">
      <div class="login-box">
        <header class="login-header text-center">
          <h1>Fattura <span class="facile-color">Facile</span></h1>
          <p class="subtitle">{{ 'AUTH.SUBTITLE' | translate }}</p>
        </header>

        <nz-card [nzBordered]="false" class="login-card">
          @if (errorMessage(); as message) {
            <nz-alert class="login-alert" nzType="error" nzShowIcon [nzMessage]="message" />
          }

          <form
            nz-form
            nzLayout="vertical"
            [formGroup]="loginForm"
            (ngSubmit)="onSubmit()"
            novalidate
          >
            <nz-form-item>
              <nz-form-label nzRequired nzFor="email">{{ 'AUTH.EMAIL' | translate }}</nz-form-label>
              <nz-form-control
                nzHasFeedback
                [nzValidateStatus]="loginForm.controls.email"
                [nzErrorTip]="emailError"
              >
                <nz-input-wrapper>
                  <nz-icon nzInputPrefix nzType="mail" />
                  <input
                    nz-input
                    id="email"
                    type="email"
                    formControlName="email"
                    autocomplete="username"
                    nzSize="large"
                    placeholder="name@company.com"
                  />
                </nz-input-wrapper>
              </nz-form-control>
              <ng-template #emailError let-control>
                @if (control.hasError('serverError')) {
                  {{ control.getError('serverError') }}
                } @else if (control.hasError('email')) {
                  {{ 'COMMON.VALIDATION.INVALID_EMAIL' | translate }}
                } @else {
                  {{ 'AUTH.EMAIL_ERROR' | translate }}
                }
              </ng-template>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired nzFor="password">{{
                'AUTH.PASSWORD' | translate
              }}</nz-form-label>
              <nz-form-control
                nzHasFeedback
                [nzValidateStatus]="loginForm.controls.password"
                [nzErrorTip]="passwordError"
              >
                <nz-input-wrapper>
                  <nz-icon nzInputPrefix nzType="lock" />
                  <input
                    nz-input
                    id="password"
                    formControlName="password"
                    autocomplete="current-password"
                    nzSize="large"
                    [type]="passwordVisible() ? 'text' : 'password'"
                  />
                  <button
                    nzInputSuffix
                    type="button"
                    class="toggle"
                    [attr.aria-label]="
                      (passwordVisible() ? 'AUTH.HIDE_PASSWORD' : 'AUTH.SHOW_PASSWORD') | translate
                    "
                    [attr.aria-pressed]="passwordVisible()"
                    (click)="passwordVisible.set(!passwordVisible())"
                  >
                    <nz-icon [nzType]="passwordVisible() ? 'eye-invisible' : 'eye'" />
                  </button>
                </nz-input-wrapper>
              </nz-form-control>
              <ng-template #passwordError let-control>
                @if (control.hasError('serverError')) {
                  {{ control.getError('serverError') }}
                } @else if (control.hasError('minlength')) {
                  {{ 'AUTH.PASSWORD_MIN' | translate }}
                } @else {
                  {{ 'AUTH.PASSWORD_ERROR' | translate }}
                }
              </ng-template>
            </nz-form-item>

            <div class="options">
              <!-- nz-checkbox renders its own input inside the label -->
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label nz-checkbox formControlName="remember">{{
                'AUTH.REMEMBER' | translate
              }}</label>
              <a href="mailto:info@fatturafacile.eu">{{ 'AUTH.FORGOT' | translate }}</a>
            </div>

            <button
              nz-button
              nzType="primary"
              nzSize="large"
              nzBlock
              type="submit"
              [nzLoading]="isSubmitting()"
            >
              {{ 'AUTH.SUBMIT_BTN' | translate }}
            </button>
          </form>
        </nz-card>
      </div>
    </main>
  `,
  styles: `
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 24px;
    }
    .login-box {
      width: 100%;
      max-width: 420px;
    }
    .login-header {
      text-align: center;
      margin-bottom: 24px;
    }
    .login-header h1 {
      color: #fff;
      font-size: 28px;
      font-weight: 700;
      margin: 0;
    }
    .subtitle {
      color: #cbd5e1;
      font-size: 14px;
      margin: 4px 0 0;
    }
    .login-card {
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    }
    .login-alert {
      margin-bottom: 16px;
    }
    .options {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .toggle {
      background: none;
      border: 0;
      padding: 0;
      cursor: pointer;
      color: inherit;
    }
  `,
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
    email: this.fb.control('', [Validators.required, Validators.email]),
    password: this.fb.control('', [Validators.required, Validators.minLength(6)]),
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

    this.authApi.login({ email, password }).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.authStore.login(undefined, res.data.token, remember);
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
