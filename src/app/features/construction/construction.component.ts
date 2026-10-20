import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent } from '@shared';

@Component({
  selector: 'app-construction',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent],
  template: `
    <app-page-header
      title="Cantieri, Impianti & Norme SIA / DiCo"
      subtitle="Stato avanzamento lavori (SAL), conformità SIA 118 / OIBT (CH), dichiarazioni di conformità DiCo (IT) e reverse charge"
    />

    <nz-card nzTitle="Cantieri e Commesse in Esecuzione">
      <nz-table #cTable [nzData]="sites" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>Codice Cantiere</th>
            <th>Committente</th>
            <th>Località & Regime</th>
            <th>SAL Eseguito</th>
            <th>Conformità Tecnica</th>
            <th>Regime IVA</th>
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
