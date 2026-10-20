import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-inventory',
  imports: [NzCardModule, NzTableModule, NzTagModule, NzButtonModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header
      [title]="'INVENTORY.TITLE' | translate"
      [subtitle]="'INVENTORY.SUBTITLE' | translate"
    />

    <nz-card [nzTitle]="'INVENTORY.CARD_TITLE' | translate">
      <nz-table #sTable [nzData]="items" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>{{ 'INVENTORY.COL_SKU' | translate }}</th>
            <th>{{ 'INVENTORY.COL_DESC' | translate }}</th>
            <th>{{ 'INVENTORY.COL_WAREHOUSE' | translate }}</th>
            <th>{{ 'INVENTORY.COL_QTY' | translate }}</th>
            <th>{{ 'INVENTORY.COL_HS' | translate }}</th>
            <th>{{ 'INVENTORY.COL_PRICE' | translate }}</th>
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
