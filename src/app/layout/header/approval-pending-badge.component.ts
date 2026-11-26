import { Component, computed, DestroyRef, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { interval } from 'rxjs';
// Deep imports keep the `@core` and `@shared` barrels out of the initial bundle (the header is part of it).
import { WorkflowApiService } from '@core/api/workflow-api.service';
import type { WorkflowPendingCount } from '@core/models/workflow.model';
import { NotificationRealtimeService } from '@core/realtime/notification-realtime.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

const POLL_INTERVAL_MS = 60_000;
/** With a live WebSocket the poll only guards against missed events. */
const REALTIME_POLL_INTERVAL_MS = 300_000;

/**
 * Pending-approvals counter of the layout header (Mod 006): links to the approval inbox and turns red when some of the
 * approvals are overdue. The count is refreshed whenever the notification centre pushes an event (an approval request is
 * a notification) and polled as a fallback. Hidden when the user cannot read the approvals.
 */
@Component({
  selector: 'app-approval-pending-badge',
  imports: [NzBadgeModule, RouterLink, TranslatePipe],
  template: `
    @if (available()) {
      <a
        routerLink="/workflows/inbox"
        class="action-btn approval-badge"
        [title]="'workflows.header.pending' | translate"
        [attr.aria-label]="'workflows.header.pendingCount' | translate: { count: counts().pending_count }"
      >
        <nz-badge
          [nzCount]="counts().pending_count"
          [nzOverflowCount]="99"
          [nzColor]="hasOverdue() ? '#f5222d' : undefined"
          nzSize="small"
        >
          <i class="fa-solid fa-list-check" aria-hidden="true"></i>
        </nz-badge>
      </a>
    }
  `,
})
export class ApprovalPendingBadgeComponent implements OnInit {
  private readonly api = inject(WorkflowApiService);
  private readonly realtime = inject(NotificationRealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private lastPoll = 0;

  readonly counts = signal<WorkflowPendingCount>({ pending_count: 0, overdue_count: 0 });
  /** False once the API refused the counter (no access to the workflow module). */
  readonly available = signal(true);
  readonly hasOverdue = computed(() => this.counts().overdue_count > 0);

  constructor() {
    effect(() => {
      if (this.realtime.changes() === null) {
        return;
      }
      untracked(() => this.refresh());
    });
  }

  ngOnInit(): void {
    this.refresh();
    interval(POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.realtime.connected() || Date.now() - this.lastPoll >= REALTIME_POLL_INTERVAL_MS) {
          this.refresh();
        }
      });
  }

  refresh(): void {
    this.lastPoll = Date.now();
    this.api.getPendingCount().subscribe({
      next: (res) => {
        this.available.set(true);
        this.counts.set(res.data);
      },
      // A 403/404 means the user has no approvals at all; any other failure keeps the last count.
      error: (error: { status?: number }) => {
        if (error.status === 403 || error.status === 404) {
          this.available.set(false);
        }
      },
    });
  }
}
