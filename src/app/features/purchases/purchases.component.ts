import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-purchases',
  imports: [
    NzCardModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzGridModule,
    NzStatisticModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'PURCHASES.TITLE' | translate"
      [subtitle]="'PURCHASES.SUBTITLE' | translate"
    />

    <div nz-row [nzGutter]="16" class="stats-row">
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic [nzValue]="12" [nzTitle]="'PURCHASES.KPI_RECONCILE' | translate" />
        </nz-card>
      </div>
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic [nzValue]="'CHF 45.120'" [nzTitle]="'PURCHASES.KPI_PAIN001' | translate" />
        </nz-card>
      </div>
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic [nzValue]="'€ 18.900'" [nzTitle]="'PURCHASES.KPI_SEPA' | translate" />
        </nz-card>
      </div>
    </div>

    <nz-card [nzTitle]="'PURCHASES.CARD_TITLE' | translate">
      <nz-table #pTable [nzData]="items" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>{{ 'PURCHASES.COL_PROTOCOL' | translate }}</th>
            <th>{{ 'PURCHASES.COL_VENDOR' | translate }}</th>
            <th>{{ 'PURCHASES.COL_CHANNEL' | translate }}</th>
            <th>{{ 'COMMON.AMOUNT' | translate }}</th>
            <th>{{ 'PURCHASES.COL_DUE' | translate }}</th>
            <th>{{ 'PURCHASES.COL_APPROVAL' | translate }}</th>
            <th>{{ 'COMMON.ACTION' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (item of pTable.data; track item.ref) {
            <tr>
              <td><strong>{{ item.ref }}</strong></td>
              <td>{{ item.vendor }}</td>
              <td>
                <nz-tag [nzColor]="item.channel === 'SDI' ? 'blue' : 'red'">
                  {{ item.channel }}
                </nz-tag>
              </td>
              <td>{{ item.amount }}</td>
              <td>{{ item.dueDate }}</td>
              <td>
                <nz-tag [nzColor]="item.statusColor">{{ item.status }}</nz-tag>
              </td>
              <td>
                <button nz-button nzSize="small" nzType="default">
                  <i class="fa-solid fa-file-invoice fa-icon-spaced"></i> {{ 'COMMON.RECONCILE' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    .stats-row {
      margin-bottom: 20px;
    }
  `,
})
export class PurchasesComponent {
  readonly items = [
    { ref: 'PASS-2026-089', vendor: 'Swisscom AG', channel: 'QR-Bill (CH)', amount: '340.50 CHF', dueDate: '2026-11-10', status: 'Verificata', statusColor: 'success' },
    { ref: 'SDI-PASS-441', vendor: 'TIM Enterprise S.p.A.', channel: 'SDI (IT)', amount: '€ 1.250,00', dueDate: '2026-11-15', status: 'In Approvazione', statusColor: 'warning' },
    { ref: 'PASS-2026-092', vendor: 'Würth AG Svizzera', channel: 'QR-Bill (CH)', amount: '1\'890.20 CHF', dueDate: '2026-11-20', status: 'pain.001 Generato', statusColor: 'blue' },
  ];
}
