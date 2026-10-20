import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { PageHeaderComponent } from '@shared';

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
  ],
  template: `
    <app-page-header
      title="Acquisti & Ciclo Passivo AP"
      subtitle="Ricezione fatture SDI, scanner Swiss QR-Bill e generazione lotti di pagamento ISO 20022 pain.001"
    />

    <div nz-row [nzGutter]="16" class="stats-row">
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic [nzValue]="12" nzTitle="Fatture Passive da Riconciliare" />
        </nz-card>
      </div>
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic [nzValue]="'CHF 45.120'" nzTitle="Pagamenti pain.001 in Coda" />
        </nz-card>
      </div>
      <div nz-col [nzSpan]="8">
        <nz-card>
          <nz-statistic [nzValue]="'€ 18.900'" nzTitle="Bonifici SEPA Programmati" />
        </nz-card>
      </div>
    </div>

    <nz-card nzTitle="Fatture Fornitori in Arrivo (SDI / QR-Bill)">
      <nz-table #pTable [nzData]="items" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>Protocollo / Rif.</th>
            <th>Fornitore</th>
            <th>Canale Ricezione</th>
            <th>Importo</th>
            <th>Scadenza</th>
            <th>Stato Approvazione</th>
            <th>Azione</th>
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
                  <i class="fa-solid fa-file-invoice fa-icon-spaced"></i> Riconcilia
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
