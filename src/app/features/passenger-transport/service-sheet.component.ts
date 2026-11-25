import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  PermissionsService,
  PtrManifestPassenger,
  PtrServiceSheet,
  PtrServiceSheetPayload,
  TranslateService,
} from '@core';
import { downloadBlob, PageHeaderComponent, TranslatePipe } from '@shared';
import { ServiceSheetStore } from './service-sheet.store';
import {
  bookingStatusColor,
  failureOf,
  openBlob,
  parseInstant,
  PASSENGER_TRANSPORT_FINANCE_MODULE,
  PASSENGER_TRANSPORT_MODULE,
  PtrOutcome,
  sheetStatusColor,
  toApiDateTime,
} from './passenger-transport.util';
import { WelcomeSignComponent } from './welcome-sign.component';

interface ManifestRow {
  name: string;
  birth_date: string;
  document: string;
  nationality: string;
}

/**
 * The service sheet (foglio di servizio) of a booking: times and odometer readings, the passenger manifest, the PDFs (sheet,
 * Interbus waybill, welcome sign), the MIT FDSE transmission, the full screen welcome sign for the airport hall, and the one click
 * "generate the sheet and the split-VAT invoice".
 */
@Component({
  selector: 'app-ptr-service-sheet',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    WelcomeSignComponent,
  ],
  providers: [ServiceSheetStore],
  styleUrl: './passenger-transport.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.PASSENGER_TRANSPORT_SHEET' | translate"></app-page-header>

    <div class="toolbar">
      <a nz-button routerLink="/passenger-transport/bookings">{{
        'passengerTransport.action.backToBookings' | translate
      }}</a>
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
    @if (store.invoiceNumber(); as number) {
      <nz-alert
        class="feedback"
        nzType="success"
        nzShowIcon
        [nzMessage]="
          'passengerTransport.notification.invoiceCreated' | translate: { number: number }
        "
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading() || store.saving()">
      @if (store.booking(); as booking) {
        <nz-descriptions nzBordered nzSize="small" [nzColumn]="2">
          <nz-descriptions-item [nzTitle]="'passengerTransport.field.bookingCode' | translate">{{
            booking.booking_code
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'passengerTransport.field.status' | translate">
            <nz-tag [nzColor]="statusColor(booking.status)">{{
              'passengerTransport.bookingStatus.' + booking.status | translate
            }}</nz-tag>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'passengerTransport.field.pickup' | translate">
            {{ booking.pickup_datetime | date: 'dd/MM/yyyy HH:mm' }} · {{ booking.pickup_address }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'passengerTransport.field.dropoff' | translate">{{
            booking.dropoff_address
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'passengerTransport.field.vehicle' | translate">{{
            booking.assigned_vehicle_plate ?? '—'
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'passengerTransport.field.driver' | translate">{{
            booking.assigned_driver_name ?? '—'
          }}</nz-descriptions-item>
        </nz-descriptions>

        @if (store.current(); as sheet) {
          <div class="section-title">
            {{ 'passengerTransport.section.sheet' | translate }} {{ sheet.number }}
            <nz-tag [nzColor]="sheetColor(sheet.status)">{{
              'passengerTransport.sheetStatus.' + sheet.status | translate
            }}</nz-tag>
          </div>

          <form [formGroup]="form" class="form">
            <div class="form-grid">
              <label class="field" for="ptr-s-garage-out">
                <span>{{ 'passengerTransport.field.garageDeparture' | translate }}</span>
                <nz-date-picker
                  nzId="ptr-s-garage-out"
                  nzShowTime
                  nzFormat="dd/MM/yyyy HH:mm"
                  formControlName="garage_departure_at"
                ></nz-date-picker>
              </label>
              <label class="field" for="ptr-s-garage-out-km">
                <span>{{ 'passengerTransport.field.garageDepartureKm' | translate }}</span>
                <nz-input-number
                  nzId="ptr-s-garage-out-km"
                  formControlName="garage_departure_km"
                  [nzMin]="0"
                ></nz-input-number>
              </label>
              <label class="field" for="ptr-s-start">
                <span>{{ 'passengerTransport.field.serviceStart' | translate }}</span>
                <nz-date-picker
                  nzId="ptr-s-start"
                  nzShowTime
                  nzFormat="dd/MM/yyyy HH:mm"
                  formControlName="service_start_at"
                ></nz-date-picker>
              </label>
              <label class="field" for="ptr-s-start-km">
                <span>{{ 'passengerTransport.field.serviceStartKm' | translate }}</span>
                <nz-input-number
                  nzId="ptr-s-start-km"
                  formControlName="service_start_km"
                  [nzMin]="0"
                ></nz-input-number>
              </label>
              <label class="field" for="ptr-s-end">
                <span>{{ 'passengerTransport.field.serviceEnd' | translate }}</span>
                <nz-date-picker
                  nzId="ptr-s-end"
                  nzShowTime
                  nzFormat="dd/MM/yyyy HH:mm"
                  formControlName="service_end_at"
                ></nz-date-picker>
              </label>
              <label class="field" for="ptr-s-end-km">
                <span>{{ 'passengerTransport.field.serviceEndKm' | translate }}</span>
                <nz-input-number
                  nzId="ptr-s-end-km"
                  formControlName="service_end_km"
                  [nzMin]="0"
                ></nz-input-number>
              </label>
              <label class="field" for="ptr-s-garage-in">
                <span>{{ 'passengerTransport.field.garageReturn' | translate }}</span>
                <nz-date-picker
                  nzId="ptr-s-garage-in"
                  nzShowTime
                  nzFormat="dd/MM/yyyy HH:mm"
                  formControlName="garage_return_at"
                ></nz-date-picker>
              </label>
              <label class="field" for="ptr-s-garage-in-km">
                <span>{{ 'passengerTransport.field.garageReturnKm' | translate }}</span>
                <nz-input-number
                  nzId="ptr-s-garage-in-km"
                  formControlName="garage_return_km"
                  [nzMin]="0"
                ></nz-input-number>
              </label>
            </div>
          </form>

          <div class="section-title">{{ 'passengerTransport.section.manifest' | translate }}</div>
          @for (row of manifest(); track $index; let index = $index) {
            <div class="manifest-row">
              <label class="field" [for]="'ptr-m-name-' + index">
                <span>{{ 'passengerTransport.field.passengerName' | translate }}</span>
                <input
                  nz-input
                  [id]="'ptr-m-name-' + index"
                  [ngModel]="row.name"
                  (ngModelChange)="patchRow(index, 'name', $event)"
                />
              </label>
              <label class="field" [for]="'ptr-m-birth-' + index">
                <span>{{ 'passengerTransport.field.birthDate' | translate }}</span>
                <input
                  nz-input
                  type="date"
                  [id]="'ptr-m-birth-' + index"
                  [ngModel]="row.birth_date"
                  (ngModelChange)="patchRow(index, 'birth_date', $event)"
                />
              </label>
              <label class="field" [for]="'ptr-m-doc-' + index">
                <span>{{ 'passengerTransport.field.document' | translate }}</span>
                <input
                  nz-input
                  [id]="'ptr-m-doc-' + index"
                  [ngModel]="row.document"
                  (ngModelChange)="patchRow(index, 'document', $event)"
                />
              </label>
              <label class="field" [for]="'ptr-m-nat-' + index">
                <span>{{ 'passengerTransport.field.nationality' | translate }}</span>
                <input
                  nz-input
                  maxlength="2"
                  [id]="'ptr-m-nat-' + index"
                  [ngModel]="row.nationality"
                  (ngModelChange)="patchRow(index, 'nationality', $event)"
                />
              </label>
              <button
                nz-button
                nzDanger
                type="button"
                [attr.aria-label]="'passengerTransport.action.remove' | translate"
                (click)="removeRow(index)"
              >
                ×
              </button>
            </div>
          }
          <button nz-button type="button" (click)="addRow()">
            {{ 'passengerTransport.action.addPassenger' | translate }}
          </button>

          @if (canWrite) {
            <div class="actions">
              <button
                nz-button
                type="button"
                [disabled]="sheet.status !== 'open'"
                (click)="save(sheet)"
              >
                {{ 'passengerTransport.action.save' | translate }}
              </button>
              <button
                nz-button
                type="button"
                nz-popconfirm
                [nzPopconfirmTitle]="'passengerTransport.confirm.closeSheet' | translate"
                [nzOkText]="'passengerTransport.action.confirm' | translate"
                [nzCancelText]="'passengerTransport.action.cancel' | translate"
                [disabled]="sheet.status !== 'open'"
                (nzOnConfirm)="close(sheet)"
              >
                {{ 'passengerTransport.action.closeSheet' | translate }}
              </button>
              @if (jurisdictionIt()) {
                <button
                  nz-button
                  type="button"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'passengerTransport.confirm.transmitFdse' | translate"
                  [nzOkText]="'passengerTransport.action.confirm' | translate"
                  [nzCancelText]="'passengerTransport.action.cancel' | translate"
                  [disabled]="sheet.status !== 'closed'"
                  (nzOnConfirm)="transmit(sheet)"
                >
                  {{ 'passengerTransport.action.transmitFdse' | translate }}
                </button>
              }
              <button nz-button type="button" (click)="sheetPdf(sheet)">
                {{ 'passengerTransport.action.sheetPdf' | translate }}
              </button>
              <button nz-button type="button" (click)="interbusPdf(sheet)">
                {{ 'passengerTransport.action.interbusPdf' | translate }}
              </button>
            </div>
          } @else {
            <div class="actions">
              <button nz-button type="button" (click)="sheetPdf(sheet)">
                {{ 'passengerTransport.action.sheetPdf' | translate }}
              </button>
              <button nz-button type="button" (click)="interbusPdf(sheet)">
                {{ 'passengerTransport.action.interbusPdf' | translate }}
              </button>
            </div>
          }

          <nz-descriptions nzSize="small" [nzColumn]="1">
            @if (sheet.mit_fdse_protocol_code_it) {
              <nz-descriptions-item [nzTitle]="'passengerTransport.field.fdseProtocol' | translate">
                {{ sheet.mit_fdse_protocol_code_it }} ·
                {{ sheet.mit_fdse_transmitted_at | date: 'dd/MM/yyyy HH:mm' }}
              </nz-descriptions-item>
            }
            @if (sheet.interbus_eu_waybill_number) {
              <nz-descriptions-item
                [nzTitle]="'passengerTransport.field.interbusNumber' | translate"
                >{{ sheet.interbus_eu_waybill_number }}</nz-descriptions-item
              >
            }
            @if (sheet.digital_signature_hash) {
              <nz-descriptions-item
                [nzTitle]="'passengerTransport.field.signatureHash' | translate"
              >
                <code>{{ sheet.digital_signature_hash }}</code>
              </nz-descriptions-item>
            }
          </nz-descriptions>
        } @else if (canWrite) {
          <nz-empty [nzNotFoundContent]="'passengerTransport.empty.sheet' | translate">
            <ng-template #nzNotFoundFooter>
              <button nz-button nzType="primary" type="button" (click)="open()">
                {{ 'passengerTransport.action.openSheet' | translate }}
              </button>
            </ng-template>
          </nz-empty>
        }

        @if (canWrite) {
          <div class="section-title">{{ 'passengerTransport.section.generate' | translate }}</div>
          <p class="muted">{{ 'passengerTransport.hint.generate' | translate }}</p>
          <div class="actions">
            <label
              nz-checkbox
              for="ptr-cb-1"
              nzId="ptr-cb-1"
              [ngModel]="closeToo()"
              (ngModelChange)="closeToo.set($event)"
              >{{ 'passengerTransport.action.closeSheet' | translate }}</label
            >
            @if (jurisdictionIt()) {
              <label
                nz-checkbox
                for="ptr-cb-2"
                nzId="ptr-cb-2"
                [ngModel]="transmitToo()"
                (ngModelChange)="transmitToo.set($event)"
                >{{ 'passengerTransport.action.transmitFdse' | translate }}</label
              >
            }
            @if (canBill) {
              <label
                nz-checkbox
                for="ptr-cb-3"
                nzId="ptr-cb-3"
                [ngModel]="invoiceToo()"
                (ngModelChange)="invoiceToo.set($event)"
                >{{ 'passengerTransport.action.invoice' | translate }}</label
              >
            }
            <button nz-button nzType="primary" type="button" (click)="generate()">
              {{ 'passengerTransport.action.generate' | translate }}
            </button>
          </div>
        }

        <div class="section-title">{{ 'passengerTransport.section.welcomeSign' | translate }}</div>
        @if (store.sign(); as sign) {
          <div class="welcome-preview">
            @if (sign.logo_data_uri; as logo) {
              <img [src]="logo" [alt]="'passengerTransport.field.logo' | translate" />
            }
            <div>{{ sign.greeting }}</div>
            <div class="guest">{{ sign.text }}</div>
          </div>
        }
        <div class="actions">
          <button nz-button type="button" (click)="showSign.set(true)">
            {{ 'passengerTransport.action.fullScreenSign' | translate }}
          </button>
          <button nz-button type="button" (click)="signPdf()">
            {{ 'passengerTransport.action.signPdf' | translate }}
          </button>
          @if (canWrite) {
            <label class="upload-area" for="ptr-s-logo">
              <input
                id="ptr-s-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                (change)="onLogo($event)"
              />
            </label>
          }
        </div>
      }
    </nz-spin>

    @if (showSign() && store.sign(); as sign) {
      <app-ptr-welcome-sign [sign]="sign" (closed)="showSign.set(false)"></app-ptr-welcome-sign>
    }
  `,
})
export class ServiceSheetComponent implements OnInit {
  protected readonly store = inject(ServiceSheetStore);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = this.permissions.canWrite(PASSENGER_TRANSPORT_MODULE);
  protected readonly canBill = this.permissions.canWrite(PASSENGER_TRANSPORT_FINANCE_MODULE);

  protected readonly feedback = signal<PtrOutcome | null>(null);
  protected readonly showSign = signal(false);
  protected readonly manifest = signal<ManifestRow[]>([]);
  protected readonly closeToo = signal(true);
  protected readonly transmitToo = signal(false);
  protected readonly invoiceToo = signal(false);
  /** The MIT FDSE transmission is an Italian duty: the booking tells which regime the sheet falls under. */
  protected readonly jurisdictionIt = computed(
    () => this.store.booking()?.pickup_country_code !== 'CH',
  );

  protected readonly form = this.fb.group({
    garage_departure_at: this.fb.control<Date | null>(null),
    garage_departure_km: this.fb.control<number | null>(null),
    service_start_at: this.fb.control<Date | null>(null),
    service_start_km: this.fb.control<number | null>(null),
    service_end_at: this.fb.control<Date | null>(null),
    service_end_km: this.fb.control<number | null>(null),
    garage_return_at: this.fb.control<Date | null>(null),
    garage_return_km: this.fb.control<number | null>(null),
  });

  protected readonly statusColor = bookingStatusColor;
  protected readonly sheetColor = sheetStatusColor;

  private bookingId = '';
  private filledFor: string | null = null;

  async ngOnInit(): Promise<void> {
    this.bookingId = this.route.snapshot.paramMap.get('id') ?? '';
    await this.store.load(this.bookingId);
    this.fillFromCurrent();
  }

  protected patchRow(index: number, key: keyof ManifestRow, value: string): void {
    this.manifest.update((rows) =>
      rows.map((row, position) => (position === index ? { ...row, [key]: value } : row)),
    );
  }

  protected addRow(): void {
    this.manifest.update((rows) => [
      ...rows,
      { name: '', birth_date: '', document: '', nationality: '' },
    ]);
  }

  protected removeRow(index: number): void {
    this.manifest.update((rows) => rows.filter((_, position) => position !== index));
  }

  protected async open(): Promise<void> {
    this.report(
      await this.store.open(this.bookingId),
      'passengerTransport.notification.sheetOpened',
    );
    this.fillFromCurrent();
  }

  protected async save(sheet: PtrServiceSheet): Promise<void> {
    this.report(
      await this.store.save(this.bookingId, sheet.id, this.payload()),
      'passengerTransport.notification.sheetSaved',
    );
  }

  protected async close(sheet: PtrServiceSheet): Promise<void> {
    const saved = await this.store.save(this.bookingId, sheet.id, this.payload());
    if (!saved.ok) {
      this.feedback.set(saved);
      return;
    }
    this.report(
      await this.store.close(this.bookingId, sheet.id),
      'passengerTransport.notification.sheetClosed',
    );
  }

  protected async transmit(sheet: PtrServiceSheet): Promise<void> {
    this.report(
      await this.store.transmit(this.bookingId, sheet.id),
      'passengerTransport.notification.sheetTransmitted',
    );
  }

  protected async generate(): Promise<void> {
    const outcome = await this.store.generate(this.bookingId, {
      ...this.payload(),
      close: this.closeToo(),
      transmit: this.transmitToo() && this.jurisdictionIt(),
      invoice: this.invoiceToo() && this.canBill,
    });
    this.report(outcome, 'passengerTransport.notification.sheetGenerated');
    this.fillFromCurrent();
  }

  protected async sheetPdf(sheet: PtrServiceSheet): Promise<void> {
    await this.download(() => this.store.sheetPdf(sheet.id), `${sheet.number}.pdf`);
  }

  protected async interbusPdf(sheet: PtrServiceSheet): Promise<void> {
    await this.download(() => this.store.interbusPdf(sheet.id), `interbus-${sheet.number}.pdf`);
  }

  protected async signPdf(): Promise<void> {
    await this.download(
      () => this.store.signPdf(this.bookingId),
      `welcome-sign-${this.bookingId}.pdf`,
      true,
    );
  }

  protected async onLogo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (!file) {
      return;
    }
    this.report(
      await this.store.uploadLogo(
        this.bookingId,
        file,
        this.store.booking()?.vip_welcome_sign_text ?? undefined,
      ),
      'passengerTransport.notification.logoUploaded',
    );
    input.value = '';
  }

  private async download(
    load: () => Promise<Blob>,
    filename: string,
    preview = false,
  ): Promise<void> {
    try {
      const blob = await load();
      if (preview) {
        openBlob(blob);
      } else {
        downloadBlob(blob, filename);
      }
    } catch (error) {
      this.feedback.set(failureOf(error));
    }
  }

  private payload(): PtrServiceSheetPayload {
    const value = this.form.getRawValue();
    const passengers: PtrManifestPassenger[] = this.manifest()
      .filter((row) => row.name.trim() !== '')
      .map((row) => ({
        name: row.name.trim(),
        birth_date: row.birth_date || null,
        document: row.document.trim() || null,
        nationality: row.nationality.trim().toUpperCase() || null,
      }));
    return {
      garage_departure_at: toApiDateTime(value.garage_departure_at),
      garage_departure_km: value.garage_departure_km,
      service_start_at: toApiDateTime(value.service_start_at),
      service_start_km: value.service_start_km,
      service_end_at: toApiDateTime(value.service_end_at),
      service_end_km: value.service_end_km,
      garage_return_at: toApiDateTime(value.garage_return_at),
      garage_return_km: value.garage_return_km,
      passenger_manifest: passengers,
    };
  }

  /** Fills the form from the sheet being compiled, once per sheet (a reload after a save keeps what the dispatcher typed). */
  private fillFromCurrent(): void {
    const sheet = this.store.current();
    if (sheet === null || this.filledFor === sheet.id) {
      return;
    }
    this.filledFor = sheet.id;
    this.form.patchValue({
      garage_departure_at: parseInstant(sheet.garage_departure_at),
      garage_departure_km: sheet.garage_departure_km,
      service_start_at: parseInstant(sheet.service_start_at),
      service_start_km: sheet.service_start_km,
      service_end_at: parseInstant(sheet.service_end_at),
      service_end_km: sheet.service_end_km,
      garage_return_at: parseInstant(sheet.garage_return_at),
      garage_return_km: sheet.garage_return_km,
    });
    this.manifest.set(
      sheet.passenger_manifest.map((passenger) => ({
        name: passenger.name,
        birth_date: passenger.birth_date ?? '',
        document: passenger.document ?? '',
        nationality: passenger.nationality ?? '',
      })),
    );
    if (sheet.status !== 'open') {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
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
