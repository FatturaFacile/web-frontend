import { Component, computed, inject, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService } from '@core';
import { TranslatePipe } from '@shared';
import { countdownParts, durationKey, riskColor, riskLevel, SlaClock } from './sla-countdown';

/**
 * Live SLA countdown of one target: time left in green or orange, time over the due date in red with a breach badge.
 * A paused clock (ticket on hold) shows the pause instead of a moving figure.
 */
@Component({
  selector: 'app-sla-countdown',
  imports: [NzTagModule, TranslatePipe],
  template: `
    @if (paused()) {
      <nz-tag class="sla-countdown" data-testid="sla-paused">{{
        'HELPDESK_SLA.CLOCK_PAUSED' | translate
      }}</nz-tag>
    } @else if (parts(); as p) {
      <nz-tag
        class="sla-countdown"
        [nzColor]="color()"
        [attr.data-state]="breached() ? 'breached' : 'running'"
      >
        @if (p.overdue) {
          {{ 'HELPDESK_SLA.OVERDUE' | translate: { time: durationText() } }}
        } @else {
          {{ 'HELPDESK_SLA.LEFT' | translate: { time: durationText() } }}
        }
      </nz-tag>
      @if (breached()) {
        <nz-tag nzColor="error" data-testid="sla-breach-badge">{{
          'HELPDESK_SLA.BREACHED' | translate
        }}</nz-tag>
      }
    } @else {
      <span class="sla-countdown-none">-</span>
    }
  `,
})
export class SlaCountdownComponent {
  private readonly clock = inject(SlaClock);
  private readonly i18n = inject(I18nService);

  readonly dueAt = input<string | null>(null);
  /** Moment the breach was recorded; marks the target as breached even when the due date moved. */
  readonly breachedAt = input<string | null>(null);
  readonly paused = input(false);
  /** Share of the target already spent, when the API reports it: colours the tag before the due date. */
  readonly elapsedPercent = input<number | null>(null);

  protected readonly parts = computed(() => countdownParts(this.dueAt(), this.clock.now()));
  protected readonly breached = computed(
    () => !!this.breachedAt() || (this.parts()?.overdue ?? false),
  );
  protected readonly color = computed(() => {
    if (this.breached()) {
      return 'error';
    }
    const percent = this.elapsedPercent();
    return percent === null ? 'success' : riskColor(riskLevel(percent));
  });

  /** Recomputed on every clock tick, so a change of language shows within seconds. */
  protected readonly durationText = computed(() => {
    const p = this.parts();
    return p ? this.i18n.translate(durationKey(p), { d: p.days, h: p.hours, m: p.minutes }) : '';
  });
}
