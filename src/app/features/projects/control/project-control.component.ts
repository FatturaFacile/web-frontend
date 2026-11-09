import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { map } from 'rxjs';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { PcAnalysisComponent } from './pc-analysis.component';
import { PcBillingComponent } from './pc-billing.component';
import { PcBudgetComponent } from './pc-budget.component';
import { PcChangeOrdersComponent } from './pc-change-orders.component';
import { PcCostsComponent } from './pc-costs.component';
import { PcMilestonesComponent } from './pc-milestones.component';

@Component({
  selector: 'app-project-control',
  imports: [
    NzTabsModule,
    RouterLink,
    PageHeaderComponent,
    TranslatePipe,
    PcAnalysisComponent,
    PcBillingComponent,
    PcBudgetComponent,
    PcChangeOrdersComponent,
    PcCostsComponent,
    PcMilestonesComponent,
  ],
  template: `
    <app-page-header [title]="'PRJ.CONTROL_TITLE' | translate" [subtitle]="'PRJ.CONTROL_SUBTITLE' | translate" />
    <p><a routerLink="/projects">{{ 'PRJ.BACK_TO_PROJECTS' | translate }}</a></p>
    @if (projectId(); as id) {
      <nz-tabs nzLazy>
        <nz-tab [nzTitle]="'PRJ.TAB_BUDGET' | translate"><app-pc-budget [projectId]="id" /></nz-tab>
        <nz-tab [nzTitle]="'PRJ.TAB_MILESTONES' | translate"><app-pc-milestones [projectId]="id" /></nz-tab>
        <nz-tab [nzTitle]="'PRJ.TAB_CHANGE_ORDERS' | translate"><app-pc-change-orders [projectId]="id" /></nz-tab>
        <nz-tab [nzTitle]="'PRJ.TAB_COSTS' | translate"><app-pc-costs [projectId]="id" /></nz-tab>
        <nz-tab [nzTitle]="'PRJ.TAB_BILLING' | translate"><app-pc-billing [projectId]="id" /></nz-tab>
        <nz-tab [nzTitle]="'PRJ.TAB_ANALYSIS' | translate"><app-pc-analysis [projectId]="id" /></nz-tab>
      </nz-tabs>
    }
  `,
})
export class ProjectControlComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), { initialValue: null });
  protected readonly projectId = computed(() => this.params());
}
