import { Component, inject, model, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzQRCodeComponent } from 'ng-zorro-antd/qr-code';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { AuthApiService, AuthStore, I18nService } from '@core';
import { TranslatePipe } from '@shared';

@Component({
  selector: 'app-two-factor-setup-modal',
  styleUrl: './two-factor-setup-modal.component.scss',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    NzStepsModule,
    NzQRCodeComponent,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzAlertModule,
    NzIconModule,
    TranslatePipe,
  ],
  templateUrl: './two-factor-setup-modal.component.html',
})
export class TwoFactorSetupModalComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly authStore = inject(AuthStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly isVisible = model<boolean>(false);
  readonly completed = output<void>();

  protected readonly currentStep = signal<number>(0);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly otpauthUri = signal<string>('');
  protected readonly secretKey = signal<string>('');
  protected readonly recoveryCodes = signal<string[]>([]);
  protected readonly codesSaved = signal<boolean>(false);

  protected readonly passwordForm = this.fb.group({
    currentPassword: this.fb.control('', [Validators.required]),
  });

  protected readonly confirmForm = this.fb.group({
    code: this.fb.control('', [
      Validators.required,
      Validators.minLength(6),
      Validators.maxLength(16),
    ]),
  });

  protected onStartEnable(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { currentPassword } = this.passwordForm.getRawValue();
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authApi.enableTwoFactor({ current_password: currentPassword }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.otpauthUri.set(res.data.otpauth_uri);
        this.secretKey.set(res.data.secret || '');
        this.currentStep.set(1);
      },
      error: (err: unknown) => {
        this.isLoading.set(false);
        const body = (err as { error?: { message?: string; detail?: string } })?.error;
        this.errorMessage.set(
          body?.detail || body?.message || this.i18n.translate('TWO_FACTOR.ENABLE_FAILED')
        );
      },
    });
  }

  protected onConfirmCode(): void {
    if (this.confirmForm.invalid) {
      this.confirmForm.markAllAsTouched();
      return;
    }

    const { code } = this.confirmForm.getRawValue();
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authApi.confirmTwoFactor({ code }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const codes = (res.data.recovery_codes || []).filter((c) => c && c !== '-');
        this.recoveryCodes.set(codes);
        this.currentStep.set(2);
        this.message.success(this.i18n.translate('TWO_FACTOR.ENABLED_SUCCESS'));
      },
      error: (err: unknown) => {
        this.isLoading.set(false);
        const body = (err as { error?: { message?: string; detail?: string } })?.error;
        this.errorMessage.set(
          body?.detail || body?.message || this.i18n.translate('TWO_FACTOR.CONFIRM_FAILED')
        );
      },
    });
  }

  protected copyRecoveryCodes(): void {
    const text = this.recoveryCodes().join('\n');
    if (navigator?.clipboard) {
      void navigator.clipboard.writeText(text).then(() => {
        this.message.success(this.i18n.translate('TWO_FACTOR.CODES_COPIED'));
        this.codesSaved.set(true);
      });
    }
  }

  protected onFinish(): void {
    this.authStore.setTwoFactorSetupRequired(false);
    this.isVisible.set(false);
    this.completed.emit();
    this.resetModal();
  }

  protected handleCancel(): void {
    if (this.currentStep() === 2) {
      this.onFinish();
      return;
    }
    this.isVisible.set(false);
    this.resetModal();
  }

  private resetModal(): void {
    this.currentStep.set(0);
    this.passwordForm.reset();
    this.confirmForm.reset();
    this.otpauthUri.set('');
    this.secretKey.set('');
    this.recoveryCodes.set([]);
    this.codesSaved.set(false);
    this.errorMessage.set(null);
  }
}
