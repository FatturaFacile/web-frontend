import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-treasury',
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
      [title]="'TREASURY.TITLE' | translate"
      [subtitle]="'TREASURY.SUBTITLE' | translate"
    />

    <div nz-row [nzGutter]="16" class="stats-row">
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic [nzValue]="'CHF 218.450'" [nzTitle]="'TREASURY.KPI_UBS' | translate" />
        </nz-card>
      </div>
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic [nzValue]="'€ 145.200'" [nzTitle]="'TREASURY.KPI_INTESA' | translate" />
        </nz-card>
      </div>
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic [nzValue]="'96%'" [nzTitle]="'TREASURY.KPI_ACCURACY' | translate" />
        </nz-card>
      </div>
    </div>

    <nz-card [nzTitle]="'TREASURY.CARD_TITLE' | translate">
      <nz-table #tTable [nzData]="transactions" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>{{ 'TREASURY.COL_VALUE_DATE' | translate }}</th>
            <th>{{ 'TREASURY.COL_BANK' | translate }}</th>
            <th>{{ 'TREASURY.COL_DESC' | translate }}</th>
            <th>{{ 'COMMON.AMOUNT' | translate }}</th>
            <th>{{ 'TREASURY.COL_STATUS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (tx of tTable.data; track tx.id) {
            <tr>
              <td>{{ tx.valuta }}</td>
              <td><strong>{{ tx.bank }}</strong></td>
              <td>{{ tx.desc }}</td>
              <td>
                <span [style.color]="tx.amount.startsWith('-') ? '#ef4444' : '#10b981'">
                  <strong>{{ tx.amount }}</strong>
                </span>
              </td>
              <td>
                <nz-tag [nzColor]="tx.statusColor">{{ tx.status }}</nz-tag>
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
export class TreasuryComponent {
  readonly transactions = [
    { id: '1', valuta: '2026-10-19', bank: 'UBS Lugano (CH44...)', desc: 'Bonifico QR-Bill Bernasconi SA Ref: 21000...', amount: '+1\'450.85 CHF', status: 'Riconciliato', statusColor: 'success' },
    { id: '2', valuta: '2026-10-18', bank: 'Intesa Sanpaolo (IT89...)', desc: 'SBF Incasso RIBA Lombarda Manifatture', amount: '+€ 5.490,00', status: 'Riconciliato', statusColor: 'success' },
    { id: '3', valuta: '2026-10-17', bank: 'UBS Lugano (CH44...)', desc: 'Addebito diretto canoni hosting', amount: '-240.00 CHF', status: 'Da verificare', statusColor: 'warning' },
  ];
}
