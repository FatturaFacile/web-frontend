import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { TwoFactorSetupModalComponent } from '../../../auth/components/two-factor-setup-modal/two-factor-setup-modal.component';

@Component({
  selector: 'app-security-settings',
  imports: [
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
  styleUrl: './security-settings.component.scss',
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
    code: this.fb.control(''),
    recoveryCode: this.fb.control(''),
  });

  protected readonly passwordConfirmForm = this.fb.group({
    currentPassword: this.fb.control('', [Validators.required]),
  });

  protected readonly newRecoveryCodes = signal<string[]>([]);
  protected readonly showCodesDialog = signal(false);

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
        return this.authApi.revokeSession(session.kind, session.id).toPromise().then(() => {
          this.message.success(this.i18n.translate('SECURITY.SESSION_REVOKED'));
          this.loadSessions();
        });
      },
    });
  }
}
