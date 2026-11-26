import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import {
  AP_DOCUMENT_TYPES,
  AP_ITEM_STATUSES,
  ApBlockKind,
  ApItem,
  ApItemFilters,
  PermissionsService,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe, RadioControlDirective } from '@shared';
import { PayablesItemsStore } from './payables-items.store';
import {
  canBlockItem,
  canReleaseItem,
  dateRange,
  formatIban,
  isBlockedItem,
  isCreditNote,
  isOverdue,
  itemFiltersFromQuery,
  itemFiltersToQuery,
  itemStatusColor,
  PAYABLES_MODULE,
  skontoColor,
  skontoDaysParts,
  skontoState,
  toIsoDate,
  todayIso,
} from './payables.util';

function queryObject(map: ParamMap): Record<string, string> {
  return Object.fromEntries(map.keys.map((key) => [key, map.get(key) ?? '']));
}

/**
 * Supplier ledger and due-date schedule (Mod 015): open items of XML invoices, QR bills, manual bills and credit notes
 * with the Skonto opportunity, and the dispute / administrative block actions. Blocked items cannot be paid.
 * The filters live in the url so a view can be shared.
 */
@Component({
  selector: 'app-payables-items',
  styleUrl: './payables.scss',
  providers: [PayablesItemsStore],
  imports: [
    RadioControlDirective,
    FormsModule,
    MoneyPipe,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    NzTimelineModule,
    NzTooltipModule,
  ],
  template: `
    <app-page-header
      [title]="'AP.ITEMS_TITLE' | translate"
      [subtitle]="'AP.ITEMS_SUBTITLE' | translate"
    >
    <ng-container ngProjectAs="[header-actions]">
      <a nz-button routerLink="/payables/aging">{{ 'AP.GO_AGING' | translate }}</a>
      <a nz-button nzType="primary" routerLink="/payables/batches">{{
        'AP.GO_BATCHES' | translate
      }}</a>
    </ng-container>
    </app-page-header>

    @if (store.summary(); as summary) {
      <div class="kpi-grid">
        <nz-statistic
          class="kpi"
          [nzTitle]="'AP.KPI_OPEN' | translate"
          [nzValue]="summary.total_open | money: summary.currency"
        ></nz-statistic>
        <nz-statistic
          class="kpi danger"
          [nzTitle]="'AP.KPI_OVERDUE' | translate"
          [nzValue]="summary.total_overdue | money: summary.currency"
        ></nz-statistic>
        <nz-statistic
          class="kpi"
          [nzTitle]="'AP.KPI_SKONTO' | translate"
          [nzValue]="summary.skonto_savings | money: summary.currency"
        ></nz-statistic>
        <nz-statistic
          class="kpi"
          [nzTitle]="'AP.KPI_BLOCKED' | translate"
          [nzValue]="summary.blocked_count"
        ></nz-statistic>
      </div>
    }

    <div class="filters" role="search" [attr.aria-label]="'AP.FILTERS' | translate">
      <div class="field">
        <label for="ap-search">{{ 'AP.SEARCH' | translate }}</label>
        <input
          nz-input
          id="ap-search"
          [ngModel]="filters().search ?? ''"
          (keydown.enter)="apply({ search: searchValue($event) })"
          (blur)="apply({ search: searchValue($event) })"
        />
      </div>

      <div class="field">
        <label for="ap-status">{{ 'AP.STATUS' | translate }}</label>
        <nz-select
          nzId="ap-status"
          style="width: 100%"
          nzAllowClear
          [ngModel]="filters().status ?? null"
          (ngModelChange)="apply({ status: $event ?? undefined })"
        >
          @for (status of statuses; track status) {
            <nz-option
              [nzValue]="status"
              [nzLabel]="'AP.STATUS_' + status.toUpperCase() | translate"
            ></nz-option>
          }
        </nz-select>
      </div>

      <div class="field">
        <label for="ap-doctype">{{ 'AP.DOCUMENT_TYPE' | translate }}</label>
        <nz-select
          nzId="ap-doctype"
          style="width: 100%"
          nzAllowClear
          [ngModel]="filters().document_type ?? null"
          (ngModelChange)="apply({ document_type: $event ?? undefined })"
        >
          @for (type of documentTypes; track type) {
            <nz-option
              [nzValue]="type"
              [nzLabel]="'AP.DOCTYPE_' + type.toUpperCase() | translate"
            ></nz-option>
          }
        </nz-select>
      </div>

      <div class="field">
        <label for="ap-currency">{{ 'AP.CURRENCY' | translate }}</label>
        <input
          nz-input
          id="ap-currency"
          maxlength="3"
          [ngModel]="filters().currency ?? ''"
          (ngModelChange)="applyCurrency($event)"
        />
      </div>

      <div class="field">
        <span>{{ 'AP.DUE_DATE' | translate }}</span>
        <nz-range-picker
          style="width: 100%"
          [ngModel]="dueRange()"
          (ngModelChange)="onDueRange($event)"
        ></nz-range-picker>
      </div>

      <div class="field">
        <label for="payables-items-field-2" nzId="payables-items-field-2"
          nz-checkbox
          [ngModel]="filters().skonto_only === true"
          (ngModelChange)="apply({ skonto_only: $event })"
        >
          {{ 'AP.SKONTO_ONLY' | translate }}
        </label>
      </div>

      <div class="field">
        <label for="payables-items-field" nzId="payables-items-field"
          nz-checkbox
          [ngModel]="filters().open_only !== false"
          (ngModelChange)="apply({ open_only: $event })"
        >
          {{ 'AP.OPEN_ONLY' | translate }}
        </label>
      </div>
    </div>

    <div class="toolbar">
      <button nz-button type="button" (click)="reset()">
        {{ 'AP.RESET_FILTERS' | translate }}
      </button>
      <span class="muted spacer">{{ 'AP.RESULTS' | translate: { total: store.total() } }}</span>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="card" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.items()"
        [nzFrontPagination]="false"
        [nzShowPagination]="true"
        [nzTotal]="store.total()"
        [nzPageIndex]="store.page()"
        [nzPageSize]="store.pageSize()"
        [nzNoResult]="empty"
        (nzPageIndexChange)="store.setPage($event)"
      >
        <thead>
          <tr>
            <th>{{ 'AP.SUPPLIER' | translate }}</th>
            <th>{{ 'AP.DOCUMENT' | translate }}</th>
            <th>{{ 'AP.ISSUE_DATE' | translate }}</th>
            <th>{{ 'AP.DUE_DATE' | translate }}</th>
            <th class="num">{{ 'AP.OPEN_AMOUNT' | translate }}</th>
            <th>{{ 'AP.SKONTO' | translate }}</th>
            <th>{{ 'AP.STATUS' | translate }}</th>
            <th>{{ 'AP.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr [class.overdue-row]="overdue(row)" [class.blocked-row]="isBlocked(row)">
              <td>
                {{ row.supplier_name }}
                @if (row.supplier_iban) {
                  <div class="muted small">{{ iban(row.supplier_iban) }}</div>
                }
              </td>
              <td>
                {{ row.document_number }}
                <div class="muted small">
                  {{ 'AP.DOCTYPE_' + row.document_type.toUpperCase() | translate }}
                </div>
              </td>
              <td>{{ row.issue_date }}</td>
              <td>
                {{ row.due_date }}
                @if (overdue(row)) {
                  <nz-tag nzColor="red">{{ 'AP.OVERDUE' | translate }}</nz-tag>
                }
              </td>
              <td class="num" [class.negative]="isCredit(row)">
                {{ row.open_amount | money: row.currency }}
              </td>
              <td>
                @if (row.skonto; as skonto) {
                  @let state = skontoOf(row);
                  <nz-tag
                    [nzColor]="skontoTagColor(state)"
                    nz-tooltip
                    [nzTooltipTitle]="skonto.terms"
                  >
                    {{ skonto.percent }}% ·
                    {{ daysParts(skonto).key | translate: daysParts(skonto).params }}
                  </nz-tag>
                  @if (state === 'active' || state === 'expiring') {
                    <div class="small">
                      {{ 'AP.SKONTO_SAVINGS' | translate }}:
                      <strong>{{ skonto.savings | money: row.currency }}</strong>
                    </div>
                    <div class="muted small">
                      {{ 'AP.SKONTO_NET' | translate }}:
                      {{ skonto.net_payable | money: row.currency }} ·
                      {{ skonto.deadline }}
                    </div>
                  } @else {
                    <div class="muted small">
                      {{ 'AP.SKONTO_STATE_' + state.toUpperCase() | translate }}
                    </div>
                  }
                } @else {
                  <span class="muted">—</span>
                }
              </td>
              <td>
                <nz-tag [nzColor]="color(row)">{{
                  'AP.STATUS_' + row.status.toUpperCase() | translate
                }}</nz-tag>
                @if (isBlocked(row) && row.block_reason) {
                  <div class="muted small">{{ row.block_reason }}</div>
                }
              </td>
              <td>
                <button nz-button nzSize="small" type="button" (click)="store.openDetail(row.id)">
                  {{ 'AP.DETAIL' | translate }}
                </button>
                @if (canWrite) {
                  @if (canBlock(row)) {
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      (click)="openBlock(row)"
                    >
                      {{ 'AP.BLOCK_ACTION' | translate }}
                    </button>
                  }
                  @if (canRelease(row)) {
                    <button nz-button nzSize="small" type="button" (click)="openRelease(row)">
                      {{ 'AP.RELEASE_ACTION' | translate }}
                    </button>
                  }
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      <ng-template #empty>
        <nz-empty [nzNotFoundContent]="'AP.NO_ITEMS' | translate"></nz-empty>
      </ng-template>
    </nz-spin>

    <nz-modal
      [nzVisible]="blockTarget() !== null"
      [nzTitle]="'AP.BLOCK_TITLE' | translate"
      [nzOkText]="'AP.CONFIRM' | translate"
      [nzCancelText]="'AP.CANCEL' | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="blockReason().trim().length === 0"
      (nzOnOk)="confirmBlock()"
      (nzOnCancel)="blockTarget.set(null)"
    >
      <ng-container *nzModalContent>
        @if (blockTarget(); as target) {
          <p>{{ target.supplier_name }} — {{ target.document_number }}</p>
        }
        <nz-radio-group [ngModel]="blockKind()" (ngModelChange)="blockKind.set($event)">
          <label for="payables-items-dispute" appRadioControl nz-radio nzValue="dispute">{{ 'AP.KIND_DISPUTE' | translate }}</label>
          <label for="payables-items-block" appRadioControl nz-radio nzValue="block">{{ 'AP.KIND_BLOCK' | translate }}</label>
        </nz-radio-group>
        <div class="field">
          <label for="ap-block-reason">{{ 'AP.REASON' | translate }}</label>
          <textarea
            nz-input
            id="ap-block-reason"
            rows="3"
            [ngModel]="blockReason()"
            (ngModelChange)="blockReason.set($event)"
          ></textarea>
          @if (blockError()) {
            <div class="error" role="alert">{{ blockError() }}</div>
          }
        </div>
        <nz-alert nzType="info" nzShowIcon [nzMessage]="'AP.BLOCK_HINT' | translate"></nz-alert>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="releaseTarget() !== null"
      [nzTitle]="'AP.RELEASE_TITLE' | translate"
      [nzOkText]="'AP.CONFIRM' | translate"
      [nzCancelText]="'AP.CANCEL' | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="releaseReason().trim().length === 0"
      (nzOnOk)="confirmRelease()"
      (nzOnCancel)="releaseTarget.set(null)"
    >
      <ng-container *nzModalContent>
        @if (releaseTarget(); as target) {
          <p>{{ target.supplier_name }} — {{ target.document_number }}</p>
        }
        <div class="field">
          <label for="ap-release-reason">{{ 'AP.RELEASE_REASON' | translate }}</label>
          <textarea
            nz-input
            id="ap-release-reason"
            rows="3"
            [ngModel]="releaseReason()"
            (ngModelChange)="releaseReason.set($event)"
          ></textarea>
          @if (releaseError()) {
            <div class="error" role="alert">{{ releaseError() }}</div>
          }
        </div>
      </ng-container>
    </nz-modal>

    <nz-drawer
      [nzVisible]="store.detail() !== null"
      [nzWidth]="520"
      [nzTitle]="'AP.DETAIL_TITLE' | translate"
      (nzOnClose)="store.closeDetail()"
    >
      <ng-container *nzDrawerContent>
        @if (store.detail(); as detail) {
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
            <nz-descriptions-item [nzTitle]="'AP.SUPPLIER' | translate">{{
              detail.supplier_name
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'AP.DOCUMENT' | translate">{{
              detail.document_number
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'AP.IBAN' | translate">{{
              iban(detail.supplier_iban)
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'AP.DUE_DATE' | translate">{{
              detail.due_date
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'AP.ORIGINAL_AMOUNT' | translate">
              {{ detail.original_amount | money: detail.currency }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'AP.OPEN_AMOUNT' | translate">
              {{ detail.open_amount | money: detail.currency }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'AP.STATUS' | translate">
              <nz-tag [nzColor]="color(detail)">{{
                'AP.STATUS_' + detail.status.toUpperCase() | translate
              }}</nz-tag>
            </nz-descriptions-item>
            @if (detail.skonto; as skonto) {
              <nz-descriptions-item [nzTitle]="'AP.SKONTO_TERMS' | translate">
                {{ skonto.terms }} ({{ skonto.percent }}%, {{ skonto.deadline }})
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'AP.SKONTO_SAVINGS' | translate">
                {{ skonto.savings | money: detail.currency }}
              </nz-descriptions-item>
            }
          </nz-descriptions>

          <h4 class="section-title">{{ 'AP.BLOCK_HISTORY' | translate }}</h4>
          @if ((detail.block_history ?? []).length === 0) {
            <p class="muted">{{ 'AP.NO_HISTORY' | translate }}</p>
          } @else {
            <nz-timeline>
              @for (event of detail.block_history; track event.id) {
                <nz-timeline-item [nzColor]="event.kind === 'release' ? 'green' : 'red'">
                  <strong>{{ 'AP.EVENT_' + event.kind.toUpperCase() | translate }}</strong>
                  — {{ event.reason }}
                  <div class="muted small">{{ event.user_name }} · {{ event.created_at }}</div>
                </nz-timeline-item>
              }
            </nz-timeline>
          }
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class PayablesItemsComponent implements OnInit {
  readonly store = inject(PayablesItemsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  /** Accountants and finance managers may dispute, block and release; the others only read. */
  readonly canWrite = inject(PermissionsService).canWrite(PAYABLES_MODULE);

  readonly statuses = AP_ITEM_STATUSES;
  readonly documentTypes = AP_DOCUMENT_TYPES;
  readonly filters = this.store.filters;
  readonly dueRange = computed(() => dateRange(this.filters().due_from, this.filters().due_to));

  readonly blockTarget = signal<ApItem | null>(null);
  readonly blockKind = signal<ApBlockKind>('dispute');
  readonly blockReason = signal('');
  readonly blockError = signal<string | null>(null);
  readonly releaseTarget = signal<ApItem | null>(null);
  readonly releaseReason = signal('');
  readonly releaseError = signal<string | null>(null);

  readonly canBlock = canBlockItem;
  readonly canRelease = canReleaseItem;
  readonly isBlocked = isBlockedItem;
  readonly isCredit = isCreditNote;
  readonly iban = formatIban;
  readonly daysParts = skontoDaysParts;
  readonly skontoTagColor = skontoColor;

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((map) => {
      void this.store.init(itemFiltersFromQuery(queryObject(map)));
    });
  }

  color(row: ApItem): string {
    return itemStatusColor(row.status);
  }

  overdue(row: ApItem): boolean {
    return isOverdue(row, todayIso());
  }

  skontoOf(row: ApItem) {
    return skontoState(row.skonto);
  }

  searchValue(event: Event): string {
    return (event.target as HTMLInputElement).value.trim();
  }

  /** The url is the source of truth of the filters: it is rewritten and the list reloads from it. */
  apply(patch: Partial<ApItemFilters>): void {
    const next: ApItemFilters = { ...this.filters(), ...patch };
    if (itemQueryKey(next) === itemQueryKey(this.filters())) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: itemFiltersToQuery(next),
      replaceUrl: true,
    });
  }

  applyCurrency(value: string): void {
    const code = value.trim().toUpperCase();
    if (code === '' || code.length === 3) {
      this.apply({ currency: code === '' ? undefined : code });
    }
  }

  onDueRange(range: Date[] | null): void {
    this.apply({
      due_from: range?.[0] ? (toIsoDate(range[0]) ?? undefined) : undefined,
      due_to: range?.[1] ? (toIsoDate(range[1]) ?? undefined) : undefined,
    });
  }

  reset(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  openBlock(row: ApItem): void {
    this.blockReason.set('');
    this.blockKind.set('dispute');
    this.blockError.set(null);
    this.blockTarget.set(row);
  }

  async confirmBlock(): Promise<void> {
    const target = this.blockTarget();
    if (!target) {
      return;
    }
    const result = await this.store.block(target.id, {
      kind: this.blockKind(),
      reason: this.blockReason().trim(),
    });
    if (result.ok) {
      this.blockTarget.set(null);
      this.message.success(this.translate.instant('AP.BLOCK_DONE'));
    } else {
      this.blockError.set(
        result.errors['reason']?.[0] ?? result.message ?? this.translate.instant('AP.SAVE_ERROR'),
      );
    }
  }

  openRelease(row: ApItem): void {
    this.releaseReason.set('');
    this.releaseError.set(null);
    this.releaseTarget.set(row);
  }

  async confirmRelease(): Promise<void> {
    const target = this.releaseTarget();
    if (!target) {
      return;
    }
    const result = await this.store.release(target.id, this.releaseReason().trim());
    if (result.ok) {
      this.releaseTarget.set(null);
      this.message.success(this.translate.instant('AP.RELEASE_DONE'));
    } else {
      this.releaseError.set(
        result.errors['reason']?.[0] ?? result.message ?? this.translate.instant('AP.SAVE_ERROR'),
      );
    }
  }
}

function itemQueryKey(filters: ApItemFilters): string {
  return JSON.stringify(itemFiltersToQuery(filters));
}
