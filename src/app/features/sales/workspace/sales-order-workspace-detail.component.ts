import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, Observable, Subject, switchMap } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { AuthStore, BillingApiService, CustomerCreditProfile, I18nService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { DownPaymentChainComponent } from '../../down-payments/down-payment-chain.component';
import { apiErrorText, CREDIT_MANAGER_ROLES, hasAnyRole } from '../cycle/shared/sales-api-helpers';
import { SalesLookupsService } from '../cycle/shared/sales-lookups.service';
import { statusColor, statusKey } from '../cycle/shared/sales-status';
import { CreateDdtDrawerComponent } from './create-ddt-drawer.component';
import { OrderCreditBannerComponent } from './order-credit-banner.component';
import { SalesWorkspaceApiService } from './sales-workspace-api.service';
import {
  atpBadge,
  atpPromiseDate,
  backorderTree,
  canShip,
  exposureFromProfile,
  shippableLines,
  suggestionKey,
} from './sales-workspace.logic';
import {
  AtpCheckResult,
  CreateDdtPayload,
  CreditExposure,
  DataEnvelope,
  WorkspaceOrder,
  WorkspaceOrderLinePayload,
} from './sales-workspace.models';

interface DraftLine {
  key: number;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  warehouse_id: string | null;
}

const ATP_DEBOUNCE_MS = 400;

/**
 * Sales order editor and detail: header with the live credit position of the customer, an editable line grid with a
 * debounced ATP/CTP traffic light per line, the credit block banner with the release override, the partial delivery
 * drawer and the traceability tab (blanket agreement, backorder lines, replenishment pegging, DDTs, audit timeline).
 */
@Component({
  selector: 'app-sales-order-workspace-detail',
  imports: [
    DecimalPipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    NzTimelineModule,
    CreateDdtDrawerComponent,
    DownPaymentChainComponent,
    OrderCreditBannerComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="(order() ? order()!.order_number : 'SWK.ORDERS.NEW') | translate"
      [subtitle]="'SWK.ORDERS.SUBTITLE' | translate"
    />

    @if (order(); as o) {
      <div class="status-row">
        <nz-tag [nzColor]="statusColor(o.status)">{{ statusKey(o.status) | translate }}</nz-tag>
        <span>{{ 'SWK.TYPE.' + o.order_type.toUpperCase() | translate }}</span>
        @if (o.blanket_agreement_number) {
          <nz-tag nzColor="purple">{{ o.blanket_agreement_number }}</nz-tag>
        }
      </div>
    }

    <app-order-credit-banner
      [exposure]="exposure()"
      [blocked]="order()?.status === 'on_hold'"
      [canRelease]="canReleaseCredit()"
      [working]="working()"
      (release)="releaseCredit($event)"
    />

    <nz-card>
      <div class="grid">
        <div>
          <label for="so-customer">{{ 'SWK.COL.CUSTOMER' | translate }}</label>
          <nz-select
            id="so-customer"
            nzShowSearch
            [nzDisabled]="!editable()"
            [ngModel]="contactId()"
            (ngModelChange)="selectCustomer($event)"
          >
            @for (c of lookups.contacts(); track c.id) {
              <nz-option [nzValue]="c.id" [nzLabel]="lookups.contactLabel(c)"></nz-option>
            }
          </nz-select>
        </div>
        <div>
          <label for="so-warehouse">{{ 'SWK.COL.WAREHOUSE' | translate }}</label>
          <nz-select
            id="so-warehouse"
            nzAllowClear
            [nzDisabled]="!editable()"
            [ngModel]="warehouseId()"
            (ngModelChange)="selectWarehouse($event)"
          >
            @for (w of lookups.warehouses(); track w.id) {
              <nz-option [nzValue]="w.id" [nzLabel]="w.name"></nz-option>
            }
          </nz-select>
        </div>
        <div>
          <label for="so-date">{{ 'SWK.COL.REQUESTED_DELIVERY' | translate }}</label>
          <input
            id="so-date"
            nz-input
            type="date"
            [disabled]="!editable()"
            [ngModel]="requestedDate()"
            (ngModelChange)="requestedDate.set($event)"
          />
        </div>
      </div>
    </nz-card>

    <nz-tabs>
      <nz-tab [nzTitle]="'SWK.TAB.LINES' | translate">
        <nz-card>
          @if (editable()) {
            <nz-table nzSize="small" [nzData]="draftLines()" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'SWK.COL.PRODUCT' | translate }}</th>
                  <th>{{ 'SWK.COL.QUANTITY' | translate }}</th>
                  <th>{{ 'SWK.COL.UNIT_PRICE' | translate }}</th>
                  <th>{{ 'SWK.COL.VAT' | translate }}</th>
                  <th>{{ 'SWK.COL.ATP' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (line of draftLines(); track line.key; let i = $index) {
                  <tr>
                    <td>
                      <nz-select
                        nzShowSearch
                        class="product"
                        [ngModel]="line.product_id"
                        (ngModelChange)="selectProduct(i, $event)"
                        [attr.aria-label]="'SWK.COL.PRODUCT' | translate"
                      >
                        @for (p of lookups.products(); track p.id) {
                          <nz-option
                            [nzValue]="p.id"
                            [nzLabel]="p.sku + ' - ' + p.name"
                          ></nz-option>
                        }
                      </nz-select>
                    </td>
                    <td>
                      <nz-input-number
                        [nzMin]="0.0001"
                        [ngModel]="line.quantity"
                        (ngModelChange)="patchLine(i, { quantity: $event ?? 1 })"
                      />
                    </td>
                    <td>
                      <nz-input-number
                        [nzMin]="0"
                        [ngModel]="line.unit_price"
                        (ngModelChange)="patchLine(i, { unit_price: $event ?? 0 })"
                      />
                    </td>
                    <td>
                      <nz-input-number
                        [nzMin]="0"
                        [nzMax]="100"
                        [ngModel]="line.tax_rate"
                        (ngModelChange)="patchLine(i, { tax_rate: $event ?? 0 })"
                      />
                    </td>
                    <td>
                      @if (atp()[line.key]; as check) {
                        <nz-tag [nzColor]="badge(check).color">{{
                          badge(check).labelKey | translate
                        }}</nz-tag>
                        @if (promise(check); as date) {
                          <div class="hint">{{ date }}</div>
                        }
                        <div class="hint">{{ suggestion(check) | translate }}</div>
                      }
                    </td>
                    <td>
                      <button
                        nz-button
                        nzSize="small"
                        nzDanger
                        type="button"
                        (click)="removeLine(i)"
                      >
                        {{ 'SWK.COMMON.REMOVE' | translate }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
            <button nz-button type="button" class="add" (click)="addLine()">
              {{ 'SWK.ORDERS.ADD_LINE' | translate }}
            </button>
          } @else if (order(); as o) {
            <nz-table nzSize="small" [nzData]="o.lines ?? []" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'SWK.COL.PRODUCT' | translate }}</th>
                  <th class="num">{{ 'SWK.COL.ORDERED' | translate }}</th>
                  <th class="num">{{ 'SWK.COL.RESERVED' | translate }}</th>
                  <th class="num">{{ 'SWK.COL.DELIVERED' | translate }}</th>
                  <th class="num">{{ 'SWK.COL.OPEN' | translate }}</th>
                  <th>{{ 'SWK.COL.ATP' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (line of o.lines ?? []; track line.id) {
                  <tr>
                    <td>
                      {{ line.description }}
                      @if (line.is_backorder) {
                        <nz-tag nzColor="gold"
                          >{{ 'SWK.ORDERS.BACKORDER' | translate }} #{{
                            line.backorder_sequence
                          }}</nz-tag
                        >
                      }
                    </td>
                    <td class="num">{{ line.ordered_quantity | number: '1.0-4' }}</td>
                    <td class="num">{{ line.reserved_quantity | number: '1.0-4' }}</td>
                    <td class="num">{{ line.delivered_quantity | number: '1.0-4' }}</td>
                    <td class="num">{{ line.backorder_quantity | number: '1.0-4' }}</td>
                    <td>
                      <nz-tag [nzColor]="atpBadgeOf(line.atp_status).color">{{
                        atpBadgeOf(line.atp_status).labelKey | translate
                      }}</nz-tag>
                      @if (line.atp_promised_date) {
                        <span class="hint">{{ line.atp_promised_date }}</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }

          <div class="actions">
            @if (editable()) {
              <button nz-button type="button" [disabled]="working() || !canSave()" (click)="save()">
                {{ 'SWK.COMMON.SAVE' | translate }}
              </button>
            }
            @if (order()?.status === 'draft') {
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="working()"
                (click)="confirm()"
              >
                {{ 'SWK.ORDERS.CONFIRM' | translate }}
              </button>
            }
            @if (shippable()) {
              <button nz-button nzType="primary" type="button" (click)="ddtOpen.set(true)">
                {{ 'SWK.DDT.TITLE' | translate }}
              </button>
            }
            @if (hasShortage()) {
              <button
                nz-button
                type="button"
                [disabled]="working()"
                (click)="generateReplenishment()"
              >
                {{ 'SWK.ORDERS.REPLENISH' | translate }}
              </button>
            }
            @if (cancellable()) {
              <button nz-button nzDanger type="button" [disabled]="working()" (click)="cancel()">
                {{ 'SWK.ORDERS.CANCEL' | translate }}
              </button>
            }
          </div>
        </nz-card>
      </nz-tab>

      <nz-tab [nzTitle]="'SWK.TAB.TRACEABILITY' | translate">
        @if (order(); as o) {
          <nz-card [nzTitle]="'SWK.TRACE.BACKORDERS' | translate">
            @for (line of originalLines(); track line.id) {
              @if (children().get(line.id); as kids) {
                <p>
                  <strong>{{ line.description }}</strong>:
                  @for (kid of kids; track kid.id) {
                    <nz-tag nzColor="gold"
                      >#{{ kid.backorder_sequence }} {{ kid.backorder_quantity }} →
                      {{ kid.atp_promised_date ?? '-' }}</nz-tag
                    >
                  }
                </p>
              }
            } @empty {
              <span>{{ 'SWK.COMMON.NONE' | translate }}</span>
            }
          </nz-card>
          <nz-card [nzTitle]="'SWK.TRACE.REPLENISHMENT' | translate">
            @for (r of o.replenishment_requests ?? []; track r.id) {
              <p>
                <nz-tag>{{ 'SWK.REPLENISH.' + r.request_type.toUpperCase() | translate }}</nz-tag>
                {{ r.quantity | number: '1.0-4' }} · {{ r.needed_by ?? '-' }} · {{ r.status }}
              </p>
            } @empty {
              <span>{{ 'SWK.COMMON.NONE' | translate }}</span>
            }
          </nz-card>
          <nz-card [nzTitle]="'SWK.TRACE.DDT' | translate">
            @for (d of o.delivery_notes ?? []; track d.id) {
              <p>
                {{ d.number ?? d.id }} <nz-tag>{{ d.status }}</nz-tag>
              </p>
            } @empty {
              <span>{{ 'SWK.COMMON.NONE' | translate }}</span>
            }
          </nz-card>
          <nz-card [nzTitle]="'SWK.TRACE.AUDIT' | translate">
            <nz-timeline>
              @for (entry of o.audit_log ?? []; track entry.id) {
                <nz-timeline-item>
                  <strong>{{ 'SWK.AUDIT.' + entry.event.toUpperCase() | translate }}</strong>
                  @if (entry.from_status || entry.to_status) {
                    <span> {{ entry.from_status ?? '' }} → {{ entry.to_status ?? '' }}</span>
                  }
                  <div class="hint">{{ entry.created_at }}</div>
                </nz-timeline-item>
              }
            </nz-timeline>
          </nz-card>
        }
      </nz-tab>

      <nz-tab [nzTitle]="'down_payments.tab.title' | translate" [nzDisabled]="!order()">
        <ng-template nzTabContent>
          @if (order(); as o) {
            <app-down-payment-chain [sourceType]="'sales_order'" [sourceId]="o.id" [sourceLabel]="o.order_number" />
          }
        </ng-template>
      </nz-tab>
    </nz-tabs>

    @if (order(); as o) {
      <app-create-ddt-drawer
        [(open)]="ddtOpen"
        [lines]="shippableOf(o)"
        [working]="working()"
        (generate)="createDdt($event)"
      />
    }
  `,
  styles: `
    .status-row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }
    .grid label {
      display: block;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .grid nz-select {
      width: 100%;
    }
    .product {
      min-width: 260px;
    }
    .num {
      text-align: right;
    }
    .hint {
      font-size: 12px;
      opacity: 0.75;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }
    .add {
      margin-top: 8px;
    }
  `,
})
export class SalesOrderWorkspaceDetailComponent {
  private readonly api = inject(SalesWorkspaceApiService);
  private readonly billing = inject(BillingApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(I18nService);
  protected readonly lookups = inject(SalesLookupsService);

  protected readonly statusColor = statusColor;
  protected readonly statusKey = statusKey;
  protected readonly atpBadgeOf = atpBadge;

  protected readonly order = signal<WorkspaceOrder | null>(null);
  protected readonly working = signal(false);
  protected readonly ddtOpen = signal(false);
  protected readonly contactId = signal<string | null>(null);
  protected readonly warehouseId = signal<string | null>(null);
  protected readonly requestedDate = signal('');
  protected readonly draftLines = signal<DraftLine[]>([]);
  protected readonly atp = signal<Record<number, AtpCheckResult>>({});
  private readonly customerProfile = signal<CustomerCreditProfile | null>(null);
  private nextKey = 1;
  private readonly atpTrigger = new Subject<void>();

  protected readonly editable = computed(
    () => this.order() === null || this.order()?.status === 'draft',
  );
  protected readonly canReleaseCredit = computed(() =>
    hasAnyRole(this.authStore.activeRoles(), CREDIT_MANAGER_ROLES),
  );
  protected readonly canSave = computed(
    () =>
      this.contactId() !== null &&
      this.draftLines().some((l) => l.description.trim() !== '' && l.quantity > 0),
  );
  protected readonly shippable = computed(() => {
    const o = this.order();
    return o !== null && canShip(o);
  });
  protected readonly hasShortage = computed(
    () =>
      (this.order()?.lines ?? []).some(
        (l) => l.atp_status === 'shortage' || l.atp_status === 'ctp_required',
      ) && this.order()?.status === 'confirmed',
  );
  protected readonly cancellable = computed(() =>
    ['draft', 'confirmed', 'approved', 'on_hold'].includes(this.order()?.status ?? ''),
  );
  protected readonly originalLines = computed(() =>
    (this.order()?.lines ?? []).filter((l) => !l.is_backorder),
  );
  protected readonly children = computed(() => backorderTree(this.order()?.lines ?? []));

  /** The credit position shown in the banner: the one of the order once saved, else the customer's live profile. */
  protected readonly exposure = computed<CreditExposure | null>(() => {
    const fromOrder = this.order()?.credit_exposure;
    if (fromOrder) {
      return fromOrder;
    }
    const profile = this.customerProfile();
    return profile ? exposureFromProfile(profile, this.draftTotal()) : null;
  });

  constructor() {
    this.lookups.load();
    this.atpTrigger
      .pipe(
        debounceTime(ATP_DEBOUNCE_MS),
        switchMap(() => {
          const lines = this.validAtpLines();
          return this.api.atpCheck(
            lines.map((l) => ({
              product_id: l.product_id as string,
              quantity: l.quantity,
              warehouse_id: l.warehouse_id,
            })),
            this.warehouseId(),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => this.applyAtp(res.data),
        error: () => this.atp.set({}),
      });

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.load(id);
    } else {
      this.addLine();
    }
  }

  protected badge(check: AtpCheckResult) {
    return atpBadge(check.atp_status);
  }

  protected promise(check: AtpCheckResult): string | null {
    return atpPromiseDate(check);
  }

  protected suggestion(check: AtpCheckResult): string {
    return suggestionKey(check.fulfillment_suggestion);
  }

  protected shippableOf(order: WorkspaceOrder) {
    return shippableLines(order);
  }

  protected selectCustomer(id: string | null): void {
    this.contactId.set(id);
    this.customerProfile.set(null);
    if (id) {
      this.billing
        .getCustomerCredit(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => this.customerProfile.set(res.data),
          error: () => this.customerProfile.set(null),
        });
    }
  }

  protected selectWarehouse(id: string | null): void {
    this.warehouseId.set(id);
    this.atpTrigger.next();
  }

  protected selectProduct(index: number, productId: string | null): void {
    const product = this.lookups.products().find((p) => p.id === productId);
    this.patchLine(index, {
      product_id: productId,
      description: product?.name ?? '',
      unit_price: product ? Number(product.sale_price) : 0,
      tax_rate:
        product && 'tax_rate' in product
          ? Number((product as { tax_rate?: number | string }).tax_rate ?? 22)
          : 22,
    });
  }

  protected patchLine(index: number, patch: Partial<DraftLine>): void {
    this.draftLines.update((lines) =>
      lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
    this.atpTrigger.next();
  }

  protected addLine(): void {
    this.draftLines.update((lines) => [
      ...lines,
      {
        key: this.nextKey++,
        product_id: null,
        description: '',
        quantity: 1,
        unit_price: 0,
        tax_rate: 22,
        warehouse_id: null,
      },
    ]);
  }

  protected removeLine(index: number): void {
    this.draftLines.update((lines) => lines.filter((_, i) => i !== index));
    this.atpTrigger.next();
  }

  protected save(): void {
    const payload = this.payload();
    if (!payload) {
      return;
    }
    const current = this.order();
    const call = current
      ? this.api.updateOrder(current.id, payload)
      : this.api.createOrder(payload);
    this.run(call, (order) => {
      this.message.success(this.t('SWK.MSG.SAVED'));
      if (current) {
        this.applyOrder(order);
      } else {
        void this.router.navigate(['/sales/workspace/orders', order.id], { replaceUrl: true });
      }
    });
  }

  protected confirm(): void {
    const current = this.order();
    if (current) {
      this.run(this.api.confirm(current.id), (order) => {
        this.applyOrder(order);
        this.message.success(
          this.t(order.status === 'on_hold' ? 'SWK.MSG.BLOCKED' : 'SWK.MSG.CONFIRMED'),
        );
      });
    }
  }

  protected releaseCredit(notes: string): void {
    const current = this.order();
    if (current) {
      this.run(this.api.creditRelease(current.id, notes), (order) => {
        this.applyOrder(order);
        this.message.success(this.t('SWK.MSG.CREDIT_RELEASED'));
      });
    }
  }

  protected generateReplenishment(): void {
    const current = this.order();
    if (current) {
      this.run(this.api.generateReplenishment(current.id), (order) => {
        this.applyOrder(order);
        this.message.success(this.t('SWK.MSG.REPLENISHED'));
      });
    }
  }

  protected cancel(): void {
    const current = this.order();
    if (current) {
      this.run(this.api.cancel(current.id, this.t('SWK.MSG.CANCEL_REASON')), (order) =>
        this.applyOrder(order),
      );
    }
  }

  protected createDdt(payload: CreateDdtPayload): void {
    const current = this.order();
    if (!current) {
      return;
    }
    this.working.set(true);
    this.api
      .createDdt(current.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.ddtOpen.set(false);
          this.message.success(this.t('SWK.MSG.DDT_CREATED'));
          this.load(current.id);
        },
        error: (err: unknown) => this.fail(err),
      });
  }

  private load(id: string): void {
    this.working.set(true);
    this.api
      .getOrder(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.applyOrder(res.data);
          this.working.set(false);
        },
        error: (err: unknown) => this.fail(err),
      });
  }

  private applyOrder(order: WorkspaceOrder): void {
    this.order.set(order);
    this.contactId.set(order.contact_id);
    this.warehouseId.set(order.warehouse_id);
    this.requestedDate.set(order.requested_delivery_date ?? '');
    if (order.status === 'draft') {
      this.draftLines.set(
        (order.lines ?? []).map((line) => ({
          key: this.nextKey++,
          product_id: line.product_id,
          description: line.description,
          quantity: Number(line.ordered_quantity),
          unit_price: Number(line.unit_price),
          tax_rate: Number(line.tax_rate),
          warehouse_id: line.warehouse_id,
        })),
      );
      this.atpTrigger.next();
    }
  }

  private run(
    call: Observable<DataEnvelope<WorkspaceOrder>>,
    done: (order: WorkspaceOrder) => void,
  ): void {
    this.working.set(true);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        done(res.data);
        this.working.set(false);
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  private fail(err: unknown): void {
    this.working.set(false);
    this.message.error(apiErrorText(err) || this.t('SWK.MSG.ERROR'));
  }

  private payload() {
    const contactId = this.contactId();
    if (!contactId) {
      return null;
    }
    const items: WorkspaceOrderLinePayload[] = this.draftLines()
      .filter((l) => l.description.trim() !== '' && l.quantity > 0)
      .map((l) => ({
        product_id: l.product_id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
        warehouse_id: l.warehouse_id,
      }));
    return {
      contact_id: contactId,
      warehouse_id: this.warehouseId(),
      requested_delivery_date: this.requestedDate() || null,
      items,
    };
  }

  private validAtpLines(): DraftLine[] {
    return this.draftLines().filter((l) => l.product_id !== null && l.quantity > 0);
  }

  private applyAtp(results: AtpCheckResult[]): void {
    const map: Record<number, AtpCheckResult> = {};
    this.validAtpLines().forEach((line, i) => {
      const result = results[i];
      if (result) {
        map[line.key] = result;
      }
    });
    this.atp.set(map);
  }

  private draftTotal(): number {
    return this.draftLines().reduce(
      (sum, l) => sum + l.quantity * l.unit_price * (1 + l.tax_rate / 100),
      0,
    );
  }

  private t(key: string): string {
    return this.i18n.translate(key);
  }
}
