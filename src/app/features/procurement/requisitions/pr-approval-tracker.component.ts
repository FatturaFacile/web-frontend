import { Component, computed, inject, input } from '@angular/core';
import { I18nService, resolveLocale } from '@core/i18n';
import {
  PrApprovalChannel,
  PrApprovalLog,
  PrApprovalStep,
  PrApprovalStepStatus,
  PrCurrency,
  PurchaseRequisitionStatus,
} from '@domain/procurement/purchase-requisition.models';
import { DateFormatPipe, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzStepsModule, NzStatusType } from 'ng-zorro-antd/steps';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { prActionLabelKey, prChannelLabelKey } from './pr-status.helpers';

/**
 * Renders the multi-level approval delegation chain stepper and immutable audit log timeline.
 */
@Component({
  selector: 'app-pr-approval-tracker',
  imports: [
    DateFormatPipe,
    TranslatePipe,
    NzCardModule,
    NzEmptyModule,
    NzStepsModule,
    NzTagModule,
    NzTimelineModule,
  ],
  templateUrl: './pr-approval-tracker.component.html',
  styleUrl: './pr-approval-tracker.component.scss',
})
export class PrApprovalTrackerComponent {
  private readonly i18n = inject(I18nService);

  readonly steps = input<PrApprovalStep[]>([]);
  readonly logs = input<PrApprovalLog[]>([]);
  readonly status = input<PurchaseRequisitionStatus>('draft');
  readonly currency = input<PrCurrency>('EUR');

  readonly currentStepIndex = computed(() => {
    const list = this.steps();
    if (list.length === 0) {
      return 0;
    }
    const rejectedIdx = list.findIndex((s) => s.status === 'rejected');
    if (rejectedIdx >= 0) {
      return rejectedIdx;
    }
    const activeIdx = list.findIndex((s) => s.status === 'in_progress');
    if (activeIdx >= 0) {
      return activeIdx;
    }
    const approvedCount = list.filter((s) => s.status === 'approved' || s.status === 'skipped').length;
    return Math.min(list.length - 1, approvedCount);
  });

  readonly stepperStatus = computed<NzStatusType>(() => {
    const current = this.status();
    if (
      current === 'rejected' ||
      current === 'budget_exceeded_blocked' ||
      this.steps().some((s) => s.status === 'rejected')
    ) {
      return 'error';
    }
    if (current === 'approved' || current === 'partially_converted' || current === 'converted') {
      return 'finish';
    }
    if (current === 'pending_approval') {
      return 'process';
    }
    return 'wait';
  });

  mapStepStatus(stepStatus: PrApprovalStepStatus): NzStatusType {
    switch (stepStatus) {
      case 'approved':
      case 'skipped':
        return 'finish';
      case 'in_progress':
        return 'process';
      case 'rejected':
        return 'error';
      case 'pending':
      default:
        return 'wait';
    }
  }

  stepSubtitle(step: PrApprovalStep): string {
    const parts = [step.approver_name, step.role_name].filter((v): v is string => Boolean(v));
    return parts.join(' · ');
  }

  stepDescription(step: PrApprovalStep): string {
    const parts: string[] = [];
    if (step.threshold_amount !== null && step.threshold_amount !== undefined) {
      const formatted = new Intl.NumberFormat(
        resolveLocale(this.i18n.currentLanguage(), this.currency()),
        { style: 'currency', currency: this.currency() },
      ).format(step.threshold_amount);
      parts.push(this.i18n.translate('PR.APPROVAL.THRESHOLD_LABEL', { amount: formatted }));
    }
    if (step.decided_at) {
      parts.push(
        new Intl.DateTimeFormat(resolveLocale(this.i18n.currentLanguage()), {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(step.decided_at)),
      );
    } else {
      parts.push(this.i18n.translate(`PR.APPROVAL.STEP_${step.status.toUpperCase()}`));
    }
    return parts.join(' — ');
  }

  timelineColor(action: string): string {
    switch (action) {
      case 'approved':
      case 'converted':
        return 'green';
      case 'rejected':
      case 'budget_blocked':
        return 'red';
      case 'submitted':
      case 'created':
        return 'blue';
      default:
        return 'gray';
    }
  }

  actionLabelKey(action: string): string {
    return prActionLabelKey(action);
  }

  actionTagColor(action: string): string {
    switch (action) {
      case 'approved':
        return 'success';
      case 'converted':
        return 'blue';
      case 'rejected':
      case 'budget_blocked':
        return 'error';
      case 'submitted':
        return 'processing';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  }

  channelLabelKey(channel: PrApprovalChannel): string {
    return prChannelLabelKey(channel);
  }
}
