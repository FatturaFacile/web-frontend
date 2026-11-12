import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { PageHeaderComponent, TranslatePipe } from '@shared';

interface TrNavItem {
  path: string;
  labelKey: string;
}

@Component({
  selector: 'app-treasury-operations-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NzMenuModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header [title]="'TR.TITLE' | translate" [subtitle]="'TR.SUBTITLE' | translate" />
    <ul nz-menu nzMode="horizontal" class="tr-menu">
      @for (item of items; track item.path) {
        <li nz-menu-item>
          <a [routerLink]="item.path" routerLinkActive="tr-active" ariaCurrentWhenActive="page">{{
            item.labelKey | translate
          }}</a>
        </li>
      }
    </ul>
    <div class="tr-content">
      <router-outlet />
    </div>
  `,
})
export class TreasuryOperationsShellComponent {
  protected readonly items: TrNavItem[] = [
    { path: 'balances', labelKey: 'TR.NAV_BALANCES' },
    { path: 'cash-registers', labelKey: 'TR.NAV_CASH_REGISTERS' },
    { path: 'payment-proposals', labelKey: 'TR.NAV_PROPOSALS' },
    { path: 'reconciliation-rules', labelKey: 'TR.NAV_RULES' },
    { path: 'liquidity', labelKey: 'TR.NAV_LIQUIDITY' },
    { path: 'kpis', labelKey: 'TR.NAV_KPIS' },
    { path: 'riba', labelKey: 'TR.NAV_RIBA' },
    { path: 'collections', labelKey: 'TR.NAV_COLLECTIONS' },
  ];
}
