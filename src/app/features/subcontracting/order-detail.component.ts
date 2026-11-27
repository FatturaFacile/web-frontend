import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { MovementDialogComponent, MovementKind } from './movement-dialog.component';
import { OrderDetailStore } from './order-detail.store';
import { ProductionDialogComponent } from './production-dialog.component';
import { ReceiveDialogComponent } from './receive-dialog.component';
import {
  availableActions,
  countdownOf,
  deadlineColor,
  directionColor,
  movementColor,
  progressOf,
  SctAction,
  SctOutcome,
  statusColor,
  SUBCONTRACTING_MODULE,
} from './subcontracting.util';

/**
 * The workspace of one subcontracting order: status and progress, the actions of its workflow in quick drawers (dispatch with the DDT
 * Conto lavoro, receive with backflush, return unused material, customer material at zero value, delivery with the DDT Reso lavorato),
 * the component lines, the statutory ledger of the order and its linked documents.
 */
@Component({
  selector: 'app-sct-order-detail',
  imports: [
    DatePipe,
    MovementDialogComponent,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzPopconfirmModule,
    NzProgressModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    ProductionDialogComponent,
    ReceiveDialogComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [OrderDetailStore],
  styleUrl: './subcontracting.scss',
  template: `
    @if (store.order(); as order) {
      <app-page-header
        [title]="order.order_number"
        [subtitle]="order.partner_name ?? order.partner_id"
      >
        <a nz-button header-actions routerLink="/subcontracting/orders">{{ 'subcontracting.action.back' | translate }}</a>
      </app-page-header>

      <div class="chips">
        <nz-tag [nzColor]="directionColor(order.direction)">{{ 'subcontracting.direction.' + order.direction | translate }}</nz-tag>
        <nz-tag>{{ 'subcontracting.type.' + order.subcontracting_type | translate }}</nz-tag>
        <nz-tag [nzColor]="statusColor(order.status)" data-test="status">{{ 'subcontracting.status.' + order.status | translate }}</nz-tag>
        @if (order.zero_balance_sheet_value) {
          <nz-tag nzColor="purple" data-test="zero-value">{{ 'subcontracting.badge.zeroValue' | translate }}</nz-tag>
        }
        @if (order.customs_regime !== 'none') {
          <nz-tag nzColor="magenta">{{ 'subcontracting.customsRegime.' + order.customs_regime | translate }}</nz-tag>
        }
      </div>

      @if (feedback(); as failure) {
        <nz-alert
          class="feedback"
          nzType="error"
          nzShowIcon
          nzCloseable
          [nzMessage]="failure.errorKey ?? 'subcontracting.error.generic' | translate: failure.params"
          [nzDescription]="failure.detail ?? null"
          (nzOnClose)="feedback.set(null)"
        ></nz-alert>
      }

      @if (canWrite) {
        <div class="actions-bar">
          @for (action of actions(); track action) {
            @if (action === 'cancel') {
              <button
                nz-button
                nzDanger
                type="button"
                data-test="action-cancel"
                nz-popconfirm
                [nzPopconfirmTitle]="'subcontracting.confirm.cancelOrder' | translate"
                (nzOnConfirm)="run('cancel')"
              >
                {{ 'subcontracting.action.cancel' | translate }}
              </button>
            } @else {
              <button
                nz-button
                [nzType]="action === 'confirm' ? 'primary' : 'default'"
                type="button"
                [attr.data-test]="'action-' + action"
                [nzLoading]="store.saving() && action === 'confirm'"
                (click)="run(action)"
              >
                {{ 'subcontracting.action.' + action | translate }}
              </button>
            }
          }
        </div>
      }

      <nz-spin [nzSpinning]="store.loading()">
        <nz-tabs>
          <nz-tab [nzTitle]="'subcontracting.tab.overview' | translate">
            <nz-progress [nzPercent]="progress()" data-test="progress"></nz-progress>
            <nz-descriptions nzBordered nzSize="small" [nzColumn]="{ xs: 1, md: 2, xl: 3 }">
              <nz-descriptions-item [nzTitle]="'subcontracting.field.outputProduct' | translate">
                {{ order.output_product_name ?? order.output_product_id }} {{ order.output_product_sku }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'subcontracting.field.plannedQuantity' | translate">{{ order.planned_quantity }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'subcontracting.field.receivedQuantity' | translate">{{ order.received_quantity }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'subcontracting.field.scrapQuantity' | translate">{{ order.scrap_quantity }}</nz-descriptions-item>
              @if (order.direction === 'active') {
                <nz-descriptions-item [nzTitle]="'subcontracting.field.deliveredQuantity' | translate">{{ order.delivered_quantity }}</nz-descriptions-item>
              }
              <nz-descriptions-item [nzTitle]="'subcontracting.field.openQuantity' | translate">{{ order.open_quantity }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'subcontracting.field.unitServiceCost' | translate">
                {{ order.unit_service_cost }} {{ order.currency }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'subcontracting.field.expectedReturnDate' | translate">
                {{ order.expected_return_date | date: 'mediumDate' }}
              </nz-descriptions-item>
              @if (order.routing_operation_label) {
                <nz-descriptions-item [nzTitle]="'subcontracting.field.routingOperation' | translate">{{ order.routing_operation_label }}</nz-descriptions-item>
              }
              @if (order.notes) {
                <nz-descriptions-item [nzTitle]="'subcontracting.field.notes' | translate">{{ order.notes }}</nz-descriptions-item>
              }
            </nz-descriptions>

            @if (order.direction === 'passive' && order.capitalized_unit_cost !== '0.000000') {
              <h4 class="section-title">{{ 'subcontracting.section.capitalization' | translate }}</h4>
              <nz-descriptions nzBordered nzSize="small" [nzColumn]="2" data-test="capitalization">
                <nz-descriptions-item [nzTitle]="'subcontracting.preview.serviceFee' | translate">
                  {{ order.capitalized_service_amount }} {{ order.currency }}
                </nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'subcontracting.preview.unitCost' | translate">
                  {{ order.capitalized_unit_cost }} {{ order.currency }}
                </nz-descriptions-item>
              </nz-descriptions>
            }

            @if (order.service_billing; as billing) {
              <h4 class="section-title">{{ 'subcontracting.section.billing' | translate }}</h4>
              <nz-descriptions nzBordered nzSize="small" [nzColumn]="2" data-test="billing">
                <nz-descriptions-item [nzTitle]="'subcontracting.field.customer' | translate">{{ billing.customer_name }}</nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'subcontracting.field.quantity' | translate">{{ billing.quantity }}</nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'subcontracting.field.unitServiceCost' | translate">{{ billing.unit_price }} {{ billing.currency }}</nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'subcontracting.field.amount' | translate">{{ billing.amount }} {{ billing.currency }}</nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'subcontracting.field.ddt' | translate" [nzSpan]="2">{{ billing.ddt_numbers.join(', ') }}</nz-descriptions-item>
              </nz-descriptions>
            }
          </nz-tab>

          <nz-tab [nzTitle]="'subcontracting.tab.components' | translate">
            <nz-table nzSize="small" [nzData]="order.components ?? []" [nzShowPagination]="false" [nzScroll]="{ x: '900px' }">
              <thead>
                <tr>
                  <th scope="col">{{ 'subcontracting.field.component' | translate }}</th>
                  <th scope="col" class="num">{{ 'subcontracting.field.perUnit' | translate }}</th>
                  <th scope="col" class="num">{{ 'subcontracting.field.planned' | translate }}</th>
                  <th scope="col" class="num">{{ 'subcontracting.field.dispatched' | translate }}</th>
                  <th scope="col" class="num">{{ 'subcontracting.field.consumed' | translate }}</th>
                  <th scope="col" class="num">{{ 'subcontracting.field.scrap' | translate }}</th>
                  <th scope="col" class="num">{{ 'subcontracting.field.returnedUnused' | translate }}</th>
                  <th scope="col" class="num">{{ 'subcontracting.field.held' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (line of order.components ?? []; track line.id) {
                  <tr [attr.data-test]="'component-' + line.id">
                    <th scope="row">
                      {{ line.product_name ?? line.component_product_id }}
                      <small class="muted">{{ line.sku }}</small>
                    </th>
                    <td class="num">{{ line.required_qty_per_unit }} {{ line.unit_of_measure }}</td>
                    <td class="num">{{ line.total_planned_qty }}</td>
                    <td class="num">{{ line.dispatched_qty }}</td>
                    <td class="num">{{ line.consumed_qty }}</td>
                    <td class="num">{{ line.scrap_qty }}</td>
                    <td class="num">{{ line.returned_unused_qty }}</td>
                    <td class="num">{{ line.held_qty }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <nz-tab [nzTitle]="'subcontracting.tab.ledger' | translate">
            <nz-table nzSize="small" [nzData]="store.ledger()" [nzShowPagination]="false" [nzScroll]="{ x: '1000px' }">
              <thead>
                <tr>
                  <th scope="col">{{ 'subcontracting.field.entryDate' | translate }}</th>
                  <th scope="col">{{ 'subcontracting.field.movement' | translate }}</th>
                  <th scope="col">{{ 'subcontracting.field.product' | translate }}</th>
                  <th scope="col" class="num">{{ 'subcontracting.field.quantity' | translate }}</th>
                  <th scope="col" class="num">{{ 'subcontracting.field.remaining' | translate }}</th>
                  <th scope="col">{{ 'subcontracting.field.ddt' | translate }}</th>
                  <th scope="col">{{ 'subcontracting.field.deadline' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (line of store.ledger(); track line.id) {
                  <tr>
                    <td>{{ line.entry_date | date: 'mediumDate' }}</td>
                    <td>
                      <nz-tag [nzColor]="movementColor(line.movement_type)">{{ 'subcontracting.movementType.' + line.movement_type | translate }}</nz-tag>
                    </td>
                    <td>{{ line.product_name ?? line.product_id }}</td>
                    <td class="num">{{ movedOf(line) }}</td>
                    <td class="num">{{ line.remaining_at_subcontractor_qty }}</td>
                    <td>{{ line.ddt_number ?? '—' }}</td>
                    <td>
                      <span [class]="'deadline ' + line.deadline_status">
                        <nz-tag [nzColor]="deadlineColor(line.deadline_status)">{{ 'subcontracting.deadlineStatus.' + line.deadline_status | translate }}</nz-tag>
                        @if (countdown(line.days_to_deadline); as left) {
                          {{ left.key | translate: { days: left.days } }}
                        }
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
            @if (store.ledger().length === 0) {
              <nz-empty [nzNotFoundContent]="'subcontracting.empty.register' | translate"></nz-empty>
            }
          </nz-tab>

          <nz-tab [nzTitle]="'subcontracting.tab.documents' | translate">
            <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
              <nz-descriptions-item [nzTitle]="'subcontracting.field.outgoingDdt' | translate">{{ order.outgoing_material_ddt_id ?? '—' }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'subcontracting.field.inboundDocument' | translate">{{ order.inbound_return_document_number ?? '—' }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'subcontracting.field.servicePurchaseOrder' | translate">{{ order.linked_service_purchase_order_id ?? '—' }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'subcontracting.field.customerSalesOrder' | translate">{{ order.linked_customer_sales_order_id ?? '—' }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'subcontracting.field.productionOrder' | translate">{{ order.linked_production_order_id ?? '—' }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'subcontracting.field.customsDeclaration' | translate">{{ order.customs_declaration_id ?? '—' }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'subcontracting.field.virtualWarehouse' | translate">{{ order.subcontractor_warehouse_id ?? '—' }}</nz-descriptions-item>
            </nz-descriptions>
          </nz-tab>
        </nz-tabs>
      </nz-spin>

      <app-sct-movement-dialog
        [order]="order"
        [kind]="movementKind()"
        [visible]="dialog() === 'dispatch' || dialog() === 'returnUnused' || dialog() === 'receiveMaterials' || dialog() === 'deliver'"
        (closed)="dialog.set(null)"
      />
      <app-sct-receive-dialog [order]="order" [visible]="dialog() === 'receive'" (closed)="dialog.set(null)" />
      <app-sct-production-dialog [order]="order" [visible]="dialog() === 'produce'" (closed)="dialog.set(null)" />
    } @else {
      @if (store.error(); as error) {
        <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
      }
      <nz-spin [nzSpinning]="store.loading()"></nz-spin>
    }
  `,
})
export class OrderDetailComponent implements OnInit {
  protected readonly store = inject(OrderDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(SUBCONTRACTING_MODULE);
  protected readonly directionColor = directionColor;
  protected readonly statusColor = statusColor;
  protected readonly movementColor = movementColor;
  protected readonly deadlineColor = deadlineColor;

  protected readonly dialog = signal<SctAction | null>(null);
  protected readonly feedback = signal<SctOutcome | null>(null);

  protected readonly actions = computed(() => {
    const order = this.store.order();
    return order ? availableActions(order) : [];
  });
  protected readonly progress = computed(() => {
    const order = this.store.order();
    return order ? progressOf(order) : 0;
  });
  protected readonly movementKind = computed<MovementKind>(() => {
    const current = this.dialog();
    return current === 'returnUnused' || current === 'receiveMaterials' || current === 'deliver' ? current : 'dispatch';
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    await this.store.load(id);
    await this.store.loadLedger(id);
  }

  protected countdown(days: number | null) {
    return countdownOf(days);
  }

  /** The quantity a ledger line moves, whichever of its four columns carries it. */
  protected movedOf(line: {
    dispatched_qty: string;
    consumed_in_returned_goods_qty: string;
    scrap_reported_by_subcontractor_qty: string;
    returned_unused_qty: string;
  }): string {
    const carrier = [
      line.dispatched_qty,
      line.consumed_in_returned_goods_qty,
      line.scrap_reported_by_subcontractor_qty,
      line.returned_unused_qty,
    ].find((value) => Number(value) > 0);
    return carrier ?? '0.0000';
  }

  protected async run(action: SctAction): Promise<void> {
    if (action !== 'confirm' && action !== 'cancel') {
      this.feedback.set(null);
      this.dialog.set(action);
      return;
    }

    const outcome = action === 'confirm' ? await this.store.confirm() : await this.store.cancel();
    if (outcome.ok) {
      this.feedback.set(null);
      this.message.success(this.i18n.instant(action === 'confirm' ? 'subcontracting.message.confirmed' : 'subcontracting.message.cancelled'));
    } else {
      this.feedback.set(outcome);
    }
  }
}
