import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '@core/auth/auth.store';
import { I18nService } from '@core/i18n';
import { PurchaseRequisitionApiService } from '@data-access/procurement/purchase-requisition-api.service';
import {
  PrDocumentLink,
  PrListTab,
  PurchaseRequisitionStatus,
  PurchaseRequisitionSummary,
  PurchaseRequisitionUrgency,
} from '@domain/procurement/purchase-requisition.models';
import { DateFormatPipe, MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { PrDetailPageComponent } from './pr-detail-page.component';
import {
  DocumentRouteTarget,
  extractApiErrorMessage,
  prDocumentLinkRoute,
  prStatusLabelKey,
  prStatusTagColor,
  prUrgencyLabelKey,
  prUrgencyTagColor,
  toIsoDateString,
} from './pr-status.helpers';
import { PurchaseRequisitionStore } from './purchase-requisition.store';

interface StatusSelectOption {
  value: PurchaseRequisitionStatus;
  labelKey: string;
}

interface UrgencySelectOption {
  value: PurchaseRequisitionUrgency;
  labelKey: string;
}

const TAB_ORDER: readonly PrListTab[] = ['mine', 'department', 'pending_approval'];

/**
 * Purchase Requisition monitoring dashboard with tab scopes (My Requisitions, All Department,
 * Pending My Approval), multi-criteria filters, bidirectional RDO/PO badges, and detail drawer.
 */
@Component({
  selector: 'app-pr-list-page',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    DateFormatPipe,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    PrDetailPageComponent,
    NzAlertModule,
    NzBadgeModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzEmptyModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpaceModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  templateUrl: './pr-list-page.component.html',
  styleUrl: './pr-list-page.component.scss',
})
export class PrListPageComponent implements OnInit {
  readonly store = inject(PurchaseRequisitionStore);
  private readonly api = inject(PurchaseRequisitionApiService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly searchInput$ = new Subject<string>();

  readonly searchTerm = signal<string>('');
  readonly statusFilter = signal<PurchaseRequisitionStatus | null>(null);
  readonly costCenterFilter = signal<string | null>(null);
  readonly projectFilter = signal<string | null>(null);
  readonly urgencyFilter = signal<PurchaseRequisitionUrgency | null>(null);
  readonly requesterFilter = signal<string | null>(null);
  readonly dateRangeFilter = signal<Date[]>([]);

  readonly drawerRequisitionId = signal<string | null>(null);
  readonly drawerVisible = signal<boolean>(false);

  readonly rejectModalVisible = signal<boolean>(false);
  readonly rejectTarget = signal<PurchaseRequisitionSummary | null>(null);
  readonly rejectForm = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(1000)]],
  });

  readonly selectedTabIndex = computed(() => {
    const idx = TAB_ORDER.indexOf(this.store.activeTab());
    return idx >= 0 ? idx : 0;
  });

  readonly statusOptions: readonly StatusSelectOption[] = [
    { value: 'draft', labelKey: 'PR.STATUS_DRAFT' },
    { value: 'pending_budget_check', labelKey: 'PR.STATUS_PENDING_BUDGET_CHECK' },
    { value: 'pending_approval', labelKey: 'PR.STATUS_PENDING_APPROVAL' },
    { value: 'budget_exceeded_blocked', labelKey: 'PR.STATUS_BUDGET_EXCEEDED_BLOCKED' },
    { value: 'approved', labelKey: 'PR.STATUS_APPROVED' },
    { value: 'rejected', labelKey: 'PR.STATUS_REJECTED' },
    { value: 'partially_converted', labelKey: 'PR.STATUS_PARTIALLY_CONVERTED' },
    { value: 'converted', labelKey: 'PR.STATUS_CONVERTED' },
    { value: 'cancelled', labelKey: 'PR.STATUS_CANCELLED' },
  ];

  readonly urgencyOptions: readonly UrgencySelectOption[] = [
    { value: 'low', labelKey: 'PR.URGENCY_LOW' },
    { value: 'normal', labelKey: 'PR.URGENCY_NORMAL' },
    { value: 'high', labelKey: 'PR.URGENCY_HIGH' },
    { value: 'critical', labelKey: 'PR.URGENCY_CRITICAL' },
  ];

  readonly statusLabel = prStatusLabelKey;
  readonly statusColor = prStatusTagColor;
  readonly urgencyLabel = prUrgencyLabelKey;
  readonly urgencyColor = prUrgencyTagColor;

  ngOnInit(): void {
    this.syncFilterSignalsFromStore();
    this.store.loadLookups().subscribe();
    this.store.loadPendingApprovalCount().subscribe();
    this.reloadList();

    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.store.setFilters({ search: term });
        this.reloadList(1);
      });
  }

  onTabIndexChange(index: number): void {
    const tab = TAB_ORDER[index] ?? 'mine';
    this.store.setTab(tab);
    if (tab === 'mine') {
      this.requesterFilter.set(null);
      this.store.setFilters({ requester_id: null });
    }
    this.reloadList(1);
  }

  onSearchInput(term: string): void {
    this.searchTerm.set(term);
    this.searchInput$.next(term);
  }

  onStatusChange(status: PurchaseRequisitionStatus | null): void {
    this.statusFilter.set(status);
    this.store.setFilters({ status });
    this.reloadList(1);
  }

  onCostCenterChange(costCenterId: string | null): void {
    this.costCenterFilter.set(costCenterId);
    this.store.setFilters({ cost_center_id: costCenterId });
    this.reloadList(1);
  }

  onProjectChange(projectId: string | null): void {
    this.projectFilter.set(projectId);
    this.store.setFilters({ project_id: projectId });
    this.reloadList(1);
  }

  onUrgencyChange(urgency: PurchaseRequisitionUrgency | null): void {
    this.urgencyFilter.set(urgency);
    this.store.setFilters({ urgency });
    this.reloadList(1);
  }

  onRequesterChange(requesterId: string | null): void {
    this.requesterFilter.set(requesterId);
    this.store.setFilters({ requester_id: requesterId });
    this.reloadList(1);
  }

  onDateRangeChange(range: Date[]): void {
    this.dateRangeFilter.set(range ?? []);
    const from = range?.[0] ? toIsoDateString(range[0]) : null;
    const to = range?.[1] ? toIsoDateString(range[1]) : null;
    this.store.setFilters({ date_from: from, date_to: to });
    this.reloadList(1);
  }

  resetAllFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set(null);
    this.costCenterFilter.set(null);
    this.projectFilter.set(null);
    this.urgencyFilter.set(null);
    this.requesterFilter.set(null);
    this.dateRangeFilter.set([]);
    this.store.resetFilters();
    this.reloadList(1);
  }

  refresh(): void {
    this.store.loadPendingApprovalCount().subscribe();
    this.reloadList();
  }

  onPageChange(page: number): void {
    this.reloadList(page);
  }

  onPageSizeChange(perPage: number): void {
    this.store
      .loadList({
        page: 1,
        per_page: perPage,
        currentUserId: this.authStore.user()?.id ?? null,
      })
      .subscribe();
  }

  createNew(): void {
    void this.router.navigate(['/procurement/requisitions/new']);
  }

  openDrawer(row: PurchaseRequisitionSummary): void {
    this.drawerRequisitionId.set(row.id);
    this.drawerVisible.set(true);
  }

  closeDrawer(): void {
    this.drawerVisible.set(false);
    this.drawerRequisitionId.set(null);
  }

  onDrawerActionCompleted(): void {
    this.store.loadPendingApprovalCount().subscribe();
    this.reloadList();
  }

  docLinkRoute(link: PrDocumentLink): DocumentRouteTarget {
    return prDocumentLinkRoute(link);
  }

  canEditRow(row: PurchaseRequisitionSummary): boolean {
    return (
      row.status === 'draft' ||
      row.status === 'rejected' ||
      row.status === 'budget_exceeded_blocked'
    );
  }

  canApproveRow(row: PurchaseRequisitionSummary): boolean {
    if (row.status !== 'pending_approval') {
      return false;
    }
    if (typeof row.can_approve === 'boolean') {
      return row.can_approve;
    }
    return this.store.activeTab() === 'pending_approval';
  }

  quickApprove(row: PurchaseRequisitionSummary): void {
    this.store.setBusy(true);
    this.api.approve(row.id).subscribe({
      next: () => {
        this.store.setBusy(false);
        this.message.success(this.i18n.translate('PR.DETAIL.APPROVE_SUCCESS'));
        this.store.loadPendingApprovalCount().subscribe();
        this.reloadList();
      },
      error: (err: unknown) => {
        this.store.setBusy(false);
        this.message.error(extractApiErrorMessage(err) || this.i18n.translate('PR.ACTION_ERROR'));
      },
    });
  }

  openRejectModal(row: PurchaseRequisitionSummary): void {
    this.rejectTarget.set(row);
    this.rejectForm.reset({ reason: '' });
    this.rejectModalVisible.set(true);
  }

  closeRejectModal(): void {
    this.rejectModalVisible.set(false);
    this.rejectTarget.set(null);
  }

  confirmReject(): void {
    const target = this.rejectTarget();
    if (!target) {
      return;
    }
    if (this.rejectForm.invalid) {
      this.rejectForm.controls.reason.markAsDirty();
      this.rejectForm.controls.reason.updateValueAndValidity();
      return;
    }

    const reason = this.rejectForm.controls.reason.getRawValue().trim();
    this.store.setBusy(true);
    this.api.reject(target.id, reason).subscribe({
      next: () => {
        this.store.setBusy(false);
        this.closeRejectModal();
        this.message.info(this.i18n.translate('PR.DETAIL.REJECT_SUCCESS'));
        this.store.loadPendingApprovalCount().subscribe();
        this.reloadList();
      },
      error: (err: unknown) => {
        this.store.setBusy(false);
        this.message.error(extractApiErrorMessage(err) || this.i18n.translate('PR.ACTION_ERROR'));
      },
    });
  }

  deleteDraft(row: PurchaseRequisitionSummary): void {
    this.store.setBusy(true);
    this.api.delete(row.id).subscribe({
      next: () => {
        this.store.setBusy(false);
        this.message.success(this.i18n.translate('PR.DELETE_SUCCESS'));
        this.reloadList();
      },
      error: (err: unknown) => {
        this.store.setBusy(false);
        this.message.error(extractApiErrorMessage(err) || this.i18n.translate('PR.ACTION_ERROR'));
      },
    });
  }

  private reloadList(page?: number): void {
    this.store
      .loadList({
        page,
        currentUserId: this.authStore.user()?.id ?? null,
      })
      .subscribe();
  }

  private syncFilterSignalsFromStore(): void {
    const f = this.store.filters();
    this.searchTerm.set(f.search);
    this.statusFilter.set(f.status);
    this.costCenterFilter.set(f.cost_center_id);
    this.projectFilter.set(f.project_id);
    this.urgencyFilter.set(f.urgency);
    this.requesterFilter.set(f.requester_id);
    if (f.date_from && f.date_to) {
      this.dateRangeFilter.set([new Date(f.date_from), new Date(f.date_to)]);
    }
  }
}
