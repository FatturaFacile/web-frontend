import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdminApiService,
  I18nService,
  PlatformUserRecord,
  WorkflowApiService,
  WorkflowDecisionType,
  WorkflowSubjectType,
  WorkflowTask,
  WorkflowTaskParams,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { catchError, forkJoin, map, of } from 'rxjs';
import {
  ApprovalSlaState,
  decisionInputError,
  newIdempotencyKey,
  slaColor,
  slaStateOf,
} from './approval-decision.util';
import { InstanceTimelineComponent } from './instance-timeline.component';

/** Filter on the due state of the tasks (maps to the `state` parameter of the API). */
export type InboxDueFilter = 'all' | 'overdue' | 'escalated' | 'delegated';

const PAGE_SIZE = 15;

/**
 * Approval inbox (Mod 006): the pending tasks of the user with type and due filters, SLA badges, quick approve, reject
 * and request-changes with a mandatory reason, reassignment, bulk approval and the timeline of a request.
 */
@Component({
  selector: 'app-approval-inbox-page',
  imports: [
    DatePipe,
    FormsModule,
    InstanceTimelineComponent,
    NzButtonModule,
    NzDrawerModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'workflows.inbox.title' | translate"></app-page-header>

    <div class="toolbar">
      <nz-select
        class="filter"
        [ngModel]="typeFilter()"
        (ngModelChange)="onTypeFilter($event)"
        nzAllowClear
        [nzPlaceHolder]="'workflows.inbox.filter.type' | translate"
        [attr.aria-label]="'workflows.inbox.filter.type' | translate"
      >
        @for (type of subjectTypes(); track type.code) {
          <nz-option [nzValue]="type.code" [nzLabel]="'workflows.subject_types.' + type.code | translate"></nz-option>
        }
      </nz-select>
      <nz-select
        class="filter"
        [ngModel]="dueFilter()"
        (ngModelChange)="onDueFilter($event)"
        [attr.aria-label]="'workflows.inbox.filter.due' | translate"
      >
        @for (option of dueOptions; track option) {
          <nz-option [nzValue]="option" [nzLabel]="'workflows.inbox.filter.due.' + option | translate"></nz-option>
        }
      </nz-select>
      <span class="spacer"></span>
      <button
        nz-button
        nzType="primary"
        data-testid="bulk-approve"
        [disabled]="selectedIds().size === 0 || busy()"
        (click)="bulkApprove()"
      >
        {{ 'workflows.inbox.action.bulkApprove' | translate: { count: selectedIds().size } }}
      </button>
    </div>

    <nz-table
      #table
      [nzData]="tasks()"
      [nzLoading]="loading()"
      [nzFrontPagination]="false"
      [nzTotal]="total()"
      [nzPageSize]="pageSize"
      [nzPageIndex]="page()"
      (nzPageIndexChange)="onPage($event)"
      nzSize="middle"
    >
      <thead>
        <tr>
          <th
            nzWidth="46px"
            [nzChecked]="allSelected()"
            [nzIndeterminate]="someSelected()"
            (nzCheckedChange)="toggleAll($event)"
            [attr.aria-label]="'workflows.inbox.column.select' | translate"
          ></th>
          <th>{{ 'workflows.inbox.column.document' | translate }}</th>
          <th>{{ 'workflows.inbox.column.type' | translate }}</th>
          <th>{{ 'workflows.inbox.column.step' | translate }}</th>
          <th>{{ 'workflows.inbox.column.requester' | translate }}</th>
          <th>{{ 'workflows.inbox.column.due' | translate }}</th>
          <th>{{ 'workflows.inbox.column.sla' | translate }}</th>
          <th>{{ 'workflows.inbox.column.actions' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (task of table.data; track task.step_id) {
          <tr>
            <td [nzChecked]="selectedIds().has(task.step_id)" (nzCheckedChange)="toggle(task.step_id, $event)"></td>
            <td>
              {{ task.approvable_label ?? task.approvable_id }}
              @if (task.via_delegation_from) {
                <nz-tag nzColor="purple">{{ 'workflows.inbox.delegated' | translate }}</nz-tag>
              }
            </td>
            <td>{{ typeLabel(task.approvable_type) | translate }}</td>
            <td>{{ task.node_name ?? task.workflow_name }}</td>
            <td>{{ task.initiator_name }}</td>
            <td>{{ task.due_at | date: 'short' }}</td>
            <td>
              <nz-tag [nzColor]="color(sla(task))">{{ 'workflows.inbox.sla.' + sla(task) | translate }}</nz-tag>
              @if ((task.escalation_level ?? 0) > 0) {
                <nz-tag nzColor="volcano">{{ 'workflows.inbox.escalated' | translate }}</nz-tag>
              }
            </td>
            <td class="actions">
              <button
                nz-button
                nzSize="small"
                nzType="primary"
                data-testid="quick-approve"
                [disabled]="busy()"
                (click)="quickApprove(task)"
              >
                {{ 'workflows.decision.approve' | translate }}
              </button>
              <button nz-button nzSize="small" nzDanger data-testid="quick-reject" (click)="openDecision(task, 'rejected')">
                {{ 'workflows.decision.reject' | translate }}
              </button>
              <button nz-button nzSize="small" (click)="openDecision(task, 'request_changes')">
                {{ 'workflows.decision.requestChanges' | translate }}
              </button>
              <button nz-button nzSize="small" (click)="openDecision(task, 'reassign')">
                {{ 'workflows.decision.reassign' | translate }}
              </button>
              <button nz-button nzSize="small" nzType="link" (click)="openTimeline(task)">
                {{ 'workflows.inbox.action.timeline' | translate }}
              </button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-modal
      [nzVisible]="dialogTask() !== null"
      [nzTitle]="'workflows.decision.dialogTitle.' + dialogDecision() | translate"
      [nzOkText]="'workflows.decision.confirm' | translate"
      [nzCancelText]="'workflows.decision.cancel' | translate"
      [nzOkLoading]="busy()"
      [nzOkDanger]="dialogDecision() === 'rejected'"
      (nzOnOk)="submitDialog()"
      (nzOnCancel)="closeDialog()"
    >
      <ng-container *nzModalContent>
        @if (dialogDecision() === 'reassign') {
          <label for="reassign-user">{{ 'workflows.decision.reassignTo' | translate }}</label>
          <nz-select
            id="reassign-user"
            class="full"
            nzShowSearch
            nzServerSearch
            [ngModel]="reassignTo()"
            (ngModelChange)="reassignTo.set($event)"
            (nzOnSearch)="searchUsers($event)"
            [nzPlaceHolder]="'workflows.decision.reassignPlaceholder' | translate"
          >
            @for (user of users(); track user.id) {
              <nz-option [nzValue]="user.id" [nzLabel]="user.name"></nz-option>
            }
          </nz-select>
        }
        <label for="decision-comment">
          {{ 'workflows.decision.comment' | translate }}
          @if (commentMandatory()) {
            <span class="required" aria-hidden="true">*</span>
          }
        </label>
        <textarea
          id="decision-comment"
          nz-input
          rows="4"
          maxlength="2000"
          [ngModel]="comment()"
          (ngModelChange)="comment.set($event)"
          [attr.aria-required]="commentMandatory()"
        ></textarea>
        @if (dialogError(); as error) {
          <p class="error" role="alert">{{ error | translate }}</p>
        }
      </ng-container>
    </nz-modal>

    <nz-drawer
      [nzVisible]="timelineTask() !== null"
      [nzWidth]="520"
      [nzTitle]="'workflows.inbox.timeline.title' | translate"
      (nzOnClose)="timelineTask.set(null)"
    >
      <ng-container *nzDrawerContent>
        @if (timelineTask(); as task) {
          <app-instance-timeline [instanceId]="task.workflow_instance_id" />
        }
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .filter {
      min-width: 200px;
    }
    .spacer {
      flex: 1;
    }
    .actions {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .full {
      width: 100%;
      margin-bottom: 12px;
    }
    label {
      display: block;
      margin: 8px 0 4px;
      font-weight: 500;
    }
    .required,
    .error {
      color: var(--error-color, #cf1322);
    }
  `,
})
export class ApprovalInboxPageComponent implements OnInit {
  private readonly api = inject(WorkflowApiService);
  private readonly adminApi = inject(AdminApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly pageSize = PAGE_SIZE;
  protected readonly dueOptions: readonly InboxDueFilter[] = ['all', 'overdue', 'escalated', 'delegated'];

  readonly tasks = signal<WorkflowTask[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly typeFilter = signal<string | null>(null);
  readonly dueFilter = signal<InboxDueFilter>('all');
  readonly subjectTypes = signal<WorkflowSubjectType[]>([]);
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());

  // Decision dialog
  readonly dialogTask = signal<WorkflowTask | null>(null);
  readonly dialogDecision = signal<WorkflowDecisionType>('rejected');
  readonly comment = signal('');
  readonly reassignTo = signal<string | null>(null);
  readonly dialogError = signal<string | null>(null);
  readonly users = signal<PlatformUserRecord[]>([]);
  readonly timelineTask = signal<WorkflowTask | null>(null);

  protected readonly commentMandatory = computed(
    () => this.dialogDecision() === 'rejected' || this.dialogDecision() === 'request_changes',
  );
  protected readonly allSelected = computed(
    () => this.tasks().length > 0 && this.tasks().every((task) => this.selectedIds().has(task.step_id)),
  );
  protected readonly someSelected = computed(() => this.selectedIds().size > 0 && !this.allSelected());

  ngOnInit(): void {
    this.api.getSubjectTypes().subscribe({
      next: (res) => this.subjectTypes.set(res.data),
      // The filter is optional: without the list the inbox still works.
      error: () => this.subjectTypes.set([]),
    });
    this.load();
  }

  load(): void {
    const params: WorkflowTaskParams = { page: this.page(), per_page: PAGE_SIZE };
    const type = this.typeFilter();
    if (type) {
      params.approvable_type = type;
    }
    const due = this.dueFilter();
    if (due !== 'all') {
      params.state = due;
    }
    this.loading.set(true);
    this.api.getMyTasks(params).subscribe({
      next: (res) => {
        this.tasks.set(res.data);
        this.total.set(res.meta?.total ?? res.data.length);
        this.selectedIds.set(new Set());
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify('error', 'workflows.inbox.loadError');
      },
    });
  }

  onTypeFilter(value: string | null): void {
    this.typeFilter.set(value);
    this.page.set(1);
    this.load();
  }

  onDueFilter(value: InboxDueFilter): void {
    this.dueFilter.set(value);
    this.page.set(1);
    this.load();
  }

  onPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected sla(task: WorkflowTask): ApprovalSlaState {
    return slaStateOf(task);
  }

  protected color(state: ApprovalSlaState): string {
    return slaColor(state);
  }

  protected typeLabel(code: string): string {
    return `workflows.subject_types.${code}`;
  }

  toggle(stepId: string, checked: boolean): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(stepId);
      } else {
        next.delete(stepId);
      }
      return next;
    });
  }

  toggleAll(checked: boolean): void {
    this.selectedIds.set(checked ? new Set(this.tasks().map((task) => task.step_id)) : new Set());
  }

  /** Approves one task straight away: an approval needs no reason. */
  quickApprove(task: WorkflowTask): void {
    this.busy.set(true);
    this.api.recordDecision(task.step_id, { decision: 'approved', idempotency_key: newIdempotencyKey() }).subscribe({
      next: () => this.afterDecision('workflows.inbox.message.approved'),
      error: (error: unknown) => this.onDecisionError(error),
    });
  }

  /** Approves every selected task; a task that fails (for example already decided) does not stop the others. */
  bulkApprove(): void {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) {
      return;
    }
    this.busy.set(true);
    forkJoin(
      ids.map((id) =>
        this.api.recordDecision(id, { decision: 'approved', idempotency_key: newIdempotencyKey() }).pipe(
          map(() => true),
          catchError(() => of(false)),
        ),
      ),
    ).subscribe((results) => {
      if (results.every(Boolean)) {
        this.afterDecision('workflows.inbox.message.bulkApproved');
      } else {
        this.busy.set(false);
        this.notify('warning', 'workflows.inbox.message.bulkPartial');
        this.load();
      }
    });
  }

  openDecision(task: WorkflowTask, decision: WorkflowDecisionType): void {
    this.dialogTask.set(task);
    this.dialogDecision.set(decision);
    this.comment.set('');
    this.reassignTo.set(null);
    this.dialogError.set(null);
    if (decision === 'reassign' && this.users().length === 0) {
      this.searchUsers('');
    }
  }

  closeDialog(): void {
    this.dialogTask.set(null);
    this.dialogError.set(null);
  }

  openTimeline(task: WorkflowTask): void {
    this.timelineTask.set(task);
  }

  searchUsers(term: string): void {
    this.adminApi.listUsers(term ? { search: term, per_page: 20 } : { per_page: 20 }).subscribe({
      next: (res) => this.users.set(res.data),
      error: () => this.users.set([]),
    });
  }

  submitDialog(): void {
    const task = this.dialogTask();
    if (!task) {
      return;
    }
    const decision = this.dialogDecision();
    const error = decisionInputError(decision, this.comment(), this.reassignTo());
    this.dialogError.set(error);
    if (error) {
      return;
    }
    this.busy.set(true);
    const comment = this.comment().trim();
    this.api
      .recordDecision(task.step_id, {
        decision,
        comment: comment === '' ? undefined : comment,
        reassign_to_user_id: decision === 'reassign' ? this.reassignTo() : undefined,
        idempotency_key: newIdempotencyKey(),
      })
      .subscribe({
        next: () => {
          this.closeDialog();
          this.afterDecision(`workflows.inbox.message.${decision}`);
        },
        error: (err: unknown) => this.onDecisionError(err),
      });
  }

  private afterDecision(messageKey: string): void {
    this.busy.set(false);
    this.notify('success', messageKey);
    this.load();
  }

  private onDecisionError(error: unknown): void {
    this.busy.set(false);
    // 409: somebody else decided the step in the meantime; the refreshed list no longer shows it.
    if (error instanceof HttpErrorResponse && error.status === 409) {
      this.closeDialog();
      this.notify('warning', 'workflows.decision.alreadyDecided');
      this.load();
      return;
    }
    // 403: separation of duties or signing limit; the API explains which in the user's language.
    if (error instanceof HttpErrorResponse && error.status === 403) {
      this.closeDialog();
      const detail: unknown = error.error?.message;
      this.notify('error', typeof detail === 'string' && detail !== '' ? detail : 'workflows.decision.error.forbidden');
      return;
    }
    this.notify('error', 'workflows.decision.error.generic');
  }

  private notify(level: 'success' | 'warning' | 'error', key: string): void {
    this.message[level](this.i18n.translate(key));
  }
}
