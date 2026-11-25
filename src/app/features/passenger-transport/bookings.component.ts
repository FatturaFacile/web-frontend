import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  PermissionsService,
  PTR_BOOKING_STATUSES,
  PTR_SERVICE_TYPES,
  PtrBooking,
  PtrBookingAction,
  PtrBookingPayload,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { BookingFormComponent } from './booking-form.component';
import { BookingsStore } from './bookings.store';
import {
  bookingActions,
  bookingStatusColor,
  flightStatusColor,
  PASSENGER_TRANSPORT_FINANCE_MODULE,
  PASSENGER_TRANSPORT_MODULE,
  PtrOutcome,
  toDateString,
} from './passenger-transport.util';

/**
 * The bookings: filters, the lifecycle buttons of every row, the link to its service sheet, invoicing for finance, and the drawer
 * with the booking form and its live cross-border VAT split.
 */
@Component({
  selector: 'app-ptr-bookings',
  imports: [
    BookingFormComponent,
    DatePipe,
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [BookingsStore],
  styleUrl: './passenger-transport.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.PASSENGER_TRANSPORT_BOOKINGS' | translate"
    ></app-page-header>

    <div class="toolbar">
      <label class="field" for="ptr-f-q">
        <span>{{ 'passengerTransport.field.search' | translate }}</span>
        <input
          nz-input
          id="ptr-f-q"
          [ngModel]="store.filters().q ?? ''"
          (ngModelChange)="onSearch($event)"
        />
      </label>
      <label class="field" for="ptr-f-status">
        <span>{{ 'passengerTransport.field.status' | translate }}</span>
        <nz-select
          nzId="ptr-f-status"
          nzAllowClear
          [ngModel]="store.filters().status || null"
          (ngModelChange)="store.setFilters({ status: $event ?? '' })"
        >
          @for (status of statuses; track status) {
            <nz-option
              [nzValue]="status"
              [nzLabel]="'passengerTransport.bookingStatus.' + status | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="ptr-f-type">
        <span>{{ 'passengerTransport.field.serviceType' | translate }}</span>
        <nz-select
          nzId="ptr-f-type"
          nzAllowClear
          [ngModel]="store.filters().service_type || null"
          (ngModelChange)="store.setFilters({ service_type: $event ?? '' })"
        >
          @for (type of serviceTypes; track type) {
            <nz-option
              [nzValue]="type"
              [nzLabel]="'passengerTransport.serviceType.' + type | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="ptr-f-range">
        <span>{{ 'passengerTransport.field.period' | translate }}</span>
        <nz-range-picker
          nzId="ptr-f-range"
          (ngModelChange)="onRange($event)"
          [ngModel]="[]"
        ></nz-range-picker>
      </label>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openCreate()">
          {{ 'passengerTransport.action.newBooking' | translate }}
        </button>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="
          failure.errorKey ?? 'passengerTransport.error.generic' | translate: failure.params
        "
        [nzDescription]="failure.detail ?? undefined"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.bookings()"
        [nzFrontPagination]="false"
        [nzTotal]="store.total()"
        [nzPageIndex]="store.page()"
        [nzPageSize]="store.pageSize()"
        [nzScroll]="{ x: '1100px' }"
        (nzPageIndexChange)="store.setPage($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'passengerTransport.field.bookingCode' | translate }}</th>
            <th scope="col">{{ 'passengerTransport.field.pickup' | translate }}</th>
            <th scope="col">{{ 'passengerTransport.field.route' | translate }}</th>
            <th scope="col">{{ 'passengerTransport.field.customer' | translate }}</th>
            <th scope="col">{{ 'passengerTransport.field.status' | translate }}</th>
            <th scope="col" class="num">
              {{ 'passengerTransport.field.agreedPrice' | translate }}
            </th>
            <th scope="col">{{ 'passengerTransport.field.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (booking of table.data; track booking.id) {
            <tr>
              <td>
                {{ booking.booking_code }}
                <small class="muted">{{
                  'passengerTransport.serviceType.' + booking.service_type | translate
                }}</small>
              </td>
              <td>{{ booking.pickup_datetime | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>
                {{ booking.pickup_address }} → {{ booking.dropoff_address }}
                @if (booking.cross_border) {
                  <nz-tag nzColor="purple">{{
                    'passengerTransport.borderCrossing.' + booking.border_crossing_point | translate
                  }}</nz-tag>
                }
                @if (booking.flight_or_train_number) {
                  <nz-tag [nzColor]="flightColor(booking)">
                    {{ booking.flight_or_train_number }}
                    @if (booking.flight_delay_minutes !== 0) {
                      {{ booking.flight_delay_minutes > 0 ? '+' : ''
                      }}{{ booking.flight_delay_minutes }}'
                    }
                  </nz-tag>
                }
              </td>
              <td>{{ booking.ordering_customer_name ?? '—' }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(booking)">{{
                  'passengerTransport.bookingStatus.' + booking.status | translate
                }}</nz-tag>
              </td>
              <td class="num">{{ booking.agreed_price_net | money: booking.currency }}</td>
              <td class="row-actions">
                @if (canWrite) {
                  @for (action of actionsOf(booking); track action) {
                    @if (action === 'cancel') {
                      <button
                        nz-button
                        nzSize="small"
                        nzDanger
                        type="button"
                        nz-popconfirm
                        [nzPopconfirmTitle]="'passengerTransport.confirm.cancelBooking' | translate"
                        [nzOkText]="'passengerTransport.action.confirm' | translate"
                        [nzCancelText]="'passengerTransport.action.cancel' | translate"
                        (nzOnConfirm)="transition(booking, action)"
                      >
                        {{ 'passengerTransport.bookingAction.' + action | translate }}
                      </button>
                    } @else {
                      <button
                        nz-button
                        nzSize="small"
                        type="button"
                        (click)="transition(booking, action)"
                      >
                        {{ 'passengerTransport.bookingAction.' + action | translate }}
                      </button>
                    }
                  }
                  @if (booking.editable) {
                    <button nz-button nzSize="small" type="button" (click)="openEdit(booking)">
                      {{ 'passengerTransport.action.edit' | translate }}
                    </button>
                  }
                }
                <a
                  nz-button
                  nzSize="small"
                  [routerLink]="['/passenger-transport/bookings', booking.id, 'sheet']"
                >
                  {{ 'passengerTransport.action.openSheet' | translate }}
                </a>
                @if (canBill && booking.status === 'completed' && booking.invoice_id === null) {
                  <button
                    nz-button
                    nzSize="small"
                    nzType="primary"
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'passengerTransport.confirm.invoiceBooking' | translate"
                    [nzOkText]="'passengerTransport.action.confirm' | translate"
                    [nzCancelText]="'passengerTransport.action.cancel' | translate"
                    (nzOnConfirm)="invoice(booking)"
                  >
                    {{ 'passengerTransport.action.invoice' | translate }}
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7">
                <nz-empty
                  [nzNotFoundContent]="'passengerTransport.empty.bookings' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzWidth]="860"
      [nzTitle]="'passengerTransport.section.booking' | translate"
      (nzOnClose)="closeDrawer()"
    >
      <ng-container *nzDrawerContent>
        <app-ptr-booking-form
          [booking]="editing()"
          [airports]="store.airports()"
          [crossings]="store.crossings()"
          [currencies]="store.currencies()"
          [jurisdiction]="store.jurisdiction()"
          [quote]="store.quote()"
          [quoting]="store.quoting()"
          [saving]="store.saving()"
          [error]="formError()"
          (quoteRequested)="quote($event)"
          (submitted)="save($event)"
          (cancelled)="closeDrawer()"
        ></app-ptr-booking-form>
      </ng-container>
    </nz-drawer>
  `,
})
export class BookingsComponent implements OnInit {
  protected readonly store = inject(BookingsStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = this.permissions.canWrite(PASSENGER_TRANSPORT_MODULE);
  protected readonly canBill = this.permissions.canWrite(PASSENGER_TRANSPORT_FINANCE_MODULE);

  protected readonly statuses = PTR_BOOKING_STATUSES;
  protected readonly serviceTypes = PTR_SERVICE_TYPES;

  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<PtrBooking | null>(null);
  protected readonly formError = signal<PtrOutcome | null>(null);
  protected readonly feedback = signal<PtrOutcome | null>(null);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly actionsOf = (booking: PtrBooking): readonly PtrBookingAction[] =>
    bookingActions(booking.status);
  protected readonly statusColor = (booking: PtrBooking): string =>
    bookingStatusColor(booking.status);
  protected readonly flightColor = (booking: PtrBooking): string =>
    flightStatusColor(booking.flight_status);

  ngOnInit(): void {
    void this.store.init();
  }

  protected onSearch(term: string): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => void this.store.setFilters({ q: term }), 350);
  }

  protected onRange(range: Date[] | null): void {
    const [from, to] = range ?? [];
    void this.store.setFilters({
      from: from ? toDateString(from) : undefined,
      to: to ? toDateString(to) : undefined,
    });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formError.set(null);
    this.store.clearQuote();
    this.drawerOpen.set(true);
  }

  protected openEdit(booking: PtrBooking): void {
    this.editing.set(booking);
    this.formError.set(null);
    this.store.clearQuote();
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
    this.editing.set(null);
  }

  protected async quote(payload: PtrBookingPayload): Promise<void> {
    await this.store.quote(payload);
  }

  protected async save(payload: PtrBookingPayload): Promise<void> {
    const current = this.editing();
    const outcome =
      current === null
        ? await this.store.create(payload)
        : await this.store.update(current.id, payload);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('passengerTransport.notification.bookingSaved'));
      this.closeDrawer();
    } else {
      this.formError.set(outcome);
    }
  }

  protected async transition(booking: PtrBooking, action: PtrBookingAction): Promise<void> {
    this.report(
      await this.store.transition(booking.id, action),
      'passengerTransport.notification.bookingUpdated',
    );
  }

  protected async invoice(booking: PtrBooking): Promise<void> {
    this.report(
      await this.store.invoice(booking.id),
      'passengerTransport.notification.bookingInvoiced',
    );
  }

  private report(outcome: PtrOutcome, successKey: string): void {
    if (outcome.ok) {
      this.feedback.set(null);
      this.message.success(this.i18n.instant(successKey));
    } else {
      this.feedback.set(outcome);
    }
  }
}
