import { Component, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
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
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe, GridExportDirective, GridSortPipe } from '@shared';
import { TwoFactorSetupModalComponent } from '../../../auth/components/two-factor-setup-modal/two-factor-setup-modal.component';

/** Mirrors `required_without:<other>`: the control is required while the sibling is blank. */
function requiredWithout(other: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const siblingValue = String(control.parent?.get(other)?.value ?? '').trim();
    return String(control.value ?? '').trim() === '' && siblingValue === '' ? { required: true } : null;
  };
}

@Component({
  selector: 'app-security-settings',
  styleUrl: './security-settings.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
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
    code: this.fb.control('', [requiredWithout('recoveryCode'), Validators.maxLength(16)]),
    recoveryCode: this.fb.control('', [requiredWithout('code'), Validators.maxLength(32)]),
  });

  protected readonly passwordConfirmForm = this.fb.group({
    currentPassword: this.fb.control('', [Validators.required]),
  });

  protected readonly newRecoveryCodes = signal<string[]>([]);
  protected readonly showCodesDialog = signal(false);

  constructor() {
    const { code, recoveryCode } = this.disableForm.controls;
    code.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => recoveryCode.updateValueAndValidity({ emitEvent: false }));
    recoveryCode.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => code.updateValueAndValidity({ emitEvent: false }));
  }

  /** The code fields are required only while the other one is blank (API: required_without). */
  protected isSecondFactorRequired(other: 'code' | 'recoveryCode'): boolean {
    return this.disableForm.controls[other].value.trim() === '';
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
    this.showDisableModal.set(true);
  }

  confirmDisable(): void {
    if (this.disableForm.invalid) {
      this.disableForm.markAllAsTouched();
      return;
    }

    const { currentPassword, code, recoveryCode } = this.disableForm.getRawValue();
    this.authApi
      .disableTwoFactor({
        current_password: currentPassword,
        code: code.trim() || undefined,
        recovery_code: recoveryCode.trim() || undefined,
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
