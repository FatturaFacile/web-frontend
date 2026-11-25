import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe } from '@shared';
import { countdownTo, urgencyColor } from './tender-management.util';

/** Live countdown to a peremptory deadline; the colour follows the alert milestones (7 days, 72 h, 24 h, 4 h). */
@Component({
  selector: 'app-tnd-countdown',
  imports: [NzTagModule, TranslatePipe],
  template: `
    @if (countdown().urgency === 'none') {
      <nz-tag>{{ 'tenderManagement.countdown.none' | translate }}</nz-tag>
    } @else if (countdown().expired) {
      <nz-tag [nzColor]="color()">{{ 'tenderManagement.countdown.expired' | translate }}</nz-tag>
    } @else {
      <nz-tag [nzColor]="color()" role="timer">
        @if (countdown().days > 0) {
          {{ 'tenderManagement.countdown.daysHours' | translate: { days: countdown().days, hours: countdown().hours } }}
        } @else {
          {{
            'tenderManagement.countdown.hoursMinutes'
              | translate: { hours: countdown().hours, minutes: countdown().minutes, seconds: countdown().seconds }
          }}
        }
      </nz-tag>
    }
  `,
})
export class DeadlineCountdownComponent {
  readonly deadline = input<string | null | undefined>(null);

  private readonly now = signal(new Date());

  protected readonly countdown = computed(() => countdownTo(this.deadline(), this.now()));
  protected readonly color = computed(() => urgencyColor(this.countdown().urgency));

  constructor() {
    const timer = setInterval(() => this.now.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
