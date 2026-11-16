import { Component, effect, inject, input, signal } from '@angular/core';
import { AccessApiService, PlanLimits } from '@core';
import { TranslatePipe } from '@shared';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTagModule } from 'ng-zorro-antd/tag';

/** Users (active plus pending invitations) and custom roles against the limits of the plan; `null` means unlimited. */
@Component({
  selector: 'app-plan-limits',
  imports: [NzProgressModule, NzTagModule, TranslatePipe],
  template: `
    @if (limits(); as current) {
      <div class="plan-limits mb-3" data-test="plan-limits">
        <nz-tag data-test="plan-code">{{ 'access.limits.plan' | translate }}: {{ current.plan_code }}</nz-tag>
        <div class="plan-limit" data-test="users-limit">
          <span>{{ 'access.limits.users' | translate }}</span>
          <strong>
            @if (current.max_users === null) {
              {{ used(current) }} / {{ 'access.limits.unlimited' | translate }}
            } @else {
              {{ used(current) }} / {{ current.max_users }}
            }
          </strong>
          <small>{{ 'access.limits.pending' | translate: { count: current.pending_invitations } }}</small>
          @if (current.max_users !== null) {
            <nz-progress
              [nzPercent]="percent(used(current), current.max_users)"
              nzSize="small"
              [nzShowInfo]="false"
              [nzStatus]="used(current) >= current.max_users ? 'exception' : 'normal'"
            />
          }
        </div>
        <div class="plan-limit" data-test="roles-limit">
          <span>{{ 'access.limits.customRoles' | translate }}</span>
          <strong>
            @if (current.max_custom_roles === null) {
              {{ current.custom_roles }} / {{ 'access.limits.unlimited' | translate }}
            } @else {
              {{ current.custom_roles }} / {{ current.max_custom_roles }}
            }
          </strong>
        </div>
      </div>
    }
  `,
  styles: `
    .plan-limits {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px 32px;
    }
    .plan-limit {
      display: flex;
      flex-direction: column;
      min-width: 180px;
    }
  `,
})
export class PlanLimitsComponent {
  private readonly api = inject(AccessApiService);

  /** Change it to load the limits again (after an invitation, a new role or an import). */
  readonly version = input(0);
  protected readonly limits = signal<PlanLimits | null>(null);

  constructor() {
    effect(() => {
      this.version();
      this.api.getLimits().subscribe({
        next: (res) => this.limits.set(res.data),
        // The limits are informative: the page works without them.
        error: () => this.limits.set(null),
      });
    });
  }

  protected used(limits: PlanLimits): number {
    return limits.active_users + limits.pending_invitations;
  }

  protected percent(used: number, max: number): number {
    return max <= 0 ? 100 : Math.min(100, Math.round((used / max) * 100));
  }
}
