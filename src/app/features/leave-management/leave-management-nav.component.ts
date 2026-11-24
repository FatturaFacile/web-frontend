import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';

export type LeaveMgmtTab = 'gantt' | 'ledgers' | 'requests' | 'comporto' | 'holidays' | 'policies';

/** Shared navigation tabs bar across Mod 074 Leave, Permits & Absences Management views. */
@Component({
  selector: 'app-leave-management-nav',
  imports: [RouterLink, NzButtonModule, TranslatePipe],
  template: `
    <nav class="mb-4 flex flex-wrap gap-2" aria-label="Mod 074 Navigation">
      <a
        nz-button
        routerLink="/leave-management/gantt"
        [nzType]="activeTab() === 'gantt' ? 'primary' : 'default'"
      >
        {{ 'leaveMgmt.tab.gantt' | translate }}
      </a>
      <a
        nz-button
        routerLink="/leave-management/ledgers"
        [nzType]="activeTab() === 'ledgers' ? 'primary' : 'default'"
      >
        {{ 'leaveMgmt.tab.ledgers' | translate }}
      </a>
      <a
        nz-button
        routerLink="/leave-management/requests"
        [nzType]="activeTab() === 'requests' ? 'primary' : 'default'"
      >
        {{ 'leaveMgmt.tab.requests' | translate }}
      </a>
      <a
        nz-button
        routerLink="/leave-management/comporto"
        [nzType]="activeTab() === 'comporto' ? 'primary' : 'default'"
      >
        {{ 'leaveMgmt.tab.comporto' | translate }}
      </a>
      <a
        nz-button
        routerLink="/leave-management/holidays"
        [nzType]="activeTab() === 'holidays' ? 'primary' : 'default'"
      >
        {{ 'leaveMgmt.tab.holidays' | translate }}
      </a>
      <a
        nz-button
        routerLink="/leave-management/policies"
        [nzType]="activeTab() === 'policies' ? 'primary' : 'default'"
      >
        {{ 'leaveMgmt.tab.policies' | translate }}
      </a>
    </nav>
  `,
})
export class LeaveManagementNavComponent {
  readonly activeTab = input<LeaveMgmtTab>('gantt');
}
