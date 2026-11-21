import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n';
import { RfqApiService } from '@data-access/procurement/rfq-api.service';
import { RfqStatus, RfqSummary } from '@domain/procurement/rfq.models';
import { RfqStore } from '@features/procurement/rfq/rfq.store';
import { DateFormatPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';

interface RfqStatusOption {
  value: RfqStatus | null;
  labelKey: string;
}

@Component({
  selector: 'app-rfq-list-page',
  imports: [
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    TranslatePipe,
    DateFormatPipe,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    NzProgressModule,
    NzSelectModule,
    NzSpaceModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './rfq-list-page.component.html',
  styleUrl: './rfq-list-page.component.scss',
})
export class RfqListPageComponent implements OnInit {
  readonly store = inject(RfqStore);
  private readonly api = inject(RfqApiService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);

  readonly searchTerm = signal<string>('');
  readonly statusSelection = signal<RfqStatus | null>(null);

  readonly extendModalVisible = signal<boolean>(false);
  readonly extendTargetRfq = signal<RfqSummary | null>(null);
  readonly extendDeadlineValue = signal<string>('');

  readonly cancelModalVisible = signal<boolean>(false);
  readonly cancelTargetRfq = signal<RfqSummary | null>(null);
  readonly cancelReason = signal<string>('');

  readonly statusOptions: RfqStatusOption[] = [
    { value: null, labelKey: 'RFQ.ALL_STATUSES' },
    { value: 'draft', labelKey: 'RFQ.STATUS_DRAFT' },
    { value: 'published', labelKey: 'RFQ.STATUS_PUBLISHED' },
    { value: 'bidding_open', labelKey: 'RFQ.STATUS_BIDDING_OPEN' },
    { value: 'under_evaluation', labelKey: 'RFQ.STATUS_UNDER_EVALUATION' },
    { value: 'awarded', labelKey: 'RFQ.STATUS_AWARDED' },
    { value: 'expired', labelKey: 'RFQ.STATUS_EXPIRED' },
    { value: 'cancelled', labelKey: 'RFQ.STATUS_CANCELLED' },
  ];

  ngOnInit(): void {
    this.store.loadList().subscribe();
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.store.setFilters(this.statusSelection(), term);
    this.store.loadList({ page: 1 }).subscribe();
  }

  onStatusChange(status: RfqStatus | null): void {
    this.statusSelection.set(status);
    this.store.setFilters(status, this.searchTerm());
    this.store.loadList({ page: 1 }).subscribe();
  }

  refresh(): void {
    this.store.loadList().subscribe();
  }

  onPageChange(page: number): void {
    this.store.loadList({ page }).subscribe();
  }

  onPageSizeChange(perPage: number): void {
    this.store.loadList({ page: 1, per_page: perPage }).subscribe();
  }

  createNewRfq(): void {
    void this.router.navigate(['/procurement/rfqs/new']);
  }

  publishRfq(rfq: RfqSummary): void {
    this.store.setBusy(true);
    this.api.publishRfq(rfq.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('RFQ.PUBLISH_SUCCESS'));
        this.store.setBusy(false);
        this.store.loadList().subscribe();
      },
      error: () => {
        this.store.setBusy(false);
        this.message.error(this.i18n.translate('RFQ.LOAD_ERROR'));
      },
    });
  }

  openExtendModal(rfq: RfqSummary): void {
    this.extendTargetRfq.set(rfq);
    this.extendDeadlineValue.set(this.toLocalDatetimeInput(rfq.submission_deadline));
    this.extendModalVisible.set(true);
  }

  closeExtendModal(): void {
    this.extendModalVisible.set(false);
    this.extendTargetRfq.set(null);
  }

  confirmExtendDeadline(): void {
    const target = this.extendTargetRfq();
    const raw = this.extendDeadlineValue();
    if (!target || !raw) {
      return;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }

    this.store.setBusy(true);
    this.api.extendDeadline(target.id, parsed.toISOString()).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('RFQ.EXTEND_SUCCESS'));
        this.store.setBusy(false);
        this.closeExtendModal();
        this.store.loadList().subscribe();
      },
      error: () => {
        this.store.setBusy(false);
      },
    });
  }

  openCancelModal(rfq: RfqSummary): void {
    this.cancelTargetRfq.set(rfq);
    this.cancelReason.set('');
    this.cancelModalVisible.set(true);
  }

  closeCancelModal(): void {
    this.cancelModalVisible.set(false);
    this.cancelTargetRfq.set(null);
    this.cancelReason.set('');
  }

  confirmCancelRfq(): void {
    const target = this.cancelTargetRfq();
    if (!target) {
      return;
    }

    this.store.setBusy(true);
    this.api.cancelRfq(target.id, this.cancelReason().trim() || null).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('RFQ.CANCEL_SUCCESS'));
        this.store.setBusy(false);
        this.closeCancelModal();
        this.store.loadList().subscribe();
      },
      error: () => {
        this.store.setBusy(false);
      },
    });
  }

  statusLabelKey(status: RfqStatus): string {
    switch (status) {
      case 'draft':
        return 'RFQ.STATUS_DRAFT';
      case 'published':
        return 'RFQ.STATUS_PUBLISHED';
      case 'bidding_open':
        return 'RFQ.STATUS_BIDDING_OPEN';
      case 'issued':
        return 'RFQ.STATUS_ISSUED';
      case 'under_evaluation':
        return 'RFQ.STATUS_UNDER_EVALUATION';
      case 'awarded':
        return 'RFQ.STATUS_AWARDED';
      case 'cancelled':
        return 'RFQ.STATUS_CANCELLED';
      case 'expired':
        return 'RFQ.STATUS_EXPIRED';
    }
  }

  statusTagColor(status: RfqStatus): string {
    switch (status) {
      case 'draft':
        return 'default';
      case 'published':
      case 'issued':
        return 'blue';
      case 'bidding_open':
        return 'processing';
      case 'under_evaluation':
        return 'gold';
      case 'awarded':
        return 'success';
      case 'expired':
        return 'orange';
      case 'cancelled':
        return 'error';
    }
  }

  isExtendable(status: RfqStatus): boolean {
    return ['published', 'bidding_open', 'issued', 'under_evaluation', 'expired'].includes(status);
  }

  isCancellable(status: RfqStatus): boolean {
    return status !== 'awarded' && status !== 'cancelled';
  }

  responsePercent(rfq: RfqSummary): number {
    const invited = rfq.invited_count ?? 0;
    if (invited <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((rfq.bids_received_count / invited) * 100));
  }

  deadlineCountdown(deadlineIso: string): string {
    const targetMs = new Date(deadlineIso).getTime();
    if (Number.isNaN(targetMs)) {
      return '';
    }
    const diffMs = targetMs - Date.now();
    if (diffMs <= 0) {
      return this.i18n.translate('RFQ.COUNTDOWN_EXPIRED');
    }
    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      return this.i18n.translate('RFQ.COUNTDOWN_DAYS', { days, hours });
    }
    return this.i18n.translate('RFQ.COUNTDOWN_HOURS', { hours, minutes });
  }

  private toLocalDatetimeInput(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
