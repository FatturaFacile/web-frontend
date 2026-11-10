import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import {
  applyServerErrors,
  AUTH_PROBLEM,
  AuthApiService,
  authProblemOf,
  AuthStore,
  ChangePasswordPayload,
  isValidationError,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { passwordsMatch, passwordStrength, STRENGTH_KEYS } from '../../../auth/password-rules';

type PasswordField = 'current' | 'password' | 'confirmation';

/**
 * Profile of the signed-in user. For now it holds the password change: with two factors active the server also asks
 * a code, and on success it closes every session, this one included, so the page signs the user out.
 */
@Component({
  selector: 'app-profile-settings',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './profile-settings.component.html',
  styleUrls: ['../../../auth/pages/register/register.component.scss', './profile-settings.component.scss'],
})
export class ProfileSettingsComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly twoFactorEnabled = signal(false);
  protected readonly useRecoveryCode = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly isLocked = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  private readonly visible = signal<Record<PasswordField, boolean>>({
    current: false,
    password: false,
    confirmation: false,
  });

  protected readonly form = this.fb.group(
    {
      current_password: this.fb.control('', [Validators.required]),
      password: this.fb.control('', [Validators.required]),
      password_confirmation: this.fb.control('', [Validators.required]),
      code: this.fb.control(''),
      recovery_code: this.fb.control(''),
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
    this.authApi.getTwoFactorStatus().subscribe({
      next: (res) => {
        this.twoFactorEnabled.set(!!res.data?.enabled);
        this.syncSecondFactorValidators();
      },
      // Without the status the form still works: the server asks the code if it is needed.
      error: () => undefined,
    });
  }

  protected isVisible(field: PasswordField): boolean {
    return this.visible()[field];
  }

  protected toggleVisible(field: PasswordField): void {
    this.visible.update((current) => ({ ...current, [field]: !current[field] }));
  }

  protected toggleRecoveryCode(): void {
    this.useRecoveryCode.set(!this.useRecoveryCode());
    this.form.controls.code.reset('');
    this.form.controls.recovery_code.reset('');
    this.syncSecondFactorValidators();
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
    this.isLocked.set(false);
    this.isSubmitting.set(true);
    this.authApi.changePassword(this.payload()).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        // Every session is gone on the server, this one included.
        this.authStore.logout();
        void this.router.navigate(['/password-updated'], { replaceUrl: true });
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        if (isValidationError(err)) {
          this.revealSecondFactorIfAsked(err);
          this.errorMessage.set(applyServerErrors(this.form, err)[0] ?? null);
          return;
        }
        if (
          authProblemOf(err) === AUTH_PROBLEM.PasswordChangeLocked ||
          (err instanceof HttpErrorResponse && err.status === 429)
        ) {
          this.isLocked.set(true);
        }
      },
    });
  }

  private payload(): ChangePasswordPayload {
    const { current_password, password, password_confirmation, code, recovery_code } = this.form.getRawValue();
    const payload: ChangePasswordPayload = { current_password, password, password_confirmation };

    if (this.twoFactorEnabled()) {
      if (this.useRecoveryCode()) {
        payload.recovery_code = recovery_code.trim();
      } else {
        payload.code = code.trim();
      }
    }
    return payload;
  }

  private syncSecondFactorValidators(): void {
    const { code, recovery_code } = this.form.controls;
    const required = [Validators.required];
    code.setValidators(this.twoFactorEnabled() && !this.useRecoveryCode() ? required : []);
    recovery_code.setValidators(this.twoFactorEnabled() && this.useRecoveryCode() ? required : []);
    code.updateValueAndValidity();
    recovery_code.updateValueAndValidity();
  }

  /** The status may be stale: if the server asks a second factor, the field appears. */
  private revealSecondFactorIfAsked(err: unknown): void {
    const errors = (err as HttpErrorResponse).error?.errors ?? {};
    if (!this.twoFactorEnabled() && ('code' in errors || 'recovery_code' in errors)) {
      this.twoFactorEnabled.set(true);
      this.syncSecondFactorValidators();
    }
  }
}
