import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  SlaState,
  TicketApiService,
  TicketListParams,
  TicketPriority,
  TicketResource,
  TicketStatus,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { TicketCreateDrawerComponent } from './components/ticket-create-drawer/ticket-create-drawer.component';
import { TicketBulkModalComponent } from './components/ticket-bulk-modal/ticket-bulk-modal.component';
import { TicketDetailDrawerComponent } from './components/ticket-detail-drawer/ticket-detail-drawer.component';

@Component({
  selector: 'app-field-service',
  imports: [
    DatePipe,
    FormsModule,
    NzCardModule,
    NzTableModule,
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
export class FieldServiceComponent implements OnInit {
  private readonly api = inject(TicketApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(false);
  readonly tickets = signal<TicketResource[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(10);

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
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  readonly selectedIdList = computed(() => [...this.selectedIds()]);
  readonly allSelected = computed(
    () =>
      this.tickets().length > 0 &&
      this.tickets().every((ticket) => this.selectedIds().has(ticket.id)),
  );

  ngOnInit(): void {
    this.loadTickets();
  }

  toggleOne(id: string, checked: boolean): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  toggleAll(checked: boolean): void {
    this.selectedIds.set(checked ? new Set(this.tickets().map((ticket) => ticket.id)) : new Set());
  }

  onBulkDone(): void {
    this.selectedIds.set(new Set());
    this.loadTickets();
  }

  loadTickets(): void {
    this.loading.set(true);

    const params: TicketListParams = {
      page: this.pageIndex(),
      per_page: this.pageSize(),
      status: (this.filterStatus() as TicketStatus) || undefined,
      priority: (this.filterPriority() as TicketPriority) || undefined,
      sla_state: (this.filterSlaState() as SlaState) || undefined,
      q: this.searchQuery().trim() || undefined,
    };

    this.api.getTickets(params).subscribe({
      next: (res) => {
        this.tickets.set(res?.data || []);
        const totalRaw = res?.meta?.total;
        const totalCount = typeof totalRaw === 'string' ? parseInt(totalRaw, 10) : totalRaw || 0;
        this.total.set(isNaN(totalCount) ? 0 : totalCount);
        this.loading.set(false);
      },
      error: (err) => {
        this.message.error(
          err?.error?.detail ||
            err?.message ||
            this.translate.instant('fieldService.errors.loadFailed'),
        );
        this.tickets.set([]);
        this.total.set(0);
        this.loading.set(false);
      },
    });
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    this.pageIndex.set(pageIndex);
    this.pageSize.set(pageSize);
    this.loadTickets();
  }

  onSearch(): void {
    this.pageIndex.set(1);
    this.loadTickets();
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.filterStatus.set('');
    this.filterPriority.set('');
    this.filterSlaState.set('');
    this.pageIndex.set(1);
    this.loadTickets();
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
