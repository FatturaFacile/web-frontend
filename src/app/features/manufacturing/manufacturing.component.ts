import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-manufacturing',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header
      [title]="'MANUFACTURING.TITLE' | translate"
      [subtitle]="'MANUFACTURING.SUBTITLE' | translate"
    />

    <nz-card [nzTitle]="'MANUFACTURING.CARD_TITLE' | translate">
      <nz-table #mTable [nzData]="orders" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>{{ 'MANUFACTURING.COL_ORDER_NUM' | translate }}</th>
            <th>{{ 'MANUFACTURING.COL_PRODUCT' | translate }}</th>
            <th>{{ 'MANUFACTURING.COL_QTY' | translate }}</th>
            <th>{{ 'MANUFACTURING.COL_LINE' | translate }}</th>
            <th>{{ 'MANUFACTURING.COL_PROGRESS' | translate }}</th>
            <th>{{ 'MANUFACTURING.COL_QA' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (o of mTable.data; track o.num) {
            <tr>
              <td><strong>{{ o.num }}</strong></td>
              <td>{{ o.product }}</td>
              <td><strong>{{ o.qty }}</strong></td>
              <td>{{ o.line }}</td>
              <td>
                <nz-tag nzColor="processing">{{ o.progress }}</nz-tag>
              </td>
              <td>
                <nz-tag nzColor="success">{{ o.qa }}</nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class ManufacturingComponent {
  readonly orders = [
    { num: 'ODP-2026-310', product: 'Sensore IoT IP67 v2', qty: '500 Pz', line: 'Centro CNC Chiasso', progress: '75%', qa: 'Certificato CE / CH Conforme' },
    { num: 'ODP-2026-311', product: 'Quadro elettrico modulare', qty: '25 Pz', line: 'Reparto Cablaggio Como', progress: '40%', qa: 'In collaudo OIBT' },
  ];
}
