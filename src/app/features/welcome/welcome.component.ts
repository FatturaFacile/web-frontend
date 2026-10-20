import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-welcome',
  imports: [RouterLink, NzButtonModule, NzCardModule, NzIconModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header
      [title]="'WELCOME.TITLE' | translate"
      [subtitle]="'WELCOME.SUBTITLE' | translate"
    />

    <nz-card [nzTitle]="'WELCOME.QUICK_ACCESS' | translate">
      <p>{{ 'WELCOME.DESC' | translate }}</p>
      <a nz-button nzType="primary" routerLink="/orders">
        <nz-icon nzType="shopping-cart" />
        {{ 'WELCOME.GO_ORDERS' | translate }}
      </a>
    </nz-card>
  `,
  styles: `
    p {
      margin-bottom: 16px;
    }
  `,
})
export class WelcomeComponent {}
