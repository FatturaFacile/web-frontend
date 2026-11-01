import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-manufacturing',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  templateUrl: './manufacturing.component.html',
})
export class ManufacturingComponent {
  readonly orders = [
    {
      num: 'ODP-2026-310',
      product: 'Sensore IoT IP67 v2',
      qty: '500 Pz',
      line: 'Centro CNC Chiasso',
      progress: '75%',
      qa: 'Certificato CE / CH Conforme',
    },
    {
      num: 'ODP-2026-311',
      product: 'Quadro elettrico modulare',
      qty: '25 Pz',
      line: 'Reparto Cablaggio Como',
      progress: '40%',
      qa: 'In collaudo OIBT',
    },
  ];
}
