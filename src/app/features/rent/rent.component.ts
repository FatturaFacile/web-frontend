import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent } from '@shared';

@Component({
  selector: 'app-rent',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent],
  template: `
    <app-page-header
      title="Flotta & Noleggio Veicoli"
      subtitle="Planning noleggio a breve/lungo termine, perizie danni digitali, vignette svizzere e Telepass"
    />

    <nz-card nzTitle="Stato Parco Mezzi & Contratti Attivi">
      <nz-table #rTable [nzData]="vehicles" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>Targa & Modello</th>
            <th>Tipo Contratto</th>
            <th>Cliente Assegnatario</th>
            <th>Vignetta Autostradale CH</th>
            <th>Rientro Previsto</th>
            <th>Stato</th>
          </tr>
        </thead>
        <tbody>
          @for (v of rTable.data; track v.plate) {
            <tr>
              <td><strong>{{ v.plate }}</strong> - {{ v.model }}</td>
              <td>{{ v.type }}</td>
              <td>{{ v.client }}</td>
              <td>
                <nz-tag [nzColor]="v.vignette ? 'success' : 'default'">
                  {{ v.vignette ? 'E-Vignetta Attiva' : 'Non richiesta' }}
                </nz-tag>
              </td>
              <td>{{ v.returnDate }}</td>
              <td>
                <nz-tag nzColor="blue">{{ v.status }}</nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class RentComponent {
  readonly vehicles = [
    { plate: 'TI 982104', model: 'BMW 320d xDrive Touring', type: 'Breve Termine (15 gg)', client: 'Alpine Precision AG', vignette: true, returnDate: '2026-10-28', status: 'In Noleggio' },
    { plate: 'FP 412 ZB', model: 'Fiat Ducato Maxi 2.2 Multijet', type: 'Lungo Termine (24 mesi)', client: 'Rossi Impianti S.r.l.', vignette: true, returnDate: '2027-05-15', status: 'Assegnato' },
  ];
}
