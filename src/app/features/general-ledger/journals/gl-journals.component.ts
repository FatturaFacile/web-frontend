import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AccountingApiService,
  ApiResponse,
  AuthStore,
  ExtendedJournalStatus,
  FetchGridModel,
  GeneralLedgerApiService,
  GlJournalEntry,
  I18nService,
  LEDGER_BOOK_CODES,
  LedgerBookCode,
  ledgerBookOfType,
  PermissionsService,
  QueryFilterParams,
} from '@core';
import { BaseTableComponent, MoneyPipe, TableColumnDef, TranslatePipe, ModalActionsDirective } from '@shared';
import { map, Observable } from 'rxjs';
import { GlLookupStore } from '../shared/gl-lookup.store';
import { todayIso } from '../prima-nota/prima-nota.util';
import { GlJournalInspectorDrawerComponent } from './gl-journal-inspector-drawer.component';

interface JournalGridFilter extends QueryFilterParams {
  status?: string;
}

const STATUS_COLORS: Record<ExtendedJournalStatus, string> = {
  draft: 'default',
  pending_approval: 'gold',
  rejected: 'red',
  posted: 'green',
  reversed: 'purple',
};

@Component({
  selector: 'app-gl-journals',
  styleUrl: './gl-journals.component.scss',
  imports: [
    BaseTableComponent,
    GlJournalInspectorDrawerComponent,
    ModalActionsDirective,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './gl-journals.component.html',
})
export class GlJournalsComponent {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly accountingApi = inject(AccountingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly lookups = inject(GlLookupStore);
  private readonly authStore = inject(AuthStore);
  protected readonly currency = this.authStore.activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly statuses: ExtendedJournalStatus[] = ['draft', 'pending_approval', 'rejected', 'posted', 'reversed'];
  /** The API filters by status and period only: book, dates and text narrow the loaded page here. */
  protected readonly grid = new FetchGridModel<GlJournalEntry, JournalGridFilter>((query) =>
    this.api.getJournals(query).pipe(map((res) => ({ ...res, data: res.data.filter((entry) => this.matchesLocalFilters(entry)) }))),
  );
  protected readonly statusFilter = signal<ExtendedJournalStatus | null>('pending_approval');
  protected readonly books: readonly LedgerBookCode[] = LEDGER_BOOK_CODES;
  protected readonly bookFilter = signal<LedgerBookCode | null>(null);
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');
  protected readonly textFilter = signal('');
  protected readonly inspected = signal<GlJournalEntry | null>(null);

  protected readonly rejectTarget = signal<GlJournalEntry | null>(null);
  protected rejectReason = '';

  private readonly entryTpl = viewChild<TemplateRef<{ $implicit: GlJournalEntry; value: unknown }>>('entryTpl');
  private readonly descriptionTpl = viewChild<TemplateRef<{ $implicit: GlJournalEntry; value: unknown }>>('descriptionTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: GlJournalEntry; value: unknown }>>('statusTpl');
  private readonly totalTpl = viewChild<TemplateRef<{ $implicit: GlJournalEntry; value: unknown }>>('totalTpl');

  protected readonly columns = computed<TableColumnDef<GlJournalEntry>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'entry_number', header: 'GL.COL_ENTRY', customCellTemplate: this.entryTpl() },
      { key: 'posting_date', header: 'GL.COL_DATE' },
      {
        key: 'ledger_type',
        header: 'GL.PN_BOOK',
        valueLabel: (value) => this.i18n.translate('GL.PN_BOOK_' + ledgerBookOfType(String(value))),
      },
      { key: 'description', header: 'GL.COL_DESCRIPTION', customCellTemplate: this.descriptionTpl() },
      {
        key: 'status',
        header: 'GL.STATUS',
        valueLabel: (value) => this.i18n.translate('GL.JOURNAL_STATUS_' + value.toUpperCase()),
        customCellTemplate: this.statusTpl(),
      },
      { key: 'total_amount', header: 'GL.COL_TOTAL', align: 'right', customCellTemplate: this.totalTpl() },
      { key: 'auto_reverse_on', header: 'GL.COL_AUTO_REVERSE' },
    ];
  });

  constructor() {
    this.lookups.load();
    this.grid.setPageSize(20);
    // Drill-down from the account ledger: `?entry=<id>` opens the inspector of that entry, whatever its status.
    const entryId = inject(ActivatedRoute).snapshot.queryParamMap.get('entry');
    if (entryId) {
      this.statusFilter.set(null);
      this.api.getJournal(entryId).subscribe({ next: (res) => this.inspected.set(res.data) });
    }
    this.grid.setFilter({ status: this.statusFilter() ?? undefined });
  }

  /** The approver must differ from author and submitter: the button is hidden for them (the server answers 403 anyway). */
  protected canApprove(entry: GlJournalEntry): boolean {
    const userId = this.authStore.user()?.id ?? null;
    return userId === null || (entry.created_by !== userId && entry.submitted_by !== userId);
  }

  protected statusColor(status: ExtendedJournalStatus): string {
    return STATUS_COLORS[status] ?? 'default';
  }

  protected setStatus(status: ExtendedJournalStatus | null): void {
    this.statusFilter.set(status);
    this.grid.setFilter({ status: status ?? undefined });
  }

  protected submit(entry: GlJournalEntry): void {
    this.run(this.api.submitJournal(entry.id), 'GL.JOURNAL_SUBMITTED');
  }

  protected post(entry: GlJournalEntry): void {
    this.run(this.accountingApi.postJournal(entry.id) as Observable<ApiResponse<unknown>>, 'GL.JOURNAL_POSTED');
  }

  protected approve(entry: GlJournalEntry): void {
    this.run(this.api.approveJournal(entry.id), 'GL.JOURNAL_APPROVED');
  }

  /** One-click storno: reverses the entry today, in its own book, with a standard reason. */
  protected reverse(entry: GlJournalEntry): void {
    this.run(
      this.api.reverseJournalEntry(entry.id, {
        reversal_date: todayIso(),
        reason: this.i18n.translate('GL.JOURNAL_STORNO_REASON'),
      }),
      'GL.JOURNAL_REVERSED',
    );
    this.inspected.set(null);
  }

  protected inspect(entry: GlJournalEntry): void {
    this.inspected.set(entry);
    // The list rows carry the lines; fall back to the detail endpoint when they are missing.
    if (!entry.lines) {
      this.api.getJournal(entry.id).subscribe({ next: (res) => this.inspected.set(res.data) });
    }
  }

  protected setBook(book: LedgerBookCode | null): void {
    this.bookFilter.set(book);
    this.grid.reload();
  }

  protected setDate(which: 'from' | 'to', value: string): void {
    (which === 'from' ? this.dateFrom : this.dateTo).set(value);
    this.grid.reload();
  }

  protected setText(value: string): void {
    this.textFilter.set(value);
    this.grid.reload();
  }

  protected bookOf(entry: GlJournalEntry): LedgerBookCode {
    return ledgerBookOfType(entry.ledger_type);
  }

  private matchesLocalFilters(entry: GlJournalEntry): boolean {
    const book = this.bookFilter();
    if (book && ledgerBookOfType(entry.ledger_type) !== book) {
      return false;
    }
    if (this.dateFrom() && entry.posting_date < this.dateFrom()) {
      return false;
    }
    if (this.dateTo() && entry.posting_date > this.dateTo()) {
      return false;
    }
    const text = this.textFilter().trim().toLowerCase();
    return !text || entry.entry_number.toLowerCase().includes(text) || entry.description.toLowerCase().includes(text);
  }

  protected openReject(entry: GlJournalEntry): void {
    this.rejectReason = '';
    this.rejectTarget.set(entry);
  }

  protected confirmReject(): void {
    const target = this.rejectTarget();
    if (!target || !this.rejectReason.trim()) {
      return;
    }
    this.run(this.api.rejectJournal(target.id, this.rejectReason.trim()), 'GL.JOURNAL_REJECTED');
    this.rejectTarget.set(null);
  }

  private run(call: Observable<ApiResponse<unknown>>, successKey: string): void {
    call.subscribe({
      next: () => {
        this.message.success(this.i18n.translate(successKey));
        this.grid.reload();
      },
    });
  }
}
