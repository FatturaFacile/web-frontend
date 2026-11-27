import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
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
  LineCategory,
  ReconciliationException,
  ReconciliationExceptionCode,
} from '@core/models/iso20022.model';
import { MoneyPipe, TranslatePipe } from '@shared';
import { EXCEPTION_CODES, LINE_CATEGORIES } from './iso-reconciliation.util';
import { ReconciliationExceptionsStore } from './reconciliation-exceptions.store';

export interface InvoiceOption {
  id: string;
  label: string;
}

const LEDGER_CODE = /^[A-Za-z0-9.-]{1,20}$/;
const EXCEPTION_COLORS: Record<ReconciliationExceptionCode, string> = {
  Unmatched: 'blue',
  AmountMismatch: 'orange',
  DuplicatePayment: 'red',
  AlreadyPaid: 'purple',
  InvalidReference: 'volcano',
};

/**
 * The reconciliation workbench: the bank lines the automatic reconciliation could not settle, one tab per exception
 * code, with one-click confirmation of the suggested invoice, assignment (with write-off or partial handling of a
 * difference), categorisation and a drawer with the raw line data.
 */
@Component({
  selector: 'app-tr-reconciliation-exceptions',
  providers: [ReconciliationExceptionsStore],
  imports: [
    FormsModule,
    NzAlertModule,
    NzBadgeModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'treasuryIso.workbench.title' | translate">
      <p class="hint">{{ 'treasuryIso.workbench.subtitle' | translate }}</p>

      <div class="codes" role="group" [attr.aria-label]="'treasuryIso.workbench.codes' | translate">
        <button
          nz-button
          type="button"
          [nzType]="store.code() === null ? 'primary' : 'default'"
          [attr.aria-pressed]="store.code() === null"
          (click)="store.setCode(null)"
          data-testid="code-all"
        >
          {{ 'treasuryIso.workbench.all' | translate }}
          <nz-badge [nzCount]="store.totalOpen()" nzShowZero [nzOverflowCount]="999" />
        </button>
        @for (code of codes; track code) {
          <button
            nz-button
            type="button"
            [nzType]="store.code() === code ? 'primary' : 'default'"
            [attr.aria-pressed]="store.code() === code"
            (click)="store.setCode(code)"
            [attr.data-testid]="'code-' + code"
          >
            {{ 'treasuryIso.exception.' + code | translate }}
            <nz-badge [nzCount]="store.counts()[code]" nzShowZero [nzOverflowCount]="999" />
          </button>
        }
      </div>

      <div class="filters">
        <nz-select
          class="select"
          nzAllowClear
          [nzPlaceHolder]="'treasuryIso.workbench.direction.all' | translate"
          [attr.aria-label]="'treasuryIso.workbench.direction.label' | translate"
          [ngModel]="store.direction()"
          (ngModelChange)="store.setDirection($event ?? null)"
          data-testid="direction-filter"
        >
          <nz-option nzValue="credit" [nzLabel]="'treasuryIso.workbench.direction.credit' | translate" />
          <nz-option nzValue="debit" [nzLabel]="'treasuryIso.workbench.direction.debit' | translate" />
        </nz-select>
        <input
          nz-input
          class="search"
          [attr.aria-label]="'treasuryIso.workbench.search' | translate"
          [placeholder]="'treasuryIso.workbench.search' | translate"
          [ngModel]="searchText()"
          (ngModelChange)="searchText.set($event ?? '')"
          (keyup.enter)="store.setSearch(searchText())"
          data-testid="search"
        />
        <button nz-button type="button" (click)="store.setSearch(searchText())" data-testid="search-button">
          {{ 'treasuryIso.workbench.apply' | translate }}
        </button>
      </div>

      @if (store.error(); as error) {
        <nz-alert
          class="gap"
          nzType="error"
          nzShowIcon
          nzCloseable
          [nzMessage]="'treasuryIso.workbench.error.' + error.action | translate"
          [nzDescription]="error.detail || null"
          (nzOnClose)="store.clearError()"
          data-testid="store-error"
        />
      }

      <nz-table
        class="gap"
        nzSize="small"
        [nzData]="store.lines()"
        [nzLoading]="store.loading()"
        [nzFrontPagination]="false"
        [nzShowSizeChanger]="false"
        [nzTotal]="store.total()"
        [nzPageSize]="store.perPage()"
        [nzPageIndex]="store.page()"
        (nzPageIndexChange)="store.goTo($event)"
        [nzScroll]="{ x: '1000px' }"
      >
        <thead>
          <tr>
            <th>{{ 'treasuryIso.workbench.col.date' | translate }}</th>
            <th>{{ 'treasuryIso.workbench.col.counterpart' | translate }}</th>
            <th>{{ 'treasuryIso.workbench.col.reference' | translate }}</th>
            <th class="num">{{ 'treasuryIso.workbench.col.amount' | translate }}</th>
            <th>{{ 'treasuryIso.workbench.col.exception' | translate }}</th>
            <th>{{ 'treasuryIso.workbench.col.suggestion' | translate }}</th>
            <th>{{ 'treasuryIso.workbench.col.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (line of store.lines(); track line.id) {
            <tr data-testid="exception-row">
              <td>{{ line.booking_date }}</td>
              <td>{{ line.counterpart_name ?? '-' }}</td>
              <td>{{ line.qr_reference ?? line.reference ?? '-' }}</td>
              <td class="num">
                <nz-tag [nzColor]="line.direction === 'credit' ? 'green' : 'volcano'">
                  {{ line.direction === 'credit' ? '+' : '-' }}{{ line.gross_amount | money: line.currency }}
                </nz-tag>
              </td>
              <td>
                <nz-tag [nzColor]="colors[line.exception_code]">
                  {{ 'treasuryIso.exception.' + line.exception_code | translate }}
                </nz-tag>
              </td>
              <td>
                @if (line.exception_candidate; as candidate) {
                  {{ candidate.invoice_number }} · {{ candidate.due_amount | money: candidate.currency }}
                } @else {
                  -
                }
              </td>
              <td class="actions">
                @if (line.exception_candidate) {
                  <button
                    nz-button
                    nzSize="small"
                    nzType="primary"
                    type="button"
                    [disabled]="store.saving()"
                    (click)="confirmSuggestion(line)"
                    data-testid="confirm-suggestion"
                  >
                    {{ 'treasuryIso.workbench.confirm' | translate }}
                  </button>
                }
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  (click)="openAssign(line)"
                  data-testid="assign-button"
                >
                  {{ 'treasuryIso.workbench.assign' | translate }}
                </button>
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  (click)="openCategorize(line)"
                  data-testid="categorize-button"
                >
                  {{ 'treasuryIso.workbench.categorize' | translate }}
                </button>
                <button
                  nz-button
                  nzSize="small"
                  nzType="link"
                  type="button"
                  (click)="detail.set(line)"
                  data-testid="detail-button"
                >
                  {{ 'treasuryIso.workbench.details' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="assigning() !== null"
      [nzTitle]="'treasuryIso.workbench.assignTitle' | translate"
      [nzOkDisabled]="!selectedInvoice() || store.saving()"
      [nzOkLoading]="store.saving()"
      [nzOkText]="'treasuryIso.workbench.assign' | translate"
      [nzCancelText]="'treasuryIso.workbench.cancel' | translate"
      (nzOnCancel)="assigning.set(null)"
      (nzOnOk)="confirmAssign()"
    >
      <ng-container *nzModalContent>
        @if (assigning()?.exception_candidate; as candidate) {
          <nz-alert
            class="gap"
            nzType="info"
            nzShowIcon
            [nzMessage]="'treasuryIso.workbench.suggested' | translate"
            [nzDescription]="candidate.invoice_number + ' · ' + (candidate.due_amount | money: candidate.currency)"
            data-testid="suggested"
          />
        }
        <label for="iso-wb-invoice" class="field">
          <span>{{ 'treasuryIso.workbench.invoice' | translate }}</span>
          <nz-select
            nzId="iso-wb-invoice"
            nzShowSearch
            nzServerSearch
            class="full"
            [ngModel]="selectedInvoice()"
            (ngModelChange)="selectedInvoice.set($event)"
            (nzOnSearch)="searchInvoices($event)"
            [nzLoading]="searching()"
            data-testid="invoice-select"
          >
            @for (option of invoiceOptions(); track option.id) {
              <nz-option [nzValue]="option.id" [nzLabel]="option.label" />
            }
          </nz-select>
        </label>
        <label for="iso-wb-difference" class="field">
          <span>{{ 'treasuryIso.workbench.difference' | translate }}</span>
          <nz-select
            nzId="iso-wb-difference"
            class="full"
            [ngModel]="difference()"
            (ngModelChange)="difference.set($event)"
            data-testid="difference-select"
          >
            @for (handling of handlings; track handling) {
              <nz-option [nzValue]="handling" [nzLabel]="'treasuryIso.workbench.diff.' + handling | translate" />
            }
          </nz-select>
        </label>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="categorizing() !== null"
      [nzTitle]="'treasuryIso.workbench.categorizeTitle' | translate"
      [nzOkDisabled]="!categoryValid() || store.saving()"
      [nzOkLoading]="store.saving()"
      [nzOkText]="'treasuryIso.workbench.categorize' | translate"
      [nzCancelText]="'treasuryIso.workbench.cancel' | translate"
      (nzOnCancel)="categorizing.set(null)"
      (nzOnOk)="confirmCategorize()"
    >
      <ng-container *nzModalContent>
        <label for="iso-wb-category" class="field">
          <span>{{ 'treasuryIso.workbench.category' | translate }}</span>
          <nz-select
            nzId="iso-wb-category"
            class="full"
            [ngModel]="category()"
            (ngModelChange)="category.set($event)"
            data-testid="category-select"
          >
            @for (entry of categories; track entry) {
              <nz-option [nzValue]="entry" [nzLabel]="'treasuryIso.category.' + entry | translate" />
            }
          </nz-select>
        </label>
        <label for="iso-wb-ledger" class="field">
          <span>{{ 'treasuryIso.workbench.ledgerAccount' | translate }}</span>
          <input
            nz-input
            id="iso-wb-ledger"
            maxlength="20"
            [ngModel]="ledgerCode()"
            (ngModelChange)="ledgerCode.set($event ?? '')"
            data-testid="ledger-code"
          />
          @if (ledgerCode() !== '' && !ledgerValid()) {
            <span class="invalid" role="alert">{{ 'treasuryIso.workbench.ledgerInvalid' | translate }}</span>
          }
        </label>
        <label for="iso-wb-notes" class="field">
          <span>{{ 'treasuryIso.workbench.notes' | translate }}</span>
          <textarea
            nz-input
            id="iso-wb-notes"
            rows="3"
            maxlength="1000"
            [ngModel]="notes()"
            (ngModelChange)="notes.set($event ?? '')"
          ></textarea>
        </label>
      </ng-container>
    </nz-modal>

    <nz-drawer
      [nzVisible]="detail() !== null"
      nzWidth="480"
      [nzTitle]="'treasuryIso.workbench.detailTitle' | translate"
      (nzOnClose)="detail.set(null)"
    >
      <ng-container *nzDrawerContent>
        @if (detail(); as line) {
          <dl class="detail" data-testid="detail">
            <dt>{{ 'treasuryIso.workbench.col.exception' | translate }}</dt>
            <dd>{{ 'treasuryIso.exception.' + line.exception_code | translate }}</dd>
            <dt>{{ 'treasuryIso.workbench.col.date' | translate }}</dt>
            <dd>{{ line.booking_date }}{{ line.value_date ? ' / ' + line.value_date : '' }}</dd>
            <dt>{{ 'treasuryIso.workbench.col.amount' | translate }}</dt>
            <dd>{{ line.gross_amount | money: line.currency }}</dd>
            <dt>{{ 'treasuryIso.workbench.detail.fee' | translate }}</dt>
            <dd>{{ line.fee_amount | money: line.currency }}</dd>
            <dt>{{ 'treasuryIso.workbench.detail.net' | translate }}</dt>
            <dd>{{ line.amount | money: line.currency }}</dd>
            <dt>{{ 'treasuryIso.workbench.col.counterpart' | translate }}</dt>
            <dd>{{ line.counterpart_name ?? '-' }}</dd>
            <dt>IBAN</dt>
            <dd>{{ line.counterpart_iban ?? '-' }}</dd>
            <dt>{{ 'treasuryIso.workbench.detail.reference' | translate }}</dt>
            <dd>{{ line.reference ?? '-' }}</dd>
            <dt>{{ 'treasuryIso.workbench.detail.qrReference' | translate }}</dt>
            <dd>{{ line.qr_reference ?? '-' }}</dd>
            <dt>{{ 'treasuryIso.workbench.detail.description' | translate }}</dt>
            <dd>{{ line.description ?? '-' }}</dd>
            <dt>{{ 'treasuryIso.workbench.detail.statement' | translate }}</dt>
            <dd>{{ line.bank_statement_id }}</dd>
          </dl>
        }
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    :host {
      display: block;
    }
    .hint {
      color: rgba(0, 0, 0, 0.55);
    }
    .codes,
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .select {
      width: 180px;
    }
    .search {
      width: 260px;
    }
    .gap {
      margin-top: 16px;
    }
    .num {
      text-align: right;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .field {
      display: grid;
      gap: 4px;
      margin-bottom: 12px;
    }
    .full {
      width: 100%;
    }
    .invalid {
      color: #cf1322;
    }
    .detail {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 8px 16px;
    }
    .detail dt {
      font-weight: 600;
    }
    .detail dd {
      margin: 0;
      word-break: break-word;
    }
  `,
})
export class TrReconciliationExceptionsComponent implements OnInit {
  protected readonly store = inject(ReconciliationExceptionsStore);
  private readonly invoices = inject(InvoiceApiService);
  private readonly procurement = inject(ProcurementApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly codes = EXCEPTION_CODES;
  protected readonly categories = LINE_CATEGORIES;
  protected readonly handlings: readonly DifferenceHandling[] = ['none', 'write_off', 'partial'];
  protected readonly colors = EXCEPTION_COLORS;

  protected readonly searchText = signal('');
  protected readonly detail = signal<ReconciliationException | null>(null);

  protected readonly assigning = signal<ReconciliationException | null>(null);
  protected readonly invoiceOptions = signal<InvoiceOption[]>([]);
  protected readonly selectedInvoice = signal<string | null>(null);
  protected readonly difference = signal<DifferenceHandling>('none');
  protected readonly searching = signal(false);

  protected readonly categorizing = signal<ReconciliationException | null>(null);
  protected readonly category = signal<LineCategory | null>(null);
  protected readonly ledgerCode = signal('');
  protected readonly notes = signal('');
  protected readonly ledgerValid = computed(() => LEDGER_CODE.test(this.ledgerCode()));
  protected readonly categoryValid = computed(
    () => this.category() !== null && (this.ledgerCode() === '' || this.ledgerValid()),
  );

  ngOnInit(): void {
    void this.store.load();
  }

  /** One click: settles the line against the invoice the API suggested, with no difference handling. */
  async confirmSuggestion(line: ReconciliationException): Promise<void> {
    if (!line.exception_candidate) {
      return;
    }

    if (await this.store.assign(line.id, line.exception_candidate.id, 'none')) {
      this.message.success(this.translate.instant('treasuryIso.workbench.assigned'));
    }
  }

  openAssign(line: ReconciliationException): void {
    const candidate = line.exception_candidate;

    this.assigning.set(line);
    this.difference.set('none');
    this.selectedInvoice.set(candidate?.id ?? null);
    this.invoiceOptions.set(
      candidate
        ? [{ id: candidate.id, label: `${candidate.invoice_number} · ${candidate.due_amount} ${candidate.currency}` }]
        : [],
    );
    this.searchInvoices('');
  }

  /** Credits are settled by customer invoices, debits by received supplier invoices; the suggestion stays listed. */
  searchInvoices(term: string): void {
    const line = this.assigning();

    if (line === null) {
      return;
    }

    const search = term.trim() || undefined;
    const keep = this.invoiceOptions().filter((option) => option.id === this.selectedInvoice());

    this.searching.set(true);

    const merge = (options: InvoiceOption[]): void => {
      const extra = options.filter((option) => !keep.some((kept) => kept.id === option.id));

      this.invoiceOptions.set([...keep, ...extra]);
      this.searching.set(false);
    };
    const fail = (): void => this.searching.set(false);

    if (line.direction === 'credit') {
      this.invoices
        .list({ payment_status: 'unpaid', search, per_page: 20 })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) =>
            merge(
              (res.data ?? []).map((invoice) => ({
                id: invoice.id,
                label: `${invoice.invoice_number} · ${invoice.contact?.company_name ?? invoice.client?.company_name ?? ''} · ${invoice.total} ${invoice.currency}`,
              })),
            ),
          error: fail,
        });

      return;
    }

    this.procurement
      .getSupplierInvoices({ payment_status: 'unpaid', search, per_page: 20 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) =>
          merge(
            (res.data ?? []).map((invoice) => ({
              id: invoice.id,
              label: `${invoice.invoice_number} · ${invoice.supplier_name ?? ''} · ${invoice.total_amount} ${invoice.currency}`,
            })),
          ),
        error: fail,
      });
  }

  async confirmAssign(): Promise<void> {
    const line = this.assigning();
    const invoiceId = this.selectedInvoice();

    if (line === null || invoiceId === null) {
      return;
    }

    if (await this.store.assign(line.id, invoiceId, this.difference())) {
      this.assigning.set(null);
      this.message.success(this.translate.instant('treasuryIso.workbench.assigned'));
    }
  }

  openCategorize(line: ReconciliationException): void {
    this.categorizing.set(line);
    this.category.set(null);
    this.ledgerCode.set('');
    this.notes.set('');
  }

  async confirmCategorize(): Promise<void> {
    const line = this.categorizing();
    const category = this.category();

    if (line === null || category === null || !this.categoryValid()) {
      return;
    }

    const saved = await this.store.categorize(line.id, {
      category,
      ledger_account_code: this.ledgerCode() || null,
      notes: this.notes().trim() || null,
    });

    if (saved) {
      this.categorizing.set(null);
      this.message.success(this.translate.instant('treasuryIso.workbench.categorized'));
    }
  }
}
