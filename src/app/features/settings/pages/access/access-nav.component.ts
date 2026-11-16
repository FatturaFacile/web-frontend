import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@shared';

interface AccessTab {
  readonly route: string;
  readonly key: string;
}

export const ACCESS_TABS: readonly AccessTab[] = [
  { route: '/settings/users', key: 'access.nav.members' },
  { route: '/settings/access/invitations', key: 'access.nav.invitations' },
  { route: '/settings/users/import', key: 'access.nav.import' },
  { route: '/settings/access/roles', key: 'access.nav.roles' },
  { route: '/settings/access/teams', key: 'access.nav.teams' },
  { route: '/settings/access/delegations', key: 'access.nav.delegations' },
  { route: '/settings/access/matrix', key: 'access.nav.matrix' },
  { route: '/settings/access/audit', key: 'access.nav.audit' },
];

/** Links between the pages of user and access management, shown on top of each of them. */
@Component({
  selector: 'app-access-nav',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <nav class="access-nav mb-3" [attr.aria-label]="'access.nav.label' | translate">
      @for (tab of tabs; track tab.route) {
        <a
          class="access-nav-link"
          [routerLink]="tab.route"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          [attr.data-test]="'access-tab-' + tab.route"
          >{{ tab.key | translate }}</a
        >
      }
    </nav>
  `,
  styles: `
    .access-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0);
    }
    .access-nav-link {
      padding: 8px 4px;
      border-bottom: 2px solid transparent;
      color: inherit;
    }
    .access-nav-link.active {
      border-bottom-color: var(--ant-color-primary, #1677ff);
      color: var(--ant-color-primary, #1677ff);
      font-weight: 600;
    }
  `,
})
export class AccessNavComponent {
  protected readonly tabs = ACCESS_TABS;
}
