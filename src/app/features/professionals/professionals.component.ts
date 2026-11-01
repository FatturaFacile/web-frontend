import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-professionals',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  templateUrl: './professionals.component.html',
})
export class ProfessionalsComponent {
  readonly cases = [
    {
      num: 'FASC-2026-08',
      client: 'Alpine Precision AG',
      subject: 'Consulenza fiscale cross-border IT-CH',
      hours: '14.5 h',
      fee: 'CHF 4.350 (No ritenuta)',
    },
    {
      num: 'FASC-2026-11',
      client: 'Lombarda Manifatture',
      subject: 'Parere societario e compliance D.Lgs. 231',
      hours: '22.0 h',
      fee: '€ 5.500 (+ 4% CPA - 20% Rit.)',
    },
  ];
}
