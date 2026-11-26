import { Component, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthApiService,
  AuthStore,
  I18nService,
  TwoFactorStatus,
  UserSession,
} from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { EmailOtpCardComponent } from './email-otp-card.component';
import { PasskeysCardComponent } from './passkeys-card.component';
import { TrustedDevicesCardComponent } from './trusted-devices-card.component';
import { userAgentLabel } from './user-agent.util';
import { TwoFactorSetupModalComponent } from '../../../auth/components/two-factor-setup-modal/two-factor-setup-modal.component';

/** Mirrors `required_without_all:<others>`: the control is required while every sibling is blank. */
function requiredWithout(...others: string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const siblingsBlank = others.every((other) => String(control.parent?.get(other)?.value ?? '').trim() === '');
    return String(control.value ?? '').trim() === '' && siblingsBlank ? { required: true } : null;
  };
}

type SecondFactorField = 'code' | 'recoveryCode' | 'emailCode';

@Component({
  selector: 'app-security-settings',
  styleUrl: './security-settings.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    ModalActionsDirective,
    ReactiveFormsModule,
    DatePipe,
    NzCardModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzAlertModule,
    NzDividerModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzIconModule,
    PageHeaderComponent,
    EmailOtpCardComponent,
    PasskeysCardComponent,
    TrustedDevicesCardComponent,
    TranslatePipe,
    TwoFactorSetupModalComponent,
  ],
  templateUrl: './security-settings.component.html',
})
export class SecuritySettingsComponent implements OnInit {
  private readonly authApi = inject(AuthApiService);
  protected readonly authStore = inject(AuthStore);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);

  protected readonly twoFactorStatus = signal<TwoFactorStatus | null>(null);
  protected readonly sessions = signal<UserSession[]>([]);
  protected readonly isLoading2FA = signal(false);
  protected readonly isLoadingSessions = signal(false);
  protected readonly isRevokingOthers = signal(false);

  // Modals & Dialogs
  protected readonly showSetupModal = signal(false);
  protected readonly showDisableModal = signal(false);
  protected readonly showRegenerateModal = signal(false);
  protected readonly showRevokeOthersModal = signal(false);

  protected readonly disableForm = this.fb.group({
    currentPassword: this.fb.control('', [Validators.required]),
    code: this.fb.control('', [requiredWithout('recoveryCode', 'emailCode'), Validators.maxLength(16)]),
    recoveryCode: this.fb.control('', [requiredWithout('code', 'emailCode'), Validators.maxLength(32)]),
    emailCode: this.fb.control('', [requiredWithout('code', 'recoveryCode'), Validators.maxLength(16)]),
  });

  protected readonly passwordConfirmForm = this.fb.group({
    currentPassword: this.fb.control('', [Validators.required]),
  });

  protected readonly isSendingEmailCode = signal(false);
  protected readonly emailCodeSent = signal(false);
  protected readonly newRecoveryCodes = signal<string[]>([]);
  protected readonly showCodesDialog = signal(false);

  constructor() {
    // Each proof is required only while the others are blank: re-validate the siblings when one changes.
    const controls = this.disableForm.controls;
    const fields: SecondFactorField[] = ['code', 'recoveryCode', 'emailCode'];
    for (const field of fields) {
      controls[field].valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
        for (const other of fields.filter((name) => name !== field)) {
          controls[other].updateValueAndValidity({ emitEvent: false });
        }
      });
    }
  }

  /** The proof fields are required only while all the others are blank (API: required_without_all). */
  protected isSecondFactorRequired(...others: SecondFactorField[]): boolean {
    return others.every((other) => this.disableForm.controls[other].value.trim() === '');
  }

  /** Short device description of a session ("Chrome / Windows"); the full User-Agent is the tooltip. */
  protected deviceLabel(session: UserSession): string {
    return userAgentLabel(session.user_agent);
  }

  protected secondFactorError(control: AbstractControl | null): string {
    return control?.hasError('maxlength')
      ? this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE')
      : this.i18n.translate('TWO_FACTOR.CODE_REQUIRED');
  }

  ngOnInit(): void {
    this.loadTwoFactorStatus();
    this.loadSessions();
  }

  loadTwoFactorStatus(): void {
    this.isLoading2FA.set(true);
    this.authApi.getTwoFactorStatus().subscribe({
      next: (res) => {
        this.isLoading2FA.set(false);
        this.twoFactorStatus.set(res.data);
      },
      error: () => {
        this.isLoading2FA.set(false);
      },
    });
  }

  loadSessions(): void {
    this.isLoadingSessions.set(true);
    this.authApi.getSessions().subscribe({
      next: (res) => {
        this.isLoadingSessions.set(false);
        const [tokens, webSessions] = res.data;
        const allSessions: UserSession[] = [...tokens, ...webSessions];
        this.sessions.set(allSessions);
      },
      error: () => {
        this.isLoadingSessions.set(false);
      },
    });
  }

  openDisableModal(): void {
    this.disableForm.reset();
    this.emailCodeSent.set(false);
    this.showDisableModal.set(true);
  }

  confirmDisable(): void {
    if (this.disableForm.invalid) {
      this.disableForm.markAllAsTouched();
      return;
    }

    const { currentPassword, code, recoveryCode, emailCode } = this.disableForm.getRawValue();
    this.authApi
      .disableTwoFactor({
        current_password: currentPassword,
        code: code.trim() || undefined,
        recovery_code: recoveryCode.trim() || undefined,
        email_code: emailCode.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.twoFactorStatus.set(res.data);
          this.showDisableModal.set(false);
          this.message.success(this.i18n.translate('SECURITY.DISABLED_SUCCESS'));
        },
        error: (err: unknown) => {
          const body = (err as { error?: { message?: string; detail?: string } })?.error;
          this.message.error(
            body?.detail || body?.message || this.i18n.translate('SECURITY.DISABLE_FAILED')
          );
        },
      });
  }

  /** Emails a code that proves the user for the change, as an alternative to the authenticator or a recovery code. */
  sendEmailProofCode(): void {
    this.isSendingEmailCode.set(true);
    this.authApi.sendEmailVerificationCode().subscribe({
      next: () => {
        this.isSendingEmailCode.set(false);
        this.emailCodeSent.set(true);
        this.message.success(this.i18n.translate('auth.mfa.challenge.code_sent_generic'));
      },
      error: (err: unknown) => {
        this.isSendingEmailCode.set(false);
        const seconds =
          err instanceof HttpErrorResponse && err.status === 429 ? Number(err.headers?.get('Retry-After')) || 60 : null;
        this.message.error(
          seconds !== null
            ? this.i18n.translate('auth.mfa.error.too_many_codes', { seconds })
            : this.i18n.translate('ERRORS.GENERIC', { status: err instanceof HttpErrorResponse ? err.status : 0 }),
        );
      },
    });
  }

  openRegenerateModal(): void {
    this.passwordConfirmForm.reset();
    this.showRegenerateModal.set(true);
  }

  confirmRegenerate(): void {
    if (this.passwordConfirmForm.invalid) {
      this.passwordConfirmForm.markAllAsTouched();
      return;
    }

    const { currentPassword } = this.passwordConfirmForm.getRawValue();
    this.authApi.getTwoFactorRecoveryCodes({ current_password: currentPassword }).subscribe({
      next: (res) => {
        this.showRegenerateModal.set(false);
        this.newRecoveryCodes.set(res.data.recovery_codes || []);
        this.showCodesDialog.set(true);
        this.loadTwoFactorStatus();
        this.message.success(this.i18n.translate('SECURITY.CODES_REGENERATED'));
      },
      error: (err: unknown) => {
        const body = (err as { error?: { message?: string; detail?: string } })?.error;
        this.message.error(
          body?.detail || body?.message || this.i18n.translate('SECURITY.REGENERATE_FAILED')
        );
      },
    });
  }

  openRevokeOthersModal(): void {
    this.passwordConfirmForm.reset();
    this.showRevokeOthersModal.set(true);
  }

  confirmRevokeOthers(): void {
    if (this.passwordConfirmForm.invalid) {
      this.passwordConfirmForm.markAllAsTouched();
      return;
    }

    const { currentPassword } = this.passwordConfirmForm.getRawValue();
    this.isRevokingOthers.set(true);

    this.authApi.revokeOtherSessions({ current_password: currentPassword }).subscribe({
      next: (res) => {
        this.isRevokingOthers.set(false);
        this.showRevokeOthersModal.set(false);
        this.message.success(
          this.i18n.translate('SECURITY.REVOKED_OTHERS', {
            sessions: res.data.sessions,
            tokens: res.data.tokens,
          })
        );
        this.loadSessions();
      },
      error: (err: unknown) => {
        this.isRevokingOthers.set(false);
        const body = (err as { error?: { message?: string; detail?: string } })?.error;
        this.message.error(
          body?.detail || body?.message || this.i18n.translate('SECURITY.REVOKE_OTHERS_FAILED')
        );
      },
    });
  }

  revokeSingleSession(session: UserSession): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('SECURITY.REVOKE_ONE_TITLE'),
      nzContent: this.i18n.translate(
        session.kind === 'session' ? 'SECURITY.REVOKE_ONE_SESSION' : 'SECURITY.REVOKE_ONE_TOKEN'
      ),
      nzOkText: this.i18n.translate('SECURITY.REVOKE'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOkDanger: true,
      nzOnOk: () => {
        return firstValueFrom(this.authApi.revokeSession(session.kind, session.id)).then(() => {
          this.message.success(this.i18n.translate('SECURITY.SESSION_REVOKED'));
          this.loadSessions();
        });
      },
    });
  }
}
