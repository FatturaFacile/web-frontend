import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import {
  PassengerTransportApiService,
  PtrComplianceIssue,
  PtrComplianceResult,
  PtrFlightResult,
  PtrTimelineBooking,
  PtrTimelineDriver,
  PtrTimelineVehicle,
} from '@core';
import { TranslatePipe } from '@shared';
import { IssueListComponent } from './issue-list.component';
import {
  clockMinutes,
  failureOf,
  flightStatusColor,
  isAssignable,
  PtrOutcome,
} from './passenger-transport.util';

/**
 * Quick assignment of a driver and a vehicle to a trip. "Check" simulates the trip against the documents of the driver, the overlaps
 * and OLR 1 / OLR 2 / Reg. (EC) 561/2006 without saving; "Assign" saves it unless a blocking violation is found, and asks to
 * acknowledge the warnings first.
 */
@Component({
  selector: 'app-ptr-assign-drawer',
  imports: [
    DatePipe,
    FormsModule,
    IssueListComponent,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTagModule,
    RouterLink,
    TranslatePipe,
  ],
  styleUrl: './passenger-transport.scss',
  template: `
    <nz-drawer
      [nzVisible]="booking() !== null"
      [nzWidth]="480"
      [nzTitle]="'passengerTransport.section.quickAssign' | translate"
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        @if (booking(); as trip) {
          <nz-descriptions nzSize="small" [nzColumn]="1">
            <nz-descriptions-item [nzTitle]="'passengerTransport.field.bookingCode' | translate">{{
              trip.booking_code
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'passengerTransport.field.pickup' | translate">
              {{ trip.pickup_datetime | date: 'dd/MM/yyyy HH:mm' }} · {{ trip.pickup_address }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'passengerTransport.field.dropoff' | translate">{{
              trip.dropoff_address
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'passengerTransport.field.passengers' | translate">{{
              trip.passengers_count
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'passengerTransport.field.status' | translate">
              <nz-tag>{{ 'passengerTransport.bookingStatus.' + trip.status | translate }}</nz-tag>
              @if (trip.cross_border) {
                <nz-tag nzColor="purple">{{
                  'passengerTransport.borderCrossing.' + trip.border_crossing_point | translate
                }}</nz-tag>
              }
            </nz-descriptions-item>
            @if (trip.flight_or_train_number) {
              <nz-descriptions-item [nzTitle]="'passengerTransport.field.flight' | translate">
                {{ trip.flight_or_train_number }}
                <nz-tag [nzColor]="flightColor(trip.flight_status)">
                  @if (trip.flight_status) {
                    {{ 'passengerTransport.flightStatus.' + trip.flight_status | translate }}
                  }
                  @if (trip.flight_delay_minutes !== 0) {
                    {{ trip.flight_delay_minutes > 0 ? '+' : '' }}{{ trip.flight_delay_minutes }}'
                  }
                </nz-tag>
              </nz-descriptions-item>
            }
          </nz-descriptions>

          @if (flight(); as result) {
            <nz-alert
              class="feedback"
              [nzType]="result.adjusted ? 'warning' : 'info'"
              nzShowIcon
              [nzMessage]="
                (result.adjusted
                  ? 'passengerTransport.hint.pickupMoved'
                  : 'passengerTransport.hint.pickupHolds'
                ) | translate
              "
            ></nz-alert>
            @if (result.conflicts.length > 0) {
              <app-ptr-issue-list [issues]="result.conflicts"></app-ptr-issue-list>
            }
          }

          @if (assignable()) {
            <div class="form">
              <label class="field" for="ptr-assign-vehicle">
                <span>{{ 'passengerTransport.field.vehicle' | translate }}</span>
                <nz-select
                  nzId="ptr-assign-vehicle"
                  nzShowSearch
                  [ngModel]="vehicleId()"
                  (ngModelChange)="vehicleId.set($event); reset()"
                >
                  @for (vehicle of vehicles(); track vehicle.id) {
                    <nz-option
                      [nzValue]="vehicle.id"
                      [nzLabel]="vehicle.license_plate + ' · ' + vehicle.passenger_capacity"
                    ></nz-option>
                  }
                </nz-select>
              </label>
              <label class="field" for="ptr-assign-driver">
                <span>{{ 'passengerTransport.field.driver' | translate }}</span>
                <nz-select
                  nzId="ptr-assign-driver"
                  nzShowSearch
                  [ngModel]="driverId()"
                  (ngModelChange)="driverId.set($event); reset()"
                >
                  @for (driver of drivers(); track driver.id) {
                    <nz-option
                      [nzValue]="driver.id"
                      [nzLabel]="
                        (driver.name ?? driver.id) + ' · ' + clock(driver.gauges.remaining_minutes)
                      "
                    ></nz-option>
                  }
                </nz-select>
              </label>
              <label class="field" for="ptr-assign-break">
                <span>{{ 'passengerTransport.field.plannedBreak' | translate }}</span>
                <nz-input-number
                  nzId="ptr-assign-break"
                  [nzMin]="0"
                  [nzMax]="600"
                  [nzStep]="15"
                  [ngModel]="breakMinutes()"
                  (ngModelChange)="breakMinutes.set($event ?? 0); reset()"
                ></nz-input-number>
              </label>
            </div>

            @if (error(); as failure) {
              <nz-alert
                class="feedback"
                nzType="error"
                nzShowIcon
                [nzMessage]="
                  failure.errorKey ?? 'passengerTransport.error.generic' | translate: failure.params
                "
                [nzDescription]="failure.detail ?? undefined"
              ></nz-alert>
            }

            @if (result(); as check) {
              <div class="section-title">
                {{ 'passengerTransport.section.compliance' | translate }}
                <nz-tag>{{
                  'passengerTransport.drivingRegime.' + check.regime | translate
                }}</nz-tag>
              </div>
              @if (issues().length === 0) {
                <nz-alert
                  nzType="success"
                  nzShowIcon
                  [nzMessage]="'passengerTransport.hint.noFindings' | translate"
                ></nz-alert>
              } @else {
                <app-ptr-issue-list [issues]="issues()"></app-ptr-issue-list>
              }
              <p class="muted">
                {{ 'passengerTransport.field.remaining' | translate }}:
                {{ clock(check.remaining_minutes) }}
              </p>
            }

            @if (needsAcknowledgement()) {
              <label
                nz-checkbox
                for="ptr-cb-1"
                nzId="ptr-cb-1"
                [ngModel]="acknowledged()"
                (ngModelChange)="acknowledged.set($event)"
              >
                {{ 'passengerTransport.action.acknowledgeWarnings' | translate }}
              </label>
            }

            <div class="actions">
              <button nz-button type="button" [disabled]="!ready() || busy()" (click)="check()">
                {{ 'passengerTransport.action.checkCompliance' | translate }}
              </button>
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="!ready() || busy() || blocked()"
                (click)="assign()"
              >
                {{ 'passengerTransport.action.assign' | translate }}
              </button>
            </div>
          }

          <div class="actions">
            @if (trip.flight_or_train_number) {
              <button nz-button type="button" [disabled]="busy()" (click)="track()">
                {{ 'passengerTransport.action.trackFlight' | translate }}
              </button>
            }
            <a nz-button [routerLink]="['/passenger-transport/bookings', trip.id, 'sheet']">
              {{ 'passengerTransport.action.openSheet' | translate }}
            </a>
          </div>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class AssignDrawerComponent {
  private readonly api = inject(PassengerTransportApiService);

  readonly booking = input<PtrTimelineBooking | null>(null);
  readonly vehicles = input<readonly PtrTimelineVehicle[]>([]);
  readonly drivers = input<readonly PtrTimelineDriver[]>([]);
  readonly closed = output<void>();
  /** The booking changed (assigned, flight tracked): the board reloads. */
  readonly changed = output<void>();

  protected readonly vehicleId = signal<string | null>(null);
  protected readonly driverId = signal<string | null>(null);
  protected readonly breakMinutes = signal(0);
  protected readonly acknowledged = signal(false);
  protected readonly result = signal<PtrComplianceResult | null>(null);
  protected readonly refused = signal<PtrComplianceIssue[]>([]);
  protected readonly flight = signal<PtrFlightResult | null>(null);
  protected readonly error = signal<PtrOutcome | null>(null);
  protected readonly busy = signal(false);

  protected readonly assignable = computed(() => {
    const trip = this.booking();
    return trip !== null && isAssignable(trip.status);
  });
  protected readonly ready = computed(() => this.vehicleId() !== null && this.driverId() !== null);
  /** The findings to show: those of the last check, or of the last refusal. */
  protected readonly issues = computed(() =>
    this.refused().length > 0 ? this.refused() : (this.result()?.issues ?? []),
  );
  protected readonly blocked = computed(() =>
    this.issues().some((issue) => issue.severity === 'blocking'),
  );
  protected readonly needsAcknowledgement = computed(
    () => !this.blocked() && this.issues().some((issue) => issue.severity === 'warning'),
  );

  protected readonly clock = clockMinutes;
  protected readonly flightColor = flightStatusColor;

  constructor() {
    // A new trip starts from a clean form.
    effect(() => {
      this.booking();
      this.vehicleId.set(null);
      this.driverId.set(null);
      this.breakMinutes.set(0);
      this.reset();
      this.flight.set(null);
    });
  }

  protected reset(): void {
    this.result.set(null);
    this.refused.set([]);
    this.error.set(null);
    this.acknowledged.set(false);
  }

  protected async check(): Promise<void> {
    await this.run(true);
  }

  protected async assign(): Promise<void> {
    await this.run(false);
  }

  protected async track(): Promise<void> {
    const trip = this.booking();
    if (trip === null) {
      return;
    }
    this.busy.set(true);
    try {
      const response = await firstValueFrom(this.api.trackFlight(trip.id));
      this.flight.set(response.data.flight);
      this.changed.emit();
    } catch (error) {
      this.error.set(failureOf(error));
    } finally {
      this.busy.set(false);
    }
  }

  private async run(dryRun: boolean): Promise<void> {
    const trip = this.booking();
    const vehicleId = this.vehicleId();
    const driverId = this.driverId();
    if (trip === null || vehicleId === null || driverId === null) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.refused.set([]);
    try {
      const response = await firstValueFrom(
        this.api.assignBooking(trip.id, {
          vehicle_id: vehicleId,
          driver_employee_id: driverId,
          planned_break_minutes: this.breakMinutes(),
          acknowledge_warnings: this.acknowledged(),
          dry_run: dryRun,
        }),
      );
      this.result.set(response.data.compliance);
      if (!dryRun) {
        this.changed.emit();
        this.closed.emit();
      }
    } catch (error) {
      const outcome = failureOf(error);
      if (outcome.issues.length > 0) {
        this.refused.set(outcome.issues);
        this.result.set(null);
      }
      if (
        outcome.code !== 'assignment_blocked' &&
        outcome.code !== 'assignment_warnings_unacknowledged'
      ) {
        this.error.set(outcome);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
