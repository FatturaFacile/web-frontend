import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, input, linkedSignal, OnInit, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { firstValueFrom } from 'rxjs';
import {
  AUTH_PROBLEM,
  AuthApiService,
  authProblemOf,
  DEFAULT_TRUSTED_DEVICE_DAYS,
  I18nService,
  LoginResult,
  PasskeyUnavailableError,
  storeTrustedDeviceToken,
  TwoFactorChallengePayload,
  TwoFactorMethod,
  WebAuthnService,
} from '@core';
import { TranslatePipe } from '@shared';

/** Seconds before another email code may be requested when the API did not say (it throttles at about a minute). */
const DEFAULT_RESEND_SECONDS = 60;

/** Order in which the factors are offered; the recovery code is always the last resort. */
const METHOD_ORDER: readonly TwoFactorMethod[] = ['totp', 'email', 'webauthn', 'recovery_code'];

const METHOD_ICON: Readonly<Record<TwoFactorMethod, string>> = {
  totp: 'mobile',
  email: 'mail',
  webauthn: 'safety-certificate',
  recovery_code: 'key',
};

type CallKind = 'send' | 'verify';

/**
 * The second step of a sign-in: the user answers the challenge with one of the factors the API offered (authenticator
 * code, emailed code, security key or a recovery code) and may remember the device. Shared by the password login and
 * the single sign-on landing page. It never keeps the trusted-device token: it goes straight to the local storage of
 * the account.
 *
 * `succeeded` carries the login answer; `restart` asks the page to go back to the password step (the challenge is gone,
 * the account is locked or the attempts ran out), with the message to show.
 */
@Component({
  selector: 'app-two-factor-challenge',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    TranslatePipe,
  ],
  template: `
    <div class="challenge-section">
      <div class="challenge-header">
        <nz-icon nzType="safety-certificate" class="challenge-icon" />
        <h2>{{ 'auth.mfa.challenge.title' | translate }}</h2>
        <p class="challenge-subtitle">{{ 'auth.mfa.challenge.subtitle' | translate }}</p>
      </div>

      @if (errorMessage(); as message) {
        <nz-alert class="challenge-alert" nzType="error" nzShowIcon [nzMessage]="message" data-testid="challenge-error" />
      }

      <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @switch (method()) {
          @case ('totp') {
            <p class="hint">{{ 'auth.mfa.challenge.totp_hint' | translate }}</p>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="mfa-code">{{ 'auth.mfa.challenge.code_label' | translate }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  id="mfa-code"
                  type="text"
                  inputmode="numeric"
                  formControlName="code"
                  placeholder="123456"
                  maxlength="16"
                  nzSize="large"
                  autocomplete="one-time-code"
                />
              </nz-form-control>
            </nz-form-item>
          }
          @case ('email') {
            <p class="hint">{{ 'auth.mfa.challenge.email_hint' | translate }}</p>
            @if (emailDispatched()) {
              <p class="sent" role="status" data-testid="email-sent">
                {{
                  email()
                    ? ('auth.mfa.challenge.code_sent' | translate: { email: email() })
                    : ('auth.mfa.challenge.code_sent_generic' | translate)
                }}
              </p>
            }
            <nz-form-item>
              <nz-form-label nzRequired nzFor="mfa-email-code">{{ 'auth.mfa.challenge.code_label' | translate }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  id="mfa-email-code"
                  type="text"
                  inputmode="numeric"
                  formControlName="code"
                  placeholder="123456"
                  maxlength="16"
                  nzSize="large"
                  autocomplete="one-time-code"
                />
              </nz-form-control>
            </nz-form-item>
            <div class="resend-row">
              @if (!emailDispatched()) {
                <button
                  nz-button
                  nzType="default"
                  type="button"
                  data-testid="send-email-code"
                  [nzLoading]="isSending()"
                  (click)="sendEmailCode()"
                >
                  {{ 'auth.mfa.challenge.send_code' | translate }}
                </button>
              } @else if (resendIn() > 0) {
                <span class="resend-wait" data-testid="resend-wait">
                  {{ 'auth.mfa.challenge.resend_in' | translate: { seconds: resendIn() } }}
                </span>
              } @else {
                <button
                  nz-button
                  nzType="link"
                  type="button"
                  data-testid="resend-email-code"
                  [nzLoading]="isSending()"
                  (click)="sendEmailCode()"
                >
                  {{ 'auth.mfa.challenge.resend' | translate }}
                </button>
              }
            </div>
          }
          @case ('webauthn') {
            <p class="hint">{{ 'auth.mfa.challenge.webauthn_hint' | translate }}</p>
            @if (isWaitingForKey()) {
              <p class="sent" role="status">{{ 'auth.mfa.challenge.webauthn_prompt' | translate }}</p>
            }
          }
          @case ('recovery_code') {
            <p class="hint">{{ 'auth.mfa.challenge.recovery_hint' | translate }}</p>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="mfa-recovery-code">{{ 'auth.mfa.challenge.recovery_label' | translate }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  id="mfa-recovery-code"
                  type="text"
                  formControlName="recoveryCode"
                  maxlength="32"
                  nzSize="large"
                  autocomplete="off"
                />
              </nz-form-control>
            </nz-form-item>
          }
        }

        @if (trustedDevicesEnabled()) {
          <div class="remember">
            <label for="mfa-remember" nzId="mfa-remember" nz-checkbox formControlName="remember" data-testid="remember-device">{{
              'auth.mfa.challenge.remember_device' | translate: { days: trustedDeviceDays() }
            }}</label>
            <p class="hint small">{{ 'auth.mfa.challenge.remember_device_hint' | translate }}</p>
            @if (form.controls.remember.value) {
              <nz-form-item>
                <nz-form-label nzFor="mfa-device-name">{{ 'auth.mfa.challenge.device_name' | translate }}</nz-form-label>
                <nz-form-control>
                  <input nz-input id="mfa-device-name" type="text" formControlName="deviceName" maxlength="120" autocomplete="off" />
                </nz-form-control>
              </nz-form-item>
            }
          </div>
        }

        @if (method() === 'webauthn') {
          <button
            nz-button
            nzType="primary"
            nzSize="large"
            nzBlock
            type="button"
            data-testid="use-security-key"
            [nzLoading]="isWaitingForKey()"
            (click)="useSecurityKey()"
          >
            <nz-icon nzType="safety-certificate" />
            {{ 'auth.mfa.challenge.webauthn_button' | translate }}
          </button>
        } @else {
          <button
            nz-button
            nzType="primary"
            nzSize="large"
            nzBlock
            type="submit"
            data-testid="submit-challenge"
            [nzLoading]="isSubmitting()"
            [disabled]="!canSubmit()"
          >
            {{ 'auth.mfa.challenge.submit' | translate }}
          </button>
        }

        @if (otherMethods().length > 0) {
          <div class="switcher" role="group" [attr.aria-label]="'auth.mfa.challenge.switch_method' | translate">
            <span class="switcher-label">{{ 'auth.mfa.challenge.switch_method' | translate }}</span>
            @for (other of otherMethods(); track other) {
              <button nz-button nzType="link" type="button" [attr.data-testid]="'switch-' + other" (click)="selectMethod(other)">
                <nz-icon [nzType]="iconOf(other)" />
                {{ 'auth.mfa.method.' + other | translate }}
              </button>
            }
          </div>
        }

        <button nz-button nzType="default" nzBlock type="button" class="cancel-challenge-btn" data-testid="back-to-login" (click)="restart.emit(null)">
          {{ 'AUTH.BACK_TO_LOGIN' | translate }}
        </button>
      </form>
    </div>
  `,
  styles: `
    .challenge-section {
      text-align: center;
    }
    .challenge-header {
      margin-bottom: var(--space-4, 16px);
    }
    .challenge-icon {
      margin-bottom: var(--space-2, 8px);
      color: var(--primary-color);
      font-size: 36px;
    }
    .challenge-header h2 {
      margin-bottom: var(--space-1, 4px);
      font-size: var(--font-size-xl, 20px);
      font-weight: 600;
    }
    .challenge-subtitle,
    .hint {
      margin: 0 0 var(--space-3, 12px);
      color: var(--text-secondary);
      font-size: var(--font-size-sm, 14px);
    }
    .hint.small {
      margin: var(--space-1, 4px) 0 var(--space-3, 12px);
      font-size: var(--font-size-xs, 12px);
    }
    .challenge-alert {
      display: block;
      margin-bottom: var(--space-3, 12px);
      text-align: left;
    }
    .sent {
      margin: 0 0 var(--space-3, 12px);
      color: var(--primary-color);
    }
    .resend-row {
      margin-bottom: var(--space-3, 12px);
      text-align: right;
    }
    .resend-wait {
      color: var(--text-secondary);
      font-size: var(--font-size-sm, 14px);
    }
    .remember {
      margin-bottom: var(--space-4, 16px);
      text-align: left;
    }
    .switcher {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--space-1, 4px);
      margin: var(--space-3, 12px) 0;
    }
    .switcher-label {
      color: var(--text-secondary);
      font-size: var(--font-size-sm, 14px);
    }
    .cancel-challenge-btn {
      margin-top: 10px;
    }
  `,
})
export class TwoFactorChallengeComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly webauthn = inject(WebAuthnService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly challengeToken = input.required<string>();
  /** Factors offered by the API; the authenticator code and the recovery code are the fallback when it sent none. */
  readonly methods = input<readonly TwoFactorMethod[] | null>(null);
  readonly defaultMethod = input<TwoFactorMethod | null>(null);
  /** The API already emailed a code with the challenge. */
  readonly emailCodeSent = input<boolean>(false);
  readonly trustedDevicesEnabled = input<boolean>(false);
  readonly trustedDeviceDays = input<number>(DEFAULT_TRUSTED_DEVICE_DAYS);
  /** Address the code is emailed to; also the account the trusted-device token is kept for. */
  readonly email = input('');

  readonly succeeded = output<LoginResult>();
  readonly restart = output<string | null>();

  protected readonly available = computed<TwoFactorMethod[]>(() => {
    const offered = this.methods();
    const list = offered && offered.length > 0 ? [...offered] : (['totp', 'recovery_code'] as TwoFactorMethod[]);
    return METHOD_ORDER.filter((method) => list.includes(method));
  });

  protected readonly method = linkedSignal<TwoFactorMethod>(() => {
    const available = this.available();
    const preferred = this.defaultMethod();
    return preferred && available.includes(preferred) ? preferred : (available[0] ?? 'totp');
  });

  protected readonly otherMethods = computed(() => this.available().filter((method) => method !== this.method()));
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly isSending = signal(false);
  protected readonly isWaitingForKey = signal(false);
  protected readonly emailDispatched = linkedSignal(() => this.emailCodeSent());
  protected readonly resendIn = signal(0);

  protected readonly form = this.fb.group({
    code: this.fb.control(''),
    recoveryCode: this.fb.control(''),
    remember: this.fb.control(false),
    deviceName: this.fb.control(''),
  });

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopCountdown());
  }

  ngOnInit(): void {
    if (this.emailCodeSent()) {
      this.startCountdown(DEFAULT_RESEND_SECONDS);
    }
  }

  protected iconOf(method: TwoFactorMethod): string {
    return METHOD_ICON[method];
  }

  protected selectMethod(method: TwoFactorMethod): void {
    this.method.set(method);
    this.errorMessage.set(null);
    this.form.controls.code.reset('');
    this.form.controls.recoveryCode.reset('');
  }

  protected canSubmit(): boolean {
    const { code, recoveryCode } = this.form.getRawValue();
    return this.method() === 'recovery_code' ? recoveryCode.trim() !== '' : code.trim() !== '';
  }

  protected submit(): void {
    const method = this.method();
    const { code, recoveryCode } = this.form.getRawValue();

    if (method === 'webauthn') {
      void this.useSecurityKey();
      return;
    }
    if (method === 'recovery_code' ? recoveryCode.trim() === '' : code.trim() === '') {
      this.errorMessage.set(
        this.i18n.translate(method === 'recovery_code' ? 'TWO_FACTOR.RECOVERY_CODE_INVALID' : 'TWO_FACTOR.CODE_REQUIRED'),
      );
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    const proof: Partial<TwoFactorChallengePayload> =
      method === 'recovery_code'
        ? { recovery_code: recoveryCode.trim() }
        : method === 'email'
          ? { email_code: code.trim() }
          : { code: code.trim() };

    this.authApi.twoFactorChallenge(this.payload(proof)).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.complete(res.data);
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        this.handleError(err, 'verify');
      },
    });
  }

  /** Emails a (new) sign-in code and starts the countdown before the next one may be requested. */
  protected sendEmailCode(): void {
    if (this.isSending() || this.resendIn() > 0) {
      return;
    }
    this.isSending.set(true);
    this.errorMessage.set(null);
    this.authApi.sendTwoFactorEmailCode(this.challengeToken()).subscribe({
      next: (res) => {
        this.isSending.set(false);
        this.emailDispatched.set(true);
        this.startCountdown(res.data?.resend_available_in ?? DEFAULT_RESEND_SECONDS);
      },
      error: (err: unknown) => {
        this.isSending.set(false);
        this.handleError(err, 'send');
      },
    });
  }

  /** Asks the browser for the security key and answers the challenge with its signed assertion. */
  protected async useSecurityKey(): Promise<void> {
    if (this.isWaitingForKey()) {
      return;
    }
    if (!this.webauthn.isSupported()) {
      this.errorMessage.set(this.i18n.translate('auth.mfa.error.webauthn_unsupported'));
      return;
    }
    this.errorMessage.set(null);
    this.isWaitingForKey.set(true);
    try {
      const begun = await firstValueFrom(this.authApi.twoFactorWebauthnOptions(this.challengeToken()));
      const credential = await this.webauthn.get(begun.data.options as Parameters<WebAuthnService['get']>[0]);
      const res = await firstValueFrom(
        this.authApi.twoFactorChallenge(
          this.payload({ webauthn: { ceremony_id: begun.data.ceremony_id, credential } }),
        ),
      );
      this.complete(res.data);
    } catch (err) {
      if (err instanceof PasskeyUnavailableError) {
        this.errorMessage.set(
          this.i18n.translate(
            err.reason === 'cancelled'
              ? 'auth.mfa.challenge.webauthn_cancelled'
              : err.reason === 'unsupported'
                ? 'auth.mfa.error.webauthn_unsupported'
                : 'auth.mfa.error.webauthn_failed',
          ),
        );
      } else {
        this.handleError(err, 'verify', true);
      }
    } finally {
      this.isWaitingForKey.set(false);
    }
  }

  private payload(proof: Partial<TwoFactorChallengePayload>): TwoFactorChallengePayload {
    const { remember, deviceName } = this.form.getRawValue();
    const remembered = this.trustedDevicesEnabled() && remember;
    const name = deviceName.trim();

    return {
      challenge_token: this.challengeToken(),
      ...proof,
      ...(remembered ? { remember_device: true, ...(name ? { device_name: name } : {}) } : {}),
    };
  }

  private complete(data: LoginResult): void {
    if (data.trusted_device_token) {
      storeTrustedDeviceToken(data.user?.email ?? this.email(), data.trusted_device_token);
    }
    this.succeeded.emit(data);
  }

  private handleError(err: unknown, kind: CallKind, viaKey = false): void {
    if (!(err instanceof HttpErrorResponse)) {
      this.errorMessage.set(this.i18n.translate('ERRORS.GENERIC', { status: 0 }));
      return;
    }

    switch (err.status) {
      case 401:
        if (authProblemOf(err) === AUTH_PROBLEM.TwoFactorChallengeInvalid) {
          this.restart.emit(this.i18n.translate('auth.mfa.challenge.expired'));
          return;
        }
        this.errorMessage.set(this.i18n.translate(viaKey ? 'auth.mfa.error.webauthn_failed' : 'auth.mfa.error.invalid_code'));
        return;
      case 423:
        this.restart.emit(this.i18n.translate('auth.mfa.error.account_locked'));
        return;
      case 429: {
        if (kind === 'send') {
          const seconds = retryAfterSeconds(err) ?? DEFAULT_RESEND_SECONDS;
          this.startCountdown(seconds);
          this.errorMessage.set(this.i18n.translate('auth.mfa.error.too_many_codes', { seconds }));
        } else {
          this.restart.emit(this.i18n.translate('auth.mfa.error.too_many_attempts'));
        }
        return;
      }
      case 422:
        this.errorMessage.set(this.i18n.translate(kind === 'send' ? 'auth.mfa.error.method_unavailable' : 'auth.mfa.error.invalid_code'));
        return;
      default:
        this.errorMessage.set(this.i18n.translate('ERRORS.GENERIC', { status: err.status }));
    }
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

/** Seconds of the `Retry-After` header of a 429, when it is a number. */
export function retryAfterSeconds(err: HttpErrorResponse): number | null {
  const header = err.headers?.get('Retry-After');
  const seconds = header === null || header === undefined ? NaN : Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}
