import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslateService } from '@core';
import { BankingApiService } from '@core/api/banking-api.service';
import { InvoiceApiService } from '@core/api/invoice-api.service';
import { ProcurementApiService } from '@core/api/procurement-api.service';
import {
  DifferenceHandling,
  ReconciliationTransaction,
  TransactionStatusFilter,
} from '@core/models/iso20022.model';
import { MoneyPipe, TranslatePipe } from '@shared';

interface MatchCandidate {
  readonly id: string;
  readonly label: string;
}

/**
 * The manual matching queue: bank transactions the automatic reconciliation could not link (overpayments, unknown
 * references) with the open invoices that can settle them.
 */
@Component({
  selector: 'app-tr-reconciliation-workbench',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'iso20022.workbench.title' | translate">
      <div class="filters">
        <nz-select
          [ngModel]="status()"
          (ngModelChange)="setStatus($event)"
          class="select"
          data-testid="status-filter"
        >
          <nz-option
            nzValue="unmatched"
            [nzLabel]="'iso20022.workbench.status.unmatched' | translate"
          />
          <nz-option
            nzValue="matched"
            [nzLabel]="'iso20022.workbench.status.matched' | translate"
          />
          <nz-option nzValue="all" [nzLabel]="'iso20022.workbench.status.all' | translate" />
        </nz-select>
        <nz-select
          [ngModel]="direction()"
          (ngModelChange)="setDirection($event)"
          class="select"
          data-testid="direction-filter"
        >
          <nz-option nzValue="" [nzLabel]="'iso20022.workbench.direction.all' | translate" />
          <nz-option
            nzValue="credit"
            [nzLabel]="'iso20022.workbench.direction.credit' | translate"
          />
          <nz-option nzValue="debit" [nzLabel]="'iso20022.workbench.direction.debit' | translate" />
        </nz-select>
        <input
          nz-input
          class="search"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keyup.enter)="reload()"
          [placeholder]="'iso20022.workbench.search' | translate"
        />
        <button nz-button (click)="reload()">{{ 'iso20022.workbench.refresh' | translate }}</button>
      </div>

      <nz-table
        nzSize="small"
        nzShowSizeChanger="false"
        [nzData]="rows()"
        [nzLoading]="loading()"
        [nzFrontPagination]="false"
        [nzTotal]="total()"
        [nzPageSize]="pageSize"
        [nzPageIndex]="page()"
        (nzPageIndexChange)="goTo($event)"
      >
        <thead>
          <tr>
            <th>{{ 'iso20022.workbench.col.date' | translate }}</th>
            <th>{{ 'iso20022.workbench.col.counterpart' | translate }}</th>
            <th>{{ 'iso20022.workbench.col.reference' | translate }}</th>
            <th>{{ 'iso20022.workbench.col.description' | translate }}</th>
            <th class="num">{{ 'iso20022.workbench.col.amount' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr data-testid="transaction-row">
              <td>{{ row.booking_date }}</td>
              <td>{{ row.counterpart_name ?? '-' }}</td>
              <td>{{ row.qr_reference ?? row.reference ?? '-' }}</td>
              <td>{{ row.description ?? '-' }}</td>
              <td class="num">
                <nz-tag [nzColor]="row.direction === 'credit' ? 'green' : 'volcano'">
                  {{ row.direction === 'credit' ? '+' : '-'
                  }}{{ row.gross_amount | money: row.currency }}
                </nz-tag>
              </td>
              <td>
                @if (!row.reconciled) {
                  <button
                    nz-button
                    nzSize="small"
                    nzType="primary"
                    (click)="openMatch(row)"
                    data-testid="match-button"
                  >
                    {{ 'iso20022.workbench.match' | translate }}
                  </button>
                } @else {
                  <nz-tag nzColor="success">{{ row.reconciliation_type ?? 'matched' }}</nz-tag>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="matching() !== null"
      [nzTitle]="'iso20022.workbench.matchTitle' | translate"
      [nzOkDisabled]="!selectedInvoice() || saving()"
      [nzOkLoading]="saving()"
      (nzOnCancel)="matching.set(null)"
      (nzOnOk)="confirmMatch()"
    >
      <ng-container *nzModalContent>
        <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
        <label class="field">
          <span>{{ 'iso20022.workbench.invoice' | translate }}</span>
          <nz-select
            nzId="wb-1"
            [ngModel]="selectedInvoice()"
            (ngModelChange)="selectedInvoice.set($event)"
            nzShowSearch
            class="full"
            data-testid="invoice-select"
          >
            @for (candidate of candidates(); track candidate.id) {
              <nz-option [nzValue]="candidate.id" [nzLabel]="candidate.label" />
            }
          </nz-select>
        </label>
        <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
        <label class="field">
          <span>{{ 'iso20022.workbench.difference' | translate }}</span>
          <nz-select
            nzId="wb-2"
            [ngModel]="difference()"
            (ngModelChange)="difference.set($event)"
            class="full"
          >
            <nz-option nzValue="none" [nzLabel]="'iso20022.workbench.diff.none' | translate" />
            <nz-option
              nzValue="write_off"
              [nzLabel]="'iso20022.workbench.diff.write_off' | translate"
            />
            <nz-option
              nzValue="partial"
              [nzLabel]="'iso20022.workbench.diff.partial' | translate"
            />
          </nz-select>
        </label>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    :host {
      display: block;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .select {
      width: 160px;
    }
    .search {
      width: 240px;
    }
    .num {
      text-align: right;
    }
    .field {
      display: grid;
      gap: 4px;
      margin-bottom: 12px;
    }
    .full {
      width: 100%;
    }
  `,
})
export class TrReconciliationWorkbenchComponent implements OnInit {
  private readonly banking = inject(BankingApiService);
  private readonly invoices = inject(InvoiceApiService);
  private readonly procurement = inject(ProcurementApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pageSize = 25;
  protected readonly status = signal<TransactionStatusFilter>('unmatched');
  protected readonly direction = signal<'credit' | 'debit' | ''>('');
  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly rows = signal<ReconciliationTransaction[]>([]);
  protected readonly loading = signal(false);

  protected readonly matching = signal<ReconciliationTransaction | null>(null);
  protected readonly candidates = signal<MatchCandidate[]>([]);
  protected readonly selectedInvoice = signal<string | null>(null);
  protected readonly difference = signal<DifferenceHandling>('none');
  protected readonly saving = signal(false);

  ngOnInit(): void {
    this.reload();
  }

  protected setStatus(value: TransactionStatusFilter): void {
    this.status.set(value);
    this.page.set(1);
    this.reload();
  }

  protected setDirection(value: 'credit' | 'debit' | ''): void {
    this.direction.set(value);
    this.page.set(1);
    this.reload();
  }

  protected goTo(page: number): void {
    this.page.set(page);
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.banking
      .getReconciliationTransactions({
        status: this.status(),
        direction: this.direction() || undefined,
        search: this.search().trim() || undefined,
        page: this.page(),
        per_page: this.pageSize,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data ?? []);
          this.total.set(res.meta?.total ?? res.data?.length ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.rows.set([]);
          this.loading.set(false);
        },
      });
  }

  /** Credits are settled by customer invoices, debits by received supplier invoices. */
  protected openMatch(row: ReconciliationTransaction): void {
    this.matching.set(row);
    this.selectedInvoice.set(null);
    this.difference.set('none');
    this.candidates.set([]);

    if (row.direction === 'credit') {
      this.invoices
        .list({ payment_status: 'unpaid', per_page: 100 })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((res) =>
          this.candidates.set(
            (res.data ?? []).map((invoice) => ({
              id: invoice.id,
              label: `${invoice.invoice_number} · ${invoice.contact?.company_name ?? invoice.client?.company_name ?? ''} · ${invoice.total} ${invoice.currency}`,
            })),
          ),
        );
      return;
    }

    this.procurement
      .getSupplierInvoices({ payment_status: 'unpaid', per_page: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) =>
        this.candidates.set(
          (res.data ?? []).map((invoice) => ({
            id: invoice.id,
            label: `${invoice.invoice_number} · ${invoice.supplier_name ?? ''} · ${invoice.total_amount} ${invoice.currency}`,
          })),
        ),
      );
  }

  protected confirmMatch(): void {
    const row = this.matching();
    const invoiceId = this.selectedInvoice();

    if (row === null || invoiceId === null) {
      return;
    }

    this.saving.set(true);
    this.banking
      .matchTransaction(row.id, { invoice_id: invoiceId, difference_handling: this.difference() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.matching.set(null);
          this.message.success(this.translate.instant('iso20022.workbench.matched'));
          this.reload();
        },
        error: (err) => {
          this.saving.set(false);
          this.message.error(
            err?.error?.message ?? this.translate.instant('iso20022.workbench.matchFailed'),
          );
        },
      });
  }
}
