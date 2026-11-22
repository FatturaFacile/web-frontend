import { Component, DestroyRef, inject, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ManufacturingApiService, MfgWorkCenterResource } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { catchError, of } from 'rxjs';
import { BomItemPickerComponent } from '../bom/bom-item-picker.component';
import {
  MrpExceptionCode,
  MrpProposal,
  MrpProposalAction,
  MrpProposalSortBy,
  MrpProposalStatus,
  MrpProposalType,
} from './mrp.models';
import { formatIsoDate } from './mrp-gantt.utils';
import { MrpStore } from './mrp.store';
import {
  EXCEPTION_CODES,
  EXCEPTION_COLORS,
  EXCEPTION_KEYS,
  formatQuantity,
  isEligible,
  PROPOSAL_STATUS_COLORS,
  PROPOSAL_STATUS_KEYS,
  PROPOSAL_STATUSES,
  PROPOSAL_TYPE_COLORS,
  PROPOSAL_TYPE_KEYS,
  PROPOSAL_TYPES,
} from './mrp.utils';

type SortOrder = 'ascend' | 'descend' | null;

/**
 * The proposals workbench: filters, a server-paged and server-sorted table with type badges, exception tags and the quantity
 * and date columns, the row actions (firm, release, dismiss, inspect pegging), the bulk selection and the Mass Firm & Release
 * confirmation that first summarises the documents it will generate.
 */
@Component({
  selector: 'app-mrp-workbench',
  imports: [
    FormsModule,
    TranslatePipe,
    BomItemPickerComponent,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    NzTooltipModule,
  ],
  styles: `
    :host {
      display: block;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }
    .filter {
      min-width: 190px;
    }
    .item-filter {
      min-width: 260px;
    }
    .bulk {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .muted {
      color: var(--ant-text-color-secondary, rgba(0, 0, 0, 0.45));
    }
    .summary {
      margin: 0 0 12px;
      padding-left: 20px;
    }
    .summary strong {
      font-variant-numeric: tabular-nums;
    }
  `,
  template: `
    @if (store.lastResult(); as result) {
      <nz-alert
        nzType="success"
        nzShowIcon
        nzCloseable
        class="result"
        data-testid="result-banner"
        [nzMessage]="'MRP.ACTION_DONE_TITLE' | translate"
        [nzDescription]="
          'MRP.ACTION_DONE_TEXT'
            | translate
              : {
                  processed: result.processed,
                  requisitions: result.purchase_requisition_ids.length,
                  orders: result.production_order_ids.length,
                }
        "
        (nzOnClose)="store.lastResult.set(null)"
      ></nz-alert>
    }

    <div class="filters" data-testid="filters">
      <nz-select
        class="filter"
        nzAllowClear
        data-testid="filter-type"
        [ngModel]="store.filters().proposalType"
        [nzPlaceHolder]="'MRP.FILTER_TYPE' | translate"
        [attr.aria-label]="'MRP.FILTER_TYPE' | translate"
        (ngModelChange)="filter({ proposalType: $event })"
      >
        @for (type of types; track type) {
          <nz-option [nzValue]="type" [nzLabel]="typeKeys[type] | translate"></nz-option>
        }
      </nz-select>
      <nz-select
        class="filter"
        nzAllowClear
        data-testid="filter-status"
        [ngModel]="store.filters().status"
        [nzPlaceHolder]="'MRP.FILTER_STATUS' | translate"
        [attr.aria-label]="'MRP.FILTER_STATUS' | translate"
        (ngModelChange)="filter({ status: $event })"
      >
        @for (status of statuses; track status) {
          <nz-option [nzValue]="status" [nzLabel]="statusKeys[status] | translate"></nz-option>
        }
      </nz-select>
      <nz-select
        class="filter"
        nzAllowClear
        data-testid="filter-exception"
        [ngModel]="store.filters().exceptionCode"
        [nzPlaceHolder]="'MRP.FILTER_EXCEPTION' | translate"
        [attr.aria-label]="'MRP.FILTER_EXCEPTION' | translate"
        (ngModelChange)="filter({ exceptionCode: $event })"
      >
        @for (code of exceptionCodes; track code) {
          <nz-option [nzValue]="code" [nzLabel]="exceptionKeys[code] | translate"></nz-option>
        }
      </nz-select>
      <div class="item-filter" data-testid="filter-item">
        <app-bom-item-picker
          placeholder="MRP.FILTER_ITEM"
          [value]="store.filters().itemId"
          (valueChange)="filter({ itemId: $event })"
        ></app-bom-item-picker>
      </div>
      <nz-select
        class="filter"
        nzAllowClear
        nzShowSearch
        data-testid="filter-work-center"
        [ngModel]="store.filters().workCenterId"
        [nzPlaceHolder]="'MRP.FILTER_WORK_CENTER' | translate"
        [attr.aria-label]="'MRP.FILTER_WORK_CENTER' | translate"
        (ngModelChange)="filter({ workCenterId: $event })"
      >
        @for (center of workCenters(); track center.id) {
          <nz-option
            [nzValue]="center.id"
            [nzLabel]="center.work_center_code + ' · ' + center.name"
          ></nz-option>
        }
      </nz-select>
      <nz-range-picker
        data-testid="filter-need-by"
        [attr.aria-label]="'MRP.FILTER_NEED_BY' | translate"
        [nzPlaceHolder]="[
          'MRP.FILTER_NEED_BY_FROM' | translate,
          'MRP.FILTER_NEED_BY_TO' | translate,
        ]"
        (ngModelChange)="needByChanged($event)"
        [ngModel]="needByRange()"
      ></nz-range-picker>
      <button nz-button type="button" data-testid="reset-filters" (click)="resetFilters()">
        {{ 'MRP.FILTER_RESET' | translate }}
      </button>
    </div>

    @if (store.selectionCount() > 0) {
      <div class="bulk" data-testid="bulk-bar">
        <span data-testid="selection-count">{{
          'MRP.SELECTED_COUNT' | translate: { count: store.selectionCount() }
        }}</span>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-testid="mass-release"
          (click)="openRelease()"
        >
          {{ 'MRP.MASS_FIRM_RELEASE' | translate }}
        </button>
        <button
          nz-button
          type="button"
          data-testid="mass-dismiss"
          [disabled]="store.acting()"
          (click)="dismissSelection()"
        >
          {{ 'MRP.DISMISS_SELECTED' | translate }}
        </button>
        <button nz-button nzType="link" type="button" (click)="store.clearSelection()">
          {{ 'MRP.CLEAR_SELECTION' | translate }}
        </button>
      </div>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        nzSize="small"
        nzBordered
        data-testid="proposals-table"
        [nzData]="store.proposals()"
        [nzFrontPagination]="false"
        [nzTotal]="store.meta()?.total ?? 0"
        [nzPageIndex]="store.filters().page"
        [nzPageSize]="store.filters().perPage"
        [nzScroll]="{ x: '1380px' }"
        (nzPageIndexChange)="pageChanged($event)"
      >
        <thead>
          <tr>
            <th
              nzLeft
              nzWidth="48px"
              nzShowCheckbox
              [nzChecked]="store.pageAllSelected()"
              [nzIndeterminate]="store.pageSomeSelected()"
              (nzCheckedChange)="store.togglePage($event)"
            ></th>
            <th nzLeft nzWidth="220px">{{ 'MRP.COL_ITEM' | translate }}</th>
            <th
              nzColumnKey="proposal_type"
              [nzSortOrder]="sortOrder('proposal_type')"
              (nzSortOrderChange)="sort('proposal_type', $event)"
            >
              {{ 'MRP.COL_TYPE' | translate }}
            </th>
            <th
              nzColumnKey="status"
              [nzSortOrder]="sortOrder('status')"
              (nzSortOrderChange)="sort('status', $event)"
            >
              {{ 'MRP.COL_STATUS' | translate }}
            </th>
            <th>{{ 'MRP.COL_EXCEPTIONS' | translate }}</th>
            <th
              class="num"
              nzColumnKey="gross_requirement_qty"
              [nzSortOrder]="sortOrder('gross_requirement_qty')"
              (nzSortOrderChange)="sort('gross_requirement_qty', $event)"
            >
              {{ 'MRP.COL_GROSS' | translate }}
            </th>
            <th class="num">{{ 'MRP.COL_PROJECTED' | translate }}</th>
            <th
              class="num"
              nzColumnKey="net_requirement_qty"
              [nzSortOrder]="sortOrder('net_requirement_qty')"
              (nzSortOrderChange)="sort('net_requirement_qty', $event)"
            >
              {{ 'MRP.COL_NET' | translate }}
            </th>
            <th
              class="num"
              nzColumnKey="suggested_order_qty"
              [nzSortOrder]="sortOrder('suggested_order_qty')"
              (nzSortOrderChange)="sort('suggested_order_qty', $event)"
            >
              <span nz-tooltip [nzTooltipTitle]="'MRP.TIP_SUGGESTED' | translate">{{
                'MRP.COL_SUGGESTED' | translate
              }}</span>
            </th>
            <th
              nzColumnKey="need_by_date"
              [nzSortOrder]="sortOrder('need_by_date')"
              (nzSortOrderChange)="sort('need_by_date', $event)"
            >
              {{ 'MRP.COL_NEED_BY' | translate }}
            </th>
            <th
              nzColumnKey="release_order_by_date"
              [nzSortOrder]="sortOrder('release_order_by_date')"
              (nzSortOrderChange)="sort('release_order_by_date', $event)"
            >
              {{ 'MRP.COL_RELEASE_BY' | translate }}
            </th>
            <th nzRight nzWidth="300px">{{ 'MRP.COL_ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of store.proposals(); track row.id) {
            <tr [attr.data-testid]="'row-' + row.id">
              <td
                nzLeft
                nzShowCheckbox
                [nzChecked]="isSelected(row)"
                (nzCheckedChange)="store.toggleSelection(row, $event)"
              ></td>
              <td nzLeft>
                <strong>{{ row.item_code }}</strong>
                <div class="muted">
                  {{ row.item_name }} · {{ 'MRP.LLC' | translate }} {{ row.low_level_code }}
                </div>
              </td>
              <td>
                <nz-tag data-testid="type-badge" [nzColor]="typeColors[row.proposal_type]">{{
                  typeKeys[row.proposal_type] | translate
                }}</nz-tag>
              </td>
              <td>
                <nz-tag data-testid="status-badge" [nzColor]="statusColors[row.status]">{{
                  statusKeys[row.status] | translate
                }}</nz-tag>
              </td>
              <td>
                <div class="tags">
                  @for (code of row.exception_messages; track code) {
                    <nz-tag
                      data-testid="exception-tag"
                      [attr.data-code]="code"
                      [nzColor]="exceptionColors[code]"
                      nz-tooltip
                      [nzTooltipTitle]="exceptionHints[code] | translate"
                    >
                      {{ exceptionKeys[code] | translate }}
                    </nz-tag>
                  }
                </div>
              </td>
              <td class="num">{{ qty(row.gross_requirement_qty) }}</td>
              <td class="num">{{ qty(row.projected_on_hand_qty) }}</td>
              <td class="num">{{ qty(row.net_requirement_qty) }}</td>
              <td class="num">
                <strong>{{ qty(row.suggested_order_qty) }}</strong>
              </td>
              <td>{{ row.need_by_date ?? '-' }}</td>
              <td>{{ row.release_order_by_date ?? '-' }}</td>
              <td nzRight>
                <div class="actions">
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    data-testid="act-firm"
                    [disabled]="store.acting() || !eligible(row, 'firm')"
                    (click)="act(row, 'firm')"
                  >
                    {{ 'MRP.ACTION_FIRM' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzType="primary"
                    type="button"
                    data-testid="act-release"
                    [disabled]="store.acting() || !eligible(row, 'release')"
                    (click)="act(row, 'release')"
                  >
                    {{ 'MRP.ACTION_RELEASE' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    data-testid="act-dismiss"
                    [disabled]="store.acting() || !eligible(row, 'dismiss')"
                    (click)="act(row, 'dismiss')"
                  >
                    {{ 'MRP.ACTION_DISMISS' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    data-testid="act-pegging"
                    (click)="inspect(row)"
                  >
                    {{ 'MRP.ACTION_PEGGING' | translate }}
                  </button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-modal
      [nzVisible]="releaseOpen()"
      [nzTitle]="'MRP.RELEASE_TITLE' | translate"
      [nzOkText]="'MRP.RELEASE_CONFIRM' | translate"
      [nzCancelText]="'MRP.CANCEL' | translate"
      [nzOkLoading]="store.acting()"
      [nzOkDisabled]="
        store.releaseSummary().eligible === 0 || store.releaseSummary().ineligible > 0
      "
      (nzOnOk)="confirmRelease()"
      (nzOnCancel)="releaseOpen.set(false)"
    >
      <ng-container *nzModalContent>
        @if (store.releaseSummary(); as summary) {
          <p data-testid="release-intro">
            {{ 'MRP.RELEASE_INTRO' | translate: { count: summary.selected } }}
          </p>
          <ul class="summary" data-testid="release-summary">
            <li>
              <strong data-testid="summary-requisitions">{{ summary.purchaseRequisitions }}</strong>
              {{ 'MRP.RELEASE_REQUISITIONS' | translate }}
            </li>
            <li>
              <strong data-testid="summary-orders">{{ summary.productionOrders }}</strong>
              {{ 'MRP.RELEASE_ORDERS' | translate }}
            </li>
            <li>
              <strong data-testid="summary-ineligible">{{ summary.ineligible }}</strong>
              {{ 'MRP.RELEASE_INELIGIBLE' | translate }}
            </li>
          </ul>
          @if (summary.ineligible > 0) {
            <nz-alert
              nzType="warning"
              nzShowIcon
              data-testid="release-ineligible-alert"
              [nzMessage]="'MRP.RELEASE_INELIGIBLE_HINT' | translate"
            ></nz-alert>
            <button
              nz-button
              type="button"
              data-testid="keep-eligible"
              (click)="store.keepEligible('release')"
            >
              {{ 'MRP.RELEASE_KEEP_ELIGIBLE' | translate }}
            </button>
          }
        }
      </ng-container>
    </nz-modal>
  `,
})
export class MrpWorkbenchComponent implements OnInit {
  protected readonly store = inject(MrpStore);
  private readonly manufacturing = inject(ManufacturingApiService);
  private readonly destroyRef = inject(DestroyRef);

  /** The inspect-pegging button of a row was used. */
  readonly pegging = output<MrpProposal>();
  /** The KPIs of the run changed (an action ran): the host reloads them. */
  readonly changed = output<void>();

  protected readonly types = PROPOSAL_TYPES;
  protected readonly statuses = PROPOSAL_STATUSES;
  protected readonly exceptionCodes = EXCEPTION_CODES;
  protected readonly typeKeys = PROPOSAL_TYPE_KEYS;
  protected readonly typeColors = PROPOSAL_TYPE_COLORS;
  protected readonly statusKeys = PROPOSAL_STATUS_KEYS;
  protected readonly statusColors = PROPOSAL_STATUS_COLORS;
  protected readonly exceptionKeys = EXCEPTION_KEYS;
  protected readonly exceptionColors = EXCEPTION_COLORS;
  protected readonly exceptionHints: Record<MrpExceptionCode, string> = {
    Expedite: 'MRP.HINT_EXPEDITE',
    Defer: 'MRP.HINT_DEFER',
    PastDueRelease: 'MRP.HINT_PAST_DUE_RELEASE',
    BelowSafetyStock: 'MRP.HINT_BELOW_SAFETY_STOCK',
    CapacityOverload: 'MRP.HINT_CAPACITY_OVERLOAD',
    HolidayShiftApplied: 'MRP.HINT_HOLIDAY_SHIFT',
    CustomsLeadTimeApplied: 'MRP.HINT_CUSTOMS_LEAD_TIME',
    LateDelivery: 'MRP.HINT_LATE_DELIVERY',
    ExcessSupply: 'MRP.HINT_EXCESS_SUPPLY',
  };
  protected readonly qty = formatQuantity;
  protected readonly eligible = isEligible;

  protected readonly workCenters = signal<MfgWorkCenterResource[]>([]);
  protected readonly needByRange = signal<Date[]>([]);
  protected readonly releaseOpen = signal(false);

  ngOnInit(): void {
    this.manufacturing
      .getWorkCenters({ per_page: 200 })
      .pipe(
        catchError(() => of({ data: [] as MfgWorkCenterResource[] })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => this.workCenters.set(res.data));
  }

  protected isSelected(row: MrpProposal): boolean {
    return this.store.selection()[row.id] !== undefined;
  }

  protected reload(): void {
    this.store.loadProposals().subscribe();
  }

  protected filter(patch: {
    proposalType?: MrpProposalType | null;
    status?: MrpProposalStatus | null;
    exceptionCode?: MrpExceptionCode | null;
    itemId?: string | null;
    workCenterId?: string | null;
  }): void {
    this.store.setFilters(patch);
    this.reload();
  }

  protected needByChanged(range: Date[] | null): void {
    const [from, to] = range ?? [];

    this.needByRange.set(range ?? []);
    this.store.setFilters({
      needByFrom: from ? formatIsoDate(from) : null,
      needByTo: to ? formatIsoDate(to) : null,
    });
    this.reload();
  }

  protected resetFilters(): void {
    this.needByRange.set([]);
    this.store.resetFilters();
    this.reload();
  }

  protected pageChanged(page: number): void {
    if (page !== this.store.filters().page) {
      this.store.setPage(page);
      this.reload();
    }
  }

  protected sortOrder(key: MrpProposalSortBy): SortOrder {
    const filters = this.store.filters();

    if (filters.sortBy !== key) {
      return null;
    }

    return filters.sortDirection === 'asc' ? 'ascend' : 'descend';
  }

  protected sort(key: MrpProposalSortBy, order: string | null): void {
    if (order === null) {
      this.store.setSort('need_by_date', 'asc');
    } else {
      this.store.setSort(key, order === 'ascend' ? 'asc' : 'desc');
    }
    this.reload();
  }

  protected act(row: MrpProposal, action: MrpProposalAction): void {
    this.store.applyActionTo(row, action).subscribe((result) => {
      if (result !== null) {
        this.changed.emit();
      }
    });
  }

  protected inspect(row: MrpProposal): void {
    this.pegging.emit(row);
  }

  protected openRelease(): void {
    this.releaseOpen.set(true);
  }

  protected confirmRelease(): void {
    this.store.applyAction('release').subscribe((result) => {
      if (result !== null) {
        this.releaseOpen.set(false);
        this.changed.emit();
      }
    });
  }

  protected dismissSelection(): void {
    this.store.applyAction('dismiss').subscribe((result) => {
      if (result !== null) {
        this.changed.emit();
      }
    });
  }
}
