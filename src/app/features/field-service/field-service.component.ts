import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { map, tap } from 'rxjs';
import {
  FetchGridModel,
  PaginatedResponse,
  SlaState,
  TicketApiService,
  TicketListParams,
  TicketPriority,
  TicketResource,
  TicketStatus,
  TranslateService,
} from '@core';
import { BaseTableComponent, IconActionDirective, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { TicketCreateDrawerComponent } from './components/ticket-create-drawer/ticket-create-drawer.component';
import { TicketBulkModalComponent } from './components/ticket-bulk-modal/ticket-bulk-modal.component';
import { TicketDetailDrawerComponent } from './components/ticket-detail-drawer/ticket-detail-drawer.component';

@Component({
  selector: 'app-field-service',
  styleUrl: './field-service.component.scss',
  imports: [
    IconActionDirective,
    DatePipe,
    FormsModule,
    NzCardModule,
    BaseTableComponent,
    NzTagModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzSpaceModule,
    NzIconModule,
    NzDividerModule,
    NzBadgeModule,
    PageHeaderComponent,
    TranslatePipe,
    TicketCreateDrawerComponent,
    TicketDetailDrawerComponent,
    TicketBulkModalComponent,
  ],
  templateUrl: './field-service.component.html',
})
export class FieldServiceComponent {
  private readonly api = inject(TicketApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  /** Server-side grid: paging, sorting, column filters, grouping and export run over the whole ticket list. */
  readonly grid = new FetchGridModel<TicketResource, TicketListParams>((query) =>
    this.api.getTickets(query).pipe(
      tap({
        error: (err) =>
          this.message.error(
            err?.error?.detail || err?.message || this.translate.instant('fieldService.errors.loadFailed'),
          ),
      }),
      map(
        (res) =>
          ({
            ...res,
            data: res?.data ?? [],
            meta: { ...res?.meta, total: Number(res?.meta?.total ?? 0) },
          }) as unknown as PaginatedResponse<TicketResource>,
      ),
    ),
  );

  // Filters
  readonly searchQuery = signal('');
  readonly filterStatus = signal<string>('');
  readonly filterPriority = signal<string>('');
  readonly filterSlaState = signal<string>('');

  // Drawers
  readonly createDrawerOpen = signal(false);
  readonly detailDrawerOpen = signal(false);
  readonly selectedTicketId = signal<string | null>(null);

  // Bulk selection
  readonly bulkOpen = signal(false);
  readonly selectedTickets = signal<TicketResource[]>([]);
  readonly selectedIdList = computed(() => this.selectedTickets().map((ticket) => ticket.id));

  private readonly ticketTpl = viewChild<TemplateRef<{ $implicit: TicketResource; value: unknown }>>('ticketTpl');
  private readonly subjectTpl = viewChild<TemplateRef<{ $implicit: TicketResource; value: unknown }>>('subjectTpl');
  private readonly priorityTpl = viewChild<TemplateRef<{ $implicit: TicketResource; value: unknown }>>('priorityTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: TicketResource; value: unknown }>>('statusTpl');
  private readonly slaTpl = viewChild<TemplateRef<{ $implicit: TicketResource; value: unknown }>>('slaTpl');
  private readonly createdTpl = viewChild<TemplateRef<{ $implicit: TicketResource; value: unknown }>>('createdTpl');

  /** `title` and `channel` are accessors of the API model: `serverKey` names the real column; `sla_state` is a gridColumns() entry. */
  readonly columns = computed<TableColumnDef<TicketResource>[]>(() => [
    { key: 'ticket_number', header: 'FIELD_SERVICE.COL_TICKET_ID', width: '120px', customCellTemplate: this.ticketTpl() },
    {
      key: 'title',
      serverKey: 'subject',
      valueGetter: (ticket) => ticket.title || ticket.subject,
      header: 'FIELD_SERVICE.COL_SUBJECT',
      customCellTemplate: this.subjectTpl(),
    },
    { key: 'channel', serverKey: 'source', header: 'FIELD_SERVICE.LBL_CANALE', width: '100px' },
    { key: 'priority', header: 'FIELD_SERVICE.LBL_PRIORITA', width: '110px', customCellTemplate: this.priorityTpl() },
    { key: 'status', header: 'COMMON.STATUS', width: '130px', customCellTemplate: this.statusTpl() },
    { key: 'sla_state', header: 'FIELD_SERVICE.COL_SLA', width: '140px', customCellTemplate: this.slaTpl() },
    { key: 'created_at', header: 'FIELD_SERVICE.LBL_DATA_CREAZIONE', width: '150px', customCellTemplate: this.createdTpl() },
  ]);

  onBulkDone(): void {
    this.selectedTickets.set([]);
    this.grid.reload();
  }

  onSearch(): void {
    this.grid.setFilter({
      status: (this.filterStatus() as TicketStatus) || undefined,
      priority: (this.filterPriority() as TicketPriority) || undefined,
      sla_state: (this.filterSlaState() as SlaState) || undefined,
      q: this.searchQuery().trim() || undefined,
    });
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.filterStatus.set('');
    this.filterPriority.set('');
    this.filterSlaState.set('');
    this.onSearch();
  }

  openCreate(): void {
    this.createDrawerOpen.set(true);
  }

  openDetail(id: string): void {
    this.selectedTicketId.set(id);
    this.detailDrawerOpen.set(true);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'new':
        return 'cyan';
      case 'open':
        return 'blue';
      case 'pending_customer':
        return 'purple';
      case 'on_hold':
        return 'warning';
      case 'resolved':
        return 'success';
      case 'closed':
        return 'default';
      default:
        return 'default';
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'blue';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  }

  getSlaColor(slaState: string): string {
    switch (slaState) {
      case 'ok':
        return 'success';
      case 'warning':
        return 'warning';
      case 'breached':
        return 'error';
      case 'paused':
        return 'default';
      default:
        return 'default';
    }
  }
}
