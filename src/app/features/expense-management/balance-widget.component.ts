import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { ExmBalance } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';

/** The balance of an employee: open reports, approved and unpaid, advances and the taxable per diem of the year. */
@Component({
  selector: 'app-exm-balance-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, NzStatisticModule, TranslatePipe],
  template: `
    @if (balance(); as data) {
      <div class="stats">
        <nz-statistic
          [nzTitle]="'expenseManagement.balance.openReports' | translate"
          [nzValue]="data.open_reports"
        ></nz-statistic>
        <nz-statistic
          [nzTitle]="'expenseManagement.balance.openAmount' | translate"
          [nzValue]="data.open_amount | money: data.currency"
        ></nz-statistic>
        <nz-statistic
          [nzTitle]="'expenseManagement.balance.approvedUnpaid' | translate"
          [nzValue]="data.approved_unpaid_amount | money: data.currency"
        ></nz-statistic>
        <nz-statistic
          [nzTitle]="'expenseManagement.balance.advances' | translate"
          [nzValue]="data.advances_outstanding | money: data.currency"
        ></nz-statistic>
        <nz-statistic
          [nzTitle]="'expenseManagement.balance.perDiemTaxable' | translate"
          [nzValue]="data.per_diem_taxable_ytd | money: data.currency"
        ></nz-statistic>
      </div>
    }
  `,
  styles: `
    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 32px;
      margin-bottom: 16px;
    }
  `,
})
export class BalanceWidgetComponent {
  readonly balance = input<ExmBalance | null>(null);
}
