import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { WorkflowApiService, WorkflowInstanceResource, WorkflowTimelineEntry } from '@core';
import { TranslatePipe } from '@shared';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { statusColor } from './approval-decision.util';

/**
 * Reusable banner of a document (Mod 006): the approval status of the latest workflow instance of the document, who has
 * to decide now and by when. Renders nothing when the document never went through an approval.
 */
@Component({
  selector: 'app-approval-status-banner',
  imports: [DatePipe, NzTagModule, TranslatePipe],
  template: `
    @if (instance(); as current) {
      <section class="banner" role="status" [attr.data-status]="current.status">
        <strong>{{ 'workflows.banner.title' | translate }}</strong>
        <nz-tag [nzColor]="color(current.status)">{{ 'workflows.status.' + current.status | translate }}</nz-tag>
        @if (current.status === 'pending' && pendingStep(); as step) {
          <span>
            {{ 'workflows.banner.currentApprover' | translate }}: {{ step.actor ?? ('workflows.banner.unassigned' | translate) }}
          </span>
          @if (step.due_at) {
            <span>{{ 'workflows.banner.dueAt' | translate }}: {{ step.due_at | date: 'medium' }}</span>
          }
        }
      </section>
    }
  `,
  styles: `
    .banner {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      align-items: center;
      padding: 8px 12px;
      margin-bottom: 16px;
      background: var(--bg-card, #fff);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md, 6px);
    }
  `,
})
export class ApprovalStatusBannerComponent {
  private readonly api = inject(WorkflowApiService);

  /** Approvable type alias of the document (for example `purchase_order`, `expense_report`). */
  readonly subjectType = input.required<string>();
  readonly subjectId = input.required<string>();

  protected readonly instance = signal<WorkflowInstanceResource | null>(null);
  private readonly timeline = signal<WorkflowTimelineEntry[]>([]);
  protected readonly pendingStep = computed(() => this.timeline().find((entry) => entry.status === 'pending') ?? null);

  constructor() {
    effect((onCleanup) => {
      const type = this.subjectType();
      const id = this.subjectId();
      this.instance.set(null);
      this.timeline.set([]);
      if (!type || !id) {
        return;
      }
      const subscription = this.api.getInstances({ approvable_type: type, approvable_id: id, per_page: 1 }).subscribe({
        next: (res) => {
          const latest = res.data[0] ?? null;
          this.instance.set(latest);
          if (latest?.status === 'pending') {
            this.api.getInstanceTimeline(latest.id).subscribe({
              next: (timeline) => this.timeline.set(timeline.data),
              // The status alone is still useful without the approver.
              error: () => this.timeline.set([]),
            });
          }
        },
        // The banner is passive: a failed lookup shows nothing.
        error: () => this.instance.set(null),
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected color(status: string): string {
    return statusColor(status);
  }
}
