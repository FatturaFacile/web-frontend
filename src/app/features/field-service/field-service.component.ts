import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-field-service',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header
      [title]="'FIELD_SERVICE.TITLE' | translate"
      [subtitle]="'FIELD_SERVICE.SUBTITLE' | translate"
    />

    <nz-card [nzTitle]="'FIELD_SERVICE.CARD_TITLE' | translate">
      <nz-table #tkTable [nzData]="tickets" [nzFrontPagination]="false" nzSize="middle">
        <thead>
          <tr>
            <th>{{ 'FIELD_SERVICE.COL_TICKET_ID' | translate }}</th>
            <th>{{ 'FIELD_SERVICE.COL_CLIENT' | translate }}</th>
            <th>{{ 'FIELD_SERVICE.COL_SUBJECT' | translate }}</th>
            <th>{{ 'FIELD_SERVICE.COL_TECH' | translate }}</th>
            <th>{{ 'FIELD_SERVICE.COL_SLA' | translate }}</th>
            <th>{{ 'COMMON.STATUS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (tk of tkTable.data; track tk.id) {
            <tr>
              <td><strong>{{ tk.id }}</strong></td>
              <td>{{ tk.client }}</td>
              <td>{{ tk.subject }}</td>
              <td>{{ tk.technician }}</td>
              <td><code>{{ tk.sla }}</code></td>
              <td>
                <nz-tag [nzColor]="tk.color">{{ tk.status }}</nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class FieldServiceComponent {
  readonly tickets = [
    { id: 'TKT-1042', client: 'Bernasconi SA (Lugano)', subject: 'Guasto linea produzione CNC', technician: 'Davide Nava', sla: '1h 15m', status: 'In Intervento', color: 'processing' },
    { id: 'TKT-1043', client: 'Lombarda Manifatture (Como)', subject: 'Configurazione gateway telemetria', technician: 'Matteo Riva', sla: '4h 00m', status: 'Pianificato', color: 'blue' },
  ];
}
