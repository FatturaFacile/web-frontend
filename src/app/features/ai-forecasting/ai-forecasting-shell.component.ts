import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PageHeaderComponent, TranslatePipe } from '@shared';

/** AI forecasting area: header and the two views (liquidity, demand). */
@Component({
  selector: 'app-ai-forecasting-shell',
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
      [title]="'AI_FORECAST.TITLE' | translate"
      [subtitle]="'AI_FORECAST.SUBTITLE' | translate"
    ></app-page-header>
    <nav [attr.aria-label]="'AI_FORECAST.SECTIONS' | translate">
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
export class AiForecastingShellComponent {
  protected readonly tabs = [
    { path: 'liquidity', key: 'AI_FORECAST.TAB_LIQUIDITY' },
    { path: 'demand', key: 'AI_FORECAST.TAB_DEMAND' },
  ];
}
