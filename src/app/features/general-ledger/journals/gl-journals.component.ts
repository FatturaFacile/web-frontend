import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AccountingApiService,
  ApiResponse,
  AuthStore,
  ExtendedJournalStatus,
  GeneralLedgerApiService,
  GlJournalEntry,
  I18nService,
  PermissionsService,
} from '@core';
import { MoneyPipe, TranslatePipe, ModalActionsDirective, GridExportDirective, GridSortPipe } from '@shared';
import { Observable } from 'rxjs';
import { GlLookupStore } from '../shared/gl-lookup.store';

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
    GridExportDirective,
    GridSortPipe,
    ModalActionsDirective,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './gl-journals.component.html',
})
export class GlJournalsComponent implements OnInit {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly accountingApi = inject(AccountingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly lookups = inject(GlLookupStore);
  private readonly authStore = inject(AuthStore);
  protected readonly currency = this.authStore.activeCurrency;
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly statuses: ExtendedJournalStatus[] = ['draft', 'pending_approval', 'rejected', 'posted', 'reversed'];
  protected readonly items = signal<GlJournalEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly statusFilter = signal<ExtendedJournalStatus | null>('pending_approval');
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected readonly detail = signal<Record<string, GlJournalEntry>>({});

  protected readonly rejectTarget = signal<GlJournalEntry | null>(null);
  protected rejectReason = '';

  ngOnInit(): void {
    this.lookups.load();
    this.load();
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
    this.pageIndex.set(1);
    this.load();
  }

  protected setPage(page: number): void {
    this.pageIndex.set(page);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .getJournals({
        status: this.statusFilter() ?? undefined,
        page: this.pageIndex(),
        per_page: this.pageSize(),
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.data ?? []);
          this.total.set(res.meta?.total ?? 0);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected toggle(entry: GlJournalEntry, open: boolean): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (open) {
        next.add(entry.id);
      } else {
        next.delete(entry.id);
      }
      return next;
    });
    if (open && !this.detail()[entry.id]) {
      this.api.getJournal(entry.id).subscribe({
        next: (res) => this.detail.update((d) => ({ ...d, [entry.id]: res.data })),
      });
    }
  }

  protected linesOf(entry: GlJournalEntry): GlJournalEntry['lines'] {
    return this.detail()[entry.id]?.lines ?? entry.lines ?? [];
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

  protected reverse(entry: GlJournalEntry): void {
    this.run(this.api.reverseJournalEntry(entry.id), 'GL.JOURNAL_REVERSED');
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
        this.detail.set({});
        this.load();
      },
    });
  }
}
