import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { catchError, debounceTime, filter, of, switchMap, tap } from 'rxjs';
import {
  AuthStore,
  FACILITY_BOOKABLE_KINDS,
  FacilityApiService,
  FacilityBooking,
  FacilityBookingCheckResult,
  FacilityBookingRequest,
  FacilityBookingSeriesRequest,
  FacilityBuilding,
  FacilitySpace,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, localInputToInstant, nextFullHour, timelineSlot, todayIso, toLocalInput } from './facility.util';

const FROM_HOUR = 7;
const TO_HOUR = 21;

/** Booking calendar of rooms, desks and parking spots with live conflict feedback, recurring bookings and check-in. */
@Component({
  selector: 'app-facility-bookings',
  styleUrl: './facility.scss',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzStatisticModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'FACILITY.BOOKINGS_TITLE' | translate" [subtitle]="'FACILITY.BOOKINGS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="stats-grid">
      <nz-card class="main-card"><nz-statistic [nzValue]="todayCount()" [nzTitle]="'FACILITY.BOOKINGS_ON_DAY' | translate"></nz-statistic></nz-card>
      <nz-card class="main-card"><nz-statistic [nzValue]="mine().length" [nzTitle]="'FACILITY.MY_UPCOMING' | translate"></nz-statistic></nz-card>
      <nz-card class="main-card"><nz-statistic [nzValue]="spaces().length" [nzTitle]="'FACILITY.BOOKABLE_SPACES' | translate"></nz-statistic></nz-card>
    </div>

    <nz-card class="main-card">
      <nz-tabs>
        <nz-tab [nzTitle]="'FACILITY.TAB_CALENDAR' | translate">
          <div class="toolbar">
            <input nz-input type="date" style="width: 170px" [ngModel]="day()" (ngModelChange)="day.set($event); loadDay()" [attr.aria-label]="'FACILITY.DAY' | translate" />
            <nz-select style="width: 200px" nzAllowClear [ngModel]="buildingId()" (ngModelChange)="buildingId.set($event); loadSpaces()" [nzPlaceHolder]="'FACILITY.BUILDING' | translate">
              @for (building of buildings(); track building.id) {
                <nz-option [nzValue]="building.id" [nzLabel]="building.code + ' - ' + building.name"></nz-option>
              }
            </nz-select>
            <nz-select style="width: 180px" nzAllowClear [ngModel]="kind()" (ngModelChange)="kind.set($event); loadSpaces()" [nzPlaceHolder]="'FACILITY.KIND' | translate">
              @for (value of kinds; track value) {
                <nz-option [nzValue]="value" [nzLabel]="('FACILITY.KIND_' + value) | translate"></nz-option>
              }
            </nz-select>
          </div>

          @if (rows().length === 0 && !loading()) {
            <nz-empty [nzNotFoundContent]="'FACILITY.NO_BOOKABLE_SPACES' | translate"></nz-empty>
          } @else {
            <div style="overflow-x: auto">
              <div class="timeline" [style.--hours]="hours.length">
                <div class="timeline-head">
                  <div></div>
                  <div class="hours">
                    @for (hour of hours; track hour) {
                      <span>{{ hour }}</span>
                    }
                  </div>
                </div>
                @for (row of rows(); track row.space.id) {
                  <div class="timeline-row">
                    <div class="label">
                      <strong>{{ row.space.code }}</strong> {{ row.space.name }}
                      <div class="muted">{{ ('FACILITY.KIND_' + row.space.kind) | translate }} · {{ row.space.capacity }}</div>
                    </div>
                    <div class="track" (click)="onTrackClick($event, row.space)">
                      @for (item of row.slots; track item.booking.id) {
                        <div
                          class="slot"
                          [class.checked_in]="item.booking.status === 'checked_in'"
                          [class.mine]="item.booking.user_id === userId()"
                          [style.left.%]="item.slot.left"
                          [style.width.%]="item.slot.width"
                          [title]="(item.booking.user?.name ?? '') + ' ' + (item.booking.title ?? '')"
                          (click)="$event.stopPropagation()"
                        >
                          {{ item.booking.user?.name }} {{ item.booking.title }}
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </nz-tab>

        <nz-tab [nzTitle]="'FACILITY.TAB_MINE' | translate">
          <nz-table #table [nzData]="mine()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
            <thead>
              <tr>
                <th>{{ 'FACILITY.SPACE' | translate }}</th>
                <th>{{ 'FACILITY.STARTS_AT' | translate }}</th>
                <th>{{ 'FACILITY.ENDS_AT' | translate }}</th>
                <th>{{ 'FACILITY.TITLE' | translate }}</th>
                <th>{{ 'FACILITY.STATUS' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of table.data; track row.id) {
                <tr>
                  <td>{{ row.space?.code }} {{ row.space?.name }}</td>
                  <td>{{ row.starts_at | date: 'short' }}</td>
                  <td>{{ row.ends_at | date: 'short' }}</td>
                  <td>{{ row.title }}</td>
                  <td><nz-tag [nzColor]="row.status === 'checked_in' ? 'green' : 'blue'">{{ ('FACILITY.BOOKING_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
                  <td>
                    @if (row.status === 'booked') {
                      <button nz-button nzSize="small" (click)="checkIn(row)">{{ 'FACILITY.CHECK_IN' | translate }}</button>
                      <button nz-button nzSize="small" nzDanger nz-popconfirm [nzPopconfirmTitle]="'FACILITY.CANCEL_BOOKING_CONFIRM' | translate" (nzOnConfirm)="cancel(row)">{{ 'FACILITY.CANCEL' | translate }}</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (!loading() && mine().length === 0) {
            <nz-empty [nzNotFoundContent]="'FACILITY.NO_BOOKINGS' | translate"></nz-empty>
          }
        </nz-tab>
      </nz-tabs>
    </nz-card>

    <nz-modal [(nzVisible)]="modalVisible" [nzTitle]="'FACILITY.NEW_BOOKING' | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid || !canSave()" nzWidth="680px">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'FACILITY.SPACE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="space_id" nzShowSearch>
                @for (space of spaces(); track space.id) {
                  <nz-option [nzValue]="space.id" [nzLabel]="space.code + ' - ' + space.name + ' (' + space.capacity + ')'"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.STARTS_AT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="datetime-local" formControlName="starts_at" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.ENDS_AT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="datetime-local" formControlName="ends_at" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.TITLE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="title" maxlength="150" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.ATTENDEES' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="1" formControlName="attendees" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label>{{ 'FACILITY.RECURRING' | translate }}</nz-form-label>
            <nz-form-control><nz-switch formControlName="recurring"></nz-switch></nz-form-control>
          </nz-form-item>
          @if (form.controls.recurring.value) {
            <div class="form-row">
              <nz-form-item>
                <nz-form-label>{{ 'FACILITY.RECURRENCE' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="recurrence">
                    <nz-option nzValue="daily" [nzLabel]="'FACILITY.RECURRENCE_DAILY' | translate"></nz-option>
                    <nz-option nzValue="weekly" [nzLabel]="'FACILITY.RECURRENCE_WEEKLY' | translate"></nz-option>
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired>{{ 'FACILITY.UNTIL_DATE' | translate }}</nz-form-label>
                <nz-form-control><input nz-input type="date" formControlName="until_date" /></nz-form-control>
              </nz-form-item>
            </div>
            @if (form.controls.recurrence.value === 'weekly') {
              <nz-form-item>
                <nz-form-label>{{ 'FACILITY.WEEKDAYS' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="weekdays" nzMode="multiple">
                    @for (weekday of weekdays; track weekday) {
                      <nz-option [nzValue]="weekday" [nzLabel]="('FACILITY.WEEKDAY_' + weekday) | translate"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            }
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.SKIP_CONFLICTS' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'FACILITY.SKIP_CONFLICTS_HINT' | translate"><nz-switch formControlName="skip_conflicts"></nz-switch></nz-form-control>
            </nz-form-item>
          } @else if (check(); as result) {
            <div class="feedback" [class.ok]="result.available" [class.bad]="!result.available" role="status">
              @if (result.available) {
                <i class="fa-solid fa-circle-check" aria-hidden="true"></i> {{ 'FACILITY.SLOT_FREE' | translate }}
              } @else {
                <i class="fa-solid fa-circle-xmark" aria-hidden="true"></i> <strong>{{ 'FACILITY.SLOT_NOT_AVAILABLE' | translate }}</strong>
                <ul class="conflict-list">
                  @for (violation of result.violations; track violation.code) {
                    <li>{{ violation.message }}</li>
                  }
                  @for (conflict of result.conflicts; track conflict.id) {
                    <li>
                      {{ conflict.user?.name }} {{ conflict.title }}: {{ conflict.starts_at | date: 'shortTime' }} - {{ conflict.ends_at | date: 'shortTime' }}
                    </li>
                  }
                </ul>
              }
            </div>
          }
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class FacilityBookingsComponent implements OnInit {
  private readonly api = inject(FacilityApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly kinds = FACILITY_BOOKABLE_KINDS;
  readonly weekdays = [1, 2, 3, 4, 5, 6, 7];
  readonly hours = Array.from({ length: TO_HOUR - FROM_HOUR }, (_, index) => FROM_HOUR + index);

  readonly day = signal(todayIso());
  readonly buildingId = signal<string | null>(null);
  readonly kind = signal<string | null>(null);
  readonly buildings = signal<FacilityBuilding[]>([]);
  readonly spaces = signal<FacilitySpace[]>([]);
  readonly bookings = signal<FacilityBooking[]>([]);
  readonly mine = signal<FacilityBooking[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly check = signal<FacilityBookingCheckResult | null>(null);
  readonly userId = computed(() => this.authStore.user()?.id ?? null);
  readonly todayCount = computed(() => this.bookings().length);

  readonly rows = computed(() =>
    this.spaces().map((space) => ({
      space,
      slots: this.bookings()
        .filter((booking) => booking.space_id === space.id)
        .map((booking) => ({ booking, slot: timelineSlot(booking.starts_at, booking.ends_at, this.day(), FROM_HOUR, TO_HOUR) }))
        .filter((item): item is { booking: FacilityBooking; slot: { left: number; width: number } } => item.slot !== null),
    })),
  );

  readonly form = this.fb.group({
    space_id: ['', [Validators.required]],
    starts_at: ['', [Validators.required]],
    ends_at: ['', [Validators.required]],
    title: ['', [Validators.maxLength(150)]],
    attendees: [null as number | null, [Validators.min(1)]],
    recurring: [false],
    recurrence: ['weekly' as 'daily' | 'weekly'],
    weekdays: [[1] as number[]],
    until_date: [''],
    skip_conflicts: [false],
  });

  /** A single booking needs a free slot; a series is validated by the API as a whole. */
  readonly canSave = computed(() => this.form.controls.recurring.value || (this.check()?.available ?? false));

  constructor() {
    this.form.valueChanges
      .pipe(
        tap(() => {
          if (this.form.controls.recurring.value) {
            this.check.set(null);
          }
        }),
        debounceTime(300),
        filter(() => this.modalVisible() && !this.form.controls.recurring.value && this.form.controls.space_id.valid && this.form.controls.starts_at.valid && this.form.controls.ends_at.valid),
        switchMap(() => {
          const value = this.form.getRawValue();
          return this.api
            .checkBooking({
              space_id: value.space_id,
              starts_at: localInputToInstant(value.starts_at),
              ends_at: localInputToInstant(value.ends_at),
              attendees: value.attendees,
            })
            .pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => this.check.set(response?.data ?? null));
  }

  ngOnInit(): void {
    this.api.getBuildings({ active: true, per_page: 100 }).subscribe({ next: (response) => this.buildings.set(response.data) });
    this.loadSpaces();
    this.loadMine();
  }

  loadSpaces(): void {
    this.api.getSpaces({ bookable: true, active: true, building_id: this.buildingId() ?? undefined, kind: this.kind() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.spaces.set(response.data);
        this.loadDay();
      },
      error: () => this.message.error(this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  loadDay(): void {
    this.loading.set(true);
    this.api.getBookings({ from: this.day(), to: this.day(), active: true, building_id: this.buildingId() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.bookings.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('FACILITY.ACTION_ERROR'));
      },
    });
  }

  loadMine(): void {
    this.api.getBookings({ mine: true, active: true, from: todayIso(), per_page: 100 }).subscribe({ next: (response) => this.mine.set(response.data) });
  }

  onTrackClick(event: MouseEvent, space: FacilitySpace): void {
    const track = event.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    const hour = Math.min(TO_HOUR - 1, Math.max(FROM_HOUR, Math.floor(FROM_HOUR + ratio * (TO_HOUR - FROM_HOUR))));
    const start = new Date(`${this.day()}T${String(hour).padStart(2, '0')}:00`);

    this.openModal(space.id, start);
  }

  openModal(spaceId: string = this.spaces()[0]?.id ?? '', start: Date = nextFullHour()): void {
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    this.check.set(null);
    this.form.reset({
      space_id: spaceId,
      starts_at: toLocalInput(start),
      ends_at: toLocalInput(end),
      title: '',
      attendees: null,
      recurring: false,
      recurrence: 'weekly',
      weekdays: [start.getDay() === 0 ? 7 : start.getDay()],
      until_date: '',
      skip_conflicts: false,
    });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();

    if (value.recurring) {
      const payload: FacilityBookingSeriesRequest = {
        space_id: value.space_id,
        recurrence: value.recurrence,
        weekdays: value.recurrence === 'weekly' ? value.weekdays : null,
        start_date: value.starts_at.slice(0, 10),
        until_date: value.until_date,
        start_time: value.starts_at.slice(11, 16),
        end_time: value.ends_at.slice(11, 16),
        title: value.title || null,
        skip_conflicts: value.skip_conflicts,
      };

      this.api.createBookingSeries(payload).subscribe({
        next: (response) => {
          const skipped = response.data.skipped.length;
          this.message.success(this.translate.instant('FACILITY.SERIES_SAVED', { count: response.data.created }));
          if (skipped > 0) {
            this.message.warning(this.translate.instant('FACILITY.SERIES_SKIPPED', { count: skipped, dates: response.data.skipped.map((item) => item.date).join(', ') }));
          }
          this.afterSave();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
      });
      return;
    }

    const payload: FacilityBookingRequest = {
      space_id: value.space_id,
      starts_at: localInputToInstant(value.starts_at),
      ends_at: localInputToInstant(value.ends_at),
      title: value.title || null,
      attendees: value.attendees,
    };

    this.api.createBooking(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('FACILITY.BOOKING_SAVED'));
        this.afterSave();
      },
      error: (error: unknown) => {
        this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR'));
        this.refreshCheck();
      },
    });
  }

  checkIn(booking: FacilityBooking): void {
    this.api.checkInBooking(booking.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('FACILITY.CHECKED_IN'));
        this.reload();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  cancel(booking: FacilityBooking): void {
    this.api.cancelBooking(booking.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('FACILITY.BOOKING_CANCELLED'));
        this.reload();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  private refreshCheck(): void {
    const value = this.form.getRawValue();
    if (!value.space_id || !value.starts_at || !value.ends_at) {
      return;
    }

    this.api
      .checkBooking({ space_id: value.space_id, starts_at: localInputToInstant(value.starts_at), ends_at: localInputToInstant(value.ends_at), attendees: value.attendees })
      .subscribe({ next: (response) => this.check.set(response.data) });
  }

  private afterSave(): void {
    this.modalVisible.set(false);
    this.reload();
  }

  private reload(): void {
    this.loadDay();
    this.loadMine();
  }
}
