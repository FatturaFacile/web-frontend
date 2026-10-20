import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent } from '@shared';

@Component({
  selector: 'app-retail',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent],
  template: `
    <app-page-header
      title="Vendita al Banco & POS Touch"
      subtitle="Integrazione Registratore Telematico RT (IT) e terminali di pagamento svizzeri (Twint, SumUp, Worldline)"
    />

    <nz-card nzTitle="Chiusure Fiscali e Sessioni Cassa">
      <nz-table #rTable [nzData]="sessions" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>Punto Cassa</th>
            <th>Operatore</th>
            <th>Regime Fiscale</th>
            <th>Totale Incassato</th>
            <th>Dispositivo Collegato</th>
            <th>Stato Chiusura</th>
          </tr>
        </thead>
        <tbody>
          @for (s of rTable.data; track s.pos) {
            <tr>
              <td><strong>{{ s.pos }}</strong></td>
              <td>{{ s.cashier }}</td>
              <td>
                <nz-tag [nzColor]="s.regime === 'IT' ? 'blue' : 'red'">{{ s.regime }}</nz-tag>
              </td>
              <td><strong>{{ s.total }}</strong></td>
              <td>{{ s.device }}</td>
              <td>
                <nz-tag nzColor="success">{{ s.status }}</nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class RetailComponent {
  readonly sessions = [
    { pos: 'Cassa 01 - Lugano Centro', cashier: 'Sara Riva', regime: 'CH', total: '2\'450.00 CHF', device: 'Twint QR & Terminale SumUp', status: 'Trasmesso' },
    { pos: 'Cassa 02 - Milano Showroom', cashier: 'Marco Rossi', regime: 'IT', total: '€ 1.820,00', device: 'Registratore Telematico RT Epson', status: 'Chiusura Z inviata ADE' },
  ];
}
