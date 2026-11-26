import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { BatchRunModalComponent } from './batch-run-modal.component';
import { InvoiceMatchRunsTableComponent } from './invoice-match-runs-table.component';
import { InvoiceMatchingStore } from './invoice-matching.store';
import { RunMatchingModalComponent } from './run-matching-modal.component';

/** Matching workbench: KPIs, the table of current runs and the entry points to run the matching. */
@Component({
  selector: 'app-invoice-matching-workbench-page',
  providers: [InvoiceMatchingStore],
  imports: [
    BatchRunModalComponent,
    DecimalPipe,
    InvoiceMatchRunsTableComponent,
    MoneyPipe,
    PageHeaderComponent,
    RouterLink,
    RunMatchingModalComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzStatisticModule,
  ],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.PROCUREMENT_INVOICE_MATCHING' | translate"
      [subtitle]="'invoiceMatching.page.workbenchSubtitle' | translate"
    >
    <ng-container ngProjectAs="[header-actions]">
      <a nz-button routerLink="/procurement/invoice-matching/blocked" data-testid="open-blocked">{{
        'NAV.PROCUREMENT_INVOICE_MATCHING_BLOCKED' | translate
      }}</a>
      <a nz-button routerLink="/procurement/invoice-matching/rules" data-testid="open-rules">{{
        'NAV.PROCUREMENT_INVOICE_MATCHING_RULES' | translate
      }}</a>
      <button nz-button type="button" (click)="batchVisible.set(true)" data-testid="open-batch">
        {{ 'invoiceMatching.button.batchRun' | translate }}
      </button>
      <button
        nz-button
        nzType="primary"
        type="button"
        (click)="runVisible.set(true)"
        data-testid="open-run"
      >
        {{ 'invoiceMatching.button.runMatching' | translate }}
      </button>
    </ng-container>
    </app-page-header>

    <section class="kpis" data-testid="kpis">
      <nz-card>
        <nz-statistic
          data-testid="kpi-total"
          [nzTitle]="'invoiceMatching.kpi.total' | translate"
          [nzValue]="store.summary()?.total ?? 0"
        />
      </nz-card>
      <nz-card>
        <nz-statistic
          data-testid="kpi-blocked"
          [nzTitle]="'invoiceMatching.kpi.blocked' | translate"
          [nzValue]="store.summary()?.blocked_count ?? 0"
        />
      </nz-card>
      <nz-card>
        <nz-statistic
          data-testid="kpi-blocked-amount"
          [nzTitle]="'invoiceMatching.kpi.blockedAmount' | translate"
          [nzValue]="store.summary()?.blocked_amount | money"
        />
      </nz-card>
      <nz-card>
        <nz-statistic
          data-testid="kpi-auto-rate"
          [nzTitle]="'invoiceMatching.kpi.autoMatchRate' | translate"
          [nzValue]="(store.summary()?.auto_match_rate ?? 0 | number: '1.0-1') + '%'"
        />
      </nz-card>
      <nz-card>
        <nz-statistic
          data-testid="kpi-gr-ir-cleared"
          [nzTitle]="'invoiceMatching.kpi.grIrCleared' | translate"
          [nzValue]="store.summary()?.gr_ir_cleared_amount | money"
        />
      </nz-card>
    </section>

    <app-invoice-match-runs-table />

    <app-run-matching-modal [(visible)]="runVisible" (completed)="reload()" />
    <app-batch-run-modal [(visible)]="batchVisible" (completed)="reload()" />
  `,
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
  `,
})
export class InvoiceMatchingWorkbenchPageComponent implements OnInit {
  protected readonly store = inject(InvoiceMatchingStore);

  protected readonly runVisible = signal(false);
  protected readonly batchVisible = signal(false);

  ngOnInit(): void {
    void this.store.loadSummary();
  }

  /** Refreshes the KPIs and the table after a run. */
  protected reload(): void {
    void this.store.loadSummary();
    void this.store.loadRuns();
  }
}
