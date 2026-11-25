import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { GDT_CONTRACT_STATUSES } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { DashboardStore } from './dashboard.store';

/** Overview of the GDO trade terms: contracts, accrued and unsettled amounts, open settlements, year-end projections. */
@Component({
  selector: 'app-gdt-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MoneyPipe,
    NzAlertModule,
    NzCardModule,
    NzEmptyModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [DashboardStore],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.GDO_TRADE_TERMS_DASHBOARD' | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.data(); as data) {
        <div class="stats-grid">
          @for (status of statuses; track status) {
            <nz-card>
              <nz-statistic
                [nzTitle]="'gdoTradeTerms.contractStatus.' + status | translate"
                [nzValue]="data.contracts_by_status[status]"
              ></nz-statistic>
            </nz-card>
          }
          <nz-card>
            <nz-statistic
              [nzTitle]="'gdoTradeTerms.dashboard.activePromotions' | translate"
              [nzValue]="data.active_promotions"
            ></nz-statistic>
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzTitle]="'gdoTradeTerms.dashboard.accruedScales' | translate"
              [nzValue]="data.accrued_unsettled.scales | money: undefined"
            ></nz-statistic>
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzTitle]="'gdoTradeTerms.dashboard.accruedPromotions' | translate"
              [nzValue]="data.accrued_unsettled.promotions | money: undefined"
            ></nz-statistic>
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzTitle]="'gdoTradeTerms.dashboard.openSettlements' | translate"
              [nzValue]="data.open_settlements"
            ></nz-statistic>
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzTitle]="'gdoTradeTerms.dashboard.disputedSettlements' | translate"
              [nzValue]="data.disputed_settlements"
            ></nz-statistic>
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzTitle]="'gdoTradeTerms.dashboard.latestRun' | translate"
              [nzValue]="data.latest_run?.period_key ?? '—'"
            ></nz-statistic>
          </nz-card>
        </div>

        <nz-card class="main-card" [nzTitle]="'gdoTradeTerms.dashboard.projections' | translate">
          <nz-table #table nzSize="small" [nzData]="data.projections" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col">{{ 'gdoTradeTerms.field.contract' | translate }}</th>
                <th scope="col">{{ 'gdoTradeTerms.field.endsOn' | translate }}</th>
                <th scope="col" class="num">{{ 'gdoTradeTerms.field.earnedToDate' | translate }}</th>
                <th scope="col" class="num">{{ 'gdoTradeTerms.field.projectedRebate' | translate }}</th>
                <th scope="col" class="num">{{ 'gdoTradeTerms.field.accrued' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of table.data; track row.contract_id) {
                <tr>
                  <th scope="row">
                    <a [routerLink]="['/gdo-trade-terms/contracts', row.contract_id]">{{ row.code }}</a>
                    <small class="muted">{{ row.name }}</small>
                  </th>
                  <td>{{ row.ends_on }}</td>
                  <td class="num">{{ row.earned_to_date | money: row.currency }}</td>
                  <td class="num">{{ row.projected_scales | money: row.currency }}</td>
                  <td class="num">{{ row.accrued | money: row.currency }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">
                    <nz-empty [nzNotFoundContent]="'gdoTradeTerms.empty.projections' | translate"></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>
      }
    </nz-spin>
  `,
})
export class DashboardComponent implements OnInit {
  protected readonly store = inject(DashboardStore);
  protected readonly statuses = GDT_CONTRACT_STATUSES;

  ngOnInit(): void {
    void this.store.load();
  }
}
