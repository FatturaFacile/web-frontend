import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@shared';

/** The three views of the data sovereignty area. */
@Component({
  selector: 'app-sovereignty-nav',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <nav class="sovereignty-nav" [attr.aria-label]="'DATA_SOVEREIGNTY.NAV' | translate">
      <a
        routerLink="/data-sovereignty"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: true }"
      >
        {{ 'DATA_SOVEREIGNTY.TAB_DASHBOARD' | translate }}
      </a>
      <a routerLink="/data-sovereignty/keys" routerLinkActive="active">
        {{ 'DATA_SOVEREIGNTY.TAB_KEYS' | translate }}
      </a>
      <a routerLink="/data-sovereignty/egress" routerLinkActive="active">
        {{ 'DATA_SOVEREIGNTY.TAB_EGRESS' | translate }}
      </a>
    </nav>
  `,
  styles: `
    .sovereignty-nav {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0);
    }
    a {
      padding: 8px 0;
      color: var(--ant-color-text-secondary, #595959);
      border-bottom: 2px solid transparent;
    }
    a.active {
      color: var(--ant-color-primary, #1677ff);
      border-bottom-color: var(--ant-color-primary, #1677ff);
    }
  `,
})
export class SovereigntyNavComponent {}
