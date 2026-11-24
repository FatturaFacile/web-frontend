import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { MarketingNavComponent } from './marketing-nav.component';
import { MarketingAutomationStore } from './marketing-automation.store';
import { rate, roiDisplay } from './marketing-automation.util';

interface Kpi {
  readonly key: string;
  readonly value: number;
  readonly money: boolean;
}

/** ROI dashboard: engagement, commercial attribution and ROI of every campaign, in the reporting currency of the tenant. */
@Component({
  selector: 'app-marketing-dashboard',
  imports: [
    DecimalPipe,
    RouterLink,
    NzCardModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    MarketingNavComponent,
  ],
  template: `
    <app-page-header
      [title]="'marketing.dashboard.title' | translate"
      [subtitle]="'marketing.dashboard.subtitle' | translate"
    />
    <app-marketing-nav activeTab="dashboard" />

    @if (store.errorCode(); as code) {
      <p class="mb-4 text-red-600" role="alert">{{ code | translate }}</p>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.dashboard(); as dashboard) {
        <section
          class="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7"
          [attr.aria-label]="'marketing.dashboard.kpis' | translate"
        >
          @for (kpi of kpis(); track kpi.key) {
            <nz-card nzSize="small" class="kpi-card">
              <div class="text-xs text-gray-500">{{ 'marketing.kpi.' + kpi.key | translate }}</div>
              <div class="text-xl font-semibold" [attr.data-kpi]="kpi.key">
                {{ kpi.value | number: kpi.money ? '1.2-2' : '1.0-0' }}
                @if (kpi.money) {
                  <span class="text-xs font-normal text-gray-500">{{ dashboard.currency }}</span>
                }
              </div>
            </nz-card>
          }
          <nz-card nzSize="small" class="kpi-card">
            <div class="text-xs text-gray-500">{{ 'marketing.kpi.roi' | translate }}</div>
            <div class="text-xl font-semibold" data-kpi="roi">
              @if (totalRoi(); as roi) {
                @if (roi.kind === 'none') {
                  <span class="text-sm font-normal">{{ 'marketing.roi.no_cost' | translate }}</span>
                } @else {
                  <span [class.text-red-600]="roi.kind === 'loss'">
                    {{ roi.value | number: '1.0-1' }} %
                  </span>
                }
              }
            </div>
          </nz-card>
        </section>

        <nz-card [nzTitle]="'marketing.dashboard.campaigns' | translate">
          <nz-table
            #table
            [nzData]="dashboard.campaigns"
            nzSize="small"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '1400px' }"
          >
            <thead>
              <tr>
                <th>{{ 'marketing.field.name' | translate }}</th>
                <th>{{ 'marketing.field.status' | translate }}</th>
                <th>{{ 'marketing.kpi.sent' | translate }}</th>
                <th>{{ 'marketing.kpi.delivered' | translate }}</th>
                <th>{{ 'marketing.kpi.opens' | translate }}</th>
                <th>{{ 'marketing.kpi.clicks' | translate }}</th>
                <th>{{ 'marketing.kpi.unsubscribes' | translate }}</th>
                <th>{{ 'marketing.kpi.quotes' | translate }}</th>
                <th>{{ 'marketing.kpi.orders' | translate }}</th>
                <th>{{ 'marketing.kpi.invoiced' | translate }}</th>
                <th>{{ 'marketing.kpi.collected' | translate }}</th>
                <th>{{ 'marketing.kpi.revenue' | translate }}</th>
                <th>{{ 'marketing.kpi.margin' | translate }}</th>
                <th>{{ 'marketing.kpi.cost' | translate }}</th>
                <th>{{ 'marketing.kpi.roi' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of table.data; track row.campaign_id) {
                <tr>
                  <td>
                    <a [routerLink]="['/marketing-automation/campaigns']" [queryParams]="{ campaign: row.campaign_id }">{{ row.name }}</a>
                  </td>
                  <td>
                    <nz-tag>{{ 'marketing.status.' + row.status | translate }}</nz-tag>
                  </td>
                  <td>{{ row.sent_count | number: '1.0-0' }}</td>
                  <td>{{ row.delivered_count | number: '1.0-0' }}</td>
                  <td>
                    {{ row.unique_opens_count | number: '1.0-0' }}
                    <span class="text-xs text-gray-500">({{ openRate(row.unique_opens_count, row.sent_count) }} %)</span>
                  </td>
                  <td>
                    {{ row.unique_clicks_count | number: '1.0-0' }}
                    <span class="text-xs text-gray-500">({{ openRate(row.unique_clicks_count, row.sent_count) }} %)</span>
                  </td>
                  <td>{{ row.unsubscribes_count | number: '1.0-0' }}</td>
                  <td>
                    {{ row.attributed_quotes_count }}
                    <span class="text-xs text-gray-500">{{ row.attributed_quotes_value | number: '1.2-2' }}</span>
                  </td>
                  <td>{{ row.attributed_sales_orders_count }}</td>
                  <td>{{ row.attributed_invoiced_amount | number: '1.2-2' }}</td>
                  <td>{{ row.attributed_collected_amount | number: '1.2-2' }}</td>
                  <td>{{ row.attributed_net_revenue_amount | number: '1.2-2' }}</td>
                  <td>{{ row.attributed_gross_margin_amount | number: '1.2-2' }}</td>
                  <td>{{ row.campaign_cost | number: '1.2-2' }}</td>
                  <td>
                    @if (rowRoi(row.calculated_roi_percentage, row.roi_state); as roi) {
                      @if (roi.kind === 'none') {
                        <span class="text-gray-500">{{ 'marketing.roi.no_cost' | translate }}</span>
                      } @else {
                        <span [class.text-red-600]="roi.kind === 'loss'">{{ roi.value | number: '1.0-1' }} %</span>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (dashboard.campaigns.length === 0 && !store.loading()) {
            <p class="py-6 text-center text-gray-500">{{ 'marketing.dashboard.empty' | translate }}</p>
          }
        </nz-card>
      }
    </nz-spin>
  `,
})
export class MarketingDashboardComponent implements OnInit {
  protected readonly store = inject(MarketingAutomationStore);

  protected readonly kpis = computed<Kpi[]>(() => {
    const totals = this.store.dashboard()?.totals;
    if (!totals) {
      return [];
    }
    return [
      { key: 'sent', value: totals.sent_count, money: false },
      { key: 'delivered', value: totals.delivered_count, money: false },
      { key: 'opens', value: totals.unique_opens_count, money: false },
      { key: 'clicks', value: totals.unique_clicks_count, money: false },
      { key: 'unsubscribes', value: totals.unsubscribes_count, money: false },
      { key: 'quotes', value: totals.attributed_quotes_count, money: false },
      { key: 'orders', value: totals.attributed_sales_orders_count, money: false },
      { key: 'invoiced', value: totals.attributed_invoiced_amount, money: true },
      { key: 'collected', value: totals.attributed_collected_amount, money: true },
      { key: 'revenue', value: totals.attributed_net_revenue_amount, money: true },
      { key: 'margin', value: totals.attributed_gross_margin_amount, money: true },
      { key: 'cost', value: totals.campaign_cost, money: true },
    ];
  });

  protected readonly totalRoi = computed(() => {
    const totals = this.store.dashboard()?.totals;
    return totals ? roiDisplay(totals.calculated_roi_percentage, totals.roi_state) : null;
  });

  ngOnInit(): void {
    void this.store.loadDashboard();
  }

  protected openRate(part: number, whole: number): number {
    return rate(part, whole);
  }

  protected rowRoi(percentage: number | null, state: 'computed' | 'no_cost' | 'no_revenue') {
    return roiDisplay(percentage, state);
  }
}
