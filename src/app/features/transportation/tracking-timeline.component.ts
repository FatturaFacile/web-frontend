import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { TmsTrackingEvent } from '@core';
import { TranslatePipe } from '@shared';

/** Chronological timeline (oldest first) of the tracking events of one shipment. */
@Component({
  selector: 'app-tracking-timeline',
  styleUrl: './transportation.scss',
  imports: [DatePipe, TranslatePipe, NzEmptyModule],
  template: `
    @if (sortedEvents().length === 0) {
      <nz-empty [nzNotFoundContent]="'TMS.TIMELINE_EMPTY' | translate"></nz-empty>
    } @else {
      <ol class="tracking-timeline">
        @for (event of sortedEvents(); track event.id) {
          <li class="tl-item">
            <span class="tl-dot" [class]="event.event_type"></span>
            <div class="tl-head">
              <strong>{{ 'RES.V.' + event.event_type | translate }}</strong>
              <span class="muted">{{ event.occurred_at | date: 'short' }}</span>
              @if (event.location) {
                <span class="muted">{{ event.location }}</span>
              }
            </div>
            @if (event.notes) {
              <div>{{ event.notes }}</div>
            }
          </li>
        }
      </ol>
    }
  `,
})
export class TrackingTimelineComponent {
  readonly events = input.required<readonly TmsTrackingEvent[]>();

  readonly sortedEvents = computed(() => [...this.events()].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)));
}
