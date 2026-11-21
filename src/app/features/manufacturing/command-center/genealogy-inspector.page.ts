import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MFG_COST_ELEMENTS, MfgCostElementKey } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { num } from './command-center.utils';
import { ManufacturingFacadeService } from './manufacturing.facade';

/** Genealogy (lot trees, operations, machine events) and cost variance of one production order. */
@Component({
  selector: 'app-genealogy-inspector',
  providers: [ManufacturingFacadeService],
  imports: [
    DecimalPipe,
    NgTemplateOutlet,
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzCardModule,
    NzEmptyModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
  ],
  styles: `
    ul.tree, ul.tree ul { list-style: none; margin: 0; padding-left: 20px }
    ul.tree { padding-left: 0 }
    .node { padding: 2px 0 }
    .sub { font-size: 12px; color: var(--ant-color-text-secondary, #595959) }
    table { width: 100%; border-collapse: collapse }
    th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0) }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums }
    .over { color: #a8071a; font-weight: 600 } .under { color: #237804; font-weight: 600 }
    .vbar { position: relative; width: 140px; height: 10px; background: var(--ant-color-border-secondary, #f0f0f0) }
    .vbar i { position: absolute; top: 0; bottom: 0 }
    .vbar i.over { background: #a8071a } .vbar i.under { background: #237804 }
    .vbar b { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: #000 }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 16px; margin-top: 16px }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap }
  `,
  template: `
    <app-page-header
      [title]="'MFG_CC.GENEALOGY_TITLE' | translate"
      [subtitle]="'MFG_CC.GENEALOGY_SUBTITLE' | translate"
    ></app-page-header>

    <label for="gen-order">{{ 'MFG_CC.PICK_ORDER' | translate }}</label>
    <nz-select
      id="gen-order"
      style="min-width: 320px; margin-left: 8px"
      nzShowSearch
      [nzPlaceHolder]="'MFG_CC.PICK_ORDER' | translate"
      [ngModel]="orderId()"
      (ngModelChange)="pick($event)"
    >
      @for (o of facade.inspectableOrders(); track o.id) {
        <nz-option [nzValue]="o.id" [nzLabel]="o.order_number + ' ' + (o.item_code ?? '')"></nz-option>
      }
    </nz-select>

    @if (facade.inspectorError(); as error) {
      <nz-alert style="margin-top: 12px" nzType="error" nzShowIcon [nzMessage]="'MFG_CC.LOAD_ERROR' | translate" [nzDescription]="error"></nz-alert>
    }

    <nz-spin [nzSpinning]="facade.inspectorLoading()">
      @if (facade.genealogy(); as g) {
        <div class="grid">
          @for (lot of g.output_lots; track lot.lot_id) {
            <nz-card [nzTitle]="('MFG_CC.OUTPUT_LOT' | translate) + ' ' + lot.lot_number">
              <h4>{{ 'MFG_CC.BACKWARD' | translate }}</h4>
              <ul class="tree" role="tree" [attr.aria-label]="'MFG_CC.BACKWARD' | translate">
                <ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: lot.backward, root: true }"></ng-container>
              </ul>
              <h4>{{ 'MFG_CC.FORWARD' | translate }}</h4>
              <ul class="tree" role="tree" [attr.aria-label]="'MFG_CC.FORWARD' | translate">
                <ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: lot.forward, root: true }"></ng-container>
              </ul>
            </nz-card>
          } @empty {
            <nz-card [nzTitle]="'MFG_CC.OUTPUT_LOTS' | translate">
              <nz-empty [nzNotFoundContent]="'MFG_CC.NO_LOTS' | translate"></nz-empty>
            </nz-card>
          }

          <nz-card [nzTitle]="'MFG_CC.OPERATIONS' | translate">
            @if (g.operations.length === 0) {
              <nz-empty [nzNotFoundContent]="'MFG_CC.NO_OPERATIONS' | translate"></nz-empty>
            } @else {
              <table>
                <caption class="sr-only">{{ 'MFG_CC.OPERATIONS' | translate }}</caption>
                <thead>
                  <tr>
                    <th scope="col">{{ 'MFG_CC.MACHINE' | translate }}</th>
                    <th scope="col">{{ 'MFG_CC.OPERATOR' | translate }}</th>
                    <th scope="col">{{ 'MFG_CC.STARTED' | translate }}</th>
                    <th scope="col">{{ 'MFG_CC.COMPLETED' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (op of g.operations; track op.production_order_operation_id + op.started_at) {
                    <tr>
                      <td>{{ op.machine_id ?? '–' }}</td>
                      <td>{{ op.operator_id ?? '–' }}</td>
                      <td>{{ op.started_at }}</td>
                      <td>{{ op.completed_at ?? '–' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </nz-card>

          <nz-card [nzTitle]="'MFG_CC.MACHINE_EVENTS' | translate">
            @if (g.machine_events.length === 0) {
              <nz-empty [nzNotFoundContent]="'MFG_CC.NO_EVENTS' | translate"></nz-empty>
            } @else {
              <table>
                <caption class="sr-only">{{ 'MFG_CC.MACHINE_EVENTS' | translate }}</caption>
                <thead>
                  <tr>
                    <th scope="col">{{ 'MFG_CC.WHEN' | translate }}</th>
                    <th scope="col">{{ 'MFG_CC.MACHINE' | translate }}</th>
                    <th scope="col">{{ 'MFG_CC.STATE' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of g.machine_events; track $index) {
                    <tr>
                      <td>{{ e.occurred_at }}</td>
                      <td>{{ e.machine_id }}</td>
                      <td>{{ e.state }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </nz-card>
        </div>
      }

      @if (facade.costReport(); as cost) {
        <nz-card style="margin-top: 16px" [nzTitle]="'MFG_CC.COST_VARIANCE' | translate">
          <p class="sub">
            {{ 'MFG_CC.COST_BASIS' | translate: { received: cost.received_quantity, target: cost.target_quantity, currency: cost.currency } }}
            @if (cost.is_closed) {
              <nz-tag>{{ 'MFG_CC.CLOSED' | translate }}</nz-tag>
            }
          </p>
          <table>
            <caption class="sr-only">{{ 'MFG_CC.COST_VARIANCE' | translate }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ 'MFG_CC.COST_ELEMENT' | translate }}</th>
                <th scope="col" class="num">{{ 'MFG_CC.STANDARD_OUTPUT' | translate }}</th>
                <th scope="col" class="num">{{ 'MFG_CC.ACTUAL' | translate }}</th>
                <th scope="col" class="num">{{ 'MFG_CC.VARIANCE' | translate }}</th>
                <th scope="col"><span class="sr-only">{{ 'MFG_CC.VARIANCE_BAR' | translate }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (row of costRows(); track row.key) {
                <tr>
                  <th scope="row">{{ 'MFG_CC.COST_' + row.key.toUpperCase() | translate }}</th>
                  <td class="num">{{ row.standard | number: '1.2-2' }}</td>
                  <td class="num">{{ row.actual | number: '1.2-2' }}</td>
                  <td class="num" [class.over]="row.variance > 0" [class.under]="row.variance < 0">{{ row.variance | number: '1.2-2' }}</td>
                  <td>
                    <div class="vbar" aria-hidden="true">
                      <b></b>
                      <i [class.over]="row.variance > 0" [class.under]="row.variance < 0" [style.left.%]="row.variance >= 0 ? 50 : 50 - row.barWidth" [style.width.%]="row.barWidth"></i>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{{ 'MFG_CC.TOTAL' | translate }}</th>
                <td class="num">{{ cost.totals.standard_for_output | number: '1.2-2' }}</td>
                <td class="num">{{ cost.totals.actual | number: '1.2-2' }}</td>
                <td class="num" [class.over]="totalVariance() > 0" [class.under]="totalVariance() < 0">{{ cost.totals.variance | number: '1.2-2' }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          <p class="sub">{{ 'MFG_CC.WIP_BALANCE' | translate }}: {{ cost.totals.wip_balance | number: '1.2-2' }}</p>
        </nz-card>
      }
    </nz-spin>

    <ng-template #nodeTpl let-node let-root="root">
      <li role="treeitem" aria-expanded="true" aria-selected="false" class="node">
        <strong>{{ node.lot_number }}</strong>
        <span class="sub">
          {{ node.sku }} {{ node.item_name }}
          @if (node.supplier_lot_number) { · {{ 'MFG_CC.SUPPLIER_LOT' | translate }} {{ node.supplier_lot_number }} }
          @if (node.quantity_consumed && !root) { · {{ node.quantity_consumed }} }
          @if (node.expiration_date) { · {{ 'MFG_CC.EXPIRES' | translate }} {{ node.expiration_date }} }
        </span>
        @for (d of node.deliveries; track d.delivery_note_id) {
          <div class="sub">→ {{ 'MFG_CC.DELIVERY' | translate }} {{ d.ddt_number }} · {{ d.date }} · {{ d.quantity }}</div>
        }
        @if (node.lots.length > 0) {
          <ul role="group">
            @for (child of node.lots; track child.lot_id) {
              <ng-container *ngTemplateOutlet="nodeTpl; context: { $implicit: child, root: false }"></ng-container>
            }
          </ul>
        }
      </li>
    </ng-template>
  `,
})
export class GenealogyInspectorComponent implements OnInit {
  protected readonly facade = inject(ManufacturingFacadeService);
  protected readonly orderId = signal<string | null>(null);

  protected readonly costRows = computed(() => {
    const cost = this.facade.costReport();
    if (cost === null) {
      return [];
    }
    const rows = MFG_COST_ELEMENTS.map((key: MfgCostElementKey) => ({
      key,
      standard: num(cost.elements[key].standard_for_output),
      actual: num(cost.elements[key].actual),
      variance: num(cost.elements[key].variance),
    }));
    const max = Math.max(1, ...rows.map((row) => Math.abs(row.variance)));
    return rows.map((row) => ({ ...row, barWidth: (Math.abs(row.variance) / max) * 50 }));
  });

  protected readonly totalVariance = computed(() => num(this.facade.costReport()?.totals.variance));

  ngOnInit(): void {
    this.facade.loadInspectableOrders();
  }

  protected pick(id: string | null): void {
    this.orderId.set(id);
    if (id !== null) {
      this.facade.inspect(id);
    }
  }

}
