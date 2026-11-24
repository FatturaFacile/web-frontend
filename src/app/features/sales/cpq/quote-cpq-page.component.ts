import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { TranslatePipe } from '@shared';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { CpqApprovalPanelComponent } from './approval-panel.component';
import { CpqMarginSimulatorComponent } from './margin-simulator.component';
import { CpqPdfPreviewComponent } from './pdf-preview.component';
import { CpqRevisionDiffComponent } from './revision-diff.component';
import { CpqSignatureLinkComponent } from './signature-link.component';

/** Technical and commercial quoting of one quote: margin and simulator, revisions, approval, PDF preview and signature. */
@Component({
  selector: 'app-quote-cpq-page',
  imports: [
    NzTabsModule,
    TranslatePipe,
    CpqApprovalPanelComponent,
    CpqMarginSimulatorComponent,
    CpqPdfPreviewComponent,
    CpqRevisionDiffComponent,
    CpqSignatureLinkComponent,
  ],
  template: `
    <h2>{{ 'CPQ.BUILDER.TITLE' | translate }}</h2>
    @if (quoteId(); as id) {
      <app-cpq-approval-panel [quoteId]="id" />
      <nz-tabs>
        <nz-tab [nzTitle]="'CPQ.MARGIN.TITLE' | translate">
          <ng-template nz-tab>
            <app-cpq-margin-simulator [quoteId]="id" />
          </ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'CPQ.REVISIONS.TITLE' | translate">
          <ng-template nz-tab>
            <app-cpq-revision-diff [quoteId]="id" />
          </ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'CPQ.PREVIEW.TITLE' | translate">
          <ng-template nz-tab>
            <app-cpq-pdf-preview [quoteId]="id" />
          </ng-template>
        </nz-tab>
        <nz-tab [nzTitle]="'CPQ.SIGN.TITLE' | translate">
          <ng-template nz-tab>
            <app-cpq-signature-link [quoteId]="id" />
          </ng-template>
        </nz-tab>
      </nz-tabs>
    }
  `,
})
export class QuoteCpqPageComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly params = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), { initialValue: null });
  protected readonly quoteId = computed(() => this.params());
}
