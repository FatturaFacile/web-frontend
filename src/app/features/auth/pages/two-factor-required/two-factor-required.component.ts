import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { AuthApiService, AuthStore } from '@core';
import { TranslatePipe } from '@shared';
import { EmailOtpSetupModalComponent } from '../../components/email-otp-setup-modal/email-otp-setup-modal.component';
import { TwoFactorSetupModalComponent } from '../../components/two-factor-setup-modal/two-factor-setup-modal.component';

const DEFAULT_RETURN_URL = '/dashboard';

/**
 * Interstitial of a tenant that requires a second factor the user has not set up yet: the route guard sends every
 * navigation here until an authenticator app or the email code is enrolled, so the app never loads half-protected.
 * The only other way out is signing out.
 */
@Component({
  selector: 'app-two-factor-required',
  imports: [NzAlertModule, NzButtonModule, NzCardModule, NzIconModule, EmailOtpSetupModalComponent, TwoFactorSetupModalComponent, TranslatePipe],
  template: `
    <main class="required-wrapper">
      <nz-card [nzBordered]="false" class="required-card">
        <div class="header">
          <nz-icon nzType="safety-certificate" class="icon" />
          <h1>{{ 'SECURITY.REQUIRED_BY_TENANT_TITLE' | translate }}</h1>
          <p>{{ 'ERRORS.TWO_FACTOR_SETUP_REQUIRED' | translate }}</p>
        </div>

        <div class="choices">
          <button nz-button nzType="primary" nzSize="large" nzBlock type="button" data-testid="enroll-totp" (click)="showTotp.set(true)">
            <nz-icon nzType="mobile" /> {{ 'auth.mfa.method.totp' | translate }}
          </button>
          <button nz-button nzSize="large" nzBlock type="button" data-testid="enroll-email" (click)="showEmail.set(true)">
            <nz-icon nzType="mail" /> {{ 'auth.mfa.method.email' | translate }}
          </button>
          <button nz-button nzType="link" nzBlock type="button" data-testid="sign-out" (click)="signOut()">
            {{ 'HEADER.LOGOUT' | translate }}
          </button>
        </div>
      </nz-card>

      <app-two-factor-setup-modal [(isVisible)]="showTotp" (completed)="onEnrolled()" />
      <app-email-otp-setup-modal [(isVisible)]="showEmail" (completed)="onEnrolled()" />
    </main>
  `,
  styles: `
    .required-wrapper { display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 16px; }
    .required-card { width: 100%; max-width: 440px; }
    .header { margin-bottom: 24px; text-align: center; }
    .icon { color: var(--primary-color); font-size: 40px; }
    .header h1 { margin: 8px 0; font-size: var(--font-size-xl, 20px); }
    .header p { margin: 0; color: var(--text-secondary); }
    .choices { display: flex; flex-direction: column; gap: 12px; }
  `,
})
export class TwoFactorRequiredComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly showTotp = signal(false);
  protected readonly showEmail = signal(false);

  ngOnInit(): void {
    // Nothing to enrol (opened by hand, or already done): go on to the app.
    if (!this.authStore.twoFactorSetupRequired()) {
      void this.router.navigateByUrl(this.returnUrl());
    }
  }

  /** A factor was enrolled: lift the block and continue where the user was heading. */
  protected onEnrolled(): void {
    this.authStore.setTwoFactorSetupRequired(false);
    void this.router.navigateByUrl(this.returnUrl());
  }

  protected signOut(): void {
    const done = () => {
      this.authStore.logout();
      void this.router.navigateByUrl('/login');
    };
    this.authApi.logout().subscribe({ next: done, error: done });
  }

  /** `returnUrl` is honoured only for same-app relative paths (open-redirect guard). */
  private returnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    return url?.startsWith('/') && !url.startsWith('//') && !url.startsWith('/two-factor-setup') ? url : DEFAULT_RETURN_URL;
  }
}
