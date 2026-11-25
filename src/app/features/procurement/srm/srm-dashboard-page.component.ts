import { DecimalPipe, KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SrmDashboard, SrmOverdueOrder, SupplierRating } from '@domain/procurement/srm.models';
import { DateFormatPipe, MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DocumentFlowDrawerComponent } from './document-flow-drawer.component';
import { scoreStatus, tierColor, toNumber } from './srm.helpers';
import { SrmStore } from './srm.store';

interface KpiCard {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly hint: string | null;
  readonly route: string;
  readonly icon: string;
  readonly alert: boolean;
}

/** Purchasing and SRM overview: what waits for a decision, what is late or blocked, spend and supplier ratings. */
@Component({
  selector: 'app-srm-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SrmStore],
  imports: [
    DateFormatPipe,
    DecimalPipe,
    DocumentFlowDrawerComponent,
    FormsModule,
    KeyValuePipe,
    NgTemplateOutlet,
    MoneyPipe,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzGridModule,
    NzIconModule,
    NzProgressModule,
    NzSkeletonModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="'srm.dashboard.title' | translate"
      [subtitle]="'srm.dashboard.subtitle' | translate"
    >
      <nz-range-picker
        [ngModel]="range()"
        (ngModelChange)="onRange($event)"
        [nzAllowClear]="false"
        data-testid="srm-period"
      />
      <button nz-button type="button" (click)="reload()" [nzLoading]="store.loading()">
        <span nz-icon nzType="reload" aria-hidden="true"></span>
        {{ 'srm.dashboard.refresh' | translate }}
      </button>
      <a nz-button routerLink="/procurement/srm/scorecards">{{
        'srm.dashboard.allScorecards' | translate
      }}</a>
    </app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        nzType="error"
        nzShowIcon
        [nzMessage]="'srm.dashboard.loadError' | translate"
        [nzDescription]="error"
      />
    }

    @if (store.loading() && !data()) {
      <nz-skeleton [nzActive]="true" [nzParagraph]="{ rows: 8 }" />
    } @else if (data(); as d) {
      <div nz-row [nzGutter]="[16, 16]" data-testid="srm-kpis">
        @for (card of kpis(); track card.key) {
          <div nz-col [nzXs]="24" [nzSm]="12" [nzLg]="8" [nzXl]="4">
            <a [routerLink]="card.route" class="kpi-link">
              <nz-card [class.kpi-alert]="card.alert" nzSize="small" nzHoverable>
                <nz-statistic
                  [nzValue]="card.value"
                  [nzTitle]="card.label | translate"
                  [nzPrefix]="icon"
                />
                <ng-template #icon
                  ><span nz-icon [nzType]="card.icon" aria-hidden="true"></span
                ></ng-template>
                @if (card.hint) {
                  <small class="kpi-hint">{{ card.hint }}</small>
                }
              </nz-card>
            </a>
          </div>
        }
      </div>

      <div nz-row [nzGutter]="[16, 16]" class="section">
        <div nz-col [nzXs]="24" [nzLg]="12">
          <nz-card [nzTitle]="'srm.dashboard.overdueOrders' | translate" nzSize="small">
            <nz-table
              [nzData]="d.orders.overdue_list"
              [nzShowPagination]="false"
              nzSize="small"
              [nzNoResult]="'srm.dashboard.noOverdue' | translate"
              data-testid="srm-overdue"
            >
              <thead>
                <tr>
                  <th>{{ 'srm.dashboard.col.order' | translate }}</th>
                  <th>{{ 'srm.dashboard.col.supplier' | translate }}</th>
                  <th>{{ 'srm.dashboard.col.expected' | translate }}</th>
                  <th class="num">{{ 'srm.dashboard.col.openValue' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (row of d.orders.overdue_list; track row.purchase_order_id) {
                  <tr>
                    <td>
                      <a [routerLink]="['/procurement/purchase-orders', row.purchase_order_id]">{{
                        row.po_number || row.purchase_order_id
                      }}</a>
                    </td>
                    <td>{{ row.supplier_name }}</td>
                    <td>
                      <nz-tag nzColor="error">{{ row.expected_delivery_date | appDate }}</nz-tag>
                      <small>{{ daysLate(row) }} {{ 'srm.dashboard.daysLate' | translate }}</small>
                    </td>
                    <td class="num">{{ row.open_value | money: row.currency }}</td>
                    <td>
                      <app-document-flow-drawer
                        type="purchase_order"
                        [documentId]="row.purchase_order_id"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
            @if (d.orders.overdue > d.orders.overdue_list.length) {
              <a routerLink="/procurement/overdue-orders">{{
                'srm.dashboard.seeAll' | translate
              }}</a>
            }
          </nz-card>
        </div>

        <div nz-col [nzXs]="24" [nzLg]="12">
          <nz-card [nzTitle]="'srm.dashboard.blockedInvoices' | translate" nzSize="small">
            <nz-table
              [nzData]="d.blocked_invoices.items"
              [nzShowPagination]="false"
              nzSize="small"
              [nzNoResult]="'srm.dashboard.noBlocked' | translate"
              data-testid="srm-blocked"
            >
              <thead>
                <tr>
                  <th>{{ 'srm.dashboard.col.invoice' | translate }}</th>
                  <th>{{ 'srm.dashboard.col.supplier' | translate }}</th>
                  <th class="num">{{ 'srm.dashboard.col.variance' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (row of d.blocked_invoices.items; track row.run_id) {
                  <tr>
                    <td>
                      <a [routerLink]="['/procurement/invoice-matching', row.run_id]">{{
                        row.invoice_number || row.passive_invoice_id
                      }}</a>
                      <nz-tag nzColor="error">{{
                        'invoiceMatching.status.' + row.status | translate
                      }}</nz-tag>
                    </td>
                    <td>{{ row.supplier_name }}</td>
                    <td class="num">{{ row.variance_amount | money: row.currency }}</td>
                    <td>
                      <app-document-flow-drawer
                        type="supplier_invoice"
                        [documentId]="row.passive_invoice_id"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
            @if (d.blocked_invoices.count > d.blocked_invoices.items.length) {
              <a routerLink="/procurement/invoice-matching/blocked">{{
                'srm.dashboard.seeAll' | translate
              }}</a>
            }
          </nz-card>
        </div>
      </div>

      <div nz-row [nzGutter]="[16, 16]" class="section">
        <div nz-col [nzXs]="24" [nzLg]="12">
          <nz-card [nzTitle]="'srm.dashboard.spendBySupplier' | translate" nzSize="small">
            <nz-table
              [nzData]="d.spend.by_supplier"
              [nzShowPagination]="false"
              nzSize="small"
              [nzNoResult]="'srm.dashboard.noSpend' | translate"
            >
              <tbody>
                @for (row of d.spend.by_supplier; track row.key ?? $index) {
                  <tr>
                    <td>{{ row.label || ('srm.dashboard.unassigned' | translate) }}</td>
                    <td class="num">{{ row.orders }}</td>
                    <td class="num">{{ toNumber(row.spend) | number: '1.2-2' }}</td>
                    <td class="bar">
                      <nz-progress
                        [nzPercent]="share(row.spend, d.spend.by_supplier)"
                        nzSize="small"
                        [nzShowInfo]="false"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-card>
        </div>
        <div nz-col [nzXs]="24" [nzLg]="12">
          <nz-card [nzTitle]="'srm.dashboard.spendByCategory' | translate" nzSize="small">
            <nz-table
              [nzData]="d.spend.by_category"
              [nzShowPagination]="false"
              nzSize="small"
              [nzNoResult]="'srm.dashboard.noSpend' | translate"
            >
              <tbody>
                @for (row of d.spend.by_category; track row.key ?? $index) {
                  <tr>
                    <td>{{ row.label || ('srm.dashboard.unassigned' | translate) }}</td>
                    <td class="num">{{ row.orders }}</td>
                    <td class="num">{{ toNumber(row.spend) | number: '1.2-2' }}</td>
                    <td class="bar">
                      <nz-progress
                        [nzPercent]="share(row.spend, d.spend.by_category)"
                        nzSize="small"
                        [nzShowInfo]="false"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-card>
        </div>
      </div>

      <div nz-row [nzGutter]="[16, 16]" class="section">
        <div nz-col [nzXs]="24" [nzLg]="12">
          <nz-card [nzTitle]="'srm.dashboard.topSuppliers' | translate" nzSize="small">
            <ng-container
              *ngTemplateOutlet="ratingList; context: { $implicit: d.scorecards.top }"
            />
          </nz-card>
        </div>
        <div nz-col [nzXs]="24" [nzLg]="12">
          <nz-card [nzTitle]="'srm.dashboard.bottomSuppliers' | translate" nzSize="small">
            <ng-container
              *ngTemplateOutlet="ratingList; context: { $implicit: d.scorecards.bottom }"
            />
          </nz-card>
        </div>
      </div>

      <nz-card [nzTitle]="'srm.dashboard.supplierBase' | translate" nzSize="small" class="section">
        <div class="qualification">
          @for (entry of d.suppliers.by_qualification | keyvalue; track entry.key) {
            <nz-tag>{{ 'srm.qualification.' + entry.key | translate }}: {{ entry.value }}</nz-tag>
          } @empty {
            <nz-empty nzNotFoundImage="simple" />
          }
          <nz-tag [nzColor]="d.suppliers.expiring_documents > 0 ? 'warning' : 'default'">
            {{ 'srm.dashboard.expiringDocuments' | translate }}:
            {{ d.suppliers.expiring_documents }}
          </nz-tag>
          <nz-tag [nzColor]="d.suppliers.expired_documents > 0 ? 'error' : 'default'">
            {{ 'srm.dashboard.expiredDocuments' | translate }}: {{ d.suppliers.expired_documents }}
          </nz-tag>
        </div>
      </nz-card>
    }

    <ng-template #ratingList let-ratings>
      @if (ratings.length === 0) {
        <nz-empty [nzNotFoundContent]="'srm.scorecards.empty' | translate" />
      } @else {
        @for (rating of ratings; track rating.supplier_id) {
          <div class="rating-row">
            <a
              [routerLink]="['/procurement/srm/scorecards']"
              [queryParams]="{ supplier: rating.supplier_id }"
              >{{ rating.supplier_name }}</a
            >
            <nz-tag [nzColor]="tier(rating)">{{ rating.tier }}</nz-tag>
            <nz-progress
              class="rating-bar"
              [nzPercent]="toNumber(rating.score) ?? 0"
              [nzStatus]="status(rating)"
              nzSize="small"
            />
          </div>
        }
      }
    </ng-template>
  `,
  styles: `
    .kpi-link {
      display: block;
      color: inherit;
    }
    .kpi-alert {
      border-color: #ff4d4f;
    }
    .kpi-hint {
      color: rgba(0, 0, 0, 0.45);
    }
    .section {
      margin-top: 16px;
    }
    .num {
      text-align: right;
    }
    .bar {
      min-width: 120px;
    }
    .rating-row {
      display: grid;
      grid-template-columns: minmax(120px, 1fr) auto minmax(120px, 2fr);
      align-items: center;
      gap: 12px;
      padding: 4px 0;
    }
    .qualification {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export class SrmDashboardPageComponent implements OnInit {
  protected readonly store = inject(SrmStore);
  protected readonly range = signal<Date[]>([new Date(new Date().getFullYear(), 0, 1), new Date()]);
  protected readonly data = computed<SrmDashboard | null>(() => this.store.dashboard());

  protected readonly kpis = computed<KpiCard[]>(() => {
    const d = this.data();
    if (!d) {
      return [];
    }
    return [
      {
        key: 'requisitions',
        label: 'srm.kpi.pendingRequisitions',
        value: d.requisitions.pending_approval,
        hint: null,
        route: '/procurement/requisitions',
        icon: 'file-text',
        alert: false,
      },
      {
        key: 'rfqs',
        label: 'srm.kpi.openRfqs',
        value: d.rfqs.open,
        hint: null,
        route: '/procurement/rfqs',
        icon: 'solution',
        alert: d.rfqs.expiring_soon > 0,
      },
      {
        key: 'orders',
        label: 'srm.kpi.openOrders',
        value: d.orders.open,
        hint: null,
        route: '/procurement/orders',
        icon: 'shopping-cart',
        alert: false,
      },
      {
        key: 'overdue',
        label: 'srm.kpi.overdueOrders',
        value: d.orders.overdue,
        hint: null,
        route: '/procurement/overdue-orders',
        icon: 'clock-circle',
        alert: d.orders.overdue > 0,
      },
      {
        key: 'receipts',
        label: 'srm.kpi.receiptsToCheck',
        value: d.receipts.pending_inspection + d.receipts.awaiting_invoice,
        hint: null,
        route: '/procurement/orders',
        icon: 'inbox',
        alert: false,
      },
      {
        key: 'blocked',
        label: 'srm.kpi.blockedInvoices',
        value: d.blocked_invoices.count,
        hint: null,
        route: '/procurement/invoice-matching/blocked',
        icon: 'stop',
        alert: d.blocked_invoices.count > 0,
      },
    ];
  });

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    const [from, to] = this.range();
    this.store.loadDashboard({ from: toIsoDate(from), to: toIsoDate(to) });
  }

  protected onRange(range: Date[] | null): void {
    if (range && range.length === 2) {
      this.range.set(range);
      this.reload();
    }
  }

  protected daysLate(order: SrmOverdueOrder): number {
    if (!order.expected_delivery_date) {
      return 0;
    }
    const diff = Date.now() - new Date(order.expected_delivery_date).getTime();
    return Math.max(0, Math.floor(diff / 86_400_000));
  }

  protected share(value: string, rows: { spend: string }[]): number {
    const max = Math.max(...rows.map((row) => toNumber(row.spend) ?? 0), 0);
    const current = toNumber(value) ?? 0;
    return max > 0 ? Math.round((current / max) * 100) : 0;
  }

  protected tier(rating: SupplierRating): string {
    return tierColor(rating.tier);
  }

  protected status(rating: SupplierRating): 'success' | 'normal' | 'exception' {
    return scoreStatus(rating.score);
  }

  protected toNumber = toNumber;
}

function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
