import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-field-service',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  templateUrl: './field-service.component.html',
})
export class FieldServiceComponent {
  readonly tickets = [
    {
      id: 'TKT-1042',
      client: 'Bernasconi SA (Lugano)',
      subject: 'Guasto linea produzione CNC',
      technician: 'Davide Nava',
      sla: '1h 15m',
      status: 'In Intervento',
      color: 'processing',
    },
    {
      id: 'TKT-1043',
      client: 'Lombarda Manifatture (Como)',
      subject: 'Configurazione gateway telemetria',
      technician: 'Matteo Riva',
      sla: '4h 00m',
      status: 'Pianificato',
      color: 'blue',
    },
  ];
}
