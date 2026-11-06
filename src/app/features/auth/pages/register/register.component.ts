import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { applyServerErrors, AuthApiService, I18nService, isValidationError } from '@core';
import { environment } from '@env';
import { TranslatePipe } from '@shared';
import { LanguageSelectorComponent } from '../../components/language-selector.component';
import { passwordsMatch, passwordStrength, STRENGTH_KEYS } from '../../password-rules';

@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    LanguageSelectorComponent,
    TranslatePipe,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['../login/login.component.scss', './register.component.scss'],
})
export class RegisterComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly termsUrl = environment.termsUrl;
  protected readonly privacyUrl = environment.privacyUrl;
  protected readonly isSubmitting = signal(false);
  protected readonly passwordVisible = signal(false);
  protected readonly confirmationVisible = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      first_name: this.fb.control('', [Validators.required, Validators.maxLength(100)]),
      last_name: this.fb.control('', [Validators.required, Validators.maxLength(100)]),
      email: this.fb.control('', [Validators.required, Validators.email]),
      company_name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
      country: this.fb.control<'IT' | 'CH'>('IT', [Validators.required]),
      tax_id: this.fb.control('', [Validators.required, Validators.maxLength(30)]),
      password: this.fb.control('', [Validators.required]),
      password_confirmation: this.fb.control('', [Validators.required]),
      terms_accepted: this.fb.control(false, [Validators.requiredTrue]),
      privacy_accepted: this.fb.control(false, [Validators.requiredTrue]),
    },
    { validators: passwordsMatch },
  );

  private readonly password = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });

  protected readonly strength = computed(() => passwordStrength(this.password()));
  protected readonly strengthKey = computed(() => STRENGTH_KEYS[this.strength()]);
  protected readonly strengthLevels = [1, 2, 3, 4];

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

    const payload = this.form.getRawValue();
    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    this.authApi.register(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigate(['/register/check-email'], {
          state: { email: payload.email },
        });
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        this.handleError(err);
      },
    });
  }

  private handleError(err: unknown): void {
    if (isValidationError(err)) {
      const unmapped = applyServerErrors(this.form, err);
      this.errorMessage.set(unmapped[0] ?? null);
      return;
    }
    this.errorMessage.set(
      this.i18n.translate(
        err instanceof HttpErrorResponse && err.status === 429
          ? 'AUTH.TOO_MANY_ATTEMPTS'
          : 'AUTH.REGISTER_FAILED',
      ),
    );
  }
}
