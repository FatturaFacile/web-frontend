import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { ApiResponse, applyServerErrors, AuthApiService, isValidationError } from '@core';
import { TranslatePipe } from '@shared';
import { LanguageSelectorComponent } from '../../components/language-selector.component';

/** The backend answers the same way for every address, and so does this page. */
@Component({
  selector: 'app-forgot-password',
  styleUrl: './forgot-password.component.scss',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    LanguageSelectorComponent,
    TranslatePipe,
  ],
  template: `
    <main class="login-wrapper">
      <div class="login-box">
        <app-language-selector />

        <header class="login-header text-center">
          <h1>Fattura <span class="facile-color">Facile</span></h1>
          <p>{{ 'AUTH.FORGOT_TITLE' | translate }}</p>
        </header>
        <nz-card [nzBordered]="false" class="login-card">
          <div aria-live="polite">
            @if (requested()) {
              <nz-alert
                class="login-alert"
                nzType="success"
                nzShowIcon
                [nzMessage]="'AUTH.FORGOT_SENT' | translate"
              />
            }
            @if (errorKey(); as key) {
              <nz-alert class="login-alert" nzType="error" nzShowIcon [nzMessage]="key | translate" />
            }
          </div>

          @if (!requested()) {
            <p>{{ 'AUTH.FORGOT_INTRO' | translate }}</p>
          }

          <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="onSubmit()">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="email">{{ 'AUTH.EMAIL' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="emailError">
                <input nz-input id="email" type="email" autocomplete="email" formControlName="email" />
              </nz-form-control>
              <ng-template #emailError let-control>
                @if (control.hasError('serverError')) {
                  {{ control.getError('serverError') }}
                } @else {
                  {{ 'AUTH.EMAIL_ERROR' | translate }}
                }
              </ng-template>
            </nz-form-item>

            <button nz-button nzType="primary" nzSize="large" nzBlock type="submit" [nzLoading]="isSubmitting()">
              {{ (requested() ? 'AUTH.RESEND_BTN' : 'AUTH.FORGOT_SUBMIT') | translate }}
            </button>
          </form>

          <p class="text-center">
            <a routerLink="/login">{{ 'AUTH.BACK_TO_LOGIN' | translate }}</a>
          </p>
        </nz-card>
      </div>
    </main>
  `,
})
export class ForgotPasswordComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authApi = inject(AuthApiService);

  protected readonly requested = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly form = this.fb.group({
    email: this.fb.control('', [Validators.required, Validators.email, Validators.maxLength(255)]),
  });

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.form.controls.email.updateValueAndValidity({ onlySelf: true });
      return;
    }

    const email = this.form.getRawValue().email.trim();
    const request: Observable<ApiResponse<unknown>> = this.requested()
      ? this.authApi.resendResetPasswordEmail(email)
      : this.authApi.forgotPassword(email);

    this.errorKey.set(null);
    this.isSubmitting.set(true);
    request.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.requested.set(true);
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        this.handleError(err);
      },
    });
  }

  private handleError(err: unknown): void {
    if (isValidationError(err)) {
      applyServerErrors(this.form, err);
      return;
    }
    this.errorKey.set(
      err instanceof HttpErrorResponse && err.status === 429
        ? 'AUTH.TOO_MANY_ATTEMPTS'
        : 'AUTH.RESEND_FAILED',
    );
  }
}
