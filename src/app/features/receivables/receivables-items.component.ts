import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { catchError, of } from 'rxjs';
import {
  AR_ITEM_STATUSES,
  ArItem,
  ArItemFilters,
  ClientApiService,
  contactDisplayName,
  PermissionsService,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { ArCustomerOption, ArCustomerSelectComponent } from './ar-customer-select.component';
import { ReceivablesItemsStore } from './receivables-items.store';
import { ReconciliationDrawerComponent } from './reconciliation-drawer.component';
import {
  bucketPartsFromKey,
  dateRange,
  isOpenItem,
  itemFiltersFromQuery,
  itemFiltersToQuery,
  RECEIVABLES_MODULE,
  statusColor,
  toIsoDate,
} from './receivables.util';

type RangeKind = 'due' | 'issued' | 'value';

function queryObject(map: ParamMap): Record<string, string> {
  return Object.fromEntries(map.keys.map((key) => [key, map.get(key) ?? '']));
}

/**
 * Open items of the customers (Mod 013): the target of the aging drill-down and the place where items are reconciled,
 * disputed and where allocations are reversed. The filters live in the url so a drill-down link can be shared.
 */
@Component({
  selector: 'app-receivables-items',
  styleUrl: './receivables.scss',
  providers: [ReceivablesItemsStore],
  imports: [
    ArCustomerSelectComponent,
    FormsModule,
    MoneyPipe,
    PageHeaderComponent,
    ReconciliationDrawerComponent,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPaginationModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'AR.ITEMS_TITLE' | translate" [subtitle]="'AR.ITEMS_SUBTITLE' | translate">
      <a nz-button routerLink="/receivables">{{ 'AR.BACK_TO_DASHBOARD' | translate }}</a>
      @if (canWrite) {
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="!store.selectionIsCoherent()"
          (click)="reconcileOpen.set(true)"
        >
          {{ 'AR.RECONCILE' | translate }} ({{ store.selectionCount() }})
        </button>
      }
    </app-page-header>

    <div class="filters" role="search" [attr.aria-label]="'AR.FILTERS' | translate">
      <div class="field">
        <span>{{ 'AR.CUSTOMER' | translate }}</span>
        <app-ar-customer-select
          [customerId]="filters().customer_id ?? null"
          (customerChange)="onCustomer($event)"
        ></app-ar-customer-select>
      </div>

      <div class="field">
        <label for="f-status">{{ 'AR.STATUS' | translate }}</label>
        <nz-select
          nzId="f-status"
          style="width: 100%"
          nzAllowClear
          [ngModel]="filters().status ?? null"
          (ngModelChange)="apply({ status: $event ?? undefined })"
        >
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="'AR.STATUS_' + status.toUpperCase() | translate"></nz-option>
          }
        </nz-select>
      </div>

      <div class="field">
        <label for="f-doctype">{{ 'AR.DOCUMENT_TYPE' | translate }}</label>
        <nz-select
          nzId="f-doctype"
          style="width: 100%"
          nzAllowClear
          [ngModel]="filters().document_type ?? null"
          (ngModelChange)="apply({ document_type: $event ?? undefined })"
        >
          @for (type of documentTypes; track type) {
            <nz-option [nzValue]="type" [nzLabel]="'AR.DOCTYPE_' + type.toUpperCase() | translate"></nz-option>
          }
        </nz-select>
      </div>

      <div class="field">
        <label for="f-currency">{{ 'AR.CURRENCY' | translate }}</label>
        <input
          nz-input
          id="f-currency"
          maxlength="3"
          [ngModel]="filters().currency ?? ''"
          (ngModelChange)="applyCurrency($event)"
        />
      </div>

      <div class="field">
        <span>{{ 'AR.DUE_DATE' | translate }}</span>
        <nz-range-picker
          style="width: 100%"
          [ngModel]="dueRange()"
          (ngModelChange)="onRange('due', $event)"
        ></nz-range-picker>
      </div>

      <div class="field">
        <span>{{ 'AR.ISSUE_DATE' | translate }}</span>
        <nz-range-picker
          style="width: 100%"
          [ngModel]="issuedRange()"
          (ngModelChange)="onRange('issued', $event)"
        ></nz-range-picker>
      </div>

      <div class="field">
        <span>{{ 'AR.VALUE_DATE' | translate }}</span>
        <nz-range-picker
          style="width: 100%"
          [ngModel]="valueRange()"
          (ngModelChange)="onRange('value', $event)"
        ></nz-range-picker>
      </div>

      <div class="field">
        <label for="receivables-items-field" nzId="receivables-items-field" nz-checkbox [ngModel]="filters().open_only !== false" (ngModelChange)="apply({ open_only: $event })">
          {{ 'AR.OPEN_ONLY' | translate }}
        </label>
      </div>
    </div>

    <div class="toolbar">
      @if (filters().bucket; as bucket) {
        @let part = bucketPart(bucket);
        <nz-tag nzMode="closeable" (nzOnClose)="apply({ bucket: undefined })">
          {{ 'AR.BUCKET' | translate }}: {{ part.key | translate: part.params }}
        </nz-tag>
      }
      <button nz-button type="button" (click)="reset()">{{ 'AR.RESET_FILTERS' | translate }}</button>
      <span class="muted spacer">{{ 'AR.RESULTS' | translate: { total: store.total() } }}</span>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="card" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (store.selectionCount() > 0 && !store.selectionIsCoherent()) {
      <nz-alert class="card" nzType="warning" nzShowIcon [nzMessage]="'AR.SELECTION_MIXED' | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.items().length === 0 && !store.loading()) {
        <nz-empty [nzNotFoundContent]="'AR.NO_ITEMS' | translate"></nz-empty>
      } @else {
        <div class="matrix-wrap">
          <table class="matrix">
            <caption class="sr-only">
              {{
                'AR.ITEMS_TITLE' | translate
              }}
            </caption>
            <thead>
              <tr>
                @if (canWrite) {
                  <th scope="col">
                    <input
                      type="checkbox"
                      [checked]="allSelected()"
                      [attr.aria-label]="'AR.SELECT_ALL' | translate"
                      (change)="onToggleAll($event)"
                    />
                  </th>
                }
                <th scope="col">{{ 'AR.CUSTOMER' | translate }}</th>
                <th scope="col">{{ 'AR.DOCUMENT' | translate }}</th>
                <th scope="col">{{ 'AR.ISSUE_DATE' | translate }}</th>
                <th scope="col">{{ 'AR.DUE_DATE' | translate }}</th>
                <th scope="col">{{ 'AR.VALUE_DATE' | translate }}</th>
                <th scope="col">{{ 'AR.CURRENCY' | translate }}</th>
                <th scope="col" class="num">{{ 'AR.ORIGINAL_AMOUNT' | translate }}</th>
                <th scope="col" class="num">{{ 'AR.OPEN_AMOUNT' | translate }}</th>
                <th scope="col">{{ 'AR.STATUS' | translate }}</th>
                <th scope="col">{{ 'AR.ACTIONS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of store.items(); track row.id) {
                <tr [class.overdue-row]="row.status === 'overdue'">
                  @if (canWrite) {
                    <td>
                      <input
                        type="checkbox"
                        [checked]="store.selectedIds().includes(row.id)"
                        [disabled]="!isOpen(row)"
                        [attr.aria-label]="'AR.SELECT_ROW' | translate: { document: row.document_number }"
                        (change)="onToggle(row.id, $event)"
                      />
                    </td>
                  }
                  <td>{{ customerName(row.customer_id) }}</td>
                  <th scope="row">
                    {{ row.document_number }} <span class="muted">· {{ row.sequence }}</span>
                    <br />
                    <span class="muted">{{ 'AR.DOCTYPE_' + row.document_type.toUpperCase() | translate }}</span>
                  </th>
                  <td>{{ row.issue_date }}</td>
                  <td>{{ row.due_date }}</td>
                  <td>{{ row.value_date ?? '–' }}</td>
                  <td>{{ row.currency }}</td>
                  <td class="num">{{ row.original_amount | money: row.currency }}</td>
                  <td class="num">{{ row.open_amount | money: row.currency }}</td>
                  <td>
                    <nz-tag [nzColor]="color(row)">{{ 'AR.STATUS_' + row.status.toUpperCase() | translate }}</nz-tag>
                    @if (row.days_past_due > 0) {
                      <span class="muted">{{ 'AR.DAYS_PAST_DUE' | translate: { days: row.days_past_due } }}</span>
                    }
                  </td>
                  <td>
                    <button nz-button nzSize="small" type="button" (click)="store.openDetail(row.id)">
                      {{ 'AR.DETAILS' | translate }}
                    </button>
                    @if (canWrite && isOpen(row)) {
                      @if (row.status === 'disputed') {
                        <button
                          nz-button
                          nzSize="small"
                          type="button"
                          nz-popconfirm
                          [nzPopconfirmTitle]="'AR.CLEAR_DISPUTE_CONFIRM' | translate"
                          (nzOnConfirm)="clearDispute(row)"
                        >
                          {{ 'AR.CLEAR_DISPUTE' | translate }}
                        </button>
                      } @else {
                        <button nz-button nzSize="small" type="button" (click)="startDispute(row)">
                          {{ 'AR.MARK_DISPUTE' | translate }}
                        </button>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <nz-pagination
          class="card"
          style="margin-top: 16px; text-align: right"
          [nzTotal]="store.total()"
          [nzPageIndex]="store.page()"
          [nzPageSize]="store.pageSize()"
          (nzPageIndexChange)="store.setPage($event)"
        ></nz-pagination>
      }
    </nz-spin>

    <app-reconciliation-drawer
      [(open)]="reconcileOpen"
      [items]="store.selectedItems()"
      (reconciled)="onReconciled($event)"
    ></app-reconciliation-drawer>

    <nz-drawer
      [nzVisible]="store.detail() !== null"
      nzPlacement="right"
      [nzWidth]="720"
      [nzTitle]="'AR.ALLOCATIONS_TITLE' | translate"
      (nzOnClose)="store.closeDetail()"
    >
      <ng-container *nzDrawerContent>
        @if (store.detail(); as detail) {
          <p>
            <strong>{{ detail.document_number }} · {{ detail.sequence }}</strong>
            — {{ 'AR.OPEN_AMOUNT' | translate }}: {{ detail.open_amount | money: detail.currency }}
          </p>
          @if (detail.dispute_reason) {
            <nz-alert class="card" nzType="warning" nzShowIcon [nzMessage]="detail.dispute_reason"></nz-alert>
          }
          @if ((detail.allocations ?? []).length === 0) {
            <nz-empty [nzNotFoundContent]="'AR.NO_ALLOCATIONS' | translate"></nz-empty>
          } @else {
            <table class="matrix">
              <thead>
                <tr>
                  <th scope="col">{{ 'AR.ALLOCATION_TYPE' | translate }}</th>
                  <th scope="col">{{ 'AR.REFERENCE' | translate }}</th>
                  <th scope="col">{{ 'AR.VALUE_DATE' | translate }}</th>
                  <th scope="col" class="num">{{ 'AR.AMOUNT' | translate }}</th>
                  <th scope="col">{{ 'AR.ACTIONS' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (allocation of detail.allocations ?? []; track allocation.id) {
                  <tr [class.muted]="allocation.reversed_at !== null">
                    <td>{{ 'AR.TYPE_' + allocation.source_type.toUpperCase() | translate }}</td>
                    <td>{{ allocation.source_reference ?? '–' }}</td>
                    <td>{{ allocation.value_date }}</td>
                    <td class="num">{{ allocation.amount | money: detail.currency }}</td>
                    <td>
                      @if (allocation.reversed_at !== null) {
                        <nz-tag>{{ 'AR.REVERSED' | translate }}</nz-tag>
                      } @else if (canWrite && allocation.origin !== 'sync') {
                        <button
                          nz-button
                          nzSize="small"
                          nzDanger
                          type="button"
                          nz-popconfirm
                          [nzPopconfirmTitle]="'AR.REVERSE_CONFIRM' | translate"
                          (nzOnConfirm)="reverse(allocation.id)"
                        >
                          {{ 'AR.REVERSE' | translate }}
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        }
      </ng-container>
    </nz-drawer>

    <nz-modal
      [nzVisible]="disputeTarget() !== null"
      [nzTitle]="'AR.MARK_DISPUTE' | translate"
      [nzOkText]="'AR.MARK_DISPUTE' | translate"
      [nzCancelText]="'AR.CANCEL' | translate"
      [nzOkDisabled]="disputeReason().trim().length === 0"
      [nzOkLoading]="store.saving()"
      (nzOnCancel)="disputeTarget.set(null)"
      (nzOnOk)="confirmDispute()"
    >
      <ng-container *nzModalContent>
        <div class="field">
          <label for="dispute-reason">{{ 'AR.DISPUTE_REASON' | translate }}</label>
          <textarea
            nz-input
            id="dispute-reason"
            rows="3"
            [ngModel]="disputeReason()"
            (ngModelChange)="disputeReason.set($event)"
          ></textarea>
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class ReceivablesItemsComponent implements OnInit {
  readonly store = inject(ReceivablesItemsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clients = inject(ClientApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  /** Credit managers (and accountants) may reconcile, dispute and reverse; the others only read. */
  readonly canWrite = inject(PermissionsService).canWrite(RECEIVABLES_MODULE);

  readonly statuses = AR_ITEM_STATUSES;
  readonly documentTypes = ['invoice', 'debit_note'] as const;
  readonly reconcileOpen = signal(false);
  readonly disputeTarget = signal<ArItem | null>(null);
  readonly disputeReason = signal('');
  readonly names = signal<Record<string, string>>({});

  readonly filters = this.store.filters;
  readonly dueRange = computed(() => dateRange(this.filters().due_from, this.filters().due_to));
  readonly issuedRange = computed(() => dateRange(this.filters().issued_from, this.filters().issued_to));
  readonly valueRange = computed(() => dateRange(this.filters().value_from, this.filters().value_to));
  readonly allSelected = computed(
    () =>
      this.store.selectableIds().length > 0 &&
      this.store.selectableIds().every((id) => this.store.selectedIds().includes(id)),
  );

  readonly isOpen = isOpenItem;
  private readonly requestedNames = new Set<string>();

  constructor() {
    effect(() => {
      for (const row of this.store.items()) {
        this.ensureName(row.customer_id);
      }
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((map) => {
      void this.store.init(itemFiltersFromQuery(queryObject(map)));
    });
  }

  color(row: ArItem): string {
    return statusColor(row.status);
  }

  bucketPart(key: string): { key: string; params?: Record<string, number | string> } {
    return bucketPartsFromKey(key);
  }

  customerName(id: string): string {
    return this.names()[id] ?? '';
  }

  /** The url is the source of truth of the filters: it is rewritten and the list reloads from it. */
  apply(patch: Partial<ArItemFilters>): void {
    const next: ArItemFilters = { ...this.filters(), ...patch };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: itemFiltersToQuery(next),
      replaceUrl: true,
    });
  }

  reset(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  onCustomer(option: ArCustomerOption | null): void {
    this.apply({ customer_id: option?.id });
  }

  applyCurrency(value: string): void {
    const code = value.trim().toUpperCase();
    // A currency code has three letters: the list reloads when it is complete or cleared.
    if (code.length === 3 || code.length === 0) {
      this.apply({ currency: code || undefined });
    }
  }

  onRange(kind: RangeKind, dates: Date[] | null): void {
    const from = toIsoDate(dates?.[0]) ?? undefined;
    const to = toIsoDate(dates?.[1]) ?? undefined;
    if (kind === 'due') {
      this.apply({ due_from: from, due_to: to });
    } else if (kind === 'issued') {
      this.apply({ issued_from: from, issued_to: to });
    } else {
      this.apply({ value_from: from, value_to: to });
    }
  }

  onToggle(id: string, event: Event): void {
    this.store.toggle(id, (event.target as HTMLInputElement).checked);
  }

  onToggleAll(event: Event): void {
    this.store.toggleAll((event.target as HTMLInputElement).checked);
  }

  onReconciled(updated: ArItem[]): void {
    this.store.applyAllocation(updated);
    void this.store.refresh();
  }

  startDispute(item: ArItem): void {
    this.disputeReason.set('');
    this.disputeTarget.set(item);
  }

  async confirmDispute(): Promise<void> {
    const target = this.disputeTarget();
    const reason = this.disputeReason().trim();
    if (!target || reason.length === 0) {
      return;
    }
    const outcome = await this.store.setDispute(target.id, { disputed: true, reason });
    if (outcome.ok) {
      this.disputeTarget.set(null);
      this.message.success(this.translate.instant('AR.DISPUTE_MARKED'));
    } else {
      this.message.error(outcome.message ?? this.translate.instant('AR.SAVE_ERROR'));
    }
  }

  async clearDispute(item: ArItem): Promise<void> {
    const outcome = await this.store.setDispute(item.id, { disputed: false });
    if (outcome.ok) {
      this.message.success(this.translate.instant('AR.DISPUTE_CLEARED'));
    } else {
      this.message.error(outcome.message ?? this.translate.instant('AR.SAVE_ERROR'));
    }
  }

  async reverse(allocationId: string): Promise<void> {
    const outcome = await this.store.reverseAllocation(allocationId);
    if (outcome.ok) {
      this.message.success(this.translate.instant('AR.REVERSED_OK'));
    } else {
      this.message.error(outcome.message ?? this.translate.instant('AR.SAVE_ERROR'));
    }
  }

  private ensureName(id: string): void {
    if (this.requestedNames.has(id)) {
      return;
    }
    this.requestedNames.add(id);
    this.clients
      .get(id)
      .pipe(catchError(() => of(null)))
      .subscribe((response) => {
        if (response) {
          this.names.update((known) => ({ ...known, [id]: contactDisplayName(response.data) }));
        }
      });
  }
}
