import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ClockNowPayload, ClockState, HrTimeApiService, I18nService, TimeEventResource, TimeEventType } from '@core';
import { TranslatePipe } from '@shared';
import { forkJoin } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { reportHttpError } from '../shared/hr-http.util';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function deriveClockState(events: TimeEventResource[]): ClockState {
  const last = events.filter((e) => !e.deleted_at).at(-1);
  if (!last) return 'Off';
  if (last.event_type === 'In' || last.event_type === 'BreakEnd') return 'Working';
  if (last.event_type === 'BreakStart') return 'OnBreak';
  return 'Off';
}

@Component({
  selector: 'app-ss-clock',
  styleUrl: './ss-clock.component.scss',
  imports: [DatePipe, NzButtonModule, NzSkeletonModule, NzTableModule, NzTagModule, TranslatePipe],
  template: `
    @if (loading()) {
      <nz-skeleton [nzActive]="true" />
    } @else {
      <div class="clock-state" [attr.data-state]="clockState()">
        <span class="clock-label">{{ 'hrmTime.clockState.' + clockState() | translate }}</span>
      </div>

      <div class="clock-actions">
        @if (clockState() === 'Off') {
          <button nz-button nzType="primary" [disabled]="punching()" (click)="punch('In')">
            {{ 'hrmTime.clockIn' | translate }}
          </button>
        }
        @if (clockState() === 'Working') {
          <button nz-button [disabled]="punching()" (click)="punch('BreakStart')">
            {{ 'hrmTime.breakStart' | translate }}
          </button>
          <button nz-button nzType="primary" nzDanger [disabled]="punching()" (click)="punch('Out')">
            {{ 'hrmTime.clockOut' | translate }}
          </button>
        }
        @if (clockState() === 'OnBreak') {
          <button nz-button nzType="primary" [disabled]="punching()" (click)="punch('BreakEnd')">
            {{ 'hrmTime.breakEnd' | translate }}
          </button>
        }
      </div>

      <h4>{{ 'hrmTime.todayLog' | translate }}</h4>
      <nz-table
        [nzData]="todayEvents()"
        [nzShowPagination]="false"
        nzSize="small"
      >
        <thead>
          <tr>
            <th>{{ 'hrmTime.occurredAt' | translate }}</th>
            <th>{{ 'hrmTime.action' | translate }}</th>
            <th>{{ 'hrmTime.source' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (ev of todayEvents(); track ev.id) {
            <tr [class.deleted]="ev.deleted_at">
              <td>{{ ev.occurred_at | date: 'HH:mm' }}</td>
              <td>
                <nz-tag [nzColor]="eventColor(ev.event_type)">
                  {{ 'hrmTime.eventTypeValue.' + ev.event_type | translate }}
                </nz-tag>
                @if (ev.amended_from_id) {
                  <nz-tag>{{ 'hrmTime.amended' | translate }}</nz-tag>
                }
              </td>
              <td>{{ 'hrmTime.sourceValue.' + ev.source | translate }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
})
export class SsClockComponent implements OnInit {
  private readonly api = inject(HrTimeApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly todayEvents = signal<TimeEventResource[]>([]);
  protected readonly loading = signal(true);
  protected readonly punching = signal(false);
  private readonly geoEnabled = signal(false);

  protected readonly clockState = computed<ClockState>(() => deriveClockState(this.todayEvents()));

  ngOnInit(): void {
    this.loadToday();
  }

  protected eventColor(type: TimeEventType): string {
    const map: Record<TimeEventType, string> = { In: 'green', Out: 'red', BreakStart: 'orange', BreakEnd: 'blue' };
    return map[type] ?? 'default';
  }

  protected punch(eventType: TimeEventType): void {
    this.punching.set(true);
    const doPunch = (payload: ClockNowPayload) => {
      this.api.clockNow(payload).subscribe({
        next: (res) => {
          this.punching.set(false);
          this.todayEvents.update((events) => [...events, res.data]);
        },
        error: (err: unknown) => {
          this.punching.set(false);
          reportHttpError(err, this.message, this.i18n);
        },
      });
    };

    // Art. 4 L. 300/1970: GPS only on punch action (never continuous), only when employee consent is on file.
    if (this.geoEnabled() && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          doPunch({
            event_type: eventType,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            gps_accuracy_meters: pos.coords.accuracy,
          }),
        () => doPunch({ event_type: eventType }),
        { maximumAge: 0, timeout: 5000, enableHighAccuracy: false },
      );
    } else {
      doPunch({ event_type: eventType });
    }
  }

  private loadToday(): void {
    const today = todayIso();
    forkJoin({
      events: this.api.getMyEvents({ from: today, to: today, per_page: 50 }),
      settings: this.api.getClockSettings(),
    }).subscribe({
      next: ({ events, settings }) => {
        this.todayEvents.set(events.data);
        this.geoEnabled.set(settings.data.geolocation_enabled && settings.data.privacy_notice_acknowledged);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        reportHttpError(err, this.message, this.i18n);
        this.loading.set(false);
      },
    });
  }
}
