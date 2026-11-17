import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { AtsApplicationDrawerComponent } from './ats-application-drawer.component';
import { AtsApplicationsComponent } from './ats-applications.component';
import { AtsBoardComponent } from './ats-board.component';
import { AtsOpeningsComponent } from './ats-openings.component';
import { AtsSettingsComponent } from './ats-settings.component';

/** Recruiting ATS: job openings, Kanban board, applications (CV, scorecards, offers, hire) and settings. */
@Component({
  selector: 'app-hr-recruiting-ats',
  imports: [
    NzCardModule,
    NzTabsModule,
    PageHeaderComponent,
    TranslatePipe,
    AtsOpeningsComponent,
    AtsBoardComponent,
    AtsApplicationsComponent,
    AtsSettingsComponent,
    AtsApplicationDrawerComponent,
  ],
  template: `
    <app-page-header [title]="'hrmAts.title' | translate" [subtitle]="'hrmAts.subtitle' | translate" />
    <nz-card>
      <nz-tabs [(nzSelectedIndex)]="tab">
        <nz-tab [nzTitle]="'hrmAts.openings' | translate">
          <app-ats-openings [canWrite]="canWrite()" (board)="showBoard($event)" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmAts.board' | translate">
          <app-ats-board [selected]="boardOpening()" (open)="applicationId.set($event)" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmRecruiting.applications' | translate">
          <app-ats-applications [canWrite]="canWrite()" (open)="applicationId.set($event)" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmRecruiting.settings' | translate">
          <app-ats-settings [canWrite]="canWrite()" />
        </nz-tab>
      </nz-tabs>
    </nz-card>
    <app-ats-application-drawer
      [applicationId]="applicationId()"
      [canWrite]="canWrite()"
      (closed)="applicationId.set(null)"
      (changed)="reload()"
    />
  `,
})
export class RecruitingAtsComponent {
  private readonly permissions = inject(PermissionsService);
  private readonly board = viewChild(AtsBoardComponent);
  private readonly applications = viewChild(AtsApplicationsComponent);

  protected readonly canWrite = computed(() => this.permissions.canWrite('hr'));
  protected readonly tab = signal(0);
  protected readonly boardOpening = signal<string | null>(null);
  protected readonly applicationId = signal<string | null>(null);

  protected showBoard(openingId: string): void {
    this.boardOpening.set(openingId);
    this.tab.set(1);
  }

  protected reload(): void {
    this.board()?.load();
    this.applications()?.load();
  }
}
