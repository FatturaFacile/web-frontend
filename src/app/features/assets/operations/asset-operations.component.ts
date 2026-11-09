import { Component } from '@angular/core';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { EaLocationsClassesComponent } from './ea-locations-classes.component';
import { EaMaintenanceComponent } from './ea-maintenance.component';
import { EaRegisterComponent } from './ea-register.component';

@Component({
  selector: 'app-asset-operations',
  imports: [NzTabsModule, PageHeaderComponent, TranslatePipe, EaMaintenanceComponent, EaLocationsClassesComponent, EaRegisterComponent],
  template: `
    <app-page-header [title]="'EA.TITLE' | translate" [subtitle]="'EA.SUBTITLE' | translate" />
    <nz-tabs nzLazy>
      <nz-tab [nzTitle]="'EA.MAINTENANCE' | translate"><app-ea-maintenance /></nz-tab>
      <nz-tab [nzTitle]="'EA.LOCATIONS_CLASSES' | translate"><app-ea-locations-classes /></nz-tab>
      <nz-tab [nzTitle]="'EA.REPORTS' | translate"><app-ea-register /></nz-tab>
    </nz-tabs>
  `,
})
export class AssetOperationsComponent {}
