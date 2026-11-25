import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PtrTimelineBooking, PtrTimelineDriver } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AssignDrawerComponent } from './assign-drawer.component';
import { DispatchStore } from './dispatch.store';
import {
  clockMinutes,
  expiryColor,
  expiryState,
  gaugePercent,
  gaugeStatus,
  timelineSpan,
  TimelineSpan,
} from './passenger-transport.util';

interface Block {
  booking: PtrTimelineBooking;
  span: TimelineSpan;
}

interface Row {
  key: string;
  kind: 'vehicle' | 'driver' | 'unassigned' | 'subcontracted';
  label: string;
  labelKey: string | null;
  sub: string | null;
  driver: PtrTimelineDriver | null;
  blocks: Block[];
}

/**
 * The dispatcher board: vehicles and drivers on one axis, the hours of the day on the other. Each trip is a block with its flight
 * status, the cross-border and subcontracted marks, and each driver shows how much OLR 1 / OLR 2 / EC 561 driving time is left.
 */
@Component({
  selector: 'app-ptr-dispatch',
  imports: [
    AssignDrawerComponent,
    FormsModule,
    NzAlertModule,
    NzBadgeModule,
    NzButtonModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzProgressModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [DispatchStore],
  styleUrl: './passenger-transport.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.PASSENGER_TRANSPORT_DISPATCH' | translate"
    ></app-page-header>

    <div class="toolbar">
      <button
        nz-button
        type="button"
        [attr.aria-label]="'passengerTransport.action.previousDay' | translate"
        (click)="store.shiftDay(-1)"
      >
        ‹
      </button>
      <label class="field" for="ptr-dispatch-day">
        <span>{{ 'passengerTransport.field.day' | translate }}</span>
        <nz-date-picker
          nzId="ptr-dispatch-day"
          [nzAllowClear]="false"
          [ngModel]="store.windowStart()"
          (ngModelChange)="onDay($event)"
        ></nz-date-picker>
      </label>
      <button
        nz-button
        type="button"
        [attr.aria-label]="'passengerTransport.action.nextDay' | translate"
        (click)="store.shiftDay(1)"
      >
        ›
      </button>
      <button nz-button type="button" (click)="store.refresh()">
        {{ 'passengerTransport.action.refresh' | translate }}
      </button>
      <span class="spacer"></span>
      <a nz-button nzType="primary" routerLink="/passenger-transport/bookings">{{
        'passengerTransport.action.newBooking' | translate
      }}</a>
    </div>

    <div class="legend">
      <nz-tag nzColor="blue">{{ 'passengerTransport.legend.transfer' | translate }}</nz-tag>
      <nz-tag nzColor="purple">{{ 'passengerTransport.legend.crossBorder' | translate }}</nz-tag>
      <nz-tag nzColor="orange">{{ 'passengerTransport.legend.delayed' | translate }}</nz-tag>
      <nz-tag nzColor="default">{{ 'passengerTransport.legend.subcontracted' | translate }}</nz-tag>
    </div>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (store.delayedFlights().length > 0) {
      <nz-alert
        class="feedback"
        nzType="warning"
        nzShowIcon
        [nzMessage]="
          'passengerTransport.hint.flightsAttention'
            | translate: { count: store.delayedFlights().length }
        "
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="rows()"
        [nzShowPagination]="false"
        [nzScroll]="{ x: '900px' }"
      >
        <thead>
          <tr>
            <th scope="col" nzWidth="200px">
              {{ 'passengerTransport.field.resource' | translate }}
            </th>
            <th scope="col" nzWidth="220px">
              {{ 'passengerTransport.section.drivingTime' | translate }}
            </th>
            <th scope="col">
              <div class="hours" aria-hidden="true">
                @for (hour of hours; track hour) {
                  <span>{{ hour }}</span>
                }
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.key) {
            <tr>
              <th scope="row">
                {{ row.labelKey ? (row.labelKey | translate) : row.label }}
                @if (row.sub) {
                  <small class="muted">{{ row.sub }}</small>
                }
                @if (row.driver; as driver) {
                  <small class="muted">
                    <nz-tag nzSize="small" [nzColor]="docColor(driver.documents.license_expiry)">{{
                      'passengerTransport.document.license' | translate
                    }}</nz-tag>
                    <nz-tag nzSize="small" [nzColor]="docColor(driver.documents.cqc_expiry)"
                      >CQC</nz-tag
                    >
                    <nz-tag nzSize="small" [nzColor]="docColor(driver.documents.czv_expiry)"
                      >CZV</nz-tag
                    >
                    <nz-tag
                      nzSize="small"
                      [nzColor]="docColor(driver.documents.tachograph_card_expiry)"
                      >{{ 'passengerTransport.document.tachographCard' | translate }}</nz-tag
                    >
                  </small>
                }
              </th>
              <td>
                @if (row.driver; as driver) {
                  <div class="gauges">
                    <nz-tag>{{
                      'passengerTransport.drivingRegime.' + driver.regime | translate
                    }}</nz-tag>
                    <span
                      >{{ 'passengerTransport.gauge.daily' | translate }}
                      {{ clock(driver.gauges.daily_used_minutes) }} /
                      {{ clock(driver.gauges.daily_limit_minutes) }}</span
                    >
                    <nz-progress
                      nzSize="small"
                      [nzPercent]="
                        percent(driver.gauges.daily_used_minutes, driver.gauges.daily_limit_minutes)
                      "
                      [nzStatus]="
                        status(driver.gauges.daily_used_minutes, driver.gauges.daily_limit_minutes)
                      "
                      [nzShowInfo]="false"
                    ></nz-progress>
                    @if (driver.gauges.weekly_limit_minutes !== null) {
                      <span
                        >{{ 'passengerTransport.gauge.weekly' | translate }}
                        {{ clock(driver.gauges.weekly_used_minutes) }} /
                        {{ clock(driver.gauges.weekly_limit_minutes) }}</span
                      >
                      <nz-progress
                        nzSize="small"
                        [nzPercent]="
                          percent(
                            driver.gauges.weekly_used_minutes,
                            driver.gauges.weekly_limit_minutes
                          )
                        "
                        [nzStatus]="
                          status(
                            driver.gauges.weekly_used_minutes,
                            driver.gauges.weekly_limit_minutes
                          )
                        "
                        [nzShowInfo]="false"
                      ></nz-progress>
                    }
                    <span>
                      <nz-badge
                        [nzStatus]="driver.available_for_next_trip ? 'success' : 'error'"
                      ></nz-badge>
                      {{ 'passengerTransport.gauge.remaining' | translate }}
                      {{ clock(driver.gauges.remaining_minutes) }}
                    </span>
                  </div>
                }
              </td>
              <td>
                <div class="track">
                  @for (block of row.blocks; track block.booking.id) {
                    <button
                      type="button"
                      class="trip"
                      [class.cross-border]="block.booking.cross_border"
                      [class.delayed]="block.booking.flight_status === 'delayed'"
                      [class.ceded]="block.booking.exchange_direction === 'ceded'"
                      [class.completed]="
                        block.booking.status === 'completed' || block.booking.status === 'invoiced'
                      "
                      [style.left.%]="block.span.left"
                      [style.width.%]="block.span.width"
                      [title]="block.booking.pickup_address + ' → ' + block.booking.dropoff_address"
                      (click)="selected.set(block.booking)"
                    >
                      {{ block.booking.booking_code }}
                      @if (block.booking.flight_or_train_number) {
                        · {{ block.booking.flight_or_train_number }}
                        @if (block.booking.flight_delay_minutes !== 0) {
                          {{ block.booking.flight_delay_minutes > 0 ? '+' : ''
                          }}{{ block.booking.flight_delay_minutes }}'
                        }
                      }
                      @if (block.booking.carrier_name) {
                        · {{ block.booking.carrier_name }}
                      }
                    </button>
                  }
                </div>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="3">
                <nz-empty
                  [nzNotFoundContent]="'passengerTransport.empty.dispatch' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <app-ptr-assign-drawer
      [booking]="selected()"
      [vehicles]="store.vehicles()"
      [drivers]="store.drivers()"
      (closed)="selected.set(null)"
      (changed)="store.refresh()"
    ></app-ptr-assign-drawer>
  `,
})
export class DispatchComponent implements OnInit {
  protected readonly store = inject(DispatchStore);

  protected readonly selected = signal<PtrTimelineBooking | null>(null);
  protected readonly hours = Array.from({ length: 24 }, (_, hour) => hour);
  protected readonly clock = clockMinutes;
  protected readonly percent = gaugePercent;
  protected readonly status = (used: number, limit: number | null) =>
    gaugeStatus(gaugePercent(used, limit));

  protected readonly rows = computed<Row[]>(() => {
    const start = this.store.windowStart();
    const end = this.store.windowEnd();
    const blocks = (bookings: readonly PtrTimelineBooking[]): Block[] =>
      bookings.flatMap((booking) => {
        const span = timelineSpan(
          booking.pickup_datetime,
          booking.estimated_dropoff_datetime,
          start,
          end,
        );
        return span === null ? [] : [{ booking, span }];
      });

    return [
      ...this.store.vehicles().map((vehicle) => ({
        key: `vehicle-${vehicle.id}`,
        kind: 'vehicle' as const,
        label: vehicle.license_plate,
        labelKey: null,
        sub: `${vehicle.passenger_capacity}`,
        driver: null,
        blocks: blocks(vehicle.bookings),
      })),
      ...this.store.drivers().map((driver) => ({
        key: `driver-${driver.id}`,
        kind: 'driver' as const,
        label: driver.name ?? driver.id,
        labelKey: null,
        sub: null,
        driver,
        blocks: blocks(driver.bookings),
      })),
      {
        key: 'unassigned',
        kind: 'unassigned' as const,
        label: '',
        labelKey: 'passengerTransport.row.unassigned',
        sub: null,
        driver: null,
        blocks: blocks(this.store.unassigned()),
      },
      {
        key: 'subcontracted',
        kind: 'subcontracted' as const,
        label: '',
        labelKey: 'passengerTransport.row.subcontracted',
        sub: null,
        driver: null,
        blocks: blocks(this.store.subcontracted()),
      },
    ].filter((row) => row.kind === 'vehicle' || row.kind === 'driver' || row.blocks.length > 0);
  });

  ngOnInit(): void {
    void this.store.load(this.store.day());
  }

  protected onDay(date: Date | null): void {
    if (date) {
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      void this.store.setDay(`${date.getFullYear()}-${month}-${day}`);
    }
  }

  protected docColor(date: string | null): string {
    return expiryColor(expiryState(date));
  }
}
