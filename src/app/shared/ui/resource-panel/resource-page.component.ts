import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { ResourcePanelComponent } from './resource-panel.component';
import { ResourcePageConfig } from './resource-panel.types';

/**
 * Route host of a `ResourcePageConfig` (route `data: { page }`): a page header and one tab per panel.
 */
@Component({
  selector: 'app-resource-page',
  imports: [NzTabsModule, PageHeaderComponent, ResourcePanelComponent, TranslatePipe],
  template: `
    <app-page-header [title]="page().titleKey | translate" />
    <nz-tabs>
      @for (tab of page().tabs; track tab.id) {
        <nz-tab [nzTitle]="tab.titleKey | translate">
          <ng-template nz-tab>
            <app-resource-panel [config]="tab" />
          </ng-template>
        </nz-tab>
      }
    </nz-tabs>
  `,
})
export class ResourcePageComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly page = computed<ResourcePageConfig>(() => this.route.snapshot.data['page'] as ResourcePageConfig);
}
