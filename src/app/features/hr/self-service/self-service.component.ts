import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { HrSelfServiceApiService, SelfServiceProfile } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { SsDocumentsComponent } from './ss-documents.component';
import { SsLeaveComponent } from './ss-leave.component';
import { SsProfileComponent } from './ss-profile.component';
import { SsTrainingComponent } from './ss-training.component';

/** Employee portal: needs no HR module access, only an employee linked to the user (403 otherwise). */
@Component({
  selector: 'app-hr-self-service',
  styleUrl: './self-service.component.scss',
  imports: [
    NzCardModule,
    NzResultModule,
    NzSkeletonModule,
    NzTabsModule,
    PageHeaderComponent,
    TranslatePipe,
    SsProfileComponent,
    SsLeaveComponent,
    SsTrainingComponent,
    SsDocumentsComponent,
  ],
  template: `
    <app-page-header
      [title]="'hrmSelfService.title' | translate"
      [subtitle]="'hrmSelfService.subtitle' | translate"
    />
    @if (loading()) {
      <nz-card><nz-skeleton [nzActive]="true" /></nz-card>
    } @else if (notLinked()) {
      <nz-card>
        <nz-result
          nzStatus="403"
          [nzTitle]="'hrmSelfService.notLinkedTitle' | translate"
          [nzSubTitle]="'hrmSelfService.notLinkedText' | translate"
        />
      </nz-card>
    } @else if (failed()) {
      <nz-card>
        <nz-result
          nzStatus="error"
          [nzTitle]="'hrmCommon.loadFailed' | translate"
        />
      </nz-card>
    } @else if (profile(); as me) {
      <nz-card>
        <nz-tabs>
          <nz-tab [nzTitle]="'hrmSelfService.tabProfile' | translate">
            <app-ss-profile [profile]="me" />
          </nz-tab>
          <nz-tab [nzTitle]="'hrmSelfService.tabLeave' | translate">
            <app-ss-leave />
          </nz-tab>
          <nz-tab [nzTitle]="'hrmSelfService.tabTraining' | translate">
            <app-ss-training />
          </nz-tab>
          <nz-tab [nzTitle]="'hrmSelfService.tabDocuments' | translate">
            <app-ss-documents />
          </nz-tab>
        </nz-tabs>
      </nz-card>
    }
  `,
})
export class SelfServiceComponent implements OnInit {
  private readonly api = inject(HrSelfServiceApiService);

  protected readonly profile = signal<SelfServiceProfile | null>(null);
  protected readonly loading = signal(true);
  protected readonly notLinked = signal(false);
  protected readonly failed = signal(false);

  ngOnInit(): void {
    this.api.getProfile().subscribe({
      next: (res) => {
        this.profile.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.notLinked.set(err instanceof HttpErrorResponse && err.status === 403);
        this.failed.set(!this.notLinked());
        this.loading.set(false);
      },
    });
  }
}
