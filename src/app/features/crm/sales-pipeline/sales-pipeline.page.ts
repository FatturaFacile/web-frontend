import { Component, signal } from '@angular/core';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { SalesBoardComponent } from './sales-board.component';
import { SalesForecastComponent } from './sales-forecast.component';
import { SalesPipelineSettingsComponent } from './sales-pipeline-settings.component';

/** Sales pipeline workspace: Kanban board, forecast and quota dashboard, and the pipeline configuration. */
@Component({
  selector: 'app-sales-pipeline-page',
  imports: [
    NzTabsModule,
    PageHeaderComponent,
    TranslatePipe,
    SalesBoardComponent,
    SalesForecastComponent,
    SalesPipelineSettingsComponent,
  ],
  template: `
    <app-page-header
      [title]="'SALESPIPE.TITLE' | translate"
      [subtitle]="'SALESPIPE.SUBTITLE' | translate"
    />
    <nz-tabs [nzSelectedIndex]="tab()" (nzSelectedIndexChange)="tab.set($event)" nzLazy>
      <nz-tab [nzTitle]="'SALESPIPE.TAB_BOARD' | translate">
        <ng-template nz-tab>
          <app-sales-board />
        </ng-template>
      </nz-tab>
      <nz-tab [nzTitle]="'SALESPIPE.TAB_FORECAST' | translate">
        <ng-template nz-tab>
          <app-sales-forecast />
        </ng-template>
      </nz-tab>
      <nz-tab [nzTitle]="'SALESPIPE.TAB_SETTINGS' | translate">
        <ng-template nz-tab>
          <app-sales-pipeline-settings />
        </ng-template>
      </nz-tab>
    </nz-tabs>
  `,
})
export class SalesPipelinePageComponent {
  readonly tab = signal(0);
}
