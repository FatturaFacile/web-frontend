import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { SimulatorPanelComponent } from './simulator-panel.component';

/** Tiered bracket simulator on its own page: try brackets and volumes before they go into a contract. */
@Component({
  selector: 'app-gdt-simulator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzCardModule, PageHeaderComponent, SimulatorPanelComponent, TranslatePipe],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.GDO_TRADE_TERMS_SIMULATOR' | translate"></app-page-header>
    <nz-card class="main-card">
      <app-gdt-simulator-panel></app-gdt-simulator-panel>
    </nz-card>
  `,
})
export class SimulatorComponent {}
