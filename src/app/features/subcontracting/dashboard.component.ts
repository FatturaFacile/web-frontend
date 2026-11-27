import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  PermissionsService,
  SCT_DEADLINE_STATUSES,
  SCT_DIRECTIONS,
  SctDashboardFilters,
  SctDeadlineStatus,
  SctDirection,
  SctPartnerTotal,
  SctStockRow,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { DashboardStore } from './dashboard.store';
import {
  countdownOf,
  deadlineColor,
  directionColor,
  SUBCONTRACTING_MODULE,
} from './subcontracting.util';

interface Choice {
  value: string;
  label: string;
}

/**
 * The cruscotto of the goods held by subcontractors (passive) and of the customer goods held by us (active): KPI cards, the matrix
 * per partner with an expandable breakdown per product, lot and order, aging and the one-year statutory return deadline.
 */
@Component({
  selector: 'app-sct-dashboard',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [DashboardStore],
  styleUrl: './subcontracting.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.SUBCONTRACTING_DASHBOARD' | translate"
      [subtitle]="'subcontracting.dashboard.subtitle' | translate"
    >
      @if (canWrite) {
        <a
          nz-button
          nzType="primary"
          header-actions
          routerLink="/subcontracting/orders/new"
          data-test="new-order"
        >
          {{ 'subcontracting.action.newOrder' | translate }}
        </a>
      }
    </app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    @if (store.dashboard(); as dashboard) {
      <div class="kpi-grid">
        <div class="kpi" data-test="kpi-passive">
          <div class="kpi-label">{{ 'subcontracting.kpi.activePassive' | translate }}</div>
          <div class="kpi-value">{{ dashboard.kpis.active_passive_orders }}</div>
        </div>
        <div class="kpi" data-test="kpi-active">
          <div class="kpi-label">{{ 'subcontracting.kpi.activeCustomer' | translate }}</div>
          <div class="kpi-value">{{ dashboard.kpis.active_customer_orders }}</div>
        </div>
        <div class="kpi" data-test="kpi-units">
          <div class="kpi-label">{{ 'subcontracting.kpi.unitsHeld' | translate }}</div>
          <div class="kpi-value">{{ dashboard.kpis.units_held }}</div>
        </div>
        <div class="kpi warn" data-test="kpi-expiring">
          <div class="kpi-label">{{ 'subcontracting.kpi.expiring' | translate }}</div>
          <div class="kpi-value">{{ dashboard.kpis.expiring_30d }}</div>
        </div>
        <div class="kpi alert" data-test="kpi-overdue">
          <div class="kpi-label">{{ 'subcontracting.kpi.overdue' | translate }}</div>
          <div class="kpi-value">{{ dashboard.kpis.overdue_deadlines }}</div>
        </div>
        <div class="kpi" data-test="kpi-customs">
          <div class="kpi-label">{{ 'subcontracting.kpi.customsRegimes' | translate }}</div>
          <div class="kpi-value">{{ dashboard.kpis.active_customs_regimes }}</div>
        </div>
      </div>
    }

    <div class="toolbar">
      <label class="field" for="sct-d-direction">
        <span>{{ 'subcontracting.field.direction' | translate }}</span>
        <nz-select nzId="sct-d-direction" nzAllowClear [(ngModel)]="direction" (ngModelChange)="reload()">
          @for (item of directions; track item) {
            <nz-option [nzValue]="item" [nzLabel]="'subcontracting.direction.' + item | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="sct-d-partner">
        <span>{{ 'subcontracting.field.partner' | translate }}</span>
        <nz-select nzId="sct-d-partner" nzAllowClear nzShowSearch [(ngModel)]="partnerId" (ngModelChange)="reload()">
          @for (item of catalog().partners; track item.value) {
            <nz-option [nzValue]="item.value" [nzLabel]="item.label"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="sct-d-product">
        <span>{{ 'subcontracting.field.product' | translate }}</span>
        <nz-select nzId="sct-d-product" nzAllowClear nzShowSearch [(ngModel)]="productId" (ngModelChange)="reload()">
          @for (item of catalog().products; track item.value) {
            <nz-option [nzValue]="item.value" [nzLabel]="item.label"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="sct-d-lot">
        <span>{{ 'subcontracting.field.lot' | translate }}</span>
        <nz-select nzId="sct-d-lot" nzAllowClear [(ngModel)]="lotId" (ngModelChange)="reload()">
          @for (item of catalog().lots; track item.value) {
            <nz-option [nzValue]="item.value" [nzLabel]="item.label"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="sct-d-deadline">
        <span>{{ 'subcontracting.field.deadlineStatus' | translate }}</span>
        <nz-select nzId="sct-d-deadline" nzAllowClear [(ngModel)]="deadlineStatus" (ngModelChange)="reload()">
          @for (item of deadlineStatuses; track item) {
            <nz-option [nzValue]="item" [nzLabel]="'subcontracting.deadlineStatus.' + item | translate"></nz-option>
          }
        </nz-select>
      </label>
    </div>

    <h3 class="section-title">{{ 'subcontracting.section.stockAtPartners' | translate }}</h3>
    <nz-spin [nzSpinning]="store.loading()">
      <nz-table #table nzSize="small" [nzData]="partners()" [nzShowPagination]="false" [nzScroll]="{ x: '800px' }">
        <thead>
          <tr>
            <th scope="col" nzWidth="48px"></th>
            <th scope="col">{{ 'subcontracting.field.partner' | translate }}</th>
            <th scope="col">{{ 'subcontracting.field.direction' | translate }}</th>
            <th scope="col" class="num">{{ 'subcontracting.field.heldQty' | translate }}</th>
            <th scope="col" class="num">{{ 'subcontracting.field.openOrders' | translate }}</th>
            <th scope="col">{{ 'subcontracting.field.deadlineStatus' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (partner of table.data; track key(partner)) {
            <tr [attr.data-test]="'partner-' + partner.partner_id">
              <td [nzExpand]="isOpen(partner)" (nzExpandChange)="toggle(partner, $event)"></td>
              <th scope="row">
                {{ partner.partner_name ?? partner.partner_id }}
                @if (partner.direction === 'active') {
                  <nz-tag class="zero-value" nzColor="purple">{{ 'subcontracting.badge.zeroValue' | translate }}</nz-tag>
                }
              </th>
              <td>
                <nz-tag [nzColor]="directionColor(partner.direction)">{{
                  'subcontracting.direction.' + partner.direction | translate
                }}</nz-tag>
              </td>
              <td class="num">{{ partner.held_qty }}</td>
              <td class="num">{{ partner.open_orders }}</td>
              <td>
                <nz-tag [nzColor]="deadlineColor(partner.worst_deadline_status)">{{
                  'subcontracting.deadlineStatus.' + partner.worst_deadline_status | translate
                }}</nz-tag>
              </td>
            </tr>
            <tr [nzExpand]="isOpen(partner)">
              <td></td>
              <td colspan="5">
                <nz-table nzSize="small" [nzData]="rowsOf(partner)" [nzShowPagination]="false">
                  <thead>
                    <tr>
                      <th scope="col">{{ 'subcontracting.field.product' | translate }}</th>
                      <th scope="col">{{ 'subcontracting.field.lot' | translate }}</th>
                      <th scope="col">{{ 'subcontracting.field.order' | translate }}</th>
                      <th scope="col" class="num">{{ 'subcontracting.field.heldQty' | translate }}</th>
                      <th scope="col" class="num">{{ 'subcontracting.field.agingDays' | translate }}</th>
                      <th scope="col">{{ 'subcontracting.field.deadline' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of rowsOf(partner); track row.order_id + row.product_id + (row.lot_id ?? '')) {
                      <tr>
                        <td>
                          {{ row.product_name ?? row.product_id }}
                          <small class="muted">{{ row.sku }}</small>
                        </td>
                        <td>{{ row.lot_id ?? '—' }}</td>
                        <td>
                          <a [routerLink]="['/subcontracting/orders', row.order_id]">{{ row.order_number }}</a>
                        </td>
                        <td class="num">{{ row.held_qty }}</td>
                        <td class="num">{{ row.aging_days ?? '—' }}</td>
                        <td>
                          <span [class]="'deadline ' + row.deadline_status">
                            {{ row.statutory_return_deadline | date: 'mediumDate' }}
                            @if (countdown(row); as left) {
                              · {{ left.key | translate: { days: left.days } }}
                            }
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </nz-table>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && partners().length === 0) {
        <nz-empty [nzNotFoundContent]="'subcontracting.empty.stock' | translate"></nz-empty>
      }
    </nz-spin>
  `,
})
export class DashboardComponent implements OnInit {
  protected readonly store = inject(DashboardStore);
  protected readonly canWrite = inject(PermissionsService).canWrite(SUBCONTRACTING_MODULE);

  protected readonly directions = SCT_DIRECTIONS;
  protected readonly deadlineStatuses = SCT_DEADLINE_STATUSES;
  protected readonly directionColor = directionColor;
  protected readonly deadlineColor = deadlineColor;

  protected direction: SctDirection | null = null;
  protected partnerId: string | null = null;
  protected productId: string | null = null;
  protected lotId: string | null = null;
  protected deadlineStatus: SctDeadlineStatus | null = null;

  private readonly open = signal<ReadonlySet<string>>(new Set());

  /** Options of the filters, taken from the unfiltered dashboard so a filter never empties its own list. */
  protected readonly catalog = signal<{ partners: Choice[]; products: Choice[]; lots: Choice[] }>({
    partners: [],
    products: [],
    lots: [],
  });

  protected readonly partners = computed(() => this.store.dashboard()?.by_partner ?? []);

  ngOnInit(): void {
    void this.load();
  }

  protected reload(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const filters: SctDashboardFilters = {
      ...(this.direction ? { direction: this.direction } : {}),
      ...(this.partnerId ? { partner_id: this.partnerId } : {}),
      ...(this.productId ? { product_id: this.productId } : {}),
      ...(this.lotId ? { lot_id: this.lotId } : {}),
      ...(this.deadlineStatus ? { deadline_status: this.deadlineStatus } : {}),
    };
    await this.store.load(filters);

    if (Object.keys(filters).length === 0) {
      this.catalog.set(this.catalogOf(this.store.dashboard()?.rows ?? []));
    }
  }

  private catalogOf(rows: SctStockRow[]): { partners: Choice[]; products: Choice[]; lots: Choice[] } {
    const partners = new Map<string, string>();
    const products = new Map<string, string>();
    const lots = new Map<string, string>();
    for (const row of rows) {
      partners.set(row.partner_id, row.partner_name ?? row.partner_id);
      products.set(row.product_id, row.product_name ?? row.product_id);
      if (row.lot_id !== null) {
        lots.set(row.lot_id, row.lot_id);
      }
    }
    const list = (map: Map<string, string>): Choice[] =>
      [...map].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
    return { partners: list(partners), products: list(products), lots: list(lots) };
  }

  protected key(partner: SctPartnerTotal): string {
    return `${partner.direction}|${partner.partner_id}`;
  }

  protected isOpen(partner: SctPartnerTotal): boolean {
    return this.open().has(this.key(partner));
  }

  protected toggle(partner: SctPartnerTotal, expanded: boolean): void {
    const next = new Set(this.open());
    if (expanded) {
      next.add(this.key(partner));
    } else {
      next.delete(this.key(partner));
    }
    this.open.set(next);
  }

  protected rowsOf(partner: SctPartnerTotal): SctStockRow[] {
    return (this.store.dashboard()?.rows ?? []).filter(
      (row) => row.partner_id === partner.partner_id && row.direction === partner.direction,
    );
  }

  protected countdown(row: SctStockRow) {
    return countdownOf(row.days_to_deadline);
  }
}
