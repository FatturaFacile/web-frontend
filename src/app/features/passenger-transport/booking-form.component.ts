import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { debounceTime, firstValueFrom } from 'rxjs';
import {
  PassengerTransportApiService,
  PTR_BORDER_CROSSINGS,
  PTR_SERVICE_TYPES,
  PtrAirport,
  PtrBooking,
  PtrBookingPayload,
  PtrBorderCrossing,
  PtrBorderCrossingRef,
  PtrJurisdiction,
  PtrPersonRef,
  PtrQuote,
  PtrServiceType,
} from '@core';
import { TranslatePipe } from '@shared';
import { PtrOutcome, parseInstant, toApiDateTime, toNumber } from './passenger-transport.util';
import { VatSplitPanelComponent } from './vat-split-panel.component';

const COUNTRIES = ['IT', 'CH', 'DE', 'FR', 'AT'] as const;

/**
 * The booking form: service type, guests, flight lookup, route with the CH-IT border crossing and the fare. Every change reprices the
 * trip, so the dispatcher sees the kilometres of Italy and Switzerland and the VAT split (10 % Italian VAT, outside the Italian
 * territory, 8.1 % Swiss MWST) before saving.
 */
@Component({
  selector: 'app-ptr-booking-form',
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    ReactiveFormsModule,
    TranslatePipe,
    VatSplitPanelComponent,
  ],
  styleUrl: './passenger-transport.scss',
  template: `
    <form [formGroup]="form" class="form" (ngSubmit)="submit()">
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

      <div class="section-title">{{ 'passengerTransport.section.service' | translate }}</div>
      <div class="form-grid">
        <label class="field" for="ptr-b-type">
          <span>{{ 'passengerTransport.field.serviceType' | translate }}</span>
          <nz-select nzId="ptr-b-type" formControlName="service_type">
            @for (type of serviceTypes; track type) {
              <nz-option
                [nzValue]="type"
                [nzLabel]="'passengerTransport.serviceType.' + type | translate"
              ></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="ptr-b-customer">
          <span>{{ 'passengerTransport.field.customer' | translate }}</span>
          <nz-select
            nzId="ptr-b-customer"
            nzShowSearch
            nzServerSearch
            nzAllowClear
            formControlName="ordering_customer_id"
            (nzOnSearch)="searchContacts($event)"
          >
            @for (contact of contactOptions(); track contact.id) {
              <nz-option [nzValue]="contact.id" [nzLabel]="contact.name"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="ptr-b-lead">
          <span>{{ 'passengerTransport.field.leadPassenger' | translate }}</span>
          <input nz-input id="ptr-b-lead" formControlName="lead_passenger_name" maxlength="160" />
        </label>
        <label class="field" for="ptr-b-phone">
          <span>{{ 'passengerTransport.field.phone' | translate }}</span>
          <input nz-input id="ptr-b-phone" formControlName="lead_passenger_phone" maxlength="40" />
        </label>
        <label class="field" for="ptr-b-sign">
          <span>{{ 'passengerTransport.field.welcomeText' | translate }}</span>
          <input nz-input id="ptr-b-sign" formControlName="vip_welcome_sign_text" maxlength="200" />
        </label>
        <label class="field" for="ptr-b-pax">
          <span>{{ 'passengerTransport.field.passengers' | translate }}</span>
          <nz-input-number
            nzId="ptr-b-pax"
            formControlName="passengers_count"
            [nzMin]="1"
            [nzMax]="100"
          ></nz-input-number>
        </label>
        <label class="field" for="ptr-b-luggage">
          <span>{{ 'passengerTransport.field.luggage' | translate }}</span>
          <nz-input-number
            nzId="ptr-b-luggage"
            formControlName="luggage_count"
            [nzMin]="0"
            [nzMax]="200"
          ></nz-input-number>
        </label>
        <label class="field" for="ptr-b-infant">
          <span>{{ 'passengerTransport.field.infantSeats' | translate }}</span>
          <nz-input-number
            nzId="ptr-b-infant"
            formControlName="infant"
            [nzMin]="0"
            [nzMax]="10"
          ></nz-input-number>
        </label>
        <label class="field" for="ptr-b-child">
          <span>{{ 'passengerTransport.field.childSeats' | translate }}</span>
          <nz-input-number
            nzId="ptr-b-child"
            formControlName="child"
            [nzMin]="0"
            [nzMax]="10"
          ></nz-input-number>
        </label>
        <label class="field" for="ptr-b-booster">
          <span>{{ 'passengerTransport.field.boosterSeats' | translate }}</span>
          <nz-input-number
            nzId="ptr-b-booster"
            formControlName="booster"
            [nzMin]="0"
            [nzMax]="10"
          ></nz-input-number>
        </label>
      </div>
      <label class="field" for="ptr-b-access">
        <span>{{ 'passengerTransport.field.accessibility' | translate }}</span>
        <textarea
          nz-input
          id="ptr-b-access"
          rows="2"
          maxlength="2000"
          formControlName="accessibility_notes"
        ></textarea>
      </label>

      <div class="section-title">{{ 'passengerTransport.section.flight' | translate }}</div>
      <div class="form-grid">
        <label class="field" for="ptr-b-flight">
          <span>{{ 'passengerTransport.field.flightNumber' | translate }}</span>
          <input
            nz-input
            id="ptr-b-flight"
            formControlName="flight_or_train_number"
            maxlength="20"
          />
        </label>
        <label class="field" for="ptr-b-carrier">
          <span>{{ 'passengerTransport.field.carrierIata' | translate }}</span>
          <input nz-input id="ptr-b-carrier" formControlName="flight_carrier_iata" maxlength="3" />
        </label>
        <label class="field" for="ptr-b-airport">
          <span>{{ 'passengerTransport.field.arrivalAirport' | translate }}</span>
          <nz-select
            nzId="ptr-b-airport"
            nzAllowClear
            formControlName="arrival_airport_iata"
            (ngModelChange)="onAirport($event)"
          >
            @for (airport of airports(); track airport.iata) {
              <nz-option
                [nzValue]="airport.iata"
                [nzLabel]="airport.iata + ' · ' + airport.country"
              ></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="ptr-b-arrival">
          <span>{{ 'passengerTransport.field.scheduledArrival' | translate }}</span>
          <nz-date-picker
            nzId="ptr-b-arrival"
            nzShowTime
            nzFormat="dd/MM/yyyy HH:mm"
            formControlName="scheduled_flight_arrival_at"
          ></nz-date-picker>
        </label>
      </div>

      <div class="section-title">{{ 'passengerTransport.section.route' | translate }}</div>
      <div class="form-grid">
        <label class="field" for="ptr-b-pickup-at">
          <span>{{ 'passengerTransport.field.pickupAt' | translate }}</span>
          <nz-date-picker
            nzId="ptr-b-pickup-at"
            nzShowTime
            nzFormat="dd/MM/yyyy HH:mm"
            formControlName="pickup_datetime"
          ></nz-date-picker>
        </label>
        <label class="field" for="ptr-b-pickup">
          <span>{{ 'passengerTransport.field.pickupAddress' | translate }}</span>
          <input nz-input id="ptr-b-pickup" formControlName="pickup_address" maxlength="255" />
        </label>
        <label class="field" for="ptr-b-pickup-country">
          <span>{{ 'passengerTransport.field.pickupCountry' | translate }}</span>
          <nz-select nzId="ptr-b-pickup-country" formControlName="pickup_country_code">
            @for (country of countries; track country) {
              <nz-option [nzValue]="country" [nzLabel]="country"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="ptr-b-pickup-lat">
          <span>{{ 'passengerTransport.field.pickupLat' | translate }}</span>
          <nz-input-number
            nzId="ptr-b-pickup-lat"
            formControlName="pickup_lat"
            [nzStep]="0.0001"
          ></nz-input-number>
        </label>
        <label class="field" for="ptr-b-pickup-lng">
          <span>{{ 'passengerTransport.field.pickupLng' | translate }}</span>
          <nz-input-number
            nzId="ptr-b-pickup-lng"
            formControlName="pickup_lng"
            [nzStep]="0.0001"
          ></nz-input-number>
        </label>
        <label class="field" for="ptr-b-dropoff">
          <span>{{ 'passengerTransport.field.dropoffAddress' | translate }}</span>
          <input nz-input id="ptr-b-dropoff" formControlName="dropoff_address" maxlength="255" />
        </label>
        <label class="field" for="ptr-b-dropoff-country">
          <span>{{ 'passengerTransport.field.dropoffCountry' | translate }}</span>
          <nz-select nzId="ptr-b-dropoff-country" formControlName="dropoff_country_code">
            @for (country of countries; track country) {
              <nz-option [nzValue]="country" [nzLabel]="country"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="ptr-b-dropoff-lat">
          <span>{{ 'passengerTransport.field.dropoffLat' | translate }}</span>
          <nz-input-number
            nzId="ptr-b-dropoff-lat"
            formControlName="dropoff_lat"
            [nzStep]="0.0001"
          ></nz-input-number>
        </label>
        <label class="field" for="ptr-b-dropoff-lng">
          <span>{{ 'passengerTransport.field.dropoffLng' | translate }}</span>
          <nz-input-number
            nzId="ptr-b-dropoff-lng"
            formControlName="dropoff_lng"
            [nzStep]="0.0001"
          ></nz-input-number>
        </label>
        <label class="field" for="ptr-b-crossing">
          <span>{{ 'passengerTransport.field.borderCrossing' | translate }}</span>
          <nz-select nzId="ptr-b-crossing" formControlName="border_crossing_point">
            @for (crossing of crossingOptions(); track crossing) {
              <nz-option
                [nzValue]="crossing"
                [nzLabel]="'passengerTransport.borderCrossing.' + crossing | translate"
              ></nz-option>
            }
          </nz-select>
        </label>
      </div>
      <p class="muted">{{ 'passengerTransport.hint.kilometresManual' | translate }}</p>
      <div class="form-grid">
        <label class="field" for="ptr-b-km">
          <span>{{ 'passengerTransport.field.totalKm' | translate }}</span>
          <nz-input-number
            nzId="ptr-b-km"
            formControlName="total_distance_km"
            [nzMin]="0"
          ></nz-input-number>
        </label>
        <label class="field" for="ptr-b-it-km">
          <span>{{ 'passengerTransport.field.itKm' | translate }}</span>
          <nz-input-number
            nzId="ptr-b-it-km"
            formControlName="it_territory_km"
            [nzMin]="0"
          ></nz-input-number>
        </label>
        <label class="field" for="ptr-b-ch-km">
          <span>{{ 'passengerTransport.field.chKm' | translate }}</span>
          <nz-input-number
            nzId="ptr-b-ch-km"
            formControlName="ch_territory_km"
            [nzMin]="0"
          ></nz-input-number>
        </label>
      </div>

      <div class="section-title">{{ 'passengerTransport.section.fare' | translate }}</div>
      <div class="form-grid">
        <label class="field" for="ptr-b-price">
          <span>{{ 'passengerTransport.field.agreedPrice' | translate }}</span>
          <nz-input-number
            nzId="ptr-b-price"
            formControlName="agreed_price_net"
            [nzMin]="0"
            [nzStep]="10"
            [nzPrecision]="2"
          ></nz-input-number>
        </label>
        <label class="field" for="ptr-b-currency">
          <span>{{ 'passengerTransport.field.currency' | translate }}</span>
          <nz-select nzId="ptr-b-currency" formControlName="currency">
            @for (code of currencies(); track code) {
              <nz-option [nzValue]="code" [nzLabel]="code"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="ptr-b-commission">
          <span>{{ 'passengerTransport.field.commissionRate' | translate }}</span>
          <nz-input-number
            nzId="ptr-b-commission"
            formControlName="hotel_concierge_commission_rate"
            [nzMin]="0"
            [nzMax]="100"
            [nzStep]="0.5"
          ></nz-input-number>
        </label>
      </div>
      <label nz-checkbox for="ptr-cb-1" nzId="ptr-cb-1" formControlName="municipal_urban_service">{{
        'passengerTransport.field.municipalUrban' | translate
      }}</label>
      @if (jurisdiction() === 'CH') {
        <label nz-checkbox for="ptr-cb-2" nzId="ptr-cb-2" formControlName="vat_exemption_art23">{{
          'passengerTransport.field.art23Exemption' | translate
        }}</label>
      }

      <app-ptr-vat-split-panel
        [quote]="quote()"
        [quoting]="quoting()"
        [jurisdiction]="jurisdiction()"
      ></app-ptr-vat-split-panel>

      <div class="actions">
        <button
          nz-button
          nzType="primary"
          type="submit"
          [nzLoading]="saving()"
          [disabled]="form.invalid"
        >
          {{ 'passengerTransport.action.save' | translate }}
        </button>
        <button nz-button type="button" (click)="cancelled.emit()">
          {{ 'passengerTransport.action.cancel' | translate }}
        </button>
      </div>
    </form>
  `,
})
export class BookingFormComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly api = inject(PassengerTransportApiService);
  private readonly destroyRef = inject(DestroyRef);

  /** The booking to edit; null creates a new one. */
  readonly booking = input<PtrBooking | null>(null);
  readonly airports = input<readonly PtrAirport[]>([]);
  readonly crossings = input<readonly PtrBorderCrossingRef[]>([]);
  readonly currencies = input<readonly string[]>(['CHF', 'EUR']);
  readonly jurisdiction = input<PtrJurisdiction>('IT');
  readonly quote = input<PtrQuote | null>(null);
  readonly quoting = input(false);
  readonly saving = input(false);
  readonly error = input<PtrOutcome | null>(null);

  readonly submitted = output<PtrBookingPayload>();
  readonly quoteRequested = output<PtrBookingPayload>();
  readonly cancelled = output<void>();

  protected readonly serviceTypes: readonly PtrServiceType[] = PTR_SERVICE_TYPES;
  protected readonly countries = COUNTRIES;
  protected readonly crossingOptions = computed<PtrBorderCrossing[]>(() =>
    this.crossings().length > 0
      ? this.crossings().map((crossing) => crossing.value)
      : [...PTR_BORDER_CROSSINGS],
  );

  protected readonly found = signal<PtrPersonRef[]>([]);
  protected readonly contactOptions = computed(() => {
    const current = this.booking();
    const options = [...this.found()];
    if (
      current?.ordering_customer_id &&
      current.ordering_customer_name &&
      !options.some((option) => option.id === current.ordering_customer_id)
    ) {
      options.push({ id: current.ordering_customer_id, name: current.ordering_customer_name });
    }
    return options;
  });

  protected readonly form = this.fb.group({
    service_type: this.fb.control<PtrServiceType>('airport_transfer', Validators.required),
    ordering_customer_id: this.fb.control<string | null>(null),
    lead_passenger_name: this.fb.control(''),
    lead_passenger_phone: this.fb.control(''),
    vip_welcome_sign_text: this.fb.control(''),
    passengers_count: this.fb.control(1, [Validators.required, Validators.min(1)]),
    luggage_count: this.fb.control(0),
    infant: this.fb.control(0),
    child: this.fb.control(0),
    booster: this.fb.control(0),
    accessibility_notes: this.fb.control(''),
    flight_or_train_number: this.fb.control(''),
    flight_carrier_iata: this.fb.control(''),
    arrival_airport_iata: this.fb.control<string | null>(null),
    scheduled_flight_arrival_at: this.fb.control<Date | null>(null),
    pickup_datetime: this.fb.control<Date | null>(null, Validators.required),
    pickup_address: this.fb.control('', Validators.required),
    pickup_country_code: this.fb.control('IT'),
    pickup_lat: this.fb.control<number | null>(null),
    pickup_lng: this.fb.control<number | null>(null),
    dropoff_address: this.fb.control('', Validators.required),
    dropoff_country_code: this.fb.control('IT'),
    dropoff_lat: this.fb.control<number | null>(null),
    dropoff_lng: this.fb.control<number | null>(null),
    border_crossing_point: this.fb.control<PtrBorderCrossing>('none'),
    total_distance_km: this.fb.control<number | null>(null),
    it_territory_km: this.fb.control<number | null>(null),
    ch_territory_km: this.fb.control<number | null>(null),
    agreed_price_net: this.fb.control(0, [Validators.required, Validators.min(0)]),
    currency: this.fb.control('EUR'),
    hotel_concierge_commission_rate: this.fb.control<number | null>(null),
    municipal_urban_service: this.fb.control(false),
    vat_exemption_art23: this.fb.control(false),
  });

  constructor() {
    effect(() => {
      const current = this.booking();
      if (current !== null) {
        this.fill(current);
      }
    });

    // Every change reprices the trip once the dispatcher stops typing.
    this.form.valueChanges
      .pipe(debounceTime(600), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.form.valid) {
          this.quoteRequested.emit(this.payload());
        }
      });
  }

  protected async searchContacts(term: string): Promise<void> {
    const response = await firstValueFrom(this.api.searchContacts(term)).catch(() => null);
    this.found.set(response?.data ?? []);
  }

  /** Choosing the arrival airport makes it the pickup point: its name, country and position. */
  protected onAirport(iata: string | null): void {
    const airport = this.airports().find((candidate) => candidate.iata === iata);
    if (airport) {
      this.form.patchValue({
        pickup_address: this.form.controls.pickup_address.value || `${airport.iata}`,
        pickup_country_code: airport.country,
        pickup_lat: airport.lat,
        pickup_lng: airport.lng,
      });
    }
  }

  protected submit(): void {
    if (this.form.valid) {
      this.submitted.emit(this.payload());
    }
  }

  private payload(): PtrBookingPayload {
    const value = this.form.getRawValue();
    const text = (input: string): string | null => (input.trim() === '' ? null : input.trim());
    const seats = { infant: value.infant, child: value.child, booster: value.booster };
    const hasSeats = seats.infant + seats.child + seats.booster > 0;

    return {
      service_type: value.service_type,
      ordering_customer_id: value.ordering_customer_id,
      lead_passenger_name: text(value.lead_passenger_name),
      lead_passenger_phone: text(value.lead_passenger_phone),
      vip_welcome_sign_text: text(value.vip_welcome_sign_text),
      passengers_count: value.passengers_count,
      luggage_count: value.luggage_count,
      child_seats_spec: hasSeats ? seats : null,
      accessibility_notes: text(value.accessibility_notes),
      flight_or_train_number: text(value.flight_or_train_number),
      flight_carrier_iata: text(value.flight_carrier_iata)?.toUpperCase() ?? null,
      arrival_airport_iata: value.arrival_airport_iata,
      scheduled_flight_arrival_at: toApiDateTime(value.scheduled_flight_arrival_at),
      pickup_datetime: toApiDateTime(value.pickup_datetime) ?? '',
      pickup_address: value.pickup_address.trim(),
      pickup_country_code: value.pickup_country_code,
      pickup_lat: value.pickup_lat,
      pickup_lng: value.pickup_lng,
      dropoff_address: value.dropoff_address.trim(),
      dropoff_country_code: value.dropoff_country_code,
      dropoff_lat: value.dropoff_lat,
      dropoff_lng: value.dropoff_lng,
      border_crossing_point: value.border_crossing_point,
      ...(value.total_distance_km ? { total_distance_km: value.total_distance_km } : {}),
      ...(value.it_territory_km ? { it_territory_km: value.it_territory_km } : {}),
      ...(value.ch_territory_km ? { ch_territory_km: value.ch_territory_km } : {}),
      agreed_price_net: value.agreed_price_net,
      currency: value.currency,
      municipal_urban_service: value.municipal_urban_service,
      vat_exemption_art23: value.vat_exemption_art23,
      hotel_concierge_commission_rate: value.hotel_concierge_commission_rate,
    };
  }

  private fill(booking: PtrBooking): void {
    const seats = booking.child_seats_spec ?? {};
    this.form.patchValue(
      {
        service_type: booking.service_type,
        ordering_customer_id: booking.ordering_customer_id,
        lead_passenger_name: booking.lead_passenger_name ?? '',
        lead_passenger_phone: booking.lead_passenger_phone ?? '',
        vip_welcome_sign_text: booking.vip_welcome_sign_text ?? '',
        passengers_count: booking.passengers_count,
        luggage_count: booking.luggage_count,
        infant: seats.infant ?? 0,
        child: seats.child ?? 0,
        booster: seats.booster ?? 0,
        accessibility_notes: booking.accessibility_notes ?? '',
        flight_or_train_number: booking.flight_or_train_number ?? '',
        flight_carrier_iata: booking.flight_carrier_iata ?? '',
        arrival_airport_iata: booking.arrival_airport_iata,
        scheduled_flight_arrival_at: parseInstant(booking.scheduled_flight_arrival_at),
        pickup_datetime: parseInstant(booking.pickup_datetime),
        pickup_address: booking.pickup_address,
        pickup_country_code: booking.pickup_country_code,
        pickup_lat: booking.pickup_lat === null ? null : toNumber(booking.pickup_lat),
        pickup_lng: booking.pickup_lng === null ? null : toNumber(booking.pickup_lng),
        dropoff_address: booking.dropoff_address,
        dropoff_country_code: booking.dropoff_country_code,
        dropoff_lat: booking.dropoff_lat === null ? null : toNumber(booking.dropoff_lat),
        dropoff_lng: booking.dropoff_lng === null ? null : toNumber(booking.dropoff_lng),
        border_crossing_point: booking.border_crossing_point,
        total_distance_km: null,
        it_territory_km: null,
        ch_territory_km: null,
        agreed_price_net: toNumber(booking.agreed_price_net),
        currency: booking.currency,
        hotel_concierge_commission_rate:
          booking.hotel_concierge_commission_rate === null
            ? null
            : toNumber(booking.hotel_concierge_commission_rate),
        municipal_urban_service: booking.municipal_urban_service,
        vat_exemption_art23: booking.vat_exemption_art23,
      },
      { emitEvent: false },
    );
    this.quoteRequested.emit(this.payload());
  }
}
