import { Component, computed, input } from '@angular/core';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { ResourcePanelComponent, TranslatePipe } from '@shared';
import { PROJECT_TOOL_PANELS } from './pc-tools.page';

/** Billing events, forecast, EVM, audit trail, direct costs and schedule links of one project. */
@Component({
  selector: 'app-pc-tools',
  imports: [NzTabsModule, ResourcePanelComponent, TranslatePipe],
  template: `
    <nz-tabs nzSize="small">
      @for (panel of panels; track panel.id) {
        <nz-tab [nzTitle]="panel.titleKey | translate">
          <ng-template nz-tab>
            <app-resource-panel [config]="panel" [context]="context()" />
          </ng-template>
        </nz-tab>
      }
    </nz-tabs>
  `,
})
export class PcToolsComponent {
  readonly projectId = input.required<string>();

  protected readonly panels = PROJECT_TOOL_PANELS;
  protected readonly context = computed(() => ({ project_id: this.projectId() }));
}
