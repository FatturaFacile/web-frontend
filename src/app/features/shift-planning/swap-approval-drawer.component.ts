import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ComplianceIssue, ShiftSwapRequest, SwapDecisionPayload, TranslateService } from '@core';
import { TranslatePipe } from '@shared';

export interface SwapDecisionEvent {
  swap: ShiftSwapRequest;
  decision: SwapDecisionPayload;
}

/**
 * The manager inbox of peer shift swaps (second step of the approval). Each request waiting for approval shows the
 * compliance impact of the exchange side by side: the shift with its current owner, and in the new hands.
 */
@Component({
  selector: 'app-swap-approval-drawer',
  imports: [
    FormsModule,
    NgTemplateOutlet,
    TranslatePipe,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzTagModule,
  ],
  styles: `
    .swap {
      border: 1px solid var(--ant-border-color-split, #f0f0f0);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
    }
    .swap-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }
    .sides {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .side {
      border: 1px solid var(--ant-border-color-split, #f0f0f0);
      border-radius: 6px;
      padding: 8px;
    }
    .side h4 {
      margin: 0 0 4px;
      font-size: 13px;
    }
    .issues {
      margin: 4px 0 0;
      padding-left: 16px;
      font-size: 12px;
    }
    .issues .blocking {
      color: #cf1322;
      font-weight: 600;
    }
    .cost {
      font-variant-numeric: tabular-nums;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      align-items: flex-start;
    }
    textarea {
      flex: 1;
    }
  `,
  template: `
    <nz-drawer
      [nzVisible]="open()"
      nzPlacement="right"
      [nzWidth]="720"
      [nzTitle]="'SHIFT_PLANNING.SWAP_INBOX' | translate"
      (nzOnClose)="open.set(false)"
    >
      <ng-container *nzDrawerContent>
        @for (swap of pending(); track swap.id) {
          <article class="swap" [attr.aria-label]="'SHIFT_PLANNING.SWAP_REQUEST' | translate">
            <div class="swap-head">
              <strong
                >{{ name(swap.requester_employee_id) }} →
                {{
                  swap.target_peer_employee_id
                    ? name(swap.target_peer_employee_id)
                    : ('SHIFT_PLANNING.SWAP_ANY' | translate)
                }}</strong
              >
              <nz-tag
                >{{ swap.assignment?.shift_date }} {{ swap.assignment?.template?.code }}</nz-tag
              >
            </div>

            @if (swap.compliance_impact; as impact) {
              <div class="sides">
                <section class="side">
                  <h4>
                    {{
                      'SHIFT_PLANNING.IMPACT_PEER'
                        | translate: { name: name(impact.peer_takes_offered_shift.new_employee_id) }
                    }}
                  </h4>
                  <ng-container
                    [ngTemplateOutlet]="side"
                    [ngTemplateOutletContext]="{ $implicit: impact.peer_takes_offered_shift }"
                  ></ng-container>
                </section>
                @if (impact.requester_takes_counter_shift; as counter) {
                  <section class="side">
                    <h4>
                      {{
                        'SHIFT_PLANNING.IMPACT_REQUESTER'
                          | translate: { name: name(counter.new_employee_id) }
                      }}
                    </h4>
                    <ng-container
                      [ngTemplateOutlet]="side"
                      [ngTemplateOutletContext]="{ $implicit: counter }"
                    ></ng-container>
                  </section>
                }
              </div>
              @if (!impact.can_approve) {
                <p class="issues blocking">{{ 'SHIFT_PLANNING.CANNOT_APPROVE' | translate }}</p>
              }
            }

            <div class="actions">
              <button
                nz-button
                nzType="primary"
                [nzLoading]="saving()"
                [disabled]="swap.compliance_impact?.can_approve === false"
                (click)="approve(swap)"
              >
                {{ 'SHIFT_PLANNING.APPROVE' | translate }}
              </button>
              <textarea
                nz-input
                rows="1"
                maxlength="1000"
                [attr.aria-label]="'SHIFT_PLANNING.REJECT_REASON' | translate"
                [placeholder]="'SHIFT_PLANNING.REJECT_REASON' | translate"
                [ngModel]="reasons()[swap.id] ?? ''"
                (ngModelChange)="setReason(swap.id, $event)"
              ></textarea>
              <button
                nz-button
                nzDanger
                [nzLoading]="saving()"
                [disabled]="!(reasons()[swap.id] ?? '').trim()"
                (click)="reject(swap)"
              >
                {{ 'SHIFT_PLANNING.REJECT' | translate }}
              </button>
            </div>
          </article>
        } @empty {
          <nz-empty [nzNotFoundContent]="'SHIFT_PLANNING.NO_SWAPS' | translate"></nz-empty>
        }
      </ng-container>
    </nz-drawer>

    <ng-template #side let-side>
      <div class="cost">
        {{ 'SHIFT_PLANNING.COST_BEFORE' | translate }}: {{ side.current.estimated_labor_cost }} →
        {{ 'SHIFT_PLANNING.COST_AFTER' | translate }}: {{ side.after.estimated_labor_cost }}
      </div>
      <ul class="issues">
        @for (issue of side.after.compliance_warnings; track $index) {
          <li [class.blocking]="issue.severity === 'blocking_error'">{{ describe(issue) }}</li>
        } @empty {
          <li>{{ 'SHIFT_PLANNING.NO_ISSUES' | translate }}</li>
        }
      </ul>
    </ng-template>
  `,
})
export class SwapApprovalDrawerComponent {
  private readonly translate = inject(TranslateService);

  readonly open = model(false);
  readonly swaps = input<ShiftSwapRequest[]>([]);
  readonly employeeNames = input<Record<string, string>>({});
  readonly saving = input(false);
  readonly decided = output<SwapDecisionEvent>();

  readonly reasons = signal<Record<string, string>>({});
  readonly pending = computed(() =>
    this.swaps().filter((swap) => swap.status === 'pending_manager_approval'),
  );

  name(employeeId: string | null | undefined): string {
    return employeeId ? this.employeeNames()[employeeId] || employeeId.slice(0, 8) : '';
  }

  setReason(id: string, value: string): void {
    this.reasons.update((reasons) => ({ ...reasons, [id]: value }));
  }

  approve(swap: ShiftSwapRequest): void {
    this.decided.emit({ swap, decision: { decision: 'approve' } });
  }

  reject(swap: ShiftSwapRequest): void {
    const reason = (this.reasons()[swap.id] ?? '').trim();
    if (reason) {
      this.decided.emit({ swap, decision: { decision: 'reject', rejection_reason: reason } });
    }
  }

  describe(issue: ComplianceIssue): string {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(issue.params)) {
      params[key] = value === null ? '' : typeof value === 'boolean' ? String(value) : value;
    }
    return this.translate.instant(issue.translation_key, params);
  }
}
