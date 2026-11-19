import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PageHeaderComponent, TranslatePipe } from '@shared';

/** Frame of the audit trail pages: the title and the two tabs (event explorer, WORM archive). */
@Component({
  selector: 'app-audit-trail-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, PageHeaderComponent, TranslatePipe],
  styles: `
    .tabs {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
    }
    .tabs a {
      padding: 6px 2px;
      border-bottom: 2px solid transparent;
    }
    .tabs a.active {
      border-bottom-color: var(--ant-primary-color, #1677ff);
      font-weight: 600;
    }
  `,
  template: `
    <app-page-header
      [title]="'AUDIT.TITLE' | translate"
      [subtitle]="'AUDIT.SUBTITLE' | translate"
    ></app-page-header>
    <nav class="tabs" [attr.aria-label]="'AUDIT.TITLE' | translate">
      <a routerLink="." routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">{{
        'AUDIT.TAB.EXPLORER' | translate
      }}</a>
      <a routerLink="worm" routerLinkActive="active">{{ 'AUDIT.TAB.WORM' | translate }}</a>
    </nav>
    <router-outlet></router-outlet>
  `,
})
export class AuditTrailShellComponent {}
