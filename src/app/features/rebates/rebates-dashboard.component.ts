import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { RebateDashboard, RebatesApiService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './rebates.util';

/** Open and settled rebate per direction, promotions by state and the agreements about to end. */
@Component({
  selector: 'app-rebates-dashboard',
  styleUrl: './rebates.scss',
  imports: [DecimalPipe, RouterLink, PageHeaderComponent, TranslatePipe, NzCardModule, NzEmptyModule, NzStatisticModule, NzTableModule],
  template: `
    <app-page-header [title]="'REBATES.DASHBOARD_TITLE' | translate" [subtitle]="'REBATES.DASHBOARD_SUBTITLE' | translate"></app-page-header>

    @if (dashboard(); as data) {
      <div class="stats-grid">
        <nz-card><nz-statistic [nzTitle]="'REBATES.AGREEMENTS_TOTAL' | translate" [nzValue]="data.agreements.total"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'REBATES.OPEN_SALES' | translate" [nzValue]="(data.accrued_open.sales | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'REBATES.OPEN_PURCHASE' | translate" [nzValue]="(data.accrued_open.purchase | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'REBATES.SETTLED_SALES' | translate" [nzValue]="(data.settled.sales | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'REBATES.SETTLED_PURCHASE' | translate" [nzValue]="(data.settled.purchase | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'REBATES.PROMOTIONS_ACTIVE' | translate" [nzValue]="data.promotions.active"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'REBATES.PROMOTIONS_SCHEDULED' | translate" [nzValue]="data.promotions.scheduled"></nz-statistic></nz-card>
      </div>

      <nz-card class="main-card" [nzTitle]="'REBATES.ENDING_AGREEMENTS' | translate">
        <nz-table #endingTable [nzData]="data.ending_agreements" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'REBATES.CODE' | translate }}</th>
              <th>{{ 'REBATES.NAME' | translate }}</th>
              <th>{{ 'REBATES.ENDS_ON' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of endingTable.data; track row.id) {
              <tr>
                <td>
                  <a [routerLink]="['/rebates/agreements', row.id]">{{ row.code }}</a>
                </td>
                <td>{{ row.name }}</td>
                <td>{{ row.ends_on }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.ending_agreements.length === 0) {
          <nz-empty [nzNotFoundContent]="'REBATES.NO_ENDING_AGREEMENTS' | translate"></nz-empty>
        }
      </nz-card>
    }
  `,
})
export class RebatesDashboardComponent implements OnInit {
  private readonly api = inject(RebatesApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly dashboard = signal<RebateDashboard | null>(null);

  ngOnInit(): void {
    this.api.getDashboard().subscribe({
      next: (response) => this.dashboard.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('REBATES.ACTION_ERROR')),
    });
  }
}
