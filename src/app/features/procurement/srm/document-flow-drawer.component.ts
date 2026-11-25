import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { DocumentFlowEntryType } from '@domain/procurement/srm.models';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { DocumentFlowPanelComponent } from './document-flow-panel.component';

/** Button that opens the procure-to-pay document flow (audit trail) of a document in a side drawer. */
@Component({
  selector: 'app-document-flow-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DocumentFlowPanelComponent,
    TranslatePipe,
    NzButtonModule,
    NzDrawerModule,
    NzIconModule,
  ],
  template: `
    <button nz-button type="button" (click)="open.set(true)" data-testid="document-flow-open">
      <span nz-icon nzType="apartment" aria-hidden="true"></span>
      {{ 'srm.flow.open' | translate }}
    </button>
    <nz-drawer
      [nzVisible]="open()"
      [nzTitle]="'srm.flow.title' | translate"
      [nzWidth]="560"
      (nzOnClose)="open.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (open()) {
          <app-document-flow-panel [type]="type()" [documentId]="documentId()" />
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class DocumentFlowDrawerComponent {
  readonly type = input.required<DocumentFlowEntryType>();
  readonly documentId = input.required<string>();

  protected readonly open = signal(false);
}
