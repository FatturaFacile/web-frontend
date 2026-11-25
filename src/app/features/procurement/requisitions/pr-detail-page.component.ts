import { DocumentFlowDrawerComponent } from '../srm/document-flow-drawer.component';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '@core/auth/auth.store';
import { I18nService } from '@core/i18n';
import { PurchaseRequisitionApiService } from '@data-access/procurement/purchase-requisition-api.service';
import {
  PrDocumentLink,
  PurchaseRequisitionDetail,
} from '@domain/procurement/purchase-requisition.models';
import { DateFormatPipe, MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { map, of } from 'rxjs';
import { PrApprovalTrackerComponent } from './pr-approval-tracker.component';
import { PrBudgetIndicatorCardComponent } from './pr-budget-indicator-card.component';
import {
  DocumentRouteTarget,
  extractApiErrorMessage,
  prDocumentLinkRoute,
  prStatusLabelKey,
  prStatusTagColor,
  prUrgencyLabelKey,
  prUrgencyTagColor,
} from './pr-status.helpers';
import { PurchaseRequisitionStore } from './purchase-requisition.store';

/**
 * Displays full Purchase Requisition details, budget snapshot, multi-level approval chain,
 * immutable audit timeline, bidirectional RDO/PO links, and sticky approver actions.
 */
@Component({
  selector: 'app-pr-detail-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DateFormatPipe,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    PrBudgetIndicatorCardComponent,
    PrApprovalTrackerComponent,
    DocumentFlowDrawerComponent,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './pr-detail-page.component.html',
  styleUrl: './pr-detail-page.component.scss',
})
export class PrDetailPageComponent {
  readonly requisitionIdInput = input<string | null>(null);
  readonly embedded = input<boolean>(false);
  readonly actionCompleted = output<void>();

  readonly store = inject(PurchaseRequisitionStore);
  private readonly api = inject(PurchaseRequisitionApiService);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);

  private readonly routeId = toSignal(
    this.route ? this.route.paramMap.pipe(map((params) => params.get('id'))) : of(null),
    { initialValue: this.route?.snapshot.paramMap.get('id') ?? null },
  );

  readonly activeId = computed(() => this.requisitionIdInput() || this.routeId());
  readonly detail = this.store.selectedRequisition;
  readonly loading = this.store.loadingDetail;
  readonly busy = this.store.busy;

  readonly rejectModalVisible = signal<boolean>(false);

  readonly rejectForm = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(1000)]],
  });

  readonly canApprove = computed(() => {
    const req = this.detail();
    if (!req) {
      return false;
    }
    if (typeof req.can_approve === 'boolean') {
      return req.can_approve && req.status === 'pending_approval';
    }
    const currentUserId = this.authStore.user()?.id;
    return req.status === 'pending_approval' && req.requester_id !== currentUserId;
  });

  readonly canEdit = computed(() => {
    const req = this.detail();
    return Boolean(
      req &&
      (req.status === 'draft' ||
        req.status === 'rejected' ||
        req.status === 'budget_exceeded_blocked'),
    );
  });

  readonly canSubmit = computed(() => {
    const req = this.detail();
    return Boolean(
      req &&
      (req.status === 'draft' ||
        req.status === 'rejected' ||
        req.status === 'budget_exceeded_blocked'),
    );
  });

  readonly isSubmitHardBlocked = computed(() => {
    const snap = this.detail()?.budget_check_snapshot;
    return Boolean(snap && (snap.status === 'hard_block' || snap.is_hard_blocked));
  });

  readonly canDelete = computed(() => this.detail()?.status === 'draft');

  readonly canConvert = computed(() => {
    const status = this.detail()?.status;
    return status === 'approved' || status === 'partially_converted';
  });

  readonly statusLabel = prStatusLabelKey;
  readonly statusColor = prStatusTagColor;
  readonly urgencyLabel = prUrgencyLabelKey;
  readonly urgencyColor = prUrgencyTagColor;

  constructor() {
    effect(() => {
      const id = this.activeId();
      if (id) {
        this.store.loadDetail(id).subscribe();
      }
    });
  }

  docLinkRoute(link: PrDocumentLink): DocumentRouteTarget {
    return prDocumentLinkRoute(link);
  }

  approveRequisition(): void {
    const req = this.detail();
    if (!req) {
      return;
    }
    this.store.setBusy(true);
    this.api.approve(req.id).subscribe({
      next: (res) => {
        this.store.setSelectedRequisition(res.data);
        this.store.setBusy(false);
        this.message.success(this.i18n.translate('PR.DETAIL.APPROVE_SUCCESS'));
        this.store.loadPendingApprovalCount().subscribe();
        this.actionCompleted.emit();
      },
      error: (err: unknown) => {
        this.store.setBusy(false);
        const msg = extractApiErrorMessage(err) || this.i18n.translate('PR.ACTION_ERROR');
        this.message.error(msg);
      },
    });
  }

  openRejectModal(): void {
    this.rejectForm.reset({ reason: '' });
    this.rejectModalVisible.set(true);
  }

  closeRejectModal(): void {
    this.rejectModalVisible.set(false);
  }

  confirmReject(): void {
    const req = this.detail();
    if (!req) {
      return;
    }
    if (this.rejectForm.invalid) {
      this.rejectForm.controls.reason.markAsDirty();
      this.rejectForm.controls.reason.updateValueAndValidity();
      return;
    }

    const reason = this.rejectForm.controls.reason.getRawValue().trim();
    this.store.setBusy(true);
    this.api.reject(req.id, reason).subscribe({
      next: (res) => {
        this.store.setSelectedRequisition(res.data);
        this.store.setBusy(false);
        this.rejectModalVisible.set(false);
        this.message.info(this.i18n.translate('PR.DETAIL.REJECT_SUCCESS'));
        this.store.loadPendingApprovalCount().subscribe();
        this.actionCompleted.emit();
      },
      error: (err: unknown) => {
        this.store.setBusy(false);
        const msg = extractApiErrorMessage(err) || this.i18n.translate('PR.ACTION_ERROR');
        this.message.error(msg);
      },
    });
  }

  submitRequisition(): void {
    const req = this.detail();
    if (!req) {
      return;
    }
    this.store.setBusy(true);
    this.api.submit(req.id).subscribe({
      next: (res) => {
        this.store.setSelectedRequisition(res.data);
        this.store.setBusy(false);
        this.message.success(this.i18n.translate('PR.SUBMIT_SUCCESS'));
        this.store.loadPendingApprovalCount().subscribe();
        this.actionCompleted.emit();
      },
      error: (err: unknown) => {
        this.store.setBusy(false);
        const msg = extractApiErrorMessage(err) || this.i18n.translate('PR.ACTION_ERROR');
        this.message.error(msg);
      },
    });
  }

  deleteRequisition(): void {
    const req = this.detail();
    if (!req) {
      return;
    }
    this.store.setBusy(true);
    this.api.delete(req.id).subscribe({
      next: () => {
        this.store.setBusy(false);
        this.store.clearSelected();
        this.message.success(this.i18n.translate('PR.DELETE_SUCCESS'));
        this.actionCompleted.emit();
        if (!this.embedded()) {
          void this.router.navigate(['/procurement/requisitions']);
        }
      },
      error: (err: unknown) => {
        this.store.setBusy(false);
        const msg = extractApiErrorMessage(err) || this.i18n.translate('PR.ACTION_ERROR');
        this.message.error(msg);
      },
    });
  }

  editRequisition(req: PurchaseRequisitionDetail): void {
    void this.router.navigate(['/procurement/requisitions', req.id, 'edit']);
  }

  goToConvert(req: PurchaseRequisitionDetail): void {
    void this.router.navigate(['/procurement/requisitions/convert'], {
      queryParams: { requisitionId: req.id },
    });
  }
}
