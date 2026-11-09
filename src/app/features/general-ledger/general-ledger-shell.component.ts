import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { PageHeaderComponent, TranslatePipe } from '@shared';

interface GlNavItem {
  path: string;
  labelKey: string;
}

@Component({
  selector: 'app-general-ledger-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NzMenuModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header [title]="'GL.TITLE' | translate" [subtitle]="'GL.SUBTITLE' | translate" />
    <ul nz-menu nzMode="horizontal" class="gl-menu">
      @for (item of items; track item.path) {
        <li nz-menu-item routerLinkActive [nzSelected]="false">
          <a [routerLink]="item.path" routerLinkActive="gl-active" ariaCurrentWhenActive="page">{{
            item.labelKey | translate
          }}</a>
        </li>
      }
    </ul>
    <div class="gl-content">
      <router-outlet />
    </div>
  `,
  styles: [
    `
      .gl-menu {
        margin-bottom: 16px;
      }
      .gl-active {
        font-weight: 600;
      }
    `,
  ],
})
export class GeneralLedgerShellComponent {
  protected readonly items: GlNavItem[] = [
    { path: 'journals', labelKey: 'GL.NAV_JOURNALS' },
    { path: 'recurring', labelKey: 'GL.NAV_RECURRING' },
    { path: 'accruals', labelKey: 'GL.NAV_ACCRUALS' },
    { path: 'accounts', labelKey: 'GL.NAV_ACCOUNTS' },
    { path: 'dimensions', labelKey: 'GL.NAV_DIMENSIONS' },
    { path: 'reports', labelKey: 'GL.NAV_REPORTS' },
    { path: 'budgets', labelKey: 'GL.NAV_BUDGETS' },
    { path: 'fx-revaluation', labelKey: 'GL.NAV_FX' },
    { path: 'close', labelKey: 'GL.NAV_CLOSE' },
    { path: 'fiscal-years', labelKey: 'GL.NAV_FISCAL_YEARS' },
    { path: 'settings', labelKey: 'GL.NAV_SETTINGS' },
  ];
}
