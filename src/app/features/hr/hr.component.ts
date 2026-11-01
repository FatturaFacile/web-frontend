import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-hr',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  templateUrl: './hr.component.html',
})
export class HrComponent {
  readonly employees = [
    {
      name: 'Matteo Bianchi',
      role: 'Software Engineer',
      type: 'Indeterminato (42h/sett.)',
      regime: 'Frontaliere CH (Accordo 2024)',
      pension: 'AVS / AI / LPP 2° Pilastro (AXA)',
      status: 'Swissdec ELM OK',
    },
    {
      name: 'Laura Colombo',
      role: 'Responsabile Amministrativa',
      type: 'Indeterminato (CCNL Commercio)',
      regime: 'Residente IT',
      pension: 'INPS Fondo Generale / TFR',
      status: 'LUL Zucchetti OK',
    },
  ];
}
