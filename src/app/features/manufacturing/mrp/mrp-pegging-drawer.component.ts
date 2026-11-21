import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@shared';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzFormatEmitEvent, NzTreeModule } from 'ng-zorro-antd/tree';
import { buildPeggingTree, PeggingNodeDetail, rootDemandNodes } from './mrp-pegging.utils';
import { MrpStore } from './mrp.store';
import {
  formatQuantity,
  PROPOSAL_STATUS_COLORS,
  PROPOSAL_STATUS_KEYS,
  PROPOSAL_TYPE_COLORS,
  PROPOSAL_TYPE_KEYS,
  SOURCE_TYPE_KEYS,
} from './mrp.utils';

/**
 * Pegging explorer: a drawer with the tree of one proposal (upstream to the root demands, downstream to the components it
 * generates) and an inspector for the selected node that names the root demand per source (sales order, MPS, safety stock).
 */
@Component({
  selector: 'app-mrp-pegging-drawer',
  imports: [TranslatePipe, NzDrawerModule, NzEmptyModule, NzSpinModule, NzTagModule, NzTreeModule],
  styles: `
    .inspector { margin-top: 16px; padding: 12px; border: 1px solid var(--ant-border-color-split, #f0f0f0); border-radius: 6px }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0 }
    dt { color: var(--ant-text-color-secondary, rgba(0, 0, 0, 0.45)) }
    dd { margin: 0 }
    .roots { margin: 16px 0 0; padding-left: 20px }
    .qty { font-variant-numeric: tabular-nums }
    .node-info { margin-left: 6px }
  `,
  template: `
    <nz-drawer
      nzPlacement="right"
      [nzWidth]="720"
      [nzVisible]="store.peggingProposal() !== null"
      [nzTitle]="'MRP.PEGGING_TITLE' | translate"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        <nz-spin [nzSpinning]="store.peggingLoading()">
          @if (tree(); as tree) {
            <div data-testid="pegging-tree">
              <nz-tree
                nzBlockNode
                nzShowLine
                nzExpandAll
                [nzData]="tree.nodes"
                [nzTreeTemplate]="nodeTemplate"
                (nzClick)="select($event)"
              ></nz-tree>
            </div>

            <ng-template #nodeTemplate let-node let-origin="origin">
              @let detail = origin.detail;
              <span [attr.data-testid]="'node-' + detail.key">
                @switch (detail.direction) {
                  @case ('group') {
                    <strong>{{ (detail.key === 'group-upstream' ? 'MRP.PEGGING_UPSTREAM' : 'MRP.PEGGING_DOWNSTREAM') | translate }}</strong>
                  }
                  @default {
                    @if (detail.isRootDemand) {
                      <nz-tag nzColor="gold" data-testid="root-demand">{{ sourceKeys[detail.sourceType] | translate }}</nz-tag>
                      <span class="qty">{{ qty(detail.quantity) }}</span>
                    } @else {
                      <nz-tag [nzColor]="typeColors[detail.proposalType]">{{ typeKeys[detail.proposalType] | translate }}</nz-tag>
                      <strong>{{ detail.itemCode }}</strong>
                      <span class="qty node-info">{{ qty(detail.quantity) }}</span>
                    }
                  }
                }
              </span>
            </ng-template>

            @if (detail(); as detail) {
              <div class="inspector" data-testid="pegging-inspector">
                <h4>{{ 'MRP.INSPECTOR_TITLE' | translate }}</h4>
                <dl>
                  @if (detail.proposalType) {
                    <dt>{{ 'MRP.COL_TYPE' | translate }}</dt>
                    <dd><nz-tag [nzColor]="typeColors[detail.proposalType]">{{ typeKeys[detail.proposalType] | translate }}</nz-tag></dd>
                  }
                  @if (detail.proposalStatus) {
                    <dt>{{ 'MRP.COL_STATUS' | translate }}</dt>
                    <dd><nz-tag [nzColor]="statusColors[detail.proposalStatus]">{{ statusKeys[detail.proposalStatus] | translate }}</nz-tag></dd>
                  }
                  @if (detail.itemCode) {
                    <dt>{{ 'MRP.COL_ITEM' | translate }}</dt>
                    <dd data-testid="inspector-item">{{ detail.itemCode }} · {{ detail.itemName }}</dd>
                  }
                  <dt>{{ 'MRP.INSPECTOR_QUANTITY' | translate }}</dt>
                  <dd class="qty" data-testid="inspector-quantity">{{ qty(detail.quantity) }}</dd>
                  @if (detail.needByDate) {
                    <dt>{{ 'MRP.COL_NEED_BY' | translate }}</dt>
                    <dd>{{ detail.needByDate }}</dd>
                  }
                  @if (detail.sourceType) {
                    <dt>{{ 'MRP.INSPECTOR_SOURCE' | translate }}</dt>
                    <dd data-testid="inspector-source">{{ sourceKeys[detail.sourceType] | translate }}</dd>
                    <dt>{{ 'MRP.INSPECTOR_SOURCE_ID' | translate }}</dt>
                    <dd>{{ detail.sourceId }}</dd>
                  }
                </dl>
              </div>
            }

            <h4 class="roots-title">{{ 'MRP.PEGGING_ROOT_DEMANDS' | translate }}</h4>
            @if (roots().length === 0) {
              <nz-empty [nzNotFoundContent]="'MRP.PEGGING_NO_ROOTS' | translate"></nz-empty>
            } @else {
              <ul class="roots" data-testid="root-demands">
                @for (root of roots(); track root.key) {
                  <li>
                    <nz-tag nzColor="gold">{{ sourceKeys[root.sourceType ?? 'mrp_proposal'] | translate }}</nz-tag>
                    <span class="qty">{{ qty(root.quantity) }}</span>
                  </li>
                }
              </ul>
            }
          } @else if (!store.peggingLoading()) {
            <nz-empty [nzNotFoundContent]="'MRP.PEGGING_EMPTY' | translate"></nz-empty>
          }
        </nz-spin>
      </ng-container>
    </nz-drawer>
  `,
})
export class MrpPeggingDrawerComponent {
  protected readonly store = inject(MrpStore);

  protected readonly typeKeys = PROPOSAL_TYPE_KEYS;
  protected readonly typeColors = PROPOSAL_TYPE_COLORS;
  protected readonly statusKeys = PROPOSAL_STATUS_KEYS;
  protected readonly statusColors = PROPOSAL_STATUS_COLORS;
  protected readonly sourceKeys = SOURCE_TYPE_KEYS;
  protected readonly qty = formatQuantity;

  protected readonly selectedKey = signal<string | null>(null);
  protected readonly tree = computed(() => {
    const pegging = this.store.pegging();

    return pegging === null ? null : buildPeggingTree(pegging);
  });
  protected readonly roots = computed(() => {
    const tree = this.tree();

    return tree === null ? [] : rootDemandNodes(tree);
  });
  /** The detail of the clicked node; the focus proposal until a node is clicked. */
  protected readonly detail = computed<PeggingNodeDetail | null>(() => {
    const tree = this.tree();

    if (tree === null) {
      return null;
    }

    return tree.details[this.selectedKey() ?? tree.nodes[0].key] ?? tree.details[tree.nodes[0].key];
  });

  protected select(event: NzFormatEmitEvent): void {
    const key = event.node?.key;

    if (key && !key.startsWith('group-')) {
      this.selectedKey.set(key);
    }
  }

  protected close(): void {
    this.selectedKey.set(null);
    this.store.closePegging();
  }
}
