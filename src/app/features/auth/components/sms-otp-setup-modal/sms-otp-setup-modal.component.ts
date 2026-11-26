import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, model, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { AuthApiService, I18nService } from '@core';
import { TranslatePipe } from '@shared';

type Step = 'phone' | 'code' | 'recovery';

/** Seconds before another code may be requested when the API did not say. */
const DEFAULT_RESEND_SECONDS = 60;

/** International format: a plus sign and digits, with the separators the API ignores (spaces, dots, dashes, brackets). */
export const PHONE_PATTERN = /^\+[\d\s().-]{6,24}$/;

/**
 * Enrolment of the SMS code as a second factor: confirm the password and give the phone number (the API sends the
 * first code), enter the code, and, when it is the first factor of the user, store the recovery codes shown once.
 */
@Component({
  selector: 'app-sms-otp-setup-modal',
  imports: [ReactiveFormsModule, NzModalModule, NzFormModule, NzInputModule, NzButtonModule, NzAlertModule, NzIconModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="isVisible()"
      (nzVisibleChange)="isVisible.set($event)"
      [nzTitle]="'security.mfa.sms.enable' | translate"
      [nzFooter]="null"
      [nzMaskClosable]="false"
      (nzOnCancel)="close()"
      nzWidth="520px"
    >
      <ng-container *nzModalContent>
        @if (errorMessage(); as message) {
          <nz-alert class="gap" nzType="error" nzShowIcon [nzMessage]="message" data-testid="sms-otp-error" />
        }

        @switch (step()) {
          @case ('phone') {
            <p>{{ 'security.mfa.email.password_prompt' | translate }}</p>
            <form nz-form nzLayout="vertical" [formGroup]="phoneForm" (ngSubmit)="start()">
              <nz-form-item>
                <nz-form-label nzRequired nzFor="sms-otp-password">{{ 'TWO_FACTOR.CURRENT_PASSWORD' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'TWO_FACTOR.CURRENT_PASSWORD_REQUIRED' | translate">
                  <input nz-input id="sms-otp-password" type="password" formControlName="currentPassword" autocomplete="current-password" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="sms-otp-phone">{{ 'security.mfa.sms.phone_label' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'security.mfa.sms.phone_invalid' | translate" [nzExtra]="'security.mfa.sms.phone_hint' | translate">
                  <input nz-input id="sms-otp-phone" type="tel" formControlName="phone" placeholder="+41791234567" autocomplete="tel" />
                </nz-form-control>
              </nz-form-item>
              <div class="actions">
                <button nz-button type="button" (click)="close()">{{ 'COMMON.CANCEL' | translate }}</button>
                <button nz-button nzType="primary" type="submit" data-testid="sms-otp-start" [nzLoading]="isLoading()" [disabled]="phoneForm.invalid">
                  {{ 'TWO_FACTOR.CONTINUE' | translate }}
                </button>
              </div>
            </form>
          }
          @case ('code') {
            <p>{{ 'security.mfa.sms.enter_code' | translate: { phone: maskedPhone() } }}</p>
            <form nz-form nzLayout="vertical" [formGroup]="codeForm" (ngSubmit)="confirm()">
              <nz-form-item>
                <nz-form-label nzRequired nzFor="sms-otp-code">{{ 'auth.mfa.challenge.code_label' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'TWO_FACTOR.CODE_REQUIRED' | translate">
                  <input
                    nz-input
                    id="sms-otp-code"
                    type="text"
                    inputmode="numeric"
                    formControlName="code"
                    placeholder="123456"
                    maxlength="16"
                    autocomplete="one-time-code"
                  />
                </nz-form-control>
              </nz-form-item>
              <div class="resend">
                @if (resendIn() > 0) {
                  <span class="wait" data-testid="sms-otp-wait">{{ 'auth.mfa.challenge.resend_in' | translate: { seconds: resendIn() } }}</span>
                } @else {
                  <button nz-button nzType="link" type="button" data-testid="sms-otp-resend" [nzLoading]="isResending()" (click)="resend()">
                    {{ 'security.mfa.sms.resend' | translate }}
                  </button>
                }
              </div>
              <div class="actions">
                <button nz-button type="button" (click)="close()">{{ 'COMMON.CANCEL' | translate }}</button>
                <button nz-button nzType="primary" type="submit" data-testid="sms-otp-confirm" [nzLoading]="isLoading()" [disabled]="codeForm.invalid">
                  {{ 'security.mfa.sms.confirm' | translate }}
                </button>
              </div>
            </form>
          }
          @case ('recovery') {
            <nz-alert
              class="gap"
              nzType="warning"
              nzShowIcon
              [nzMessage]="'security.mfa.recovery.new_codes_title' | translate"
              [nzDescription]="'security.mfa.recovery.new_codes_hint' | translate"
            />
            <div class="codes" data-testid="sms-otp-recovery-codes">
              @for (code of recoveryCodes(); track $index) {
                <div class="code">{{ code }}</div>
              }
            </div>
            <button nz-button nzBlock type="button" class="gap" (click)="copyCodes()">
              <nz-icon nzType="copy" /> {{ 'TWO_FACTOR.COPY_CODES' | translate }}
            </button>
            <div class="actions">
              <button nz-button nzType="primary" type="button" data-testid="sms-otp-finish" (click)="finish()">
                {{ 'TWO_FACTOR.FINISH' | translate }}
              </button>
            </div>
          }
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .gap { display: block; margin-bottom: 16px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
    .resend { margin-bottom: 12px; text-align: right; }
    .wait { color: var(--text-secondary); font-size: var(--font-size-sm, 14px); }
    .codes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px; }
    .code { padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-md, 6px); font-family: monospace; text-align: center; }
  `,
})
export class SmsOtpSetupModalComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isVisible = model<boolean>(false);
  /** The factor is on (after the recovery codes, when there were any, were acknowledged). */
  readonly completed = output<void>();

  protected readonly step = signal<Step>('phone');
  protected readonly isLoading = signal(false);
  protected readonly isResending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly recoveryCodes = signal<string[]>([]);
  protected readonly resendIn = signal(0);
  /** The phone as the API shows it (masked), once the first code is on its way. */
  protected readonly maskedPhone = signal('');

  protected readonly phoneForm = this.fb.group({
    currentPassword: this.fb.control('', [Validators.required]),
    phone: this.fb.control('', [Validators.required, Validators.pattern(PHONE_PATTERN)]),
  });
  protected readonly codeForm = this.fb.group({
    code: this.fb.control('', [Validators.required, Validators.minLength(6), Validators.maxLength(16)]),
  });

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopCountdown());
  }

  /** Checks the password; the API sends the first code to the phone. */
  protected start(): void {
    if (this.phoneForm.invalid) {
      this.phoneForm.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.authApi.enableSmsTwoFactor(this.payload()).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.maskedPhone.set(res.data?.phone ?? '');
        this.step.set('code');
        this.startCountdown(res.data?.resend_available_in ?? DEFAULT_RESEND_SECONDS);
      },
      error: (err: unknown) => {
        this.isLoading.set(false);
        this.errorMessage.set(this.errorText(err, 'security.mfa.sms.send_error'));
      },
    });
  }

  /** Sends the same request again to get a fresh code (the API throttles it). */
  protected resend(): void {
    if (this.resendIn() > 0 || this.isResending()) {
      return;
    }
    this.isResending.set(true);
    this.errorMessage.set(null);
    this.authApi.enableSmsTwoFactor(this.payload()).subscribe({
      next: (res) => {
        this.isResending.set(false);
        this.startCountdown(res.data?.resend_available_in ?? DEFAULT_RESEND_SECONDS);
      },
      error: (err: unknown) => {
        this.isResending.set(false);
        if (err instanceof HttpErrorResponse && err.status === 429) {
          const seconds = Number(err.headers?.get('Retry-After')) || DEFAULT_RESEND_SECONDS;
          this.startCountdown(seconds);
          this.errorMessage.set(this.i18n.translate('auth.mfa.error.too_many_codes', { seconds }));
          return;
        }
        this.errorMessage.set(this.errorText(err, 'security.mfa.sms.send_error'));
      },
    });
  }

  protected confirm(): void {
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.authApi.confirmSmsTwoFactor({ code: this.codeForm.getRawValue().code.trim() }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.message.success(this.i18n.translate('security.mfa.sms.enabled_toast'));
        const codes = (res.data?.recovery_codes ?? []).filter((code) => code && code !== '-');
        if (codes.length > 0) {
          this.recoveryCodes.set(codes);
          this.step.set('recovery');
          return;
        }
        this.finish();
      },
      error: (err: unknown) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err instanceof HttpErrorResponse && (err.status === 401 || err.status === 422)
            ? this.i18n.translate('auth.mfa.error.invalid_code')
            : this.errorText(err, 'TWO_FACTOR.CONFIRM_FAILED'),
        );
      },
    });
  }

  protected copyCodes(): void {
    if (navigator?.clipboard) {
      void navigator.clipboard.writeText(this.recoveryCodes().join('\n')).then(() => {
        this.message.success(this.i18n.translate('TWO_FACTOR.CODES_COPIED'));
      });
    }
  }

  protected finish(): void {
    this.isVisible.set(false);
    this.completed.emit();
    this.reset();
  }

  protected close(): void {
    // The recovery codes are shown once: closing the dialog there still completes the enrolment.
    if (this.step() === 'recovery') {
      this.finish();
      return;
    }
    this.isVisible.set(false);
    this.reset();
  }

  private payload(): { current_password: string; phone: string } {
    const { currentPassword, phone } = this.phoneForm.getRawValue();
    return { current_password: currentPassword, phone: phone.trim() };
  }

  private errorText(err: unknown, fallbackKey: string): string {
    const body = err instanceof HttpErrorResponse ? (err.error as { detail?: unknown; message?: unknown; errors?: Record<string, unknown> } | null) : null;
    const first = Object.values(body?.errors ?? {})[0];
    if (Array.isArray(first) && typeof first[0] === 'string') {
      return first[0];
    }
    if (typeof body?.detail === 'string' && body.detail !== '') {
      return body.detail;
    }
    if (typeof body?.message === 'string' && body.message !== '') {
      return body.message;
    }
    return this.i18n.translate(fallbackKey);
  }

  private reset(): void {
    this.stopCountdown();
    this.resendIn.set(0);
    this.step.set('phone');
    this.phoneForm.reset();
    this.codeForm.reset();
    this.recoveryCodes.set([]);
    this.maskedPhone.set('');
    this.errorMessage.set(null);
  }

  private startCountdown(seconds: number): void {
    this.stopCountdown();
    this.resendIn.set(Math.max(0, Math.ceil(seconds)));
    if (this.resendIn() === 0) {
      return;
    }
    this.timer = setInterval(() => {
      this.resendIn.update((value) => Math.max(0, value - 1));
      if (this.resendIn() === 0) {
        this.stopCountdown();
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
