import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-construction',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  templateUrl: './construction.component.html',
})
export class ConstructionComponent {
  readonly sites = [
    {
      code: 'CANT-2026-TI',
      client: 'Residenza Monte Brè',
      location: 'Lugano',
      regime: 'CH',
      sal: '65% (CHF 320.000)',
      norm: 'SIA 118 / OIBT',
      vatRegime: 'IVA 8.1% (CH)',
    },
    {
      code: 'CANT-2026-MI',
      client: 'Condominio San Babila',
      location: 'Milano',
      regime: 'IT',
      sal: '40% (€ 180.000)',
      norm: 'DiCo DM 37/08',
      vatRegime: 'Reverse Charge Art. 17',
    },
  ];
}
