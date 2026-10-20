import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent } from '@shared';

@Component({
  selector: 'app-accounting',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent],
  template: `
    <app-page-header
      title="Contabilità Generale & Fiscale Dual-Ledger"
      subtitle="Piano dei conti italiano CEE e svizzero KMU / PME, liquidazione IVA periodica, Esterometro e rendiconto AFC / ESTV"
    />

    <nz-card nzTitle="Piano dei Conti & Raccordi Fisc">
      <nz-table #accTable [nzData]="accounts" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>Codice Conto</th>
            <th>Descrizione Conto</th>
            <th>Standard Contabile</th>
            <th>Saldo Corrente</th>
            <th>Mappatura IVA Fiscale</th>
          </tr>
        </thead>
        <tbody>
          @for (a of accTable.data; track a.code) {
            <tr>
              <td><code>{{ a.code }}</code></td>
              <td><strong>{{ a.desc }}</strong></td>
              <td>
                <nz-tag [nzColor]="a.std === 'KMU / PME (CH)' ? 'red' : 'blue'">{{ a.std }}</nz-tag>
              </td>
              <td><strong>{{ a.balance }}</strong></td>
              <td>{{ a.tax }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class AccountingComponent {
  readonly accounts = [
    { code: '1020', desc: 'Banca UBS Svizzera c/c', std: 'KMU / PME (CH)', balance: 'CHF 218.450,00', tax: 'Esente / Operazione finanziaria' },
    { code: '3200', desc: 'Ricavi da prestazioni servizi IT', std: 'KMU / PME (CH)', balance: 'CHF 184.200,00', tax: 'Cod. 200 (IVA 8.1% CH)' },
    { code: '01.01.05', desc: 'Banca Intesa c/c ordinario', std: 'Piano CEE (IT)', balance: '€ 145.200,00', tax: 'Esente Art. 10 DPR 633' },
    { code: '05.01.01', desc: 'Merci c/vendite Italia', std: 'Piano CEE (IT)', balance: '€ 142.850,00', tax: 'Aliquota Ordinaria 22%' },
  ];
}
