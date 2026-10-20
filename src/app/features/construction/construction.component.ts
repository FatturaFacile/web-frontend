import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-construction',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header
      [title]="'CONSTRUCTION.TITLE' | translate"
      [subtitle]="'CONSTRUCTION.SUBTITLE' | translate"
    />

    <nz-card [nzTitle]="'CONSTRUCTION.CARD_TITLE' | translate">
      <nz-table #cTable [nzData]="sites" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>{{ 'CONSTRUCTION.COL_SITE_CODE' | translate }}</th>
            <th>{{ 'CONSTRUCTION.COL_CLIENT' | translate }}</th>
            <th>{{ 'CONSTRUCTION.COL_LOCATION_REGIME' | translate }}</th>
            <th>{{ 'CONSTRUCTION.COL_SAL' | translate }}</th>
            <th>{{ 'CONSTRUCTION.COL_TECH_COMPLIANCE' | translate }}</th>
            <th>{{ 'CONSTRUCTION.COL_VAT_REGIME' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (s of cTable.data; track s.code) {
            <tr>
              <td><strong>{{ s.code }}</strong></td>
              <td>{{ s.client }}</td>
              <td>
                <nz-tag [nzColor]="s.regime === 'CH' ? 'red' : 'blue'">
                  {{ s.location }} ({{ s.regime }})
                </nz-tag>
              </td>
              <td><strong>{{ s.sal }}</strong></td>
              <td>
                <nz-tag nzColor="success">{{ s.norm }}</nz-tag>
              </td>
              <td>{{ s.vatRegime }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class ConstructionComponent {
  readonly sites = [
    { code: 'CANT-2026-TI', client: 'Residenza Monte Brè', location: 'Lugano', regime: 'CH', sal: '65% (CHF 320.000)', norm: 'SIA 118 / OIBT', vatRegime: 'IVA 8.1% (CH)' },
    { code: 'CANT-2026-MI', client: 'Condominio San Babila', location: 'Milano', regime: 'IT', sal: '40% (€ 180.000)', norm: 'DiCo DM 37/08', vatRegime: 'Reverse Charge Art. 17' },
  ];
}
