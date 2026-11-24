import { DecimalPipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  INVOICE_MATCH_STATUSES,
  INVOICE_MATCH_TYPES,
  InvoiceMatchStatus,
  InvoiceMatchType,
} from '@domain/procurement/invoice-matching.models';
import { DateFormatPipe, MoneyPipe, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  matchStatusColor,
  matchStatusKey,
  matchTypeKey,
  reasonKey,
} from './invoice-matching.helpers';
import { InvoiceMatchingStore } from './invoice-matching.store';

/**
 * Table of the current matching runs with its filters. Used by the workbench (all runs) and by the blocked
 * discrepancies queue (`queue="blocked"`). The store is provided by the hosting page.
 */
@Component({
  selector: 'app-invoice-match-runs-table',
  imports: [
    DateFormatPipe,
    DecimalPipe,
    FormsModule,
    MoneyPipe,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <div class="filters" role="search" data-testid="runs-filters">
      @if (queue() === null) {
        <nz-select
          class="filter-select"
          nzAllowClear
          [nzPlaceHolder]="'invoiceMatching.field.allStatuses' | translate"
          [ngModel]="store.filters().status ?? null"
          (ngModelChange)="onStatus($event)"
          data-testid="filter-status"
        >
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="statusKey(status) | translate" />
          }
        </nz-select>
      }
      <nz-select
        class="filter-select"
        nzAllowClear
        [nzPlaceHolder]="'invoiceMatching.field.allTypes' | translate"
        [ngModel]="store.filters().match_type ?? null"
        (ngModelChange)="onType($event)"
        data-testid="filter-type"
      >
        @for (type of types; track type) {
          <nz-option [nzValue]="type" [nzLabel]="typeKey(type) | translate" />
        }
      </nz-select>
      <input
        nz-input
        class="filter-search"
        type="search"
        [placeholder]="'invoiceMatching.field.search' | translate"
        [attr.aria-label]="'invoiceMatching.field.search' | translate"
        [ngModel]="searchText()"
        (ngModelChange)="searchText.set($event)"
        (keyup.enter)="search()"
        data-testid="filter-search"
      />
      <button nz-button type="button" (click)="search()" data-testid="filter-search-button">
        {{ 'invoiceMatching.button.search' | translate }}
      </button>
      <button
        nz-button
        type="button"
        (click)="refresh()"
        [nzLoading]="store.loading()"
        data-testid="runs-refresh"
      >
        {{ 'invoiceMatching.button.refresh' | translate }}
      </button>
    </div>

    @if (store.failed()) {
      <nz-alert
        nzType="error"
        nzShowIcon
        [nzMessage]="store.error() || ('invoiceMatching.message.loadError' | translate)"
      />
    }

    <nz-table
      #table
      nzSize="small"
      [nzData]="store.runs()"
      [nzLoading]="store.loading()"
      [nzFrontPagination]="false"
      [nzTotal]="store.total()"
      [nzPageIndex]="store.page()"
      [nzPageSize]="store.pageSize()"
      [nzNoResult]="empty"
      (nzPageIndexChange)="store.setPage($event)"
      data-testid="runs-table"
    >
      <thead>
        <tr>
          <th>{{ 'invoiceMatching.column.invoice' | translate }}</th>
          <th>{{ 'invoiceMatching.column.supplier' | translate }}</th>
          <th>{{ 'invoiceMatching.column.purchaseOrder' | translate }}</th>
          <th>{{ 'invoiceMatching.column.type' | translate }}</th>
          <th>{{ 'invoiceMatching.column.status' | translate }}</th>
          <th>{{ 'invoiceMatching.column.reasons' | translate }}</th>
          <th class="num">{{ 'invoiceMatching.column.variance' | translate }}</th>
          <th>{{ 'invoiceMatching.column.blockedAt' | translate }}</th>
          <th>{{ 'invoiceMatching.column.actions' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track row.id) {
          <tr [attr.data-testid]="'run-row-' + row.id">
            <td>{{ row.invoice_number ?? '-' }}</td>
            <td>{{ row.supplier_name ?? '-' }}</td>
            <td>{{ row.po_number ?? '-' }}</td>
            <td>{{ typeKey(row.match_type) | translate }}</td>
            <td>
              <nz-tag [nzColor]="color(row.status)" data-testid="status-tag">{{
                statusKey(row.status) | translate
              }}</nz-tag>
            </td>
            <td>
              @for (reason of row.reasons; track reason) {
                <nz-tag>{{ reasonText(reason) | translate }}</nz-tag>
              }
            </td>
            <td class="num">
              {{ row.variance_amount | money: row.currency }}
              <small>({{ row.variance_percent | number: '1.0-2' }}%)</small>
            </td>
            <td>{{ row.blocked_at | appDate }}</td>
            <td>
              <a nz-button nzSize="small" [routerLink]="['/procurement/invoice-matching', row.id]">
                {{ 'invoiceMatching.button.open' | translate }}
              </a>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
    <ng-template #empty>
      <nz-empty
        [nzNotFoundContent]="
          (queue() === 'blocked'
            ? 'invoiceMatching.message.noBlocked'
            : 'invoiceMatching.message.noRuns'
          ) | translate
        "
      />
    </ng-template>
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .filter-select {
      min-width: 200px;
    }
    .filter-search {
      width: 280px;
    }
    .num {
      text-align: right;
    }
  `,
})
export class InvoiceMatchRunsTableComponent implements OnInit {
  protected readonly store = inject(InvoiceMatchingStore);

  /** `blocked` restricts the table to the blocked discrepancies queue. */
  readonly queue = input<'blocked' | null>(null);

  protected readonly statuses = INVOICE_MATCH_STATUSES;
  protected readonly types = INVOICE_MATCH_TYPES;
  protected readonly searchText = signal('');
  protected readonly statusKey = matchStatusKey;
  protected readonly typeKey = matchTypeKey;
  protected readonly reasonText = reasonKey;

  ngOnInit(): void {
    void this.store.loadRuns({
      page: 1,
      per_page: 20,
      ...(this.queue() === 'blocked' ? { queue: 'blocked' as const } : {}),
    });
  }

  protected color(status: InvoiceMatchStatus): string {
    return matchStatusColor(status);
  }

  protected onStatus(status: InvoiceMatchStatus | null): void {
    void this.store.applyFilters({ status: status ?? undefined });
  }

  protected onType(type: InvoiceMatchType | null): void {
    void this.store.applyFilters({ match_type: type ?? undefined });
  }

  protected search(): void {
    void this.store.applyFilters({ search: this.searchText().trim() || undefined });
  }

  refresh(): void {
    void this.store.loadRuns();
  }
}
