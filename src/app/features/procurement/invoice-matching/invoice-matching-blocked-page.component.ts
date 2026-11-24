import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { InvoiceMatchRunsTableComponent } from './invoice-match-runs-table.component';
import { InvoiceMatchingStore } from './invoice-matching.store';

/** Queue of the invoices blocked for a discrepancy: reasons, variance, block date and a link to the resolution. */
@Component({
  selector: 'app-invoice-matching-blocked-page',
  providers: [InvoiceMatchingStore],
  imports: [
    InvoiceMatchRunsTableComponent,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
    NzButtonModule,
  ],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.PROCUREMENT_INVOICE_MATCHING_BLOCKED' | translate"
      [subtitle]="'invoiceMatching.page.blockedSubtitle' | translate"
    >
      <a nz-button routerLink="/procurement/invoice-matching">{{
        'invoiceMatching.page.backToWorkbench' | translate
      }}</a>
    </app-page-header>

    <app-invoice-match-runs-table queue="blocked" />
  `,
})
export class InvoiceMatchingBlockedPageComponent {}
