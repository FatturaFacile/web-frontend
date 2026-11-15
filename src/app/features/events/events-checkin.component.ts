import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { EventRegistration, EventsApiService, ManagedEvent, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './events.util';

/** Desk check-in: the QR token read by the scanner (or typed) is sent to the API, which confirms or refuses it. */
@Component({
  selector: 'app-events-checkin',
  styleUrl: './events.scss',
  imports: [FormsModule, PageHeaderComponent, TranslatePipe, NzAlertModule, NzButtonModule, NzCardModule, NzInputModule, NzSelectModule],
  template: `
    <app-page-header [title]="'EVENTS.CHECKIN_TITLE' | translate" [subtitle]="'EVENTS.CHECKIN_SUBTITLE' | translate"></app-page-header>

    <nz-card class="main-card">
      <div class="toolbar">
        <nz-select style="width: 280px" nzAllowClear nzShowSearch [ngModel]="eventId()" (ngModelChange)="eventId.set($event)" [nzPlaceHolder]="'EVENTS.ANY_EVENT' | translate">
          @for (event of events(); track event.id) {
            <nz-option [nzValue]="event.id" [nzLabel]="event.code + ' - ' + event.name"></nz-option>
          }
        </nz-select>
        <input nz-input style="width: 320px" [ngModel]="token()" (ngModelChange)="token.set($event)" (keyup.enter)="submit()" [placeholder]="'EVENTS.QR_TOKEN' | translate" autofocus />
        <button nz-button nzType="primary" [disabled]="token().trim() === ''" (click)="submit()">{{ 'EVENTS.CHECKIN' | translate }}</button>
      </div>

      @if (last(); as registration) {
        <nz-alert nzType="success" nzShowIcon [nzMessage]="registration.attendee_name" [nzDescription]="(registration.ticket_type?.name ?? '') + ' - ' + (registration.event?.name ?? '')"></nz-alert>
      }
      @if (error(); as text) {
        <nz-alert nzType="error" nzShowIcon [nzMessage]="text"></nz-alert>
      }
    </nz-card>
  `,
})
export class EventsCheckinComponent implements OnInit {
  private readonly api = inject(EventsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly events = signal<ManagedEvent[]>([]);
  readonly eventId = signal<string | null>(null);
  readonly token = signal('');
  readonly last = signal<EventRegistration | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.getEvents({ status: 'published', per_page: 100 }).subscribe({ next: (response) => this.events.set(response.data) });
  }

  submit(): void {
    const token = this.token().trim();
    if (token === '') {
      return;
    }

    this.api.checkIn({ qr_token: token, event_id: this.eventId() }).subscribe({
      next: (response) => {
        this.last.set(response.data);
        this.error.set(null);
        this.token.set('');
        this.message.success(this.translate.instant('EVENTS.CHECKED_IN'));
      },
      error: (error: unknown) => {
        this.last.set(null);
        this.error.set(apiErrorText(error) ?? this.translate.instant('EVENTS.ACTION_ERROR'));
      },
    });
  }
}
