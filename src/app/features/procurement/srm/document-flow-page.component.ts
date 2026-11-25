import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { DOCUMENT_FLOW_ENTRY_TYPES, DocumentFlowEntryType } from '@domain/procurement/srm.models';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { DocumentFlowPanelComponent } from './document-flow-panel.component';

/** Full-page document flow of `/procurement/document-flow/:type/:id`. */
@Component({
  selector: 'app-document-flow-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DocumentFlowPanelComponent,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzCardModule,
  ],
  template: `
    <app-page-header
      [title]="'srm.flow.title' | translate"
      [subtitle]="'srm.flow.subtitle' | translate"
    />
    @if (type(); as entryType) {
      <nz-card>
        <app-document-flow-panel [type]="entryType" [documentId]="id()" />
      </nz-card>
    } @else {
      <nz-alert nzType="warning" nzShowIcon [nzMessage]="'srm.flow.unsupportedType' | translate" />
    }
  `,
})
export class DocumentFlowPageComponent {
  private readonly params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

  protected readonly type = computed<DocumentFlowEntryType | null>(() => {
    const value = this.params().get('type');
    return DOCUMENT_FLOW_ENTRY_TYPES.find((entry) => entry === value) ?? null;
  });
  protected readonly id = computed(() => this.params().get('id') ?? '');
}
