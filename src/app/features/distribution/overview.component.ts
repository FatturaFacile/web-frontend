import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { formatQuantity, toNumber } from './distribution.util';
import { OverviewStore } from './overview.store';

/** The distribution overview: KPI cards, the overdue shipments and the quick actions of the planner. */
@Component({
  selector: 'app-dst-overview',
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [OverviewStore],
  styleUrl: './distribution.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.DISTRIBUTION_OVERVIEW' | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.dashboard(); as board) {
        <div class="toolbar">
          <a nz-button nzType="primary" routerLink="../transfers">{{
            'distribution.action.newTransfer' | translate
          }}</a>
          <a nz-button routerLink="../proposals">{{
            'distribution.action.reviewProposals' | translate
          }}</a>
          <a nz-button routerLink="../drp">{{ 'distribution.action.openDrp' | translate }}</a>
          <a nz-button routerLink="../in-transit">{{
            'NAV.DISTRIBUTION_IN_TRANSIT' | translate
          }}</a>
        </div>

        <div class="stats-grid">
          <nz-card class="main-card">
            <nz-statistic
              [nzTitle]="'distribution.kpi.activeTransfers' | translate"
              [nzValue]="board.active_transfers"
            ></nz-statistic>
          </nz-card>
          <nz-card class="main-card">
            <nz-statistic
              [nzTitle]="'distribution.kpi.unitsInTransit' | translate"
              [nzValue]="quantity(board.units_in_transit)"
            ></nz-statistic>
            <small class="muted"
              >{{ 'distribution.kpi.valueInTransit' | translate }}:
              {{ money(board.value_in_transit) }}</small
            >
          </nz-card>
          <nz-card class="main-card">
            <nz-statistic
              [nzTitle]="'distribution.kpi.pendingProposals' | translate"
              [nzValue]="board.pending_proposals"
            ></nz-statistic>
          </nz-card>
          <nz-card class="main-card">
            <nz-statistic
              [nzTitle]="'distribution.kpi.stockoutAlerts' | translate"
              [nzValue]="board.stockout_alerts"
            ></nz-statistic>
            @if (board.latest_run; as run) {
              <small class="muted">{{ run.run_number }}</small>
            }
          </nz-card>
          <nz-card class="main-card">
            <nz-statistic
              [nzTitle]="'distribution.kpi.consignmentValue' | translate"
              [nzValue]="money(board.consignment_stock_value)"
            ></nz-statistic>
          </nz-card>
        </div>

        <nz-card class="main-card" [nzTitle]="'distribution.section.overdueShipments' | translate">
          @if (board.overdue_shipments > 0) {
            <nz-tag nzColor="red">{{
              'distribution.kpi.overdueShipments' | translate: { count: board.overdue_shipments }
            }}</nz-tag>
          }
          <nz-table
            #table
            nzSize="small"
            [nzData]="board.overdue"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '800px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'distribution.field.transfer' | translate }}</th>
                <th scope="col">{{ 'distribution.field.item' | translate }}</th>
                <th scope="col">{{ 'distribution.field.route' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'distribution.field.quantityInTransit' | translate }}
                </th>
                <th scope="col">{{ 'distribution.field.expectedArrival' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (
                row of table.data;
                track row.transfer_id + row.stock_item_id + (row.lot_id ?? '')
              ) {
                <tr>
                  <th scope="row">{{ row.transfer_number }}</th>
                  <td>
                    {{ row.sku }} <small class="muted">{{ row.name }}</small>
                  </td>
                  <td>{{ row.source_warehouse.code }} → {{ row.destination_warehouse.code }}</td>
                  <td class="num">{{ quantity(row.quantity_in_transit) }} {{ row.uom }}</td>
                  <td>
                    <nz-tag nzColor="red">{{ row.expected_arrival_date }}</nz-tag>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">
                    <nz-empty
                      [nzNotFoundContent]="'distribution.empty.overdue' | translate"
                    ></nz-empty>
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
export class OverviewComponent implements OnInit {
  protected readonly store = inject(OverviewStore);

  ngOnInit(): void {
    void this.store.load();
  }

  protected quantity(value: string | number): string {
    return formatQuantity(value);
  }

  protected money(value: string | number): string {
    return toNumber(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}
