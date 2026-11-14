import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { GovAction, GovernanceApiService, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { GovernanceAccess } from './governance-access.service';
import { GovTransitionChoice, GovTransitionModalComponent } from './gov-transition-modal.component';
import { GOV_ACTION_TRANSITIONS, GOV_NOTES_REQUIRED, govSeverityColor, govStatusColor } from './governance.shared';

/**
 * Whether the member may move an action to a status: starting, completing and cancelling belong to the owner of the
 * action or a manager; verifying (and sending a completed action back) is a management decision.
 */
export function govActionTargets(
  action: GovAction,
  access: { canManage(): boolean; canApprove(): boolean; userId(): string },
): readonly string[] {
  const isOwner = action.owner_id === access.userId();
  return GOV_ACTION_TRANSITIONS[action.status].filter((target) => {
    const isDecision = target === 'verified' || (action.status === 'completed' && target === 'in_progress');
    return isDecision ? access.canApprove() : access.canManage() || isOwner;
  });
}

/** Remediation actions in a table with the status changes the member may make (start, complete, verify, cancel). */
@Component({
  selector: 'app-gov-action-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, NzButtonModule, NzTableModule, NzTagModule, TranslatePipe, GovTransitionModalComponent],
  styles: `
    .overdue {
      color: #cf1322;
    }
  `,
  template: `
    <nz-table #actionTable [nzData]="actions()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="pageSize()">
      <thead>
        <tr>
          <th>{{ 'GOVERNANCE.COMMON.CODE' | translate }}</th>
          <th>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</th>
          @if (showFinding()) {
            <th>{{ 'GOVERNANCE.ACTIONS.FINDING' | translate }}</th>
          }
          <th>{{ 'GOVERNANCE.COMMON.OWNER' | translate }}</th>
          <th>{{ 'GOVERNANCE.ACTIONS.DUE_DATE' | translate }}</th>
          <th>{{ 'GOVERNANCE.COMMON.STATUS' | translate }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (action of actionTable.data; track action.id) {
          <tr>
            <td>{{ action.code }}</td>
            <td>
              {{ action.title }}
              @if (action.completion_notes) {
                <div><small>{{ action.completion_notes }}</small></div>
              }
              @if (action.verification_notes) {
                <div><small>{{ action.verification_notes }}</small></div>
              }
            </td>
            @if (showFinding()) {
              <td>
                @if (action.finding; as finding) {
                  <nz-tag [nzColor]="severityColor(finding.severity)">{{ finding.code }}</nz-tag>
                }
              </td>
            }
            <td>{{ action.owner?.name || '-' }}</td>
            <td [class.overdue]="action.is_overdue">
              {{ action.due_date | date: 'dd/MM/yyyy' }}
              @if (action.is_overdue) {
                <i class="fa-solid fa-triangle-exclamation" [title]="'GOVERNANCE.ACTIONS.OVERDUE' | translate"></i>
              }
            </td>
            <td><nz-tag [nzColor]="statusColor(action.status)">{{ 'GOVERNANCE.ACTION_STATUS.' + action.status.toUpperCase() | translate }}</nz-tag></td>
            <td>
              @if (targetsOf(action).length > 0) {
                <button nz-button nzSize="small" [title]="'GOVERNANCE.TRANSITION.TITLE' | translate" (click)="open(action)">
                  <i class="fa-solid fa-right-left"></i>
                </button>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <app-gov-transition-modal
      [(visible)]="visible"
      statusKeyPrefix="GOVERNANCE.ACTION_STATUS"
      [targets]="targets()"
      [notesRequiredFor]="notesRequiredFor"
      (confirmed)="apply($event)"
    />
  `,
})
export class GovActionListComponent {
  private readonly api = inject(GovernanceApiService);
  private readonly access = inject(GovernanceAccess);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly actions = input.required<readonly GovAction[]>();
  readonly loading = input<boolean>(false);
  readonly showFinding = input<boolean>(false);
  readonly pageSize = input<number>(10);
  /** Emitted after an action changed status, so the parent reloads its figures. */
  readonly changed = output<void>();

  protected readonly notesRequiredFor = GOV_NOTES_REQUIRED['action'];
  protected readonly statusColor = govStatusColor;
  protected readonly severityColor = govSeverityColor;
  protected readonly visible = signal(false);
  private readonly selected = signal<GovAction | null>(null);
  protected readonly targets = computed(() => {
    const action = this.selected();
    return action === null ? [] : govActionTargets(action, this.access);
  });

  protected targetsOf(action: GovAction): readonly string[] {
    return govActionTargets(action, this.access);
  }

  protected open(action: GovAction): void {
    this.selected.set(action);
    this.visible.set(true);
  }

  protected apply(choice: GovTransitionChoice): void {
    const action = this.selected();
    if (action === null) {
      return;
    }
    this.api.transitionAction(action.id, { status: choice.status, notes: choice.notes }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
        this.changed.emit();
      },
      error: (error: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
        const first = Object.values(error.error?.errors ?? {})[0]?.[0] ?? error.error?.message;
        if (first) {
          this.message.error(first);
        }
      },
    });
  }
}
