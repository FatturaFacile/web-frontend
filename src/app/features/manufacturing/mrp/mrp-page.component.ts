import { Component, inject, OnInit } from '@angular/core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { MrpGanttComponent } from './mrp-gantt.component';
import { MrpPeggingDrawerComponent } from './mrp-pegging-drawer.component';
import { MrpRunBarComponent } from './mrp-run-bar.component';
import { MrpWorkbenchComponent } from './mrp-workbench.component';
import { MrpStore } from './mrp.store';

/**
 * MRP I & II workspace (`/manufacturing/mrp`): the run bar with the KPIs, the proposals workbench with the pegging explorer and
 * the finite-capacity Gantt. The store is provided here and shared by the child components.
 */
@Component({
  selector: 'app-mrp-page',
  providers: [MrpStore],
  imports: [
    PageHeaderComponent,
    TranslatePipe,
    NzTabsModule,
    MrpGanttComponent,
    MrpPeggingDrawerComponent,
    MrpRunBarComponent,
    MrpWorkbenchComponent,
  ],
  template: `
    <app-page-header
      [title]="'MRP.TITLE' | translate"
      [subtitle]="'MRP.SUBTITLE' | translate"
    ></app-page-header>

    <app-mrp-run-bar (refresh)="refresh()"></app-mrp-run-bar>

    <nz-tabs nzSize="small">
      <nz-tab [nzTitle]="'MRP.TAB_PROPOSALS' | translate">
        <ng-template nz-tab>
          <app-mrp-workbench
            (pegging)="openPegging($event)"
            (changed)="reloadKpis()"
          ></app-mrp-workbench>
        </ng-template>
      </nz-tab>
      <nz-tab [nzTitle]="'MRP.TAB_CAPACITY' | translate">
        <ng-template nz-tab>
          <app-mrp-gantt (changed)="refresh()"></app-mrp-gantt>
        </ng-template>
      </nz-tab>
    </nz-tabs>

    <app-mrp-pegging-drawer></app-mrp-pegging-drawer>
  `,
})
export class MrpPageComponent implements OnInit {
  protected readonly store = inject(MrpStore);

  ngOnInit(): void {
    this.store.loadRuns().subscribe((runs) => {
      const latest = runs?.find((run) => run.status === 'Completed') ?? runs?.[0];

      if (latest) {
        this.store.selectRun(latest.id);
        this.refresh();
      }
    });
  }

  /** Reloads the KPIs and the proposals of the selected run. */
  protected refresh(): void {
    this.reloadKpis();
    this.store.loadProposals().subscribe();
  }

  protected reloadKpis(): void {
    this.store.loadDetail().subscribe();
  }

  protected openPegging(proposal: Parameters<MrpStore['openPegging']>[0]): void {
    this.store.openPegging(proposal).subscribe();
  }
}
