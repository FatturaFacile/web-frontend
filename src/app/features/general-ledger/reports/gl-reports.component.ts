import { Component, inject, OnInit } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { TranslatePipe } from '@shared';
import { GlLookupStore } from '../shared/gl-lookup.store';
import { GlAccountLedgerComponent } from './gl-account-ledger.component';
import { GlDimensionReportComponent } from './gl-dimension-report.component';
import { GlStatementsComponent } from './gl-statements.component';
import { GlTrialBalanceComponent } from './gl-trial-balance.component';
import { GlVatRegistersComponent } from './gl-vat-registers.component';

@Component({
  selector: 'app-gl-reports',
  styleUrl: './gl-reports.component.scss',
  imports: [
    NzCardModule,
    NzTabsModule,
    GlAccountLedgerComponent,
    GlDimensionReportComponent,
    GlStatementsComponent,
    GlTrialBalanceComponent,
    GlVatRegistersComponent,
    TranslatePipe,
  ],
  template: `
    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'GL.REPORT_TRIAL_BALANCE' | translate"><app-gl-trial-balance /></nz-tab>
        <nz-tab [nzTitle]="'GL.REPORT_ACCOUNT_LEDGER' | translate"><app-gl-account-ledger /></nz-tab>
        <nz-tab [nzTitle]="'GL.REPORT_BALANCE_SHEET' | translate"><app-gl-statements [mode]="'balance-sheet'" /></nz-tab>
        <nz-tab [nzTitle]="'GL.REPORT_INCOME_STATEMENT' | translate"><app-gl-statements [mode]="'income-statement'" /></nz-tab>
        <nz-tab [nzTitle]="'GL.REPORT_DIMENSIONS' | translate"><app-gl-dimension-report /></nz-tab>
        <nz-tab [nzTitle]="'GL.REPORT_VAT_REGISTERS' | translate"><app-gl-vat-registers /></nz-tab>
      </nz-tabs>
    </nz-card>
  `,
})
export class GlReportsComponent implements OnInit {
  private readonly lookups = inject(GlLookupStore);

  ngOnInit(): void {
    this.lookups.load();
  }
}
