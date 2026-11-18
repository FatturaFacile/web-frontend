import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthStore, CpqApiService, CpqApprovalOverview, CpqApprovalStatus } from '@core';
import { Observable } from 'rxjs';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';

/** Roles that may decide an approval request; the API checks the level of the pending request. */
export const CPQ_APPROVER_ROLES: readonly string[] = ['owner', 'admin', 'sales_manager'];

const TAG_COLORS: Record<CpqApprovalStatus, string> = { pending: 'gold', approved: 'green', rejected: 'red' };

/**
 * Approval of non-standard discounts: the banner that tells the quote waits for or was refused an approval, the levels
 * with who decided them, and the actions of the sales person (submit) and of the managers (approve or reject).
 */
@Component({
  selector: 'app-cpq-approval-panel',
  imports: [ReactiveFormsModule, NzAlertModule, NzButtonModule, NzInputModule, NzSpinModule, NzTagModule, TranslatePipe],
  template: `
    <nz-spin [nzSpinning]="loading()">
      @if (overview(); as o) {
        @if (pending()) {
          <nz-alert nzType="warning" nzShowIcon data-test="banner-pending" [nzMessage]="'CPQ.APPROVAL.BANNER_PENDING' | translate" />
        }
        @if (rejected()) {
          <nz-alert nzType="error" nzShowIcon data-test="banner-rejected" [nzMessage]="'CPQ.APPROVAL.BANNER_REJECTED' | translate" />
        }

        <ul class="levels" data-test="levels">
          @for (request of o.requests; track request.id) {
            <li>
              {{ 'CPQ.APPROVAL.LEVEL' | translate }} {{ request.level }} · {{ request.required_role }}
              <nz-tag [nzColor]="color(request.status)">{{ statusKey(request.status) | translate }}</nz-tag>
              @for (trigger of request.triggers; track trigger.type) {
                <div class="trigger">
                  {{ 'CPQ.APPROVAL.TRIGGER_' + trigger.type.toUpperCase() | translate }}: {{ trigger.actual }} / {{ trigger.limit }}
                </div>
              }
              @if (request.decided_at) {
                <div>{{ 'CPQ.APPROVAL.DECIDED_AT' | translate }} {{ request.decided_at }}</div>
              }
              @if (request.rejection_reason) {
                <div class="reason">{{ request.rejection_reason }}</div>
              }
            </li>
          }
        </ul>

        <div class="actions">
          @if (canSubmit()) {
            <button nz-button type="button" data-test="submit" [nzLoading]="busy()" (click)="submit()">
              {{ 'CPQ.APPROVAL.SUBMIT' | translate }}
            </button>
          }
          @if (canDecide()) {
            <button nz-button nzType="primary" type="button" data-test="approve" [nzLoading]="busy()" (click)="approve()">
              {{ 'CPQ.APPROVAL.APPROVE' | translate }}
            </button>
            <button nz-button nzDanger type="button" data-test="start-reject" (click)="rejecting.set(true)">
              {{ 'CPQ.APPROVAL.REJECT' | translate }}
            </button>
          }
        </div>

        @if (rejecting()) {
          <form [formGroup]="rejectForm" (ngSubmit)="reject()" class="reject">
            <label for="reject-reason">{{ 'CPQ.APPROVAL.REASON' | translate }}</label>
            <textarea nz-input id="reject-reason" rows="3" formControlName="reason"></textarea>
            <button nz-button nzDanger type="submit" data-test="confirm-reject" [nzLoading]="busy()" [disabled]="rejectForm.invalid">
              {{ 'CPQ.APPROVAL.REJECT' | translate }}
            </button>
          </form>
        }
      }
    </nz-spin>
  `,
  styles: `
    .levels {
      padding-left: 18px;
    }
    .actions {
      display: flex;
      gap: 12px;
      margin: 12px 0;
    }
    .reject {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 480px;
    }
  `,
})
export class CpqApprovalPanelComponent {
  private readonly api = inject(CpqApiService);
  private readonly auth = inject(AuthStore);
  private readonly fb = inject(FormBuilder);

  readonly quoteId = input.required<string>();
  /** Emitted after every decision or submission, so the host can reload the quote. */
  readonly changed = output<void>();

  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly rejecting = signal(false);
  protected readonly overview = signal<CpqApprovalOverview | null>(null);

  protected readonly rejectForm = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  protected readonly pending = computed(() => this.overview()?.requests.some((r) => r.status === 'pending') ?? false);
  protected readonly rejected = computed(() => this.overview()?.requests.some((r) => r.status === 'rejected') ?? false);
  protected readonly canDecide = computed(() => this.pending() && CPQ_APPROVER_ROLES.includes(this.auth.activeRole().toLowerCase()));
  protected readonly canSubmit = computed(() => {
    const overview = this.overview();

    return overview !== null && !this.pending() && !overview.cleared;
  });

  constructor() {
    effect(() => this.load(this.quoteId()));
  }

  protected color(status: CpqApprovalStatus): string {
    return TAG_COLORS[status];
  }

  protected statusKey(status: CpqApprovalStatus): string {
    return `CPQ.APPROVAL.STATUS_${status.toUpperCase()}`;
  }

  protected submit(): void {
    this.run(this.api.submitForApproval(this.quoteId()));
  }

  protected approve(): void {
    this.run(this.api.approve(this.quoteId()));
  }

  protected reject(): void {
    if (this.rejectForm.invalid) {
      return;
    }

    this.run(this.api.reject(this.quoteId(), this.rejectForm.getRawValue().reason));
  }

  private run(call: Observable<unknown>): void {
    this.busy.set(true);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.rejecting.set(false);
        this.rejectForm.reset();
        this.load(this.quoteId());
        this.changed.emit();
      },
      error: () => this.busy.set(false),
    });
  }

  private load(quoteId: string): void {
    this.loading.set(true);
    this.api.getApprovals(quoteId).subscribe({
      next: (res) => {
        this.overview.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
