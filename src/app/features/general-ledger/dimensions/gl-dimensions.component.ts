import { Component } from '@angular/core';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { TranslatePipe } from '@shared';
import { GlDimensionTableComponent } from './gl-dimension-table.component';

@Component({
  selector: 'app-gl-dimensions',
  imports: [NzCardModule, NzTabsModule, GlDimensionTableComponent, TranslatePipe],
  template: `
    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'GL.COST_CENTERS' | translate">
          <app-gl-dimension-table [kind]="'cost'" />
        </nz-tab>
        <nz-tab [nzTitle]="'GL.PROFIT_CENTERS' | translate">
          <app-gl-dimension-table [kind]="'profit'" />
        </nz-tab>
      </nz-tabs>
    </nz-card>
  `,
})
export class GlDimensionsComponent {}
