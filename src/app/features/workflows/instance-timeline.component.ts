import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { WorkflowApiService, WorkflowTimelineEntry } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { statusColor } from './approval-decision.util';

/** Timeline of an approval instance: a step bar of the approval nodes and the chronological list of what happened. */
@Component({
  selector: 'app-instance-timeline',
  imports: [DatePipe, NzAlertModule, NzEmptyModule, NzSpinModule, NzStepsModule, NzTagModule, NzTimelineModule, TranslatePipe],
  template: `
    <nz-spin [nzSpinning]="loading()">
      @if (failed()) {
        <nz-alert nzType="error" nzShowIcon [nzMessage]="'workflows.inbox.timeline.loadError' | translate"></nz-alert>
      } @else if (entries().length === 0 && !loading()) {
        <nz-empty [nzNotFoundContent]="'workflows.inbox.timeline.empty' | translate"></nz-empty>
      } @else {
        <nz-steps [nzCurrent]="currentIndex()" nzSize="small" class="steps">
          @for (step of approvalSteps(); track step.id) {
            <nz-step
              [nzTitle]="step.node_name ?? ('workflows.inbox.timeline.step' | translate)"
              [nzStatus]="stepStatus(step)"
              [nzDescription]="('workflows.status.' + step.status) | translate"
            ></nz-step>
          }
        </nz-steps>

        <nz-timeline>
          @for (entry of entries(); track entry.id) {
            <nz-timeline-item [nzColor]="color(entry.status)">
              <div class="line">
                <strong>{{ entry.node_name ?? ('workflows.inbox.timeline.type.' + entry.type | translate) }}</strong>
                <nz-tag [nzColor]="color(entry.status)">{{ 'workflows.status.' + entry.status | translate }}</nz-tag>
                @if (entry.channel) {
                  <nz-tag>{{ 'workflows.inbox.timeline.channel.' + entry.channel | translate }}</nz-tag>
                }
              </div>
              @if (entry.actor) {
                <div>{{ 'workflows.inbox.timeline.actor' | translate }}: {{ entry.actor }}</div>
              }
              @if (entry.decided_at) {
                <div>{{ 'workflows.inbox.timeline.decidedAt' | translate }}: {{ entry.decided_at | date: 'medium' }}</div>
              } @else if (entry.due_at) {
                <div>{{ 'workflows.inbox.timeline.dueAt' | translate }}: {{ entry.due_at | date: 'medium' }}</div>
              }
              @if (entry.comment) {
                <blockquote class="comment">{{ entry.comment }}</blockquote>
              }
            </nz-timeline-item>
          }
        </nz-timeline>
      }
    </nz-spin>
  `,
  styles: `
    .steps {
      margin-bottom: 24px;
    }
    .line {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .comment {
      margin: 4px 0 0;
      padding-left: 8px;
      border-left: 3px solid var(--border-color);
      color: var(--text-secondary);
    }
  `,
})
export class InstanceTimelineComponent {
  private readonly api = inject(WorkflowApiService);

  readonly instanceId = input.required<string>();

  protected readonly entries = signal<WorkflowTimelineEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);

  protected readonly approvalSteps = computed(() => this.entries().filter((entry) => entry.type === 'approval'));
  protected readonly currentIndex = computed(() => {
    const index = this.approvalSteps().findIndex((entry) => entry.status === 'pending');
    return index === -1 ? this.approvalSteps().length : index;
  });

  constructor() {
    effect((onCleanup) => {
      const id = this.instanceId();
      this.loading.set(true);
      this.failed.set(false);
      const subscription = this.api.getInstanceTimeline(id).subscribe({
        next: (res) => {
          this.entries.set(res.data);
          this.loading.set(false);
        },
        error: () => {
          this.entries.set([]);
          this.failed.set(true);
          this.loading.set(false);
        },
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected color(status: string): string {
    return statusColor(status);
  }

  protected stepStatus(step: WorkflowTimelineEntry): 'wait' | 'process' | 'finish' | 'error' {
    switch (step.status) {
      case 'approved':
        return 'finish';
      case 'rejected':
        return 'error';
      case 'pending':
        return 'process';
      default:
        return 'wait';
    }
  }
}
