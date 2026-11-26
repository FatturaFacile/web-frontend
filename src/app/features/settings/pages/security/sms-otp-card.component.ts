import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthApiService, I18nService, TwoFactorStatus } from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { SmsOtpSetupModalComponent } from '../../../auth/components/sms-otp-setup-modal/sms-otp-setup-modal.component';

/**
 * The SMS code as a second factor: turn it on (password, then the code that arrives by SMS) or off (password).
 * The API refuses to turn it off when it is the last factor the tenant requires (`mfa_cannot_be_disabled`).
 */
@Component({
  selector: 'app-sms-otp-card',
  imports: [
    ReactiveFormsModule,
    ModalActionsDirective,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzTagModule,
    SmsOtpSetupModalComponent,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'security.mfa.sms.title' | translate">
      <p>{{ 'security.mfa.sms.description' | translate }}</p>

      <div class="status">
        @if (status()?.sms_enabled) {
          <nz-tag nzColor="success"><nz-icon nzType="check-circle" /> {{ 'security.mfa.methods.enabled' | translate }}</nz-tag>
        } @else {
          <nz-tag nzColor="default"><nz-icon nzType="close-circle" /> {{ 'security.mfa.methods.disabled' | translate }}</nz-tag>
        }
      </div>

      @if (status()?.sms_enabled && status()?.sms_phone; as phone) {
        <p class="phone" data-testid="sms-phone">{{ phone }}</p>
      }

      @if (lastFactor()) {
        <nz-alert class="gap" nzType="info" nzShowIcon [nzMessage]="'security.mfa.sms.last_factor' | translate" data-testid="sms-last-factor" />
      }

      @if (status()?.sms_enabled) {
        <button nz-button nzDanger nzType="default" type="button" data-testid="sms-otp-disable" (click)="openDisable()">
          <nz-icon nzType="stop" /> {{ 'security.mfa.sms.disable' | translate }}
        </button>
      } @else {
        <button nz-button nzType="primary" type="button" data-testid="sms-otp-enable" (click)="showSetup.set(true)">
          <nz-icon nzType="message" /> {{ 'security.mfa.sms.enable' | translate }}
        </button>
      }
    </nz-card>

    <app-sms-otp-setup-modal [(isVisible)]="showSetup" (completed)="changed.emit()" />

    <nz-modal
      appModalActions
      [nzVisible]="showDisable()"
      (nzVisibleChange)="showDisable.set($event)"
      [nzTitle]="'security.mfa.sms.disable' | translate"
      (nzOnCancel)="showDisable.set(false)"
      (nzOnOk)="confirmDisable()"
      [nzOkDisabled]="passwordForm.invalid"
      okAction="confirm"
      [nzOkDanger]="true"
    >
      <ng-container *nzModalContent>
        <p>{{ 'security.mfa.email.password_prompt' | translate }}</p>
        @if (disableError(); as text) {
          <nz-alert class="gap" nzType="error" nzShowIcon [nzMessage]="text" data-testid="sms-disable-error" />
        }
        <form [formGroup]="passwordForm" nz-form nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="sms-otp-disable-password">{{ 'TWO_FACTOR.CURRENT_PASSWORD' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'TWO_FACTOR.CURRENT_PASSWORD_REQUIRED' | translate">
              <input nz-input id="sms-otp-disable-password" type="password" formControlName="currentPassword" autocomplete="current-password" />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .status { margin-bottom: 16px; }
    .phone { margin: 0 0 16px; font-family: monospace; }
    .gap { display: block; margin-bottom: 16px; }
  `,
})
export class SmsOtpCardComponent {
  private readonly api = inject(AuthApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly status = input<TwoFactorStatus | null>(null);
  /** The factor was turned on or off: the page reloads the status. */
  readonly changed = output<void>();

  protected readonly showSetup = signal(false);
  protected readonly showDisable = signal(false);
  protected readonly lastFactor = signal(false);
  protected readonly disableError = signal<string | null>(null);

  protected readonly passwordForm = this.fb.group({ currentPassword: this.fb.control('', [Validators.required]) });

  protected openDisable(): void {
    this.passwordForm.reset();
    this.disableError.set(null);
    this.showDisable.set(true);
  }

  protected confirmDisable(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.api.disableSmsTwoFactor({ current_password: this.passwordForm.getRawValue().currentPassword }).subscribe({
      next: () => {
        this.showDisable.set(false);
        this.lastFactor.set(false);
        this.message.success(this.i18n.translate('security.mfa.sms.disabled_toast'));
        this.changed.emit();
      },
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 403 && (err.error as { code?: unknown } | null)?.code === 'mfa_cannot_be_disabled') {
          this.showDisable.set(false);
          this.lastFactor.set(true);
          return;
        }
        const body = err instanceof HttpErrorResponse ? (err.error as { detail?: unknown; message?: unknown } | null) : null;
        this.disableError.set(
          typeof body?.detail === 'string' && body.detail !== ''
            ? body.detail
            : typeof body?.message === 'string' && body.message !== ''
              ? body.message
              : this.i18n.translate('SECURITY.DISABLE_FAILED'),
        );
      },
    });
  }
}
