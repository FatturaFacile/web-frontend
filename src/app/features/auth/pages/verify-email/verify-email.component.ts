import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { AUTH_PROBLEM, AuthApiService, authProblemOf } from '@core';
import { TranslatePipe } from '@shared';
import { LanguageSelectorComponent } from '../../components/language-selector.component';
import { ResendVerificationComponent } from '../../components/resend-verification.component';

type VerificationState = 'loading' | 'verified' | 'expired' | 'invalid' | 'failed';

/**
 * The email link opens this page and the page calls the API: mail scanners that follow links do not run scripts, so
 * they cannot consume the single-use token.
 */
@Component({
  selector: 'app-verify-email',
  imports: [
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzSpinModule,
    LanguageSelectorComponent,
    ResendVerificationComponent,
    TranslatePipe,
  ],
  template: `
    <main class="login-wrapper">
      <div class="login-box">
        <app-language-selector />

        <header class="login-header text-center">
          <h1>Fattura <span class="facile-color">Facile</span></h1>
        </header>
        <nz-card [nzBordered]="false" class="login-card">
          <div aria-live="polite">
            @switch (state()) {
              @case ('loading') {
                <p class="text-center"><nz-spin nzSimple /> {{ 'AUTH.VERIFYING' | translate }}</p>
              }
              @case ('verified') {
                <nz-alert
                  class="login-alert"
                  nzType="success"
                  nzShowIcon
                  [nzMessage]="'AUTH.VERIFIED_TITLE' | translate"
                  [nzDescription]="'AUTH.VERIFIED_BODY' | translate"
                />
                <a nz-button nzType="primary" nzBlock routerLink="/login">{{
                  'AUTH.GO_TO_LOGIN' | translate
                }}</a>
              }
              @case ('expired') {
                <nz-alert
                  class="login-alert"
                  nzType="warning"
                  nzShowIcon
                  [nzMessage]="'AUTH.LINK_EXPIRED_TITLE' | translate"
                  [nzDescription]="'AUTH.LINK_EXPIRED_BODY' | translate"
                />
                <app-resend-verification />
              }
              @case ('invalid') {
                <nz-alert
                  class="login-alert"
                  nzType="error"
                  nzShowIcon
                  [nzMessage]="'AUTH.LINK_INVALID_TITLE' | translate"
                  [nzDescription]="'AUTH.LINK_INVALID_BODY' | translate"
                />
                <app-resend-verification />
                <p class="text-center">
                  <a routerLink="/login">{{ 'AUTH.BACK_TO_LOGIN' | translate }}</a>
                </p>
              }
              @default {
                <nz-alert
                  class="login-alert"
                  nzType="error"
                  nzShowIcon
                  [nzMessage]="'AUTH.VERIFY_FAILED' | translate"
                />
              }
            }
          </div>
        </nz-card>
      </div>
    </main>
  `,
  styleUrl: '../login/login.component.scss',
})
export class VerifyEmailComponent implements OnInit {
  private readonly authApi = inject(AuthApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly state = signal<VerificationState>('loading');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    // The token leaves the address bar and the history as soon as it has been read.
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });

    if (!token) {
      this.state.set('invalid');
      return;
    }

    this.authApi.verifyEmail(token).subscribe({
      next: () => this.state.set('verified'),
      error: (err: unknown) => this.state.set(this.stateFor(err)),
    });
  }

  private stateFor(err: unknown): VerificationState {
    switch (authProblemOf(err)) {
      case AUTH_PROBLEM.VerificationTokenExpired:
        return 'expired';
      case AUTH_PROBLEM.VerificationTokenInvalid:
        return 'invalid';
      default:
        return 'failed';
    }
  }
}
