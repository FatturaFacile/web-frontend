import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-rent',
  imports: [NzCardModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  templateUrl: './rent.component.html',
})
export class RentComponent {
  readonly vehicles = [
    {
      plate: 'TI 982104',
      model: 'BMW 320d xDrive Touring',
      type: 'Breve Termine (15 gg)',
      client: 'Alpine Precision AG',
      vignette: true,
      returnDate: '2026-10-28',
      status: 'In Noleggio',
    },
    {
      plate: 'FP 412 ZB',
      model: 'Fiat Ducato Maxi 2.2 Multijet',
      type: 'Lungo Termine (24 mesi)',
      client: 'Rossi Impianti S.r.l.',
      vignette: true,
      returnDate: '2027-05-15',
      status: 'Assegnato',
    },
  ];
}
