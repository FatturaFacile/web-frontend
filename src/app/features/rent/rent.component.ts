import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-rent',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header
      [title]="'RENT.TITLE' | translate"
      [subtitle]="'RENT.SUBTITLE' | translate"
    />

    <nz-card [nzTitle]="'RENT.CARD_TITLE' | translate">
      <nz-table #rTable [nzData]="vehicles" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>{{ 'RENT.COL_PLATE_MODEL' | translate }}</th>
            <th>{{ 'RENT.COL_TYPE' | translate }}</th>
            <th>{{ 'RENT.COL_CLIENT' | translate }}</th>
            <th>{{ 'RENT.COL_VIGNETTE' | translate }}</th>
            <th>{{ 'RENT.COL_RETURN' | translate }}</th>
            <th>{{ 'COMMON.STATUS' | translate }}</th>
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
                  {{ v.vignette ? ('RENT.VIGNETTE_ACTIVE' | translate) : ('RENT.VIGNETTE_NONE' | translate) }}
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
