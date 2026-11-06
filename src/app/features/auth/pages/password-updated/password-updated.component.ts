import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { TranslatePipe } from '@shared';
import { LanguageSelectorComponent } from '../../components/language-selector.component';

@Component({
  selector: 'app-password-updated',
  imports: [
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    LanguageSelectorComponent,
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
          <nz-alert
            class="login-alert"
            nzType="success"
            nzShowIcon
            [nzMessage]="'AUTH.PASSWORD_UPDATED_TITLE' | translate"
            [nzDescription]="'AUTH.PASSWORD_UPDATED_BODY' | translate"
          />
          <p>{{ 'AUTH.PASSWORD_UPDATED_TIP' | translate }}</p>
          <a nz-button nzType="primary" nzBlock routerLink="/login">{{ 'AUTH.GO_TO_LOGIN' | translate }}</a>
        </nz-card>
      </div>
    </main>
  `,
  styleUrl: '../login/login.component.scss',
})
export class PasswordUpdatedComponent {}
