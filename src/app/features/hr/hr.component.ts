import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent } from '@shared';

@Component({
  selector: 'app-hr',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent],
  template: `
    <app-page-header
      title="Risorse Umane & Payroll Cross-Border (IT / CH)"
      subtitle="Gestione frontalieri IT-CH, trattenute AVS/LPP, imposta alla fonte cantonale e flussi LUL / Swissdec ELM"
    />

    <nz-card nzTitle="Personale & Regime Fiscale / Previdenziale">
      <nz-table #hTable [nzData]="employees" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>Dipendente</th>
            <th>Qualifica</th>
            <th>Tipologia Contratto</th>
            <th>Regime Fiscale</th>
            <th>Previdenza Obbligatoria</th>
            <th>Stato Trasmissione</th>
          </tr>
        </thead>
        <tbody>
          @for (emp of hTable.data; track emp.name) {
            <tr>
              <td><strong>{{ emp.name }}</strong></td>
              <td>{{ emp.role }}</td>
              <td>{{ emp.type }}</td>
              <td>
                <nz-tag [nzColor]="emp.regime.includes('Frontaliere') ? 'purple' : 'blue'">
                  {{ emp.regime }}
                </nz-tag>
              </td>
              <td>{{ emp.pension }}</td>
              <td>
                <nz-tag nzColor="success">{{ emp.status }}</nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class HrComponent {
  readonly employees = [
    { name: 'Matteo Bianchi', role: 'Software Engineer', type: 'Indeterminato (42h/sett.)', regime: 'Frontaliere CH (Accordo 2024)', pension: 'AVS / AI / LPP 2° Pilastro (AXA)', status: 'Swissdec ELM OK' },
    { name: 'Laura Colombo', role: 'Responsabile Amministrativa', type: 'Indeterminato (CCNL Commercio)', regime: 'Residente IT', pension: 'INPS Fondo Generale / TFR', status: 'LUL Zucchetti OK' },
  ];
}
