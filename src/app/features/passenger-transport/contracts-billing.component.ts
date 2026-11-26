import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  PermissionsService,
  PTR_BORDER_CROSSINGS,
  PTR_VEHICLE_CATEGORIES,
  PtrBorderCrossing,
  PtrExchangeAction,
  PtrHotelContract,
  PtrRateCardRoute,
  PtrSchoolContract,
  PtrSchoolRateRoute,
  PtrVehicleCategory,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { ContractsBillingStore } from './contracts-billing.store';
import {
  parseInstant,
  PASSENGER_TRANSPORT_FINANCE_MODULE,
  PASSENGER_TRANSPORT_MODULE,
  PtrOutcome,
  toApiDateTime,
  toDateString,
  toNumber,
  toPeriod,
} from './passenger-transport.util';

interface HotelRouteRow {
  route_code: string;
  origin_label: string;
  destination_label: string;
  vehicle_category: PtrVehicleCategory;
  price: number;
  border_crossing: PtrBorderCrossing;
  total_km: number | null;
  it_km: number | null;
  ch_km: number | null;
}

interface SchoolRouteRow {
  route_code: string;
  label: string;
  price: number;
}

const EXCHANGE_ACTIONS: readonly PtrExchangeAction[] = ['cede', 'acquire', 'release'];

/**
 * The B2B side of the module: the hotel concierge portal (contracts with a rate card, bookings at the agreed fare and commission),
 * the school bus contracts, the ledger of the services exchanged with partner carriers and the month-end invoicing wizard that
 * consolidates the completed trips and the monthly flat amounts of every customer.
 */
@Component({
  selector: 'app-ptr-contracts-billing',
  imports: [
    DatePipe,
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [ContractsBillingStore],
  styleUrl: './passenger-transport.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.PASSENGER_TRANSPORT_CONTRACTS_BILLING' | translate"
    ></app-page-header>

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
        [nzDescription]="failure.detail ?? null"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading() || store.saving()">
      <nz-tabs>
        <!-- Hotel concierge portal -->
        <nz-tab [nzTitle]="'passengerTransport.section.concierge' | translate">
          @if (canWrite) {
            <div class="toolbar">
              <span class="spacer"></span>
              <button nz-button nzType="primary" type="button" (click)="openHotel(null)">
                {{ 'passengerTransport.action.newContract' | translate }}
              </button>
            </div>
          }
          <nz-table
            #hotels
            nzSize="small"
            [nzData]="store.hotelContracts()"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '800px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'passengerTransport.field.contract' | translate }}</th>
                <th scope="col">{{ 'passengerTransport.field.customer' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'passengerTransport.field.commissionRate' | translate }}
                </th>
                <th scope="col" class="num">{{ 'passengerTransport.field.routes' | translate }}</th>
                <th scope="col">{{ 'passengerTransport.field.validity' | translate }}</th>
                <th scope="col">{{ 'passengerTransport.field.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (contract of hotels.data; track contract.id) {
                <tr>
                  <th scope="row">
                    {{ contract.code }} · {{ contract.name }}
                    @if (!contract.is_active) {
                      <nz-tag>{{ 'passengerTransport.field.inactive' | translate }}</nz-tag>
                    }
                  </th>
                  <td>{{ contract.contact_name ?? '—' }}</td>
                  <td class="num">{{ contract.commission_rate }} %</td>
                  <td class="num">{{ contract.rate_card.length }}</td>
                  <td>
                    {{ contract.valid_from ? (contract.valid_from | date: 'dd/MM/yyyy') : '…' }} –
                    {{ contract.valid_to ? (contract.valid_to | date: 'dd/MM/yyyy') : '…' }}
                  </td>
                  <td class="row-actions">
                    @if (canWrite) {
                      <button nz-button nzSize="small" type="button" (click)="openHotel(contract)">
                        {{ 'passengerTransport.action.edit' | translate }}
                      </button>
                      <button
                        nz-button
                        nzSize="small"
                        nzDanger
                        type="button"
                        nz-popconfirm
                        [nzPopconfirmTitle]="
                          'passengerTransport.confirm.deleteContract' | translate
                        "
                        [nzOkText]="'passengerTransport.action.confirm' | translate"
                        [nzCancelText]="'passengerTransport.action.cancel' | translate"
                        (nzOnConfirm)="removeHotel(contract)"
                      >
                        {{ 'passengerTransport.action.delete' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <nz-empty
                      [nzNotFoundContent]="'passengerTransport.empty.contracts' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>

          @if (canWrite) {
            <div class="section-title">
              {{ 'passengerTransport.section.conciergeBooking' | translate }}
            </div>
            <form [formGroup]="conciergeForm" class="form" (ngSubmit)="bookConcierge()">
              <div class="form-grid">
                <label class="field" for="ptr-c-contract">
                  <span>{{ 'passengerTransport.field.contract' | translate }}</span>
                  <nz-select nzId="ptr-c-contract" formControlName="contract_id">
                    @for (contract of activeHotels(); track contract.id) {
                      <nz-option
                        [nzValue]="contract.id"
                        [nzLabel]="contract.code + ' · ' + contract.name"
                      ></nz-option>
                    }
                  </nz-select>
                </label>
                <label class="field" for="ptr-c-route">
                  <span>{{ 'passengerTransport.field.route' | translate }}</span>
                  <nz-select nzId="ptr-c-route" formControlName="route_code">
                    @for (route of conciergeRoutes(); track route.route_code) {
                      <nz-option
                        [nzValue]="route.route_code"
                        [nzLabel]="
                          route.origin_label + ' → ' + route.destination_label + ' · ' + route.price
                        "
                      ></nz-option>
                    }
                  </nz-select>
                </label>
                <label class="field" for="ptr-c-pickup">
                  <span>{{ 'passengerTransport.field.pickupAt' | translate }}</span>
                  <nz-date-picker
                    nzId="ptr-c-pickup"
                    nzShowTime
                    nzFormat="dd/MM/yyyy HH:mm"
                    formControlName="pickup_datetime"
                  ></nz-date-picker>
                </label>
                <label class="field" for="ptr-c-lead">
                  <span>{{ 'passengerTransport.field.leadPassenger' | translate }}</span>
                  <input
                    nz-input
                    id="ptr-c-lead"
                    formControlName="lead_passenger_name"
                    maxlength="160"
                  />
                </label>
                <label class="field" for="ptr-c-phone">
                  <span>{{ 'passengerTransport.field.phone' | translate }}</span>
                  <input
                    nz-input
                    id="ptr-c-phone"
                    formControlName="lead_passenger_phone"
                    maxlength="40"
                  />
                </label>
                <label class="field" for="ptr-c-sign">
                  <span>{{ 'passengerTransport.field.welcomeText' | translate }}</span>
                  <input
                    nz-input
                    id="ptr-c-sign"
                    formControlName="vip_welcome_sign_text"
                    maxlength="200"
                  />
                </label>
                <label class="field" for="ptr-c-pax">
                  <span>{{ 'passengerTransport.field.passengers' | translate }}</span>
                  <nz-input-number
                    nzId="ptr-c-pax"
                    formControlName="passengers_count"
                    [nzMin]="1"
                    [nzMax]="100"
                  ></nz-input-number>
                </label>
                <label class="field" for="ptr-c-luggage">
                  <span>{{ 'passengerTransport.field.luggage' | translate }}</span>
                  <nz-input-number
                    nzId="ptr-c-luggage"
                    formControlName="luggage_count"
                    [nzMin]="0"
                    [nzMax]="200"
                  ></nz-input-number>
                </label>
                <label class="field" for="ptr-c-flight">
                  <span>{{ 'passengerTransport.field.flightNumber' | translate }}</span>
                  <input
                    nz-input
                    id="ptr-c-flight"
                    formControlName="flight_or_train_number"
                    maxlength="20"
                  />
                </label>
                <label class="field" for="ptr-c-carrier">
                  <span>{{ 'passengerTransport.field.carrierIata' | translate }}</span>
                  <input
                    nz-input
                    id="ptr-c-carrier"
                    formControlName="flight_carrier_iata"
                    maxlength="3"
                  />
                </label>
                <label class="field" for="ptr-c-arrival">
                  <span>{{ 'passengerTransport.field.scheduledArrival' | translate }}</span>
                  <nz-date-picker
                    nzId="ptr-c-arrival"
                    nzShowTime
                    nzFormat="dd/MM/yyyy HH:mm"
                    formControlName="scheduled_flight_arrival_at"
                  ></nz-date-picker>
                </label>
              </div>
              <div class="actions">
                <button nz-button nzType="primary" type="submit" [disabled]="conciergeForm.invalid">
                  {{ 'passengerTransport.action.bookConcierge' | translate }}
                </button>
              </div>
            </form>
            @if (store.lastBooking(); as booking) {
              <nz-alert
                class="feedback"
                nzType="success"
                nzShowIcon
                [nzMessage]="
                  'passengerTransport.notification.conciergeBooked'
                    | translate: { code: booking.booking_code }
                "
                [nzDescription]="
                  ('passengerTransport.field.agreedPrice' | translate) +
                  ': ' +
                  booking.agreed_price_net +
                  ' ' +
                  booking.currency +
                  ' · ' +
                  ('passengerTransport.field.conciergeCommission' | translate) +
                  ': ' +
                  booking.hotel_concierge_commission_amount
                "
              ></nz-alert>
            }
          }
        </nz-tab>

        <!-- School bus contracts -->
        <nz-tab [nzTitle]="'passengerTransport.section.schoolBus' | translate">
          @if (canWrite) {
            <div class="toolbar">
              <span class="spacer"></span>
              <button nz-button nzType="primary" type="button" (click)="openSchool(null)">
                {{ 'passengerTransport.action.newContract' | translate }}
              </button>
            </div>
          }
          <nz-table
            #schools
            nzSize="small"
            [nzData]="store.schoolContracts()"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '800px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'passengerTransport.field.contract' | translate }}</th>
                <th scope="col">{{ 'passengerTransport.field.customer' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'passengerTransport.field.monthlyFlat' | translate }}
                </th>
                <th scope="col" class="num">{{ 'passengerTransport.field.routes' | translate }}</th>
                <th scope="col">{{ 'passengerTransport.field.validity' | translate }}</th>
                <th scope="col">{{ 'passengerTransport.field.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (contract of schools.data; track contract.id) {
                <tr>
                  <th scope="row">
                    {{ contract.code }} · {{ contract.name }}
                    @if (!contract.is_active) {
                      <nz-tag>{{ 'passengerTransport.field.inactive' | translate }}</nz-tag>
                    }
                  </th>
                  <td>{{ contract.contact_name ?? '—' }}</td>
                  <td class="num">
                    {{
                      contract.monthly_flat_amount
                        ? (contract.monthly_flat_amount | money: contract.currency)
                        : '—'
                    }}
                  </td>
                  <td class="num">{{ contract.rate_card.length }}</td>
                  <td>
                    {{ contract.valid_from ? (contract.valid_from | date: 'dd/MM/yyyy') : '…' }} –
                    {{ contract.valid_to ? (contract.valid_to | date: 'dd/MM/yyyy') : '…' }}
                  </td>
                  <td class="row-actions">
                    @if (canWrite) {
                      <button nz-button nzSize="small" type="button" (click)="openSchool(contract)">
                        {{ 'passengerTransport.action.edit' | translate }}
                      </button>
                      <button
                        nz-button
                        nzSize="small"
                        nzDanger
                        type="button"
                        nz-popconfirm
                        [nzPopconfirmTitle]="
                          'passengerTransport.confirm.deleteContract' | translate
                        "
                        [nzOkText]="'passengerTransport.action.confirm' | translate"
                        [nzCancelText]="'passengerTransport.action.cancel' | translate"
                        (nzOnConfirm)="removeSchool(contract)"
                      >
                        {{ 'passengerTransport.action.delete' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <nz-empty
                      [nzNotFoundContent]="'passengerTransport.empty.contracts' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <!-- Service exchange ledger -->
        <nz-tab [nzTitle]="'passengerTransport.section.exchange' | translate">
          <div class="toolbar">
            <label class="field" for="ptr-x-period">
              <span>{{ 'passengerTransport.field.month' | translate }}</span>
              <input
                nz-input
                id="ptr-x-period"
                type="month"
                [ngModel]="store.ledgerPeriod()"
                (ngModelChange)="store.setLedgerPeriod($event)"
              />
            </label>
          </div>

          @if (canWrite) {
            <div class="toolbar">
              <label class="field" for="ptr-x-booking">
                <span>{{ 'passengerTransport.field.bookingCode' | translate }}</span>
                <nz-select
                  nzId="ptr-x-booking"
                  nzShowSearch
                  [ngModel]="exchangeBooking()"
                  (ngModelChange)="exchangeBooking.set($event)"
                >
                  @for (booking of store.exchangeable(); track booking.id) {
                    <nz-option
                      [nzValue]="booking.id"
                      [nzLabel]="booking.booking_code + ' · ' + booking.pickup_address"
                    ></nz-option>
                  }
                </nz-select>
              </label>
              <label class="field" for="ptr-x-action">
                <span>{{ 'passengerTransport.field.exchangeAction' | translate }}</span>
                <nz-select
                  nzId="ptr-x-action"
                  [ngModel]="exchangeAction()"
                  (ngModelChange)="exchangeAction.set($event)"
                >
                  @for (action of exchangeActions; track action) {
                    <nz-option
                      [nzValue]="action"
                      [nzLabel]="'passengerTransport.exchangeAction.' + action | translate"
                    ></nz-option>
                  }
                </nz-select>
              </label>
              @if (exchangeAction() !== 'release') {
                <label class="field" for="ptr-x-carrier">
                  <span>{{ 'passengerTransport.field.carrier' | translate }}</span>
                  <nz-select
                    nzId="ptr-x-carrier"
                    nzShowSearch
                    nzServerSearch
                    [ngModel]="exchangeCarrier()"
                    (ngModelChange)="exchangeCarrier.set($event)"
                    (nzOnSearch)="store.searchContacts($event)"
                  >
                    @for (contact of store.contacts(); track contact.id) {
                      <nz-option [nzValue]="contact.id" [nzLabel]="contact.name"></nz-option>
                    }
                  </nz-select>
                </label>
                <label class="field" for="ptr-x-amount">
                  <span>{{ 'passengerTransport.field.payout' | translate }}</span>
                  <nz-input-number
                    nzId="ptr-x-amount"
                    [nzMin]="0"
                    [nzPrecision]="2"
                    [ngModel]="exchangeAmount()"
                    (ngModelChange)="exchangeAmount.set($event)"
                  ></nz-input-number>
                </label>
              }
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="!exchangeReady()"
                (click)="exchange()"
              >
                {{ 'passengerTransport.action.applyExchange' | translate }}
              </button>
            </div>
          }

          @if (store.ledger(); as ledger) {
            <div class="section-title">{{ 'passengerTransport.section.partners' | translate }}</div>
            <nz-table
              #partners
              nzSize="small"
              [nzData]="ledger.partners"
              [nzShowPagination]="false"
              [nzScroll]="{ x: '800px' }"
            >
              <thead>
                <tr>
                  <th scope="col">{{ 'passengerTransport.field.carrier' | translate }}</th>
                  <th scope="col" class="num">
                    {{ 'passengerTransport.field.cededPayout' | translate }}
                  </th>
                  <th scope="col" class="num">
                    {{ 'passengerTransport.field.commissionKept' | translate }}
                  </th>
                  <th scope="col" class="num">
                    {{ 'passengerTransport.field.acquiredPayout' | translate }}
                  </th>
                  <th scope="col" class="num">
                    {{ 'passengerTransport.field.commissionOwed' | translate }}
                  </th>
                  <th scope="col" class="num">
                    {{ 'passengerTransport.field.balance' | translate }}
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (partner of partners.data; track partner.carrier_id + partner.currency) {
                  <tr>
                    <th scope="row">{{ partner.carrier_name ?? partner.carrier_id }}</th>
                    <td class="num">{{ partner.ceded_payout | money: partner.currency }}</td>
                    <td class="num">
                      {{ partner.ceded_commission_kept | money: partner.currency }}
                    </td>
                    <td class="num">{{ partner.acquired_payout | money: partner.currency }}</td>
                    <td class="num">
                      {{ partner.acquired_commission_owed | money: partner.currency }}
                    </td>
                    <td
                      class="num"
                      [class.positive]="balance(partner.net_balance) >= 0"
                      [class.negative]="balance(partner.net_balance) < 0"
                    >
                      {{ partner.net_balance | money: partner.currency }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6">
                      <nz-empty
                        [nzNotFoundContent]="'passengerTransport.empty.ledger' | translate"
                      ></nz-empty>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>

            <div class="section-title">
              {{ 'passengerTransport.section.exchangedServices' | translate }}
            </div>
            <nz-table
              #rows
              nzSize="small"
              [nzData]="ledger.rows"
              [nzShowPagination]="false"
              [nzScroll]="{ x: '900px' }"
            >
              <thead>
                <tr>
                  <th scope="col">{{ 'passengerTransport.field.bookingCode' | translate }}</th>
                  <th scope="col">{{ 'passengerTransport.field.exchangeAction' | translate }}</th>
                  <th scope="col">{{ 'passengerTransport.field.carrier' | translate }}</th>
                  <th scope="col">{{ 'passengerTransport.field.pickup' | translate }}</th>
                  <th scope="col" class="num">
                    {{ 'passengerTransport.field.agreedPrice' | translate }}
                  </th>
                  <th scope="col" class="num">
                    {{ 'passengerTransport.field.payout' | translate }}
                  </th>
                  <th scope="col" class="num">
                    {{ 'passengerTransport.field.commission' | translate }}
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows.data; track row.booking_id) {
                  <tr>
                    <td>{{ row.booking_code }}</td>
                    <td>
                      <nz-tag>{{
                        'passengerTransport.exchangeDirection.' + row.direction | translate
                      }}</nz-tag>
                    </td>
                    <td>{{ row.carrier_name ?? row.carrier_id }}</td>
                    <td>{{ row.pickup_datetime | date: 'dd/MM/yyyy HH:mm' }} · {{ row.route }}</td>
                    <td class="num">{{ row.agreed_price_net | money: row.currency }}</td>
                    <td class="num">{{ row.payout | money: row.currency }}</td>
                    <td class="num">{{ row.commission | money: row.currency }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7">
                      <nz-empty
                        [nzNotFoundContent]="'passengerTransport.empty.ledger' | translate"
                      ></nz-empty>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        </nz-tab>

        <!-- Month-end invoicing -->
        @if (canBill) {
          <nz-tab [nzTitle]="'passengerTransport.section.monthEnd' | translate">
            <p class="muted">{{ 'passengerTransport.hint.monthEnd' | translate }}</p>
            <div class="toolbar">
              <label class="field" for="ptr-b-period">
                <span>{{ 'passengerTransport.field.month' | translate }}</span>
                <input
                  nz-input
                  id="ptr-b-period"
                  type="month"
                  [ngModel]="store.period()"
                  (ngModelChange)="onPeriod($event)"
                />
              </label>
              <span class="spacer"></span>
              <button
                nz-button
                nzType="primary"
                type="button"
                nz-popconfirm
                [nzPopconfirmTitle]="
                  'passengerTransport.confirm.invoiceMonth' | translate: { count: selectedCount() }
                "
                [nzOkText]="'passengerTransport.action.confirm' | translate"
                [nzCancelText]="'passengerTransport.action.cancel' | translate"
                [disabled]="selectedCount() === 0"
                (nzOnConfirm)="issue()"
              >
                {{ 'passengerTransport.action.invoiceMonth' | translate }}
              </button>
            </div>

            <nz-table
              #preview
              nzSize="small"
              [nzData]="store.preview()"
              [nzShowPagination]="false"
              [nzScroll]="{ x: '900px' }"
            >
              <thead>
                <tr>
                  <th scope="col" nzWidth="48px">
                    <label
                      nz-checkbox
                      for="ptr-cb-1"
                      nzId="ptr-cb-1"
                      [ngModel]="allSelected()"
                      (ngModelChange)="toggleAll($event)"
                      [attr.aria-label]="'passengerTransport.action.selectAll' | translate"
                    ></label>
                  </th>
                  <th scope="col">{{ 'passengerTransport.field.customer' | translate }}</th>
                  <th scope="col" class="num">
                    {{ 'passengerTransport.field.trips' | translate }}
                  </th>
                  <th scope="col" class="num">
                    {{ 'passengerTransport.field.monthlyFlat' | translate }}
                  </th>
                  <th scope="col" class="num">{{ 'passengerTransport.field.net' | translate }}</th>
                  <th scope="col" class="num">{{ 'passengerTransport.field.vat' | translate }}</th>
                  <th scope="col" class="num">
                    {{ 'passengerTransport.field.total' | translate }}
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (row of preview.data; track row.customer_id) {
                  <tr>
                    <td>
                      <label
                        nz-checkbox
                        [for]="'ptr-cb-row-' + row.customer_id"
                        [nzId]="'ptr-cb-row-' + row.customer_id"
                        [ngModel]="isSelected(row.customer_id)"
                        (ngModelChange)="toggle(row.customer_id, $event)"
                      ></label>
                    </td>
                    <th scope="row">
                      {{ row.customer_name ?? row.customer_id }}
                      <small class="muted">{{ row.booking_codes.join(', ') }}</small>
                    </th>
                    <td class="num">{{ row.bookings_count }}</td>
                    <td class="num">
                      {{
                        row.monthly_flat_amount
                          ? (row.monthly_flat_amount | money: row.currency)
                          : '—'
                      }}
                    </td>
                    <td class="num">{{ row.total_net | money: row.currency }}</td>
                    <td class="num">{{ row.total_tax | money: row.currency }}</td>
                    <td class="num">{{ row.total_gross | money: row.currency }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7">
                      <nz-empty
                        [nzNotFoundContent]="'passengerTransport.empty.preview' | translate"
                      ></nz-empty>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>

            @if (store.issued().length > 0) {
              <div class="section-title">
                {{ 'passengerTransport.section.issuedInvoices' | translate }}
              </div>
              @for (invoice of store.issued(); track invoice.invoice_id) {
                <nz-alert
                  class="feedback"
                  nzType="success"
                  nzShowIcon
                  [nzMessage]="invoice.invoice_number"
                  [nzDescription]="invoice.bookings_count + ' · ' + invoice.total_gross"
                ></nz-alert>
              }
            }
          </nz-tab>
        }
      </nz-tabs>
    </nz-spin>

    <!-- Hotel contract drawer -->
    <nz-drawer
      [nzVisible]="hotelDrawer()"
      [nzWidth]="860"
      [nzTitle]="'passengerTransport.section.hotelContract' | translate"
      (nzOnClose)="closeHotel()"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="
              failure.errorKey ?? 'passengerTransport.error.generic' | translate: failure.params
            "
            [nzDescription]="failure.detail ?? null"
          ></nz-alert>
        }
        <form [formGroup]="hotelForm" class="form" (ngSubmit)="saveHotel()">
          <div class="form-grid">
            <label class="field" for="ptr-h-contact">
              <span>{{ 'passengerTransport.field.customer' | translate }}</span>
              <nz-select
                nzId="ptr-h-contact"
                nzShowSearch
                nzServerSearch
                formControlName="contact_id"
                (nzOnSearch)="store.searchContacts($event)"
              >
                @for (contact of contactOptions(); track contact.id) {
                  <nz-option [nzValue]="contact.id" [nzLabel]="contact.name"></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="ptr-h-code">
              <span>{{ 'passengerTransport.field.code' | translate }}</span>
              <input nz-input id="ptr-h-code" formControlName="code" maxlength="40" />
            </label>
            <label class="field" for="ptr-h-name">
              <span>{{ 'passengerTransport.field.name' | translate }}</span>
              <input nz-input id="ptr-h-name" formControlName="name" maxlength="160" />
            </label>
            <label class="field" for="ptr-h-commission">
              <span>{{ 'passengerTransport.field.commissionRate' | translate }}</span>
              <nz-input-number
                nzId="ptr-h-commission"
                formControlName="commission_rate"
                [nzMin]="0"
                [nzMax]="100"
                [nzStep]="0.5"
              ></nz-input-number>
            </label>
            <label class="field" for="ptr-h-currency">
              <span>{{ 'passengerTransport.field.currency' | translate }}</span>
              <nz-select nzId="ptr-h-currency" formControlName="currency">
                @for (code of currencies; track code) {
                  <nz-option [nzValue]="code" [nzLabel]="code"></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="ptr-h-from">
              <span>{{ 'passengerTransport.field.validFrom' | translate }}</span>
              <nz-date-picker nzId="ptr-h-from" formControlName="valid_from"></nz-date-picker>
            </label>
            <label class="field" for="ptr-h-to">
              <span>{{ 'passengerTransport.field.validTo' | translate }}</span>
              <nz-date-picker nzId="ptr-h-to" formControlName="valid_to"></nz-date-picker>
            </label>
          </div>
          <label nz-checkbox for="ptr-cb-3" nzId="ptr-cb-3" formControlName="is_active">{{
            'passengerTransport.field.active' | translate
          }}</label>

          <div class="section-title">{{ 'passengerTransport.section.rateCard' | translate }}</div>
          @for (route of hotelRoutes(); track $index; let index = $index) {
            <div class="form-grid rate-row">
              <label class="field" [for]="'ptr-hr-code-' + index">
                <span>{{ 'passengerTransport.field.routeCode' | translate }}</span>
                <input
                  nz-input
                  [id]="'ptr-hr-code-' + index"
                  [ngModel]="route.route_code"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="patchHotelRoute(index, { route_code: $event })"
                />
              </label>
              <label class="field" [for]="'ptr-hr-from-' + index">
                <span>{{ 'passengerTransport.field.origin' | translate }}</span>
                <input
                  nz-input
                  [id]="'ptr-hr-from-' + index"
                  [ngModel]="route.origin_label"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="patchHotelRoute(index, { origin_label: $event })"
                />
              </label>
              <label class="field" [for]="'ptr-hr-to-' + index">
                <span>{{ 'passengerTransport.field.destination' | translate }}</span>
                <input
                  nz-input
                  [id]="'ptr-hr-to-' + index"
                  [ngModel]="route.destination_label"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="patchHotelRoute(index, { destination_label: $event })"
                />
              </label>
              <label class="field" [for]="'ptr-hr-cat-' + index">
                <span>{{ 'passengerTransport.field.vehicleCategory' | translate }}</span>
                <nz-select
                  [nzId]="'ptr-hr-cat-' + index"
                  [ngModel]="route.vehicle_category"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="patchHotelRoute(index, { vehicle_category: $event })"
                >
                  @for (category of categories; track category) {
                    <nz-option
                      [nzValue]="category"
                      [nzLabel]="'passengerTransport.vehicleCategory.' + category | translate"
                    ></nz-option>
                  }
                </nz-select>
              </label>
              <label class="field" [for]="'ptr-hr-price-' + index">
                <span>{{ 'passengerTransport.field.price' | translate }}</span>
                <nz-input-number
                  [nzId]="'ptr-hr-price-' + index"
                  [nzMin]="0"
                  [nzPrecision]="2"
                  [ngModel]="route.price"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="patchHotelRoute(index, { price: $event ?? 0 })"
                ></nz-input-number>
              </label>
              <label class="field" [for]="'ptr-hr-border-' + index">
                <span>{{ 'passengerTransport.field.borderCrossing' | translate }}</span>
                <nz-select
                  [nzId]="'ptr-hr-border-' + index"
                  [ngModel]="route.border_crossing"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="patchHotelRoute(index, { border_crossing: $event })"
                >
                  @for (crossing of crossings; track crossing) {
                    <nz-option
                      [nzValue]="crossing"
                      [nzLabel]="'passengerTransport.borderCrossing.' + crossing | translate"
                    ></nz-option>
                  }
                </nz-select>
              </label>
              <label class="field" [for]="'ptr-hr-km-' + index">
                <span>{{ 'passengerTransport.field.totalKm' | translate }}</span>
                <nz-input-number
                  [nzId]="'ptr-hr-km-' + index"
                  [nzMin]="0"
                  [ngModel]="route.total_km"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="patchHotelRoute(index, { total_km: $event })"
                ></nz-input-number>
              </label>
              <label class="field" [for]="'ptr-hr-it-' + index">
                <span>{{ 'passengerTransport.field.itKm' | translate }}</span>
                <nz-input-number
                  [nzId]="'ptr-hr-it-' + index"
                  [nzMin]="0"
                  [ngModel]="route.it_km"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="patchHotelRoute(index, { it_km: $event })"
                ></nz-input-number>
              </label>
              <label class="field" [for]="'ptr-hr-ch-' + index">
                <span>{{ 'passengerTransport.field.chKm' | translate }}</span>
                <nz-input-number
                  [nzId]="'ptr-hr-ch-' + index"
                  [nzMin]="0"
                  [ngModel]="route.ch_km"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="patchHotelRoute(index, { ch_km: $event })"
                ></nz-input-number>
              </label>
              <button
                nz-button
                nzDanger
                type="button"
                [attr.aria-label]="'passengerTransport.action.remove' | translate"
                (click)="removeHotelRoute(index)"
              >
                ×
              </button>
            </div>
          }
          <button nz-button type="button" (click)="addHotelRoute()">
            {{ 'passengerTransport.action.addRoute' | translate }}
          </button>

          <div class="actions">
            <button
              nz-button
              nzType="primary"
              type="submit"
              [nzLoading]="store.saving()"
              [disabled]="hotelForm.invalid"
            >
              {{ 'passengerTransport.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="closeHotel()">
              {{ 'passengerTransport.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>

    <!-- School contract drawer -->
    <nz-drawer
      [nzVisible]="schoolDrawer()"
      [nzWidth]="720"
      [nzTitle]="'passengerTransport.section.schoolContract' | translate"
      (nzOnClose)="closeSchool()"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="
              failure.errorKey ?? 'passengerTransport.error.generic' | translate: failure.params
            "
            [nzDescription]="failure.detail ?? null"
          ></nz-alert>
        }
        <form [formGroup]="schoolForm" class="form" (ngSubmit)="saveSchool()">
          <div class="form-grid">
            <label class="field" for="ptr-s-contact">
              <span>{{ 'passengerTransport.field.customer' | translate }}</span>
              <nz-select
                nzId="ptr-s-contact"
                nzShowSearch
                nzServerSearch
                formControlName="contact_id"
                (nzOnSearch)="store.searchContacts($event)"
              >
                @for (contact of contactOptions(); track contact.id) {
                  <nz-option [nzValue]="contact.id" [nzLabel]="contact.name"></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="ptr-s-code">
              <span>{{ 'passengerTransport.field.code' | translate }}</span>
              <input nz-input id="ptr-s-code" formControlName="code" maxlength="40" />
            </label>
            <label class="field" for="ptr-s-name">
              <span>{{ 'passengerTransport.field.name' | translate }}</span>
              <input nz-input id="ptr-s-name" formControlName="name" maxlength="160" />
            </label>
            <label class="field" for="ptr-s-flat">
              <span>{{ 'passengerTransport.field.monthlyFlat' | translate }}</span>
              <nz-input-number
                nzId="ptr-s-flat"
                formControlName="monthly_flat_amount"
                [nzMin]="0"
                [nzPrecision]="2"
              ></nz-input-number>
            </label>
            <label class="field" for="ptr-s-currency">
              <span>{{ 'passengerTransport.field.currency' | translate }}</span>
              <nz-select nzId="ptr-s-currency" formControlName="currency">
                @for (code of currencies; track code) {
                  <nz-option [nzValue]="code" [nzLabel]="code"></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="ptr-s-from">
              <span>{{ 'passengerTransport.field.validFrom' | translate }}</span>
              <nz-date-picker nzId="ptr-s-from" formControlName="valid_from"></nz-date-picker>
            </label>
            <label class="field" for="ptr-s-to">
              <span>{{ 'passengerTransport.field.validTo' | translate }}</span>
              <nz-date-picker nzId="ptr-s-to" formControlName="valid_to"></nz-date-picker>
            </label>
          </div>
          <label nz-checkbox for="ptr-cb-4" nzId="ptr-cb-4" formControlName="is_active">{{
            'passengerTransport.field.active' | translate
          }}</label>

          <div class="section-title">{{ 'passengerTransport.section.rateCard' | translate }}</div>
          @for (route of schoolRoutes(); track $index; let index = $index) {
            <div class="manifest-row">
              <label class="field" [for]="'ptr-sr-code-' + index">
                <span>{{ 'passengerTransport.field.routeCode' | translate }}</span>
                <input
                  nz-input
                  [id]="'ptr-sr-code-' + index"
                  [ngModel]="route.route_code"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="patchSchoolRoute(index, { route_code: $event })"
                />
              </label>
              <label class="field" [for]="'ptr-sr-label-' + index">
                <span>{{ 'passengerTransport.field.label' | translate }}</span>
                <input
                  nz-input
                  [id]="'ptr-sr-label-' + index"
                  [ngModel]="route.label"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="patchSchoolRoute(index, { label: $event })"
                />
              </label>
              <label class="field" [for]="'ptr-sr-price-' + index">
                <span>{{ 'passengerTransport.field.price' | translate }}</span>
                <nz-input-number
                  [nzId]="'ptr-sr-price-' + index"
                  [nzMin]="0"
                  [nzPrecision]="2"
                  [ngModel]="route.price"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="patchSchoolRoute(index, { price: $event ?? 0 })"
                ></nz-input-number>
              </label>
              <span></span>
              <button
                nz-button
                nzDanger
                type="button"
                [attr.aria-label]="'passengerTransport.action.remove' | translate"
                (click)="removeSchoolRoute(index)"
              >
                ×
              </button>
            </div>
          }
          <button nz-button type="button" (click)="addSchoolRoute()">
            {{ 'passengerTransport.action.addRoute' | translate }}
          </button>

          <div class="actions">
            <button
              nz-button
              nzType="primary"
              type="submit"
              [nzLoading]="store.saving()"
              [disabled]="schoolForm.invalid"
            >
              {{ 'passengerTransport.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="closeSchool()">
              {{ 'passengerTransport.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class ContractsBillingComponent implements OnInit {
  protected readonly store = inject(ContractsBillingStore);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = this.permissions.canWrite(PASSENGER_TRANSPORT_MODULE);
  protected readonly canBill = this.permissions.canWrite(PASSENGER_TRANSPORT_FINANCE_MODULE);

  protected readonly categories = PTR_VEHICLE_CATEGORIES;
  protected readonly crossings = PTR_BORDER_CROSSINGS;
  protected readonly currencies: readonly string[] = ['CHF', 'EUR'];
  protected readonly exchangeActions = EXCHANGE_ACTIONS;

  protected readonly feedback = signal<PtrOutcome | null>(null);
  protected readonly formError = signal<PtrOutcome | null>(null);

  // Hotel contracts
  protected readonly hotelDrawer = signal(false);
  protected readonly editingHotel = signal<PtrHotelContract | null>(null);
  protected readonly hotelRoutes = signal<HotelRouteRow[]>([]);
  protected readonly hotelForm = this.fb.group({
    contact_id: this.fb.control<string | null>(null, Validators.required),
    code: this.fb.control('', Validators.required),
    name: this.fb.control('', Validators.required),
    commission_rate: this.fb.control(10, [Validators.min(0), Validators.max(100)]),
    currency: this.fb.control('EUR'),
    valid_from: this.fb.control<Date | null>(null),
    valid_to: this.fb.control<Date | null>(null),
    is_active: this.fb.control(true),
  });

  // Concierge booking
  protected readonly conciergeForm = this.fb.group({
    contract_id: this.fb.control<string | null>(null, Validators.required),
    route_code: this.fb.control<string | null>(null, Validators.required),
    pickup_datetime: this.fb.control<Date | null>(null, Validators.required),
    lead_passenger_name: this.fb.control('', Validators.required),
    lead_passenger_phone: this.fb.control(''),
    vip_welcome_sign_text: this.fb.control(''),
    passengers_count: this.fb.control(1, Validators.min(1)),
    luggage_count: this.fb.control(0),
    flight_or_train_number: this.fb.control(''),
    flight_carrier_iata: this.fb.control(''),
    scheduled_flight_arrival_at: this.fb.control<Date | null>(null),
  });
  private readonly conciergeContract = signal<string | null>(null);

  // School contracts
  protected readonly schoolDrawer = signal(false);
  protected readonly editingSchool = signal<PtrSchoolContract | null>(null);
  protected readonly schoolRoutes = signal<SchoolRouteRow[]>([]);
  protected readonly schoolForm = this.fb.group({
    contact_id: this.fb.control<string | null>(null, Validators.required),
    code: this.fb.control('', Validators.required),
    name: this.fb.control('', Validators.required),
    monthly_flat_amount: this.fb.control<number | null>(null),
    currency: this.fb.control('EUR'),
    valid_from: this.fb.control<Date | null>(null),
    valid_to: this.fb.control<Date | null>(null),
    is_active: this.fb.control(true),
  });

  // Service exchange
  protected readonly exchangeBooking = signal<string | null>(null);
  protected readonly exchangeAction = signal<PtrExchangeAction>('cede');
  protected readonly exchangeCarrier = signal<string | null>(null);
  protected readonly exchangeAmount = signal<number | null>(null);
  protected readonly exchangeReady = computed(
    () =>
      this.exchangeBooking() !== null &&
      (this.exchangeAction() === 'release' ||
        (this.exchangeCarrier() !== null && (this.exchangeAmount() ?? 0) > 0)),
  );

  // Month-end invoicing
  private readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly selectedCount = computed(() => this.selected().size);
  protected readonly allSelected = computed(
    () =>
      this.store.preview().length > 0 &&
      this.store.preview().every((row) => this.selected().has(row.customer_id)),
  );

  protected readonly activeHotels = computed(() =>
    this.store.hotelContracts().filter((contract) => contract.is_active),
  );
  protected readonly conciergeRoutes = computed<PtrRateCardRoute[]>(
    () =>
      this.store.hotelContracts().find((contract) => contract.id === this.conciergeContract())
        ?.rate_card ?? [],
  );
  /** The contacts found by the search, plus the customer of the contract being edited. */
  protected readonly contactOptions = computed(() => {
    const options = [...this.store.contacts()];
    const current = this.editingHotel() ?? this.editingSchool();
    if (current && !options.some((option) => option.id === current.contact_id)) {
      options.push({ id: current.contact_id, name: current.contact_name ?? current.contact_id });
    }
    return options;
  });

  constructor() {
    // Choosing the hotel contract restricts the routes to its rate card.
    this.conciergeForm.controls.contract_id.valueChanges.subscribe((id) => {
      this.conciergeContract.set(id);
      this.conciergeForm.controls.route_code.reset(null);
    });
  }

  async ngOnInit(): Promise<void> {
    await this.store.init();
    this.selected.set(new Set(this.store.preview().map((row) => row.customer_id)));
  }

  protected readonly balance = (value: string): number => Number.parseFloat(value);

  // --- Hotel contracts ---

  protected openHotel(contract: PtrHotelContract | null): void {
    this.editingHotel.set(contract);
    this.formError.set(null);
    if (contract === null) {
      this.hotelForm.reset();
      this.hotelRoutes.set([]);
    } else {
      this.hotelForm.reset({
        contact_id: contract.contact_id,
        code: contract.code,
        name: contract.name,
        commission_rate: toNumber(contract.commission_rate),
        currency: contract.currency,
        valid_from: parseInstant(contract.valid_from),
        valid_to: parseInstant(contract.valid_to),
        is_active: contract.is_active,
      });
      this.hotelRoutes.set(
        contract.rate_card.map((route) => ({
          route_code: route.route_code,
          origin_label: route.origin_label,
          destination_label: route.destination_label,
          vehicle_category: route.vehicle_category,
          price: toNumber(route.price),
          border_crossing: route.border_crossing ?? 'none',
          total_km:
            route.total_km === null || route.total_km === undefined
              ? null
              : toNumber(route.total_km),
          it_km: route.it_km === null || route.it_km === undefined ? null : toNumber(route.it_km),
          ch_km: route.ch_km === null || route.ch_km === undefined ? null : toNumber(route.ch_km),
        })),
      );
    }
    this.hotelDrawer.set(true);
  }

  protected closeHotel(): void {
    this.hotelDrawer.set(false);
    this.editingHotel.set(null);
  }

  protected addHotelRoute(): void {
    this.hotelRoutes.update((rows) => [
      ...rows,
      {
        route_code: '',
        origin_label: '',
        destination_label: '',
        vehicle_category: 'sedan_ncc',
        price: 0,
        border_crossing: 'none',
        total_km: null,
        it_km: null,
        ch_km: null,
      },
    ]);
  }

  protected patchHotelRoute(index: number, patch: Partial<HotelRouteRow>): void {
    this.hotelRoutes.update((rows) =>
      rows.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  }

  protected removeHotelRoute(index: number): void {
    this.hotelRoutes.update((rows) => rows.filter((_, position) => position !== index));
  }

  protected async saveHotel(): Promise<void> {
    const value = this.hotelForm.getRawValue();
    if (this.hotelForm.invalid || value.contact_id === null) {
      return;
    }
    const outcome = await this.store.saveHotelContract(
      {
        contact_id: value.contact_id,
        code: value.code.trim(),
        name: value.name.trim(),
        commission_rate: value.commission_rate,
        currency: value.currency,
        valid_from: value.valid_from ? toDateString(value.valid_from) : null,
        valid_to: value.valid_to ? toDateString(value.valid_to) : null,
        is_active: value.is_active,
        rate_card: this.hotelRoutes()
          .filter((route) => route.route_code.trim() !== '')
          .map((route) => ({
            route_code: route.route_code.trim(),
            origin_label: route.origin_label.trim(),
            destination_label: route.destination_label.trim(),
            vehicle_category: route.vehicle_category,
            price: route.price,
            border_crossing: route.border_crossing,
            total_km: route.total_km,
            it_km: route.it_km,
            ch_km: route.ch_km,
          })),
      },
      this.editingHotel()?.id,
    );
    this.afterSave(outcome, 'passengerTransport.notification.contractSaved', () =>
      this.closeHotel(),
    );
  }

  protected async removeHotel(contract: PtrHotelContract): Promise<void> {
    this.afterDelete(await this.store.removeHotelContract(contract.id));
  }

  // --- Concierge booking ---

  protected async bookConcierge(): Promise<void> {
    const value = this.conciergeForm.getRawValue();
    if (this.conciergeForm.invalid || value.contract_id === null || value.route_code === null) {
      return;
    }
    const text = (input: string): string | null => (input.trim() === '' ? null : input.trim());
    const outcome = await this.store.bookConcierge(value.contract_id, {
      route_code: value.route_code,
      pickup_datetime: toApiDateTime(value.pickup_datetime) ?? '',
      lead_passenger_name: value.lead_passenger_name.trim(),
      lead_passenger_phone: text(value.lead_passenger_phone),
      vip_welcome_sign_text: text(value.vip_welcome_sign_text),
      passengers_count: value.passengers_count,
      luggage_count: value.luggage_count,
      flight_or_train_number: text(value.flight_or_train_number),
      flight_carrier_iata: text(value.flight_carrier_iata)?.toUpperCase() ?? null,
      scheduled_flight_arrival_at: toApiDateTime(value.scheduled_flight_arrival_at),
    });
    if (outcome.ok) {
      this.feedback.set(null);
      this.conciergeForm.reset({
        contract_id: value.contract_id,
        passengers_count: 1,
        luggage_count: 0,
      });
    } else {
      this.feedback.set(outcome);
    }
  }

  // --- School contracts ---

  protected openSchool(contract: PtrSchoolContract | null): void {
    this.editingSchool.set(contract);
    this.formError.set(null);
    if (contract === null) {
      this.schoolForm.reset();
      this.schoolRoutes.set([]);
    } else {
      this.schoolForm.reset({
        contact_id: contract.contact_id,
        code: contract.code,
        name: contract.name,
        monthly_flat_amount:
          contract.monthly_flat_amount === null ? null : toNumber(contract.monthly_flat_amount),
        currency: contract.currency,
        valid_from: parseInstant(contract.valid_from),
        valid_to: parseInstant(contract.valid_to),
        is_active: contract.is_active,
      });
      this.schoolRoutes.set(
        contract.rate_card.map((route: PtrSchoolRateRoute) => ({
          route_code: route.route_code,
          label: route.label,
          price: toNumber(route.price),
        })),
      );
    }
    this.schoolDrawer.set(true);
  }

  protected closeSchool(): void {
    this.schoolDrawer.set(false);
    this.editingSchool.set(null);
  }

  protected addSchoolRoute(): void {
    this.schoolRoutes.update((rows) => [...rows, { route_code: '', label: '', price: 0 }]);
  }

  protected patchSchoolRoute(index: number, patch: Partial<SchoolRouteRow>): void {
    this.schoolRoutes.update((rows) =>
      rows.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  }

  protected removeSchoolRoute(index: number): void {
    this.schoolRoutes.update((rows) => rows.filter((_, position) => position !== index));
  }

  protected async saveSchool(): Promise<void> {
    const value = this.schoolForm.getRawValue();
    if (this.schoolForm.invalid || value.contact_id === null) {
      return;
    }
    const outcome = await this.store.saveSchoolContract(
      {
        contact_id: value.contact_id,
        code: value.code.trim(),
        name: value.name.trim(),
        currency: value.currency,
        monthly_flat_amount: value.monthly_flat_amount,
        valid_from: value.valid_from ? toDateString(value.valid_from) : null,
        valid_to: value.valid_to ? toDateString(value.valid_to) : null,
        is_active: value.is_active,
        rate_card: this.schoolRoutes()
          .filter((route) => route.route_code.trim() !== '')
          .map((route) => ({
            route_code: route.route_code.trim(),
            label: route.label.trim(),
            price: route.price,
          })),
      },
      this.editingSchool()?.id,
    );
    this.afterSave(outcome, 'passengerTransport.notification.contractSaved', () =>
      this.closeSchool(),
    );
  }

  protected async removeSchool(contract: PtrSchoolContract): Promise<void> {
    this.afterDelete(await this.store.removeSchoolContract(contract.id));
  }

  // --- Service exchange ---

  protected async exchange(): Promise<void> {
    const booking = this.exchangeBooking();
    if (booking === null) {
      return;
    }
    const action = this.exchangeAction();
    const amount = this.exchangeAmount();
    const outcome = await this.store.exchange(
      booking,
      action,
      action === 'release' ? undefined : (this.exchangeCarrier() ?? undefined),
      action === 'release' || amount === null ? undefined : amount.toFixed(2),
    );
    if (outcome.ok) {
      this.feedback.set(null);
      this.message.success(this.i18n.instant('passengerTransport.notification.exchangeApplied'));
      this.exchangeBooking.set(null);
      this.exchangeAmount.set(null);
    } else {
      this.feedback.set(outcome);
    }
  }

  // --- Month-end invoicing ---

  protected async onPeriod(period: string): Promise<void> {
    await this.store.setPeriod(period || toPeriod(new Date()));
    this.selected.set(new Set(this.store.preview().map((row) => row.customer_id)));
  }

  protected isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  protected toggle(id: string, checked: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  protected toggleAll(checked: boolean): void {
    this.selected.set(
      checked ? new Set(this.store.preview().map((row) => row.customer_id)) : new Set(),
    );
  }

  protected async issue(): Promise<void> {
    const outcome = await this.store.issue([...this.selected()]);
    if (outcome.ok) {
      this.feedback.set(null);
      this.message.success(this.i18n.instant('passengerTransport.notification.monthInvoiced'));
      this.selected.set(new Set(this.store.preview().map((row) => row.customer_id)));
    } else {
      this.feedback.set(outcome);
    }
  }

  private afterSave(outcome: PtrOutcome, successKey: string, close: () => void): void {
    if (outcome.ok) {
      this.message.success(this.i18n.instant(successKey));
      close();
    } else {
      this.formError.set(outcome);
    }
  }

  private afterDelete(outcome: PtrOutcome): void {
    if (outcome.ok) {
      this.feedback.set(null);
      this.message.success(this.i18n.instant('passengerTransport.notification.contractDeleted'));
    } else {
      this.feedback.set(outcome);
    }
  }
}
