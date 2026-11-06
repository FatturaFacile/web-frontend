import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { applyServerErrors, AUTH_PROBLEM, AuthApiService, authProblemOf, isValidationError } from '@core';
import { TranslatePipe } from '@shared';
import { LanguageSelectorComponent } from '../../components/language-selector.component';
import { passwordsMatch, passwordStrength, STRENGTH_KEYS } from '../../password-rules';

type ResetState = 'loading' | 'ready' | 'expired' | 'invalid' | 'locked' | 'failed';

/**
 * Opening the link only checks the token: it is consumed when the form is submitted, so mail scanners that follow links
 * cannot use it up.
 */
@Component({
  selector: 'app-reset-password',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzSpinModule,
    LanguageSelectorComponent,
    TranslatePipe,
  ],
  template: `
    <main class="login-wrapper">
      <div class="login-box">
        <app-language-selector />

        <header class="login-header text-center">
          <h1>Fattura <span class="facile-color">Facile</span></h1>
          <p>{{ 'AUTH.RESET_TITLE' | translate }}</p>
        </header>
        <nz-card [nzBordered]="false" class="login-card">
          <div aria-live="polite">
            @switch (state()) {
              @case ('loading') {
                <p class="text-center"><nz-spin nzSimple /> {{ 'AUTH.RESET_CHECKING' | translate }}</p>
              }
              @case ('expired') {
                <nz-alert
                  class="login-alert"
                  nzType="warning"
                  nzShowIcon
                  [nzMessage]="'AUTH.LINK_EXPIRED_TITLE' | translate"
                  [nzDescription]="'AUTH.RESET_LINK_EXPIRED_BODY' | translate"
                />
              }
              @case ('invalid') {
                <nz-alert
                  class="login-alert"
                  nzType="error"
                  nzShowIcon
                  [nzMessage]="'AUTH.LINK_INVALID_TITLE' | translate"
                  [nzDescription]="'AUTH.RESET_LINK_INVALID_BODY' | translate"
                />
              }
              @case ('locked') {
                <nz-alert class="login-alert" nzType="warning" nzShowIcon [nzMessage]="'AUTH.TOO_MANY_ATTEMPTS' | translate" />
              }
              @case ('failed') {
                <nz-alert class="login-alert" nzType="error" nzShowIcon [nzMessage]="'AUTH.RESET_FAILED' | translate" />
              }
            }
          </div>

          @if (state() === 'ready') {
            <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="onSubmit()">
              @if (errorMessage(); as message) {
                <nz-alert class="login-alert" nzType="error" nzShowIcon [nzMessage]="message" />
              }

              <nz-form-item>
                <nz-form-label nzRequired nzFor="password">{{ 'AUTH.NEW_PASSWORD' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="passwordError">
                  <nz-input-wrapper>
                    <input
                      nz-input
                      id="password"
                      formControlName="password"
                      autocomplete="new-password"
                      aria-describedby="password-requirements"
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
                  <small id="password-requirements" class="password-requirements">{{
                    'AUTH.PASSWORD_REQUIREMENTS' | translate
                  }}</small>
                  <div class="strength" aria-hidden="true">
                    @for (level of strengthLevels; track level) {
                      <span [class.on]="strength() >= level"></span>
                    }
                  </div>
                  @if (strength() > 0) {
                    <small class="strength-label" aria-live="polite">{{ strengthKey() | translate }}</small>
                  }
                </nz-form-control>
                <ng-template #passwordError let-control>
                  @if (control.hasError('serverError')) {
                    {{ control.getError('serverError') }}
                  } @else {
                    {{ 'COMMON.VALIDATION.REQUIRED' | translate }}
                  }
                </ng-template>
              </nz-form-item>

              <nz-form-item>
                <nz-form-label nzRequired nzFor="password_confirmation">{{
                  'AUTH.PASSWORD_CONFIRMATION' | translate
                }}</nz-form-label>
                <nz-form-control [nzErrorTip]="confirmationError">
                  <nz-input-wrapper>
                    <input
                      nz-input
                      id="password_confirmation"
                      formControlName="password_confirmation"
                      autocomplete="new-password"
                      [type]="confirmationVisible() ? 'text' : 'password'"
                    />
                    <button
                      nzInputSuffix
                      type="button"
                      class="toggle"
                      [attr.aria-label]="
                        (confirmationVisible() ? 'AUTH.HIDE_PASSWORD' : 'AUTH.SHOW_PASSWORD') | translate
                      "
                      [attr.aria-pressed]="confirmationVisible()"
                      (click)="confirmationVisible.set(!confirmationVisible())"
                    >
                      <nz-icon [nzType]="confirmationVisible() ? 'eye-invisible' : 'eye'" />
                    </button>
                  </nz-input-wrapper>
                </nz-form-control>
                <ng-template #confirmationError let-control>
                  @if (control.hasError('mismatch')) {
                    {{ 'AUTH.PASSWORD_MISMATCH' | translate }}
                  } @else {
                    {{ 'COMMON.VALIDATION.REQUIRED' | translate }}
                  }
                </ng-template>
              </nz-form-item>

              <button nz-button nzType="primary" nzSize="large" nzBlock type="submit" [nzLoading]="isSubmitting()">
                {{ 'AUTH.RESET_SUBMIT' | translate }}
              </button>
            </form>
          }

          @if (state() === 'expired' || state() === 'invalid') {
            <a nz-button nzType="primary" nzBlock routerLink="/forgot-password">{{
              'AUTH.RESET_REQUEST_NEW' | translate
            }}</a>
          }

          <p class="text-center">
            <a routerLink="/login">{{ 'AUTH.BACK_TO_LOGIN' | translate }}</a>
          </p>
        </nz-card>
      </div>
    </main>
  `,
  styleUrls: ['../login/login.component.scss', '../register/register.component.scss'],
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private token = '';

  protected readonly state = signal<ResetState>('loading');
  protected readonly isSubmitting = signal(false);
  protected readonly passwordVisible = signal(false);
  protected readonly confirmationVisible = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      password: this.fb.control('', [Validators.required]),
      password_confirmation: this.fb.control('', [Validators.required]),
    },
    { validators: passwordsMatch },
  );

  private readonly password = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });

  protected readonly strength = computed(() => passwordStrength(this.password()));
  protected readonly strengthKey = computed(() => STRENGTH_KEYS[this.strength()]);
  protected readonly strengthLevels = [1, 2, 3, 4];

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    // The token leaves the address bar and the history as soon as it has been read.
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });

    if (!token) {
      this.state.set('invalid');
      return;
    }

    this.token = token;
    this.authApi.validateResetToken(token).subscribe({
      next: () => this.state.set('ready'),
      error: (err: unknown) => this.state.set(this.stateFor(err)),
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Object.values(this.form.controls).forEach((control) =>
        control.updateValueAndValidity({ onlySelf: true }),
      );
      // The controls have just dropped the mismatch error, which only the group validator can set.
      this.form.updateValueAndValidity();
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);
    this.authApi.resetPassword({ token: this.token, ...this.form.getRawValue() }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigate(['/password-updated'], { replaceUrl: true });
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        if (isValidationError(err)) {
          this.errorMessage.set(applyServerErrors(this.form, err)[0] ?? null);
          return;
        }
        this.state.set(this.stateFor(err));
      },
    });
  }

  private stateFor(err: unknown): ResetState {
    switch (authProblemOf(err)) {
      case AUTH_PROBLEM.PasswordResetTokenExpired:
        return 'expired';
      case AUTH_PROBLEM.PasswordResetTokenInvalid:
        return 'invalid';
      case AUTH_PROBLEM.PasswordResetLocked:
        return 'locked';
      default:
        return err instanceof HttpErrorResponse && err.status === 429 ? 'locked' : 'failed';
    }
  }
}
