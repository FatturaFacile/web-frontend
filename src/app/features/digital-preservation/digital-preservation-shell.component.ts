import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PageHeaderComponent, TranslatePipe } from '@shared';

/** Digital preservation area: header and the five sections (dashboard, batches, exhibition, configuration, audit). */
@Component({
  selector: 'app-digital-preservation-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, PageHeaderComponent, TranslatePipe],
  styles: `
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      border-bottom: 1px solid var(--border-color, #f0f0f0);
      margin-bottom: 16px;
    }
    nav a {
      padding: 8px 14px;
      border-bottom: 2px solid transparent;
      color: inherit;
    }
    nav a.active {
      border-bottom-color: var(--primary-color, #1677ff);
      font-weight: 600;
    }
  `,
  template: `
    <app-page-header
      [title]="'PRESERVATION.TITLE' | translate"
      [subtitle]="'PRESERVATION.SUBTITLE' | translate"
    ></app-page-header>
    <nav [attr.aria-label]="'PRESERVATION.SECTIONS' | translate">
      @for (tab of tabs; track tab.path) {
        <a
          [routerLink]="tab.path"
          routerLinkActive="active"
          [attr.data-testid]="'tab-' + tab.path"
          >{{ tab.key | translate }}</a
        >
      }
    </nav>
    <router-outlet />
  `,
})
export class DigitalPreservationShellComponent {
  protected readonly tabs = [
    { path: 'dashboard', key: 'PRESERVATION.TAB_DASHBOARD' },
    { path: 'batches', key: 'PRESERVATION.TAB_BATCHES' },
    { path: 'exhibition', key: 'PRESERVATION.TAB_EXHIBITION' },
    { path: 'configuration', key: 'PRESERVATION.TAB_CONFIGURATION' },
    { path: 'audit', key: 'PRESERVATION.TAB_AUDIT' },
  ];
}
