import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocumentFlowEntryType, DocumentFlowNode } from '@domain/procurement/srm.models';
import { DateFormatPipe, MoneyPipe, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import {
  coverage,
  documentLink,
  documentTypeKey,
  nodeStatusColor,
  nodeStatusKey,
  relationKey,
  toNumber,
} from './srm.helpers';
import { SrmStore } from './srm.store';

const TYPE_ORDER: Record<DocumentFlowNode['type'], number> = {
  requisition: 0,
  rfq: 1,
  framework_agreement: 2,
  purchase_order: 3,
  goods_receipt: 4,
  supplier_invoice: 5,
  purchase_return: 6,
};

/**
 * Document flow of a purchasing document: the linked upstream and downstream documents in procure-to-pay order
 * (requisition, tender, agreement, order, receipts, invoices with their 3-way match, returns), with one-click navigation
 * and the ordered / received / invoiced / returned / remaining quantities.
 */
@Component({
  selector: 'app-document-flow-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SrmStore],
  imports: [
    DateFormatPipe,
    DecimalPipe,
    MoneyPipe,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzEmptyModule,
    NzProgressModule,
    NzSkeletonModule,
    NzTableModule,
    NzTagModule,
    NzTimelineModule,
  ],
  template: `
    @if (store.error(); as error) {
      <nz-alert
        nzType="error"
        nzShowIcon
        [nzMessage]="'srm.flow.loadError' | translate"
        [nzDescription]="error"
      />
    }

    @if (store.loading()) {
      <nz-skeleton [nzActive]="true" [nzParagraph]="{ rows: 6 }" />
    } @else if (store.flow(); as flow) {
      @if (ordered().length === 0) {
        <nz-empty [nzNotFoundContent]="'srm.flow.empty' | translate" />
      } @else {
        <nz-timeline data-testid="document-flow-timeline">
          @for (node of ordered(); track node.key) {
            <nz-timeline-item [nzColor]="statusColor(node)">
              <div class="flow-node" [class.flow-node-anchor]="node.is_anchor">
                <strong>{{ typeKey(node) | translate }}</strong>
                @if (link(node); as target) {
                  <a
                    [routerLink]="target"
                    class="flow-link"
                    [attr.data-testid]="'flow-link-' + node.type"
                    >{{ node.number || node.id }}</a
                  >
                } @else {
                  <span>{{ node.number || node.id }}</span>
                }
                @if (statusKey(node); as key) {
                  <nz-tag [nzColor]="statusColor(node)">{{ key | translate }}</nz-tag>
                } @else if (node.status) {
                  <nz-tag [nzColor]="statusColor(node)">{{ node.status }}</nz-tag>
                }
                @if (node.is_anchor) {
                  <nz-tag nzColor="geekblue">{{ 'srm.flow.current' | translate }}</nz-tag>
                }
              </div>
              <div class="flow-meta">
                @if (node.date) {
                  <span>{{ node.date | appDate }}</span>
                }
                @if (node.amount) {
                  <span>{{ node.amount | money: node.currency }}</span>
                }
                @if (parentRelation(node); as relation) {
                  <span class="flow-relation">{{ relationLabel(relation) | translate }}</span>
                }
              </div>
            </nz-timeline-item>
          }
        </nz-timeline>

        <h4>{{ 'srm.flow.quantities' | translate }}</h4>
        <nz-table
          #quantities
          [nzData]="flow.orders"
          [nzShowPagination]="false"
          nzSize="small"
          [nzNoResult]="'srm.flow.noQuantities' | translate"
        >
          <thead>
            <tr>
              <th>{{ 'srm.flow.type.purchase_order' | translate }}</th>
              <th class="num">{{ 'srm.flow.qty.ordered' | translate }}</th>
              <th class="num">{{ 'srm.flow.qty.received' | translate }}</th>
              <th class="num">{{ 'srm.flow.qty.invoiced' | translate }}</th>
              <th class="num">{{ 'srm.flow.qty.returned' | translate }}</th>
              <th class="num">{{ 'srm.flow.qty.remaining' | translate }}</th>
              <th>{{ 'srm.flow.qty.progress' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of quantities.data; track row.purchase_order_id) {
              <tr>
                <td>
                  <a [routerLink]="['/procurement/purchase-orders', row.purchase_order_id]">{{
                    row.po_number || row.purchase_order_id
                  }}</a>
                </td>
                <td class="num">{{ n(row.ordered) | number: '1.0-4' }}</td>
                <td class="num">{{ n(row.received) | number: '1.0-4' }}</td>
                <td class="num">{{ n(row.invoiced) | number: '1.0-4' }}</td>
                <td class="num">{{ n(row.returned) | number: '1.0-4' }}</td>
                <td class="num">{{ n(row.remaining) | number: '1.0-4' }}</td>
                <td class="progress-cell">
                  <nz-progress
                    [nzPercent]="pct(row.received, row.ordered)"
                    nzSize="small"
                    [nzShowInfo]="false"
                  />
                  <nz-progress
                    [nzPercent]="pct(row.invoiced, row.ordered)"
                    nzSize="small"
                    nzStrokeColor="#52c41a"
                    [nzShowInfo]="false"
                  />
                </td>
              </tr>
            }
          </tbody>
          @if (flow.orders.length > 1) {
            <tfoot>
              <tr>
                <td>{{ 'srm.flow.total' | translate }}</td>
                <td class="num">{{ n(flow.quantities.ordered) | number: '1.0-4' }}</td>
                <td class="num">{{ n(flow.quantities.received) | number: '1.0-4' }}</td>
                <td class="num">{{ n(flow.quantities.invoiced) | number: '1.0-4' }}</td>
                <td class="num">{{ n(flow.quantities.returned) | number: '1.0-4' }}</td>
                <td class="num">{{ n(flow.quantities.remaining) | number: '1.0-4' }}</td>
                <td></td>
              </tr>
            </tfoot>
          }
        </nz-table>
      }
    }
  `,
  styles: `
    .flow-node {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .flow-node-anchor strong {
      text-decoration: underline;
    }
    .flow-meta {
      display: flex;
      gap: 12px;
      color: rgba(0, 0, 0, 0.45);
      font-size: 12px;
    }
    .num {
      text-align: right;
    }
    .progress-cell {
      min-width: 120px;
    }
    h4 {
      margin: 16px 0 8px;
    }
  `,
})
export class DocumentFlowPanelComponent {
  readonly type = input.required<DocumentFlowEntryType>();
  readonly documentId = input.required<string>();

  protected readonly store = inject(SrmStore);

  protected readonly ordered = computed<DocumentFlowNode[]>(() =>
    [...(this.store.flow()?.nodes ?? [])].sort(
      (a, b) =>
        TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
        (a.date ?? '').localeCompare(b.date ?? '') ||
        (a.number ?? '').localeCompare(b.number ?? ''),
    ),
  );

  private readonly parents = computed(() => {
    const map = new Map<string, string>();
    for (const edge of this.store.flow()?.edges ?? []) {
      map.set(edge.to, edge.relation);
    }
    return map;
  });

  constructor() {
    effect(() => {
      this.store.loadFlow(this.type(), this.documentId());
    });
  }

  protected typeKey(node: DocumentFlowNode): string {
    return documentTypeKey(node.type);
  }

  protected statusKey(node: DocumentFlowNode): string | null {
    return nodeStatusKey(node);
  }

  protected statusColor(node: DocumentFlowNode): string {
    return nodeStatusColor(node);
  }

  protected link(node: DocumentFlowNode): string[] | null {
    if (node.type === 'supplier_invoice') {
      return node.run_id ? ['/procurement/invoice-matching', node.run_id] : ['/purchases/invoices'];
    }
    return documentLink(node);
  }

  protected parentRelation(node: DocumentFlowNode): string | null {
    return this.parents().get(node.key) ?? null;
  }

  protected relationLabel(relation: string): string {
    return relationKey(relation);
  }

  protected n(value: string): number {
    return toNumber(value) ?? 0;
  }

  protected pct(part: string, ordered: string): number {
    return coverage(part, ordered);
  }
}
