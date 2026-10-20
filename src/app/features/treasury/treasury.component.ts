import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { PageHeaderComponent } from '@shared';

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
  ],
  template: `
    <app-page-header
      title="Tesoreria & Gestione Bancaria"
      subtitle="Import estratti conto ISO 20022 (camt.053 / camt.054), formato CBI e riconciliazione automatica"
    />

    <div nz-row [nzGutter]="16" class="stats-row">
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic [nzValue]="'CHF 218.450'" nzTitle="Saldo UBS Svizzera (CHF)" />
        </nz-card>
      </div>
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic [nzValue]="'€ 145.200'" nzTitle="Saldo Intesa Sanpaolo (EUR)" />
        </nz-card>
      </div>
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic [nzValue]="'96%'" nzTitle="Accuratezza Auto-Match" />
        </nz-card>
      </div>
    </div>

    <nz-card nzTitle="Movimenti Bancari da Riconciliare">
      <nz-table #tTable [nzData]="transactions" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>Data Valuta</th>
            <th>Banca / Conto</th>
            <th>Descrizione / Riferimento</th>
            <th>Importo</th>
            <th>Stato Riconciliazione</th>
          </tr>
        </thead>
        <tbody>
          @for (tx of tTable.data; track tx.id) {
            <tr>
              <td>{{ tx.valuta }}</td>
              <td><strong>{{ tx.bank }}</strong></td>
              <td>{{ tx.desc }}</td>
              <td>
                <span [style.color]="tx.amount.startsWith('-') ? '#ff4d4f' : '#52c41a'">
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
