import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-retail',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  templateUrl: './retail.component.html',
})
export class RetailComponent {
  readonly sessions = [
    {
      pos: 'Cassa 01 - Lugano Centro',
      cashier: 'Sara Riva',
      regime: 'CH',
      total: "2'450.00 CHF",
      device: 'Twint QR & Terminale SumUp',
      status: 'Trasmesso',
    },
    {
      pos: 'Cassa 02 - Milano Showroom',
      cashier: 'Marco Rossi',
      regime: 'IT',
      total: '€ 1.820,00',
      device: 'Registratore Telematico RT Epson',
      status: 'Chiusura Z inviata ADE',
    },
  ];
}
