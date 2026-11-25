import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ILR_SEGMENTS, IlrSegment } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { DashboardStore } from './dashboard.store';
import { gapColor, num } from './industrial-laundry.util';

/** Par level against circulating stock per customer: pieces, net kg and the billing preview of the month. */
@Component({
  selector: 'app-ilr-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzProgressModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [DashboardStore],
  styleUrl: './industrial-laundry.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.INDUSTRIAL_LAUNDRY_PAR_STOCK' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="ilr-dash-segment">
        <span>{{ 'industrialLaundry.field.segment' | translate }}</span>
        <nz-select
          id="ilr-dash-segment"
          nzAllowClear
          [ngModel]="store.segment()"
          (ngModelChange)="store.setFilters({ segment: $event })"
          [nzPlaceHolder]="'industrialLaundry.field.allSegments' | translate"
        >
          @for (segment of segments; track segment) {
            <nz-option [nzValue]="segment" [nzLabel]="'industrialLaundry.customerSegment.' + segment | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field wide" for="ilr-dash-customer">
        <span>{{ 'industrialLaundry.field.customer' | translate }}</span>
        <nz-select
          id="ilr-dash-customer"
          nzAllowClear
          nzShowSearch
          [ngModel]="store.customerId()"
          (ngModelChange)="store.setFilters({ customerId: $event })"
          [nzPlaceHolder]="'industrialLaundry.field.allCustomers' | translate"
        >
          @for (customer of store.customers(); track customer.id) {
            <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
          }
        </nz-select>
      </label>
      <span class="spacer"></span>
      <button nz-button type="button" (click)="store.load()">{{ 'industrialLaundry.action.refresh' | translate }}</button>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @for (row of store.rows(); track row.contract_id) {
        <nz-card class="main-card">
          <div class="card-head">
            <h3>{{ row.customer_name }}</h3>
            <span class="chips">
              <nz-tag>{{ row.contract_code }}</nz-tag>
              <nz-tag nzColor="blue">{{ 'industrialLaundry.customerSegment.' + row.customer_segment | translate }}</nz-tag>
              <nz-tag>{{ 'industrialLaundry.billingModel.' + row.billing_model | translate }}</nz-tag>
            </span>
          </div>

          <div class="stats-grid">
            <nz-statistic
              [nzTitle]="'industrialLaundry.field.parVersusCirculating' | translate"
              [nzValue]="row.circulating_total + ' / ' + row.par_total"
            ></nz-statistic>
            <nz-statistic [nzTitle]="'industrialLaundry.field.piecesMonth' | translate" [nzValue]="row.pieces_delivered ?? 0"></nz-statistic>
            <nz-statistic [nzTitle]="'industrialLaundry.field.netKgDirty' | translate" [nzValue]="row.net_kg_dirty"></nz-statistic>
            <nz-statistic [nzTitle]="'industrialLaundry.field.netKgClean' | translate" [nzValue]="row.net_kg_clean"></nz-statistic>
            @if (row.billing_preview; as preview) {
              <nz-statistic
                [nzTitle]="'industrialLaundry.field.billingPreview' | translate"
                [nzValue]="preview.total | money: row.currency"
              ></nz-statistic>
            }
          </div>

          <nz-table nzSize="small" [nzData]="row.lines" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col">{{ 'industrialLaundry.field.articleType' | translate }}</th>
                <th scope="col" class="num">{{ 'industrialLaundry.field.parLevel' | translate }}</th>
                <th scope="col" class="num">{{ 'industrialLaundry.field.circulating' | translate }}</th>
                <th scope="col">{{ 'industrialLaundry.field.coverage' | translate }}</th>
                <th scope="col" class="num">{{ 'industrialLaundry.field.atCustomer' | translate }}</th>
                <th scope="col" class="num">{{ 'industrialLaundry.field.inLaundry' | translate }}</th>
                <th scope="col" class="num">{{ 'industrialLaundry.field.inMending' | translate }}</th>
                <th scope="col" class="num">{{ 'industrialLaundry.field.gap' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (line of row.lines; track line.article_type) {
                <tr>
                  <th scope="row">{{ 'industrialLaundry.articleType.' + line.article_type | translate }}</th>
                  <td class="num">{{ line.par_level }}</td>
                  <td class="num">{{ line.circulating }}</td>
                  <td>
                    <nz-progress nzSize="small" [nzPercent]="coverage(line.circulating, line.par_level)" [nzShowInfo]="false"></nz-progress>
                  </td>
                  <td class="num">{{ line.at_customer }}</td>
                  <td class="num">{{ line.in_laundry }}</td>
                  <td class="num">{{ line.in_mending }}</td>
                  <td class="num">
                    <nz-tag [nzColor]="gapColor(line.gap)">{{ line.gap }}</nz-tag>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>

          @if (row.billing_preview; as preview) {
            <div class="totals">
              <nz-statistic [nzTitle]="'industrialLaundry.field.washAmount' | translate" [nzValue]="preview.wash_amount | money: row.currency"></nz-statistic>
              <nz-statistic [nzTitle]="'industrialLaundry.field.topUpAmount' | translate" [nzValue]="preview.minimum_top_up_amount | money: row.currency"></nz-statistic>
              <nz-statistic [nzTitle]="'industrialLaundry.field.rentalAmount' | translate" [nzValue]="preview.rental_amount | money: row.currency"></nz-statistic>
              <nz-statistic [nzTitle]="'industrialLaundry.field.unreturnedAmount' | translate" [nzValue]="preview.unreturned_amount | money: row.currency"></nz-statistic>
            </div>
            <p class="hint">{{ 'industrialLaundry.hint.previewPeriod' | translate }} {{ row.period_start }} – {{ row.period_end }}</p>
          }
        </nz-card>
      } @empty {
        @if (!store.loading()) {
          <nz-empty [nzNotFoundContent]="'industrialLaundry.empty.parStock' | translate"></nz-empty>
        }
      }
    </nz-spin>
  `,
})
export class DashboardComponent implements OnInit {
  protected readonly store = inject(DashboardStore);
  protected readonly segments: readonly IlrSegment[] = ILR_SEGMENTS;
  protected readonly gapColor = gapColor;

  ngOnInit(): void {
    void this.store.init();
  }

  /** Share of the par level that is in circulation, capped for the bar. */
  protected coverage(circulating: number, par: number): number {
    return par <= 0 ? 0 : Math.min(100, Math.round((num(circulating) / par) * 100));
  }
}
