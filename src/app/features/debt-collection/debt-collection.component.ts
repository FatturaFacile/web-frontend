import { Component, inject, OnInit, signal } from '@angular/core';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { DcBatchesComponent } from './dc-batches.component';
import { DcDashboardComponent } from './dc-dashboard.component';
import { DcExclusionsComponent } from './dc-exclusions.component';
import { DcLegalComponent } from './dc-legal.component';
import { DcNoticesComponent } from './dc-notices.component';
import { DcProposalsComponent } from './dc-proposals.component';
import { DcSettingsComponent } from './dc-settings.component';
import { DcLookupsStore } from './lookups.store';
import { WorkbenchStore } from './workbench.store';

/** Tabs of the workbench, in display order. */
export const DEBT_COLLECTION_TABS = [
  'dashboard',
  'proposals',
  'notices',
  'batches',
  'legal',
  'exclusions',
  'settings',
] as const;
export type DebtCollectionTab = (typeof DEBT_COLLECTION_TABS)[number];

/**
 * Dunning and debt collection workbench (Mod 014): KPIs, the proposal queue with the notice generation, the notices
 * and their PEC receipts, the dispatch batches, the legal escalation (Betreibung, messa in mora), the exclusions and
 * payment plans, and the settings. Each tab is rendered the first time it opens.
 */
@Component({
  selector: 'app-debt-collection',
  imports: [
    PageHeaderComponent,
    TranslatePipe,
    NzTabsModule,
    DcBatchesComponent,
    DcDashboardComponent,
    DcExclusionsComponent,
    DcLegalComponent,
    DcNoticesComponent,
    DcProposalsComponent,
    DcSettingsComponent,
  ],
  providers: [WorkbenchStore],
  template: `
    <app-page-header
      [title]="'debtCollection.title' | translate"
      [subtitle]="'debtCollection.subtitle' | translate"
    />

    <nz-tabs
      [nzSelectedIndex]="selectedIndex()"
      (nzSelectedIndexChange)="selectedIndex.set($event)"
    >
      @for (tab of tabs; track tab) {
        <nz-tab [nzTitle]="'debtCollection.tab.' + tab | translate">
          <ng-template nz-tab>
            @switch (tab) {
              @case ('dashboard') {
                <app-dc-dashboard />
              }
              @case ('proposals') {
                <app-dc-proposals />
              }
              @case ('notices') {
                <app-dc-notices />
              }
              @case ('batches') {
                <app-dc-batches />
              }
              @case ('legal') {
                <app-dc-legal />
              }
              @case ('exclusions') {
                <app-dc-exclusions />
              }
              @case ('settings') {
                <app-dc-settings />
              }
            }
          </ng-template>
        </nz-tab>
      }
    </nz-tabs>
  `,
})
export class DebtCollectionComponent implements OnInit {
  private readonly lookups = inject(DcLookupsStore);

  protected readonly tabs = DEBT_COLLECTION_TABS;
  protected readonly selectedIndex = signal(0);

  ngOnInit(): void {
    void this.lookups.ensureLoaded();
  }
}
