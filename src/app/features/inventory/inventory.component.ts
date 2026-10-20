import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { PageHeaderComponent } from '@shared';

@Component({
  selector: 'app-inventory',
  imports: [NzCardModule, NzTableModule, NzTagModule, NzButtonModule, PageHeaderComponent],
  template: `
    <app-page-header
      title="Magazzino & Logistica Cross-Border"
      subtitle="Cataloghi articoli, DDT, codici doganali HS/TARIC e gestione export IT-CH"
    />

    <nz-card nzTitle="Giacenze Multimagazzino (Milano / Chiasso)">
      <nz-table #sTable [nzData]="items" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>Codice SKU</th>
            <th>Descrizione</th>
            <th>Magazzino</th>
            <th>Giacenza</th>
            <th>Codice Doganale HS</th>
            <th>Valore Unitario</th>
          </tr>
        </thead>
        <tbody>
          @for (it of sTable.data; track it.sku) {
            <tr>
              <td><strong>{{ it.sku }}</strong></td>
              <td>{{ it.desc }}</td>
              <td>
                <nz-tag [nzColor]="it.wh === 'Chiasso (CH)' ? 'red' : 'blue'">{{ it.wh }}</nz-tag>
              </td>
              <td><strong>{{ it.qty }}</strong></td>
              <td><code>{{ it.hs }}</code></td>
              <td>{{ it.price }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class InventoryComponent {
  readonly items = [
    { sku: 'EL-SENS-01', desc: 'Sensore industriale IoT IP67', wh: 'Chiasso (CH)', qty: '450 Pz', hs: '9031.90.00', price: '45.00 CHF' },
    { sku: 'CAB-OPTO-50', desc: 'Fibra ottica corazzata 50m', wh: 'Milano (IT)', qty: '120 Pz', hs: '8544.70.00', price: '€ 85,00' },
    { sku: 'RACK-SRV-24', desc: 'Armadio Rack 24U ventilato', wh: 'Chiasso (CH)', qty: '18 Pz', hs: '9403.20.80', price: '420.00 CHF' },
  ];
}
