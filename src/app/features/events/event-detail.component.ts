import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  EventRegistration,
  EventRegistrationQr,
  EventSession,
  EventsApiService,
  EventTicketType,
  ManagedEvent,
  ManagedEventReport,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, EVENT_STATUS_COLORS, nowInput, REGISTRATION_STATUS_COLORS, toApiDateTime, toInputDateTime } from './events.util';

/** One event: programme, ticket types, registrations (payment, cancellation, QR code) and the revenue report. */
@Component({
  selector: 'app-event-detail',
  styleUrl: './events.scss',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    @if (event(); as current) {
      <app-page-header [title]="current.code + ' - ' + current.name" [subtitle]="'EVENTS.DETAIL_SUBTITLE' | translate">
        <a nz-button routerLink="/events">{{ 'EVENTS.BACK' | translate }}</a>
        @if (current.status === 'draft') {
          <button nz-button nzType="primary" (click)="transition('publish')">{{ 'EVENTS.PUBLISH' | translate }}</button>
        }
        @if (current.status === 'published') {
          <button nz-button nz-popconfirm [nzPopconfirmTitle]="'EVENTS.CLOSE_CONFIRM' | translate" (nzOnConfirm)="transition('close')">{{ 'EVENTS.CLOSE' | translate }}</button>
        }
        @if (current.status === 'draft' || current.status === 'published') {
          <button nz-button nzDanger nz-popconfirm [nzPopconfirmTitle]="'EVENTS.CANCEL_CONFIRM' | translate" (nzOnConfirm)="transition('cancel')">{{ 'EVENTS.CANCEL_EVENT' | translate }}</button>
        }
      </app-page-header>

      <nz-card class="main-card">
        <nz-descriptions nzSize="small" [nzColumn]="3">
          <nz-descriptions-item [nzTitle]="'EVENTS.STATUS' | translate">
            <nz-tag [nzColor]="statusColor(current.status)">{{ ('EVENTS.STATUS_' + current.status.toUpperCase()) | translate }}</nz-tag>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'EVENTS.STARTS_AT' | translate">{{ current.starts_at }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'EVENTS.ENDS_AT' | translate">{{ current.ends_at }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'EVENTS.VENUE' | translate">{{ current.venue }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'EVENTS.PLACES' | translate">{{ current.confirmed_count ?? 0 }} / {{ current.capacity ?? '∞' }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'EVENTS.WAITLISTED' | translate">{{ current.waitlisted_count ?? 0 }}</nz-descriptions-item>
        </nz-descriptions>
      </nz-card>

      <nz-tabs (nzSelectedIndexChange)="onTab($event)">
        <nz-tab [nzTitle]="'EVENTS.TAB_REGISTRATIONS' | translate">
          <div class="toolbar">
            <span class="spacer"></span>
            <button nz-button nzType="primary" (click)="openRegistration()" [disabled]="current.status !== 'published'" appIconAction="create"></button>
          </div>
          <nz-table #regTable [nzData]="registrations()" nzSize="small" [nzPageSize]="25">
            <thead>
              <tr>
                <th>{{ 'EVENTS.ATTENDEE' | translate }}</th>
                <th>{{ 'EVENTS.TICKET_TYPE' | translate }}</th>
                <th>{{ 'EVENTS.STATUS' | translate }}</th>
                <th class="num">{{ 'EVENTS.PRICE' | translate }}</th>
                <th>{{ 'EVENTS.PAID' | translate }}</th>
                <th>{{ 'EVENTS.CHECKED_IN_AT' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of regTable.data; track row.id) {
                <tr>
                  <td>{{ row.attendee_name }} <span class="muted">{{ row.attendee_email }}</span></td>
                  <td>{{ row.ticket_type?.name }}</td>
                  <td>
                    <nz-tag [nzColor]="registrationColor(row.status)">{{ ('EVENTS.REG_' + row.status.toUpperCase()) | translate }}</nz-tag>
                  </td>
                  <td class="num">{{ row.price | number: '1.2-2' }}</td>
                  <td>{{ row.paid_at ?? '' }}</td>
                  <td>{{ row.checked_in_at ?? '' }}</td>
                  <td>
                    <div class="row-actions">
                      @if (row.status === 'confirmed') {
                        <button nz-button nzType="text" (click)="showQr(row)">{{ 'EVENTS.QR' | translate }}</button>
                        @if (!row.paid_at) {
                          <button nz-button nzType="text" (click)="pay(row)">{{ 'EVENTS.MARK_PAID' | translate }}</button>
                        }
                      }
                      @if (row.status !== 'cancelled' && !row.checked_in_at) {
                        <button nz-button nzType="text" nzDanger nz-popconfirm [nzPopconfirmTitle]="'EVENTS.CANCEL_REGISTRATION_CONFIRM' | translate" (nzOnConfirm)="cancelRegistration(row)">{{ 'EVENTS.CANCEL_REGISTRATION' | translate }}</button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (registrations().length === 0) {
            <nz-empty [nzNotFoundContent]="'EVENTS.NO_REGISTRATIONS' | translate"></nz-empty>
          }
        </nz-tab>

        <nz-tab [nzTitle]="'EVENTS.TAB_TICKETS' | translate">
          <div class="toolbar"><span class="spacer"></span><button nz-button nzType="primary" (click)="openTicket()" appIconAction="create"></button></div>
          <nz-table #ticketTable [nzData]="current.ticket_types ?? []" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'EVENTS.NAME' | translate }}</th>
                <th class="num">{{ 'EVENTS.PRICE' | translate }}</th>
                <th class="num">{{ 'EVENTS.QUANTITY' | translate }}</th>
                <th class="num">{{ 'EVENTS.SOLD' | translate }}</th>
                <th>{{ 'EVENTS.ON_SALE' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of ticketTable.data; track row.id) {
                <tr>
                  <td>{{ row.name }}</td>
                  <td class="num">{{ row.price | number: '1.2-2' }}</td>
                  <td class="num">{{ row.quantity ?? '∞' }}</td>
                  <td class="num">{{ row.sold_count ?? 0 }}</td>
                  <td>{{ (row.is_active ? 'EVENTS.YES' : 'EVENTS.NO') | translate }}</td>
                  <td>
                    <div class="row-actions">
                      <button nz-button nzType="text" appIconAction="edit" (click)="openTicket(row)"></button>
                      <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'EVENTS.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeTicket(row)"></button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if ((current.ticket_types ?? []).length === 0) {
            <nz-empty [nzNotFoundContent]="'EVENTS.NO_TICKETS' | translate"></nz-empty>
          }
        </nz-tab>

        <nz-tab [nzTitle]="'EVENTS.TAB_PROGRAMME' | translate">
          <div class="toolbar"><span class="spacer"></span><button nz-button nzType="primary" (click)="openSession()" appIconAction="create"></button></div>
          <nz-table #sessionTable [nzData]="current.sessions ?? []" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'EVENTS.SESSION_TITLE' | translate }}</th>
                <th>{{ 'EVENTS.SPEAKER' | translate }}</th>
                <th>{{ 'EVENTS.ROOM' | translate }}</th>
                <th>{{ 'EVENTS.STARTS_AT' | translate }}</th>
                <th>{{ 'EVENTS.ENDS_AT' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of sessionTable.data; track row.id) {
                <tr>
                  <td>{{ row.title }}</td>
                  <td>{{ row.speaker }}</td>
                  <td>{{ row.room }}</td>
                  <td>{{ row.starts_at }}</td>
                  <td>{{ row.ends_at }}</td>
                  <td>
                    <div class="row-actions">
                      <button nz-button nzType="text" appIconAction="edit" (click)="openSession(row)"></button>
                      <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'EVENTS.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeSession(row)"></button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if ((current.sessions ?? []).length === 0) {
            <nz-empty [nzNotFoundContent]="'EVENTS.NO_SESSIONS' | translate"></nz-empty>
          }
        </nz-tab>

        <nz-tab [nzTitle]="'EVENTS.TAB_REPORT' | translate">
          @if (report(); as data) {
            <div class="stats-grid">
              <nz-card><nz-statistic [nzTitle]="'EVENTS.EXPECTED_REVENUE' | translate" [nzValue]="(data.expected_revenue | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
              <nz-card><nz-statistic [nzTitle]="'EVENTS.COLLECTED_REVENUE' | translate" [nzValue]="(data.collected_revenue | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
              <nz-card><nz-statistic [nzTitle]="'EVENTS.OUTSTANDING_REVENUE' | translate" [nzValue]="(data.outstanding_revenue | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
              <nz-card><nz-statistic [nzTitle]="'EVENTS.CONFIRMED' | translate" [nzValue]="data.confirmed"></nz-statistic></nz-card>
              <nz-card><nz-statistic [nzTitle]="'EVENTS.OCCUPANCY' | translate" [nzValue]="data.occupancy_percent !== null ? data.occupancy_percent + ' %' : '-'"></nz-statistic></nz-card>
              <nz-card><nz-statistic [nzTitle]="'EVENTS.WAITLISTED' | translate" [nzValue]="data.waitlisted"></nz-statistic></nz-card>
              <nz-card><nz-statistic [nzTitle]="'EVENTS.CHECKED_IN' | translate" [nzValue]="data.checked_in"></nz-statistic></nz-card>
              <nz-card><nz-statistic [nzTitle]="'EVENTS.NO_SHOW' | translate" [nzValue]="data.no_show"></nz-statistic></nz-card>
              <nz-card><nz-statistic [nzTitle]="'EVENTS.CANCELLED' | translate" [nzValue]="data.cancelled"></nz-statistic></nz-card>
            </div>
            <nz-table #reportTable [nzData]="data.by_ticket_type" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'EVENTS.TICKET_TYPE' | translate }}</th>
                  <th class="num">{{ 'EVENTS.PRICE' | translate }}</th>
                  <th class="num">{{ 'EVENTS.SOLD' | translate }}</th>
                  <th class="num">{{ 'EVENTS.WAITLISTED' | translate }}</th>
                  <th class="num">{{ 'EVENTS.EXPECTED_REVENUE' | translate }}</th>
                  <th class="num">{{ 'EVENTS.COLLECTED_REVENUE' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of reportTable.data; track row.ticket_type_id) {
                  <tr>
                    <td>{{ row.name }}</td>
                    <td class="num">{{ row.price | number: '1.2-2' }}</td>
                    <td class="num">{{ row.sold }}</td>
                    <td class="num">{{ row.waitlisted }}</td>
                    <td class="num">{{ row.expected_revenue | number: '1.2-2' }}</td>
                    <td class="num">{{ row.collected_revenue | number: '1.2-2' }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        </nz-tab>
      </nz-tabs>

      <nz-modal [(nzVisible)]="registrationVisible" [nzTitle]="'EVENTS.NEW_REGISTRATION' | translate" (nzOnCancel)="registrationVisible.set(false)" (nzOnOk)="saveRegistration()" okAction="save" [nzOkDisabled]="registrationForm.invalid">
        <ng-container *nzModalContent>
          <form nz-form [formGroup]="registrationForm" nzLayout="vertical">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'EVENTS.TICKET_TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="ticket_type_id">
                  @for (ticket of activeTickets(); track ticket.id) {
                    <nz-option [nzValue]="ticket.id" [nzLabel]="ticket.name + ' - ' + (ticket.price | number: '1.2-2')"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="reg-name">{{ 'EVENTS.ATTENDEE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="reg-name" formControlName="attendee_name" maxlength="160" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="reg-email">{{ 'EVENTS.EMAIL' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="reg-email" type="email" formControlName="attendee_email" maxlength="190" /></nz-form-control>
            </nz-form-item>
          </form>
        </ng-container>
      </nz-modal>

      <nz-modal [(nzVisible)]="ticketVisible" [nzTitle]="(editingTicket() ? 'EVENTS.EDIT_TICKET' : 'EVENTS.NEW_TICKET') | translate" (nzOnCancel)="ticketVisible.set(false)" (nzOnOk)="saveTicket()" okAction="save" [nzOkDisabled]="ticketForm.invalid">
        <ng-container *nzModalContent>
          <form nz-form [formGroup]="ticketForm" nzLayout="vertical">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="tk-name">{{ 'EVENTS.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="tk-name" formControlName="name" maxlength="120" /></nz-form-control>
            </nz-form-item>
            <div class="form-row">
              <nz-form-item>
                <nz-form-label nzRequired nzFor="tk-price">{{ 'EVENTS.PRICE' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="tk-price" type="number" min="0" step="any" formControlName="price" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="tk-quantity">{{ 'EVENTS.QUANTITY' | translate }}</nz-form-label>
                <nz-form-control [nzExtra]="'EVENTS.CAPACITY_HINT' | translate"><input nz-input id="tk-quantity" type="number" min="1" formControlName="quantity" /></nz-form-control>
              </nz-form-item>
            </div>
            <nz-form-item>
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <nz-form-control><label nz-checkbox formControlName="is_active">{{ 'EVENTS.ON_SALE' | translate }}</label></nz-form-control>
            </nz-form-item>
          </form>
        </ng-container>
      </nz-modal>

      <nz-modal [(nzVisible)]="sessionVisible" [nzTitle]="(editingSession() ? 'EVENTS.EDIT_SESSION' : 'EVENTS.NEW_SESSION') | translate" (nzOnCancel)="sessionVisible.set(false)" (nzOnOk)="saveSession()" okAction="save" [nzOkDisabled]="sessionForm.invalid">
        <ng-container *nzModalContent>
          <form nz-form [formGroup]="sessionForm" nzLayout="vertical">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="se-title">{{ 'EVENTS.SESSION_TITLE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="se-title" formControlName="title" maxlength="160" /></nz-form-control>
            </nz-form-item>
            <div class="form-row">
              <nz-form-item>
                <nz-form-label nzFor="se-speaker">{{ 'EVENTS.SPEAKER' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="se-speaker" formControlName="speaker" maxlength="160" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="se-room">{{ 'EVENTS.ROOM' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="se-room" formControlName="room" maxlength="80" /></nz-form-control>
              </nz-form-item>
            </div>
            <div class="form-row">
              <nz-form-item>
                <nz-form-label nzRequired nzFor="se-start">{{ 'EVENTS.STARTS_AT' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="se-start" type="datetime-local" formControlName="starts_at" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="se-end">{{ 'EVENTS.ENDS_AT' | translate }}</nz-form-label>
                <nz-form-control><input nz-input id="se-end" type="datetime-local" formControlName="ends_at" /></nz-form-control>
              </nz-form-item>
            </div>
          </form>
        </ng-container>
      </nz-modal>

      <nz-modal [(nzVisible)]="qrVisible" [nzTitle]="'EVENTS.QR' | translate" [nzFooter]="null" (nzOnCancel)="qrVisible.set(false)">
        <ng-container *nzModalContent>
          @if (qr(); as code) {
            <div class="qr-box">
              <img [src]="code.data_uri" [alt]="'EVENTS.QR' | translate" />
              <code>{{ code.qr_token }}</code>
            </div>
          }
        </ng-container>
      </nz-modal>
    }
  `,
})
export class EventDetailComponent implements OnInit {
  private readonly api = inject(EventsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly event = signal<ManagedEvent | null>(null);
  readonly registrations = signal<EventRegistration[]>([]);
  readonly report = signal<ManagedEventReport | null>(null);
  readonly qr = signal<EventRegistrationQr | null>(null);

  readonly registrationVisible = signal(false);
  readonly ticketVisible = signal(false);
  readonly sessionVisible = signal(false);
  readonly qrVisible = signal(false);
  readonly editingTicket = signal<EventTicketType | null>(null);
  readonly editingSession = signal<EventSession | null>(null);

  readonly registrationForm = this.fb.group({
    ticket_type_id: ['', [Validators.required]],
    attendee_name: ['', [Validators.required]],
    attendee_email: ['', [Validators.email]],
  });

  readonly ticketForm = this.fb.group({
    name: ['', [Validators.required]],
    price: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    quantity: this.fb.control<number | null>(null, [Validators.min(1)]),
    is_active: [true],
  });

  readonly sessionForm = this.fb.group({
    title: ['', [Validators.required]],
    speaker: [''],
    room: [''],
    starts_at: [nowInput(), [Validators.required]],
    ends_at: [nowInput(), [Validators.required]],
  });

  private get eventId(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: string): string {
    return EVENT_STATUS_COLORS[status] ?? 'default';
  }

  registrationColor(status: string): string {
    return REGISTRATION_STATUS_COLORS[status] ?? 'default';
  }

  activeTickets(): EventTicketType[] {
    return (this.event()?.ticket_types ?? []).filter((ticket) => ticket.is_active);
  }

  load(): void {
    this.api.getEvent(this.eventId).subscribe({ next: (response) => this.event.set(response.data), error: (error: unknown) => this.fail(error) });
    this.api.getRegistrations({ event_id: this.eventId, per_page: 100 }).subscribe({ next: (response) => this.registrations.set(response.data), error: (error: unknown) => this.fail(error) });
  }

  onTab(index: number): void {
    if (index === 3) {
      this.api.getReport(this.eventId).subscribe({ next: (response) => this.report.set(response.data), error: (error: unknown) => this.fail(error) });
    }
  }

  transition(action: 'publish' | 'close' | 'cancel'): void {
    const request = action === 'publish' ? this.api.publishEvent(this.eventId) : action === 'close' ? this.api.closeEvent(this.eventId) : this.api.cancelEvent(this.eventId);
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('EVENTS.EVENT_UPDATED'));
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  openRegistration(): void {
    this.registrationForm.reset({ ticket_type_id: this.activeTickets()[0]?.id ?? '', attendee_name: '', attendee_email: '' });
    this.registrationVisible.set(true);
  }

  saveRegistration(): void {
    const value = this.registrationForm.getRawValue();
    this.api.createRegistration({ event_id: this.eventId, ticket_type_id: value.ticket_type_id, attendee_name: value.attendee_name, attendee_email: blankToNull(value.attendee_email) }).subscribe({
      next: (response) => {
        this.message.success(this.translate.instant(response.data.status === 'waitlisted' ? 'EVENTS.WAITLISTED_MESSAGE' : 'EVENTS.REGISTERED'));
        this.registrationVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  pay(registration: EventRegistration): void {
    this.api.payRegistration(registration.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('EVENTS.PAID_MESSAGE'));
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  cancelRegistration(registration: EventRegistration): void {
    this.api.cancelRegistration(registration.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('EVENTS.REGISTRATION_CANCELLED'));
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  showQr(registration: EventRegistration): void {
    this.api.getRegistrationQr(registration.id).subscribe({
      next: (response) => {
        this.qr.set(response.data);
        this.qrVisible.set(true);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  openTicket(ticket: EventTicketType | null = null): void {
    this.editingTicket.set(ticket);
    this.ticketForm.reset({ name: ticket?.name ?? '', price: ticket ? Number(ticket.price) : 0, quantity: ticket?.quantity ?? null, is_active: ticket?.is_active ?? true });
    this.ticketVisible.set(true);
  }

  saveTicket(): void {
    const value = this.ticketForm.getRawValue();
    const payload = { name: value.name, price: String(value.price ?? 0), quantity: value.quantity, is_active: value.is_active };
    const current = this.editingTicket();
    const request = current ? this.api.updateTicketType(current.id, payload) : this.api.createTicketType({ ...payload, event_id: this.eventId });
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('EVENTS.SAVED'));
        this.ticketVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  removeTicket(ticket: EventTicketType): void {
    this.api.deleteTicketType(ticket.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('EVENTS.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  openSession(session: EventSession | null = null): void {
    this.editingSession.set(session);
    this.sessionForm.reset({
      title: session?.title ?? '',
      speaker: session?.speaker ?? '',
      room: session?.room ?? '',
      starts_at: session ? toInputDateTime(session.starts_at) : nowInput(),
      ends_at: session ? toInputDateTime(session.ends_at) : nowInput(),
    });
    this.sessionVisible.set(true);
  }

  saveSession(): void {
    const value = this.sessionForm.getRawValue();
    const payload = { title: value.title, speaker: blankToNull(value.speaker), room: blankToNull(value.room), starts_at: toApiDateTime(value.starts_at), ends_at: toApiDateTime(value.ends_at) };
    const current = this.editingSession();
    const request = current ? this.api.updateSession(current.id, payload) : this.api.createSession({ ...payload, event_id: this.eventId });
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('EVENTS.SAVED'));
        this.sessionVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  removeSession(session: EventSession): void {
    this.api.deleteSession(session.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('EVENTS.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.message.error(apiErrorText(error) ?? this.translate.instant('EVENTS.ACTION_ERROR'));
  }
}
