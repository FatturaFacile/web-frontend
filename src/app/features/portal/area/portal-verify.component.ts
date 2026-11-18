import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { PortalAreaApiService } from '@core/api/portal-area-api.service';
import { PortalVerifyResult } from '@core/models/portal-area.models';
import { TranslatePipe } from '@shared';
import { PortalSessionService } from './portal-session.service';

type VerifyState = 'verifying' | 'otp' | 'failed' | 'locked';

/**
 * `/portal/auth/verify?token=...`: exchanges the magic link for a session. When the tenant asks for a second factor, the
 * same link is used again together with the e-mailed code.
 */
@Component({
  selector: 'app-portal-verify',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzInputModule,
    NzSpinModule,
    TranslatePipe,
  ],
  template: `
    <section class="verify-card" aria-live="polite">
      @switch (state()) {
        @case ('verifying') {
          <nz-spin />
          <p>{{ 'PORTAL_AREA.VERIFYING' | translate }}</p>
        }
        @case ('otp') {
          <h1>{{ 'PORTAL_AREA.OTP_TITLE' | translate }}</h1>
          <p>{{ 'PORTAL_AREA.OTP_INTRO' | translate }}</p>
          <form (submit)="submitOtp($event)" novalidate>
            <label for="portal-otp">{{ 'PORTAL_AREA.OTP_LABEL' | translate }}</label>
            <input
              nz-input
              id="portal-otp"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              [formControl]="otp"
            />
            @if (otpWrong()) {
              <nz-alert
                nzType="error"
                [nzMessage]="'PORTAL_AREA.OTP_WRONG' | translate"
                nzShowIcon
              />
            }
            <button nz-button nzType="primary" nzBlock type="submit" [disabled]="otp.invalid">
              {{ 'PORTAL_AREA.OTP_SUBMIT' | translate }}
            </button>
          </form>
        }
        @default {
          <nz-alert
            nzType="error"
            nzShowIcon
            [nzMessage]="
              (state() === 'locked' ? 'PORTAL_AREA.OTP_LOCKED' : 'PORTAL_AREA.VERIFY_FAILED')
                | translate
            "
          />
          <a
            nz-button
            nzType="primary"
            routerLink="/portal/login"
            [queryParams]="session.slug() ? { portal: session.slug() } : {}"
          >
            {{ 'PORTAL_AREA.SEND_LINK' | translate }}
          </a>
        }
      }
    </section>
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      min-height: 100vh;
      padding: 16px;
      background: #f5f6f8;
    }
    .verify-card {
      width: 100%;
      max-width: 420px;
      background: #fff;
      padding: 24px;
      border-radius: 8px;
      display: grid;
      gap: 12px;
      text-align: center;
    }
    form {
      display: grid;
      gap: 12px;
      text-align: left;
    }
  `,
})
export class PortalVerifyComponent implements OnInit {
  protected readonly session = inject(PortalSessionService);
  private readonly api = inject(PortalAreaApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly state = signal<VerifyState>('verifying');
  protected readonly otpWrong = signal(false);
  protected readonly otp = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
  });

  private token = '';

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    this.session.useSlug(query.get('portal'));
    this.token = query.get('token') ?? '';

    if (!/^[0-9a-f]{64}$/.test(this.token)) {
      this.state.set('failed');
      return;
    }
    this.verify();
  }

  protected submitOtp(event: Event): void {
    event.preventDefault();
    if (this.otp.valid) {
      this.verify(this.otp.value);
    }
  }

  private verify(otp?: string): void {
    this.api.verify({ token: this.token, otp, accept_privacy: true }).subscribe({
      next: (response) => this.handle(response.data),
      error: (error: unknown) => this.fail(error),
    });
  }

  private handle(result: PortalVerifyResult): void {
    if (result.status === 'otp_required') {
      this.state.set('otp');
      return;
    }
    this.session.start(result.token, result.expires_at, result.customer);
    void this.router.navigate(['/portal/dashboard'], { replaceUrl: true });
  }

  private fail(error: unknown): void {
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    if (status === 422 && this.state() === 'otp') {
      this.otpWrong.set(true);
    } else if (status === 429) {
      this.state.set('locked');
    } else {
      this.state.set('failed');
    }
  }
}
