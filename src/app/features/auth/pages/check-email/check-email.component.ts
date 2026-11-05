import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { TranslatePipe } from '@shared';
import { ResendVerificationComponent } from '../../components/resend-verification.component';

@Component({
  selector: 'app-check-email',
  imports: [RouterLink, NzAlertModule, NzCardModule, ResendVerificationComponent, TranslatePipe],
  template: `
    <main class="login-wrapper">
      <div class="login-box">
        <header class="login-header text-center">
          <h1>Fattura <span class="facile-color">Facile</span></h1>
        </header>
        <nz-card [nzBordered]="false" class="login-card">
          <nz-alert
            class="login-alert"
            nzType="success"
            nzShowIcon
            [nzMessage]="'AUTH.CHECK_EMAIL_TITLE' | translate"
            [nzDescription]="'AUTH.CHECK_EMAIL_BODY' | translate"
          />
          <p>{{ 'AUTH.CHECK_EMAIL_VALIDITY' | translate }}</p>
          <p>{{ 'AUTH.CHECK_EMAIL_APPROVAL' | translate }}</p>
          <h2 class="resend-title">{{ 'AUTH.RESEND_TITLE' | translate }}</h2>
          <app-resend-verification [email]="email" />
          <p class="text-center">
            <a routerLink="/login">{{ 'AUTH.BACK_TO_LOGIN' | translate }}</a>
          </p>
        </nz-card>
      </div>
    </main>
  `,
  styleUrl: '../login/login.component.scss',
  styles: `
    .resend-title {
      font-size: 15px;
      margin: 16px 0 8px;
    }
  `,
})
export class CheckEmailComponent {
  /** Passed through the navigation state, so the address never appears in the URL or in the history. */
  protected readonly email =
    (inject(Router).currentNavigation()?.extras.state?.['email'] as string | undefined) ?? '';
}
