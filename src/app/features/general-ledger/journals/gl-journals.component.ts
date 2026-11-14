import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  PermissionsService,
  QueryFilterParams,
} from '@core';
import { BaseTableComponent, MoneyPipe, TableColumnDef, TranslatePipe, ModalActionsDirective } from '@shared';
import { Observable } from 'rxjs';
import { GlLookupStore } from '../shared/gl-lookup.store';

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
  protected readonly grid = new FetchGridModel<GlJournalEntry, JournalGridFilter>((query) => this.api.getJournals(query));
  protected readonly statusFilter = signal<ExtendedJournalStatus | null>('pending_approval');

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
        this.grid.reload();
      },
    });
  }
}
