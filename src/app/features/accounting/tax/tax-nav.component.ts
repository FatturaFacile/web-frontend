import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@shared';

/** Sub-navigation of the accounting area: ledger and the Italian tax reports (issue #286). */
@Component({
  selector: 'app-tax-nav',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <nav class="tax-nav" [attr.aria-label]="'ACCOUNTING.TAX.NAV_LABEL' | translate">
      @for (link of links; track link.path) {
        <a [routerLink]="link.path" routerLinkActive="active" ariaCurrentWhenActive="page">{{
          link.label | translate
        }}</a>
      }
    </nav>
  `,
  styles: `
    .tax-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      margin-bottom: 16px;
    }
    .tax-nav a {
      padding: 4px 0;
      border-bottom: 2px solid transparent;
    }
    .tax-nav a.active {
      border-bottom-color: currentColor;
      font-weight: 600;
    }
  `,
})
export class TaxNavComponent {
  protected readonly links = [
    { path: '/accounting/ledger', label: 'ACCOUNTING.TAX.NAV_LEDGER' },
    { path: '/accounting/tax/stamp-duty', label: 'ACCOUNTING.TAX.STAMP.TITLE' },
    { path: '/accounting/tax/withholdings', label: 'ACCOUNTING.TAX.WITHHOLDING.TITLE' },
    { path: '/accounting/tax/enasarco', label: 'ACCOUNTING.TAX.ENASARCO.TITLE' },
  ];
}
