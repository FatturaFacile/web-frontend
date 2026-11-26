import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { PermissionsService, PtrDriver, PtrDriverPayload, TranslateService } from '@core';
import { downloadBlob, PageHeaderComponent, TranslatePipe } from '@shared';
import { TachographStore } from './tachograph.store';
import {
  expiryColor,
  expiryState,
  failureOf,
  isTachographFile,
  parseInstant,
  PASSENGER_TRANSPORT_MODULE,
  PtrOutcome,
  toDateString,
} from './passenger-transport.util';

/**
 * The tachograph dashboard: the expiry of the documents of every driver (licence, CQC Persone, CZV, tachograph card), the upload of
 * .DDD files of the driver card with the infringements of EU 561/2006 found in them, and the 5 year archive.
 */
@Component({
  selector: 'app-ptr-tachograph',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    NzUploadModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [TachographStore],
  styleUrl: './passenger-transport.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.PASSENGER_TRANSPORT_TACHOGRAPH' | translate"
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
    @if (store.expiringDocuments() > 0) {
      <nz-alert
        class="feedback"
        nzType="warning"
        nzShowIcon
        [nzMessage]="
          'passengerTransport.hint.documentsExpiring'
            | translate: { count: store.expiringDocuments() }
        "
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading() || store.uploading()">
      <nz-tabs>
        <nz-tab [nzTitle]="'passengerTransport.section.drivers' | translate">
          @if (canWrite) {
            <div class="toolbar">
              <span class="spacer"></span>
              <button nz-button nzType="primary" type="button" (click)="openDriver(null)">
                {{ 'passengerTransport.action.newDriver' | translate }}
              </button>
            </div>
          }
          <nz-table
            #drivers
            nzSize="small"
            [nzData]="store.drivers()"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '900px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'passengerTransport.field.driver' | translate }}</th>
                <th scope="col">{{ 'passengerTransport.document.license' | translate }}</th>
                <th scope="col">CQC</th>
                <th scope="col">CZV</th>
                <th scope="col">{{ 'passengerTransport.document.tachographCard' | translate }}</th>
                <th scope="col">{{ 'passengerTransport.field.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (driver of drivers.data; track driver.id) {
                <tr>
                  <th scope="row">{{ driver.driver_name ?? driver.driver_employee_id }}</th>
                  <td>
                    <nz-tag [nzColor]="color(driver.driving_license_expiry_date)">
                      {{
                        driver.driving_license_expiry_date
                          ? (driver.driving_license_expiry_date | date: 'dd/MM/yyyy')
                          : ('passengerTransport.expiry.missing' | translate)
                      }}
                    </nz-tag>
                  </td>
                  <td>
                    <nz-tag [nzColor]="color(driver.cqc_persone_expiry_date)">
                      {{
                        driver.cqc_persone_expiry_date
                          ? (driver.cqc_persone_expiry_date | date: 'dd/MM/yyyy')
                          : ('passengerTransport.expiry.missing' | translate)
                      }}
                    </nz-tag>
                  </td>
                  <td>
                    <nz-tag [nzColor]="color(driver.czv_expiry_date)">
                      {{
                        driver.czv_expiry_date
                          ? (driver.czv_expiry_date | date: 'dd/MM/yyyy')
                          : ('passengerTransport.expiry.missing' | translate)
                      }}
                    </nz-tag>
                  </td>
                  <td>
                    <nz-tag [nzColor]="color(driver.tachograph_card_expiry_date)">
                      {{
                        driver.tachograph_card_expiry_date
                          ? (driver.tachograph_card_expiry_date | date: 'dd/MM/yyyy')
                          : ('passengerTransport.expiry.missing' | translate)
                      }}
                    </nz-tag>
                    @if (driver.tachograph_card_number) {
                      <small class="muted">{{ driver.tachograph_card_number }}</small>
                    }
                  </td>
                  <td class="row-actions">
                    @if (canWrite) {
                      <button nz-button nzSize="small" type="button" (click)="openDriver(driver)">
                        {{ 'passengerTransport.action.edit' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <nz-empty
                      [nzNotFoundContent]="'passengerTransport.empty.drivers' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'passengerTransport.section.ddd' | translate">
          <div class="toolbar">
            <label class="field" for="ptr-t-driver">
              <span>{{ 'passengerTransport.field.driver' | translate }}</span>
              <nz-select
                nzId="ptr-t-driver"
                nzAllowClear
                [ngModel]="store.driverFilter()"
                (ngModelChange)="store.setDriverFilter($event ?? null)"
              >
                @for (driver of store.drivers(); track driver.id) {
                  <nz-option
                    [nzValue]="driver.driver_employee_id"
                    [nzLabel]="driver.driver_name ?? driver.driver_employee_id"
                  ></nz-option>
                }
              </nz-select>
            </label>
          </div>

          @if (canWrite) {
            <div class="upload-area">
              <nz-upload
                nzType="drag"
                [nzBeforeUpload]="beforeUpload"
                [nzShowUploadList]="false"
                nzAccept=".ddd,.c1b,.v1b,.tgd"
              >
                <p>{{ 'passengerTransport.hint.dddUpload' | translate }}</p>
              </nz-upload>
              <p class="muted">{{ 'passengerTransport.hint.dddOwner' | translate }}</p>
            </div>
          }

          <nz-table
            #archives
            nzSize="small"
            [nzData]="store.archives()"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '800px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'passengerTransport.field.file' | translate }}</th>
                <th scope="col">{{ 'passengerTransport.field.driver' | translate }}</th>
                <th scope="col">{{ 'passengerTransport.field.period' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'passengerTransport.field.infringements' | translate }}
                </th>
                <th scope="col">{{ 'passengerTransport.field.uploadedAt' | translate }}</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              @for (archive of archives.data; track archive.id) {
                <tr>
                  <td>
                    {{ archive.original_name }}
                    <small class="muted">{{ archive.card_number ?? '' }}</small>
                  </td>
                  <td>
                    {{ archive.driver_name ?? store.driverName()(archive.driver_employee_id) }}
                  </td>
                  <td>
                    @if (archive.period_start) {
                      {{ archive.period_start | date: 'dd/MM/yyyy' }} –
                      {{ archive.period_end | date: 'dd/MM/yyyy' }}
                    } @else {
                      —
                    }
                  </td>
                  <td class="num">
                    <nz-tag [nzColor]="archive.infringements_count > 0 ? 'red' : 'green'">{{
                      archive.infringements_count
                    }}</nz-tag>
                  </td>
                  <td>{{ archive.uploaded_at | date: 'dd/MM/yyyy HH:mm' }}</td>
                  <td>
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      (click)="download(archive.id, archive.original_name)"
                    >
                      {{ 'passengerTransport.action.download' | translate }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <nz-empty
                      [nzNotFoundContent]="'passengerTransport.empty.archives' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab
          [nzTitle]="
            ('passengerTransport.section.infringements' | translate) +
            ' (' +
            store.infringementCount() +
            ')'
          "
        >
          <nz-table
            #infringements
            nzSize="small"
            [nzData]="store.infringements()"
            [nzShowPagination]="false"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'passengerTransport.field.date' | translate }}</th>
                <th scope="col">{{ 'passengerTransport.field.driver' | translate }}</th>
                <th scope="col">{{ 'passengerTransport.field.infringement' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'passengerTransport.field.minutes' | translate }}
                </th>
              </tr>
            </thead>
            <tbody>
              @for (row of infringements.data; track row.id) {
                <tr>
                  <td>{{ row.event_date | date: 'dd/MM/yyyy' }}</td>
                  <td>
                    {{ store.driverName()(row.driver_employee_id) || row.driver_employee_id }}
                  </td>
                  <td>
                    <nz-tag nzColor="red">{{
                      'passengerTransport.infringement.' + row.code | translate
                    }}</nz-tag>
                  </td>
                  <td class="num">{{ row.minutes }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4">
                    <nz-empty
                      [nzNotFoundContent]="'passengerTransport.hint.noFindings' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>
      </nz-tabs>
    </nz-spin>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzWidth]="520"
      [nzTitle]="'passengerTransport.section.driver' | translate"
      (nzOnClose)="closeDriver()"
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
        <form [formGroup]="form" class="form" (ngSubmit)="saveDriver()">
          @if (editing() === null) {
            <label class="field" for="ptr-d-employee">
              <span>{{ 'passengerTransport.field.employee' | translate }}</span>
              <nz-select
                nzId="ptr-d-employee"
                nzShowSearch
                nzServerSearch
                formControlName="driver_employee_id"
                (nzOnSearch)="store.searchEmployees($event)"
              >
                @for (employee of store.employees(); track employee.id) {
                  <nz-option [nzValue]="employee.id" [nzLabel]="employee.name"></nz-option>
                }
              </nz-select>
            </label>
          }
          <label class="field" for="ptr-d-license">
            <span>{{ 'passengerTransport.field.licenseNumber' | translate }}</span>
            <input nz-input id="ptr-d-license" formControlName="driving_license_number" />
          </label>
          <label class="field" for="ptr-d-categories">
            <span>{{ 'passengerTransport.field.licenseCategories' | translate }}</span>
            <nz-select
              nzId="ptr-d-categories"
              nzMode="tags"
              formControlName="driving_license_categories"
            ></nz-select>
          </label>
          <label class="field" for="ptr-d-license-exp">
            <span>{{ 'passengerTransport.field.licenseExpiry' | translate }}</span>
            <nz-date-picker
              nzId="ptr-d-license-exp"
              formControlName="driving_license_expiry_date"
            ></nz-date-picker>
          </label>
          <label class="field" for="ptr-d-cqc">
            <span>{{ 'passengerTransport.field.cqcNumber' | translate }}</span>
            <input nz-input id="ptr-d-cqc" formControlName="cqc_persone_number_it" />
          </label>
          <label class="field" for="ptr-d-cqc-exp">
            <span>{{ 'passengerTransport.field.cqcExpiry' | translate }}</span>
            <nz-date-picker
              nzId="ptr-d-cqc-exp"
              formControlName="cqc_persone_expiry_date"
            ></nz-date-picker>
          </label>
          <label class="field" for="ptr-d-czv">
            <span>{{ 'passengerTransport.field.czvNumber' | translate }}</span>
            <input nz-input id="ptr-d-czv" formControlName="czv_certificate_number_ch" />
          </label>
          <label class="field" for="ptr-d-czv-exp">
            <span>{{ 'passengerTransport.field.czvExpiry' | translate }}</span>
            <nz-date-picker nzId="ptr-d-czv-exp" formControlName="czv_expiry_date"></nz-date-picker>
          </label>
          <label class="field" for="ptr-d-card">
            <span>{{ 'passengerTransport.field.tachographCardNumber' | translate }}</span>
            <input nz-input id="ptr-d-card" formControlName="tachograph_card_number" />
          </label>
          <label class="field" for="ptr-d-card-exp">
            <span>{{ 'passengerTransport.field.tachographCardExpiry' | translate }}</span>
            <nz-date-picker
              nzId="ptr-d-card-exp"
              formControlName="tachograph_card_expiry_date"
            ></nz-date-picker>
          </label>
          <div class="actions">
            <button
              nz-button
              nzType="primary"
              type="submit"
              [nzLoading]="store.saving()"
              [disabled]="!canSubmit()"
            >
              {{ 'passengerTransport.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="closeDriver()">
              {{ 'passengerTransport.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class TachographComponent implements OnInit {
  protected readonly store = inject(TachographStore);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(PASSENGER_TRANSPORT_MODULE);

  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<PtrDriver | null>(null);
  protected readonly formError = signal<PtrOutcome | null>(null);
  protected readonly feedback = signal<PtrOutcome | null>(null);

  protected readonly form = this.fb.group({
    driver_employee_id: this.fb.control<string | null>(null),
    driving_license_number: this.fb.control(''),
    driving_license_categories: this.fb.control<string[]>([]),
    driving_license_expiry_date: this.fb.control<Date | null>(null),
    cqc_persone_number_it: this.fb.control(''),
    cqc_persone_expiry_date: this.fb.control<Date | null>(null),
    czv_certificate_number_ch: this.fb.control(''),
    czv_expiry_date: this.fb.control<Date | null>(null),
    tachograph_card_number: this.fb.control(''),
    tachograph_card_expiry_date: this.fb.control<Date | null>(null),
  });

  /** A new driver needs the employee it belongs to; an existing one is saved as is. */
  protected readonly canSubmit = computed(
    () => this.editing() !== null || this.form.controls.driver_employee_id.value !== null,
  );

  protected readonly color = (date: string | null): string => expiryColor(expiryState(date));

  ngOnInit(): void {
    void this.store.load();
  }

  /** The upload of a .DDD file: the archive attributes it to the driver whose card is in the file. */
  protected readonly beforeUpload = (file: NzUploadFile): boolean => {
    void this.upload(file as unknown as File);
    return false;
  };

  protected openDriver(driver: PtrDriver | null): void {
    this.editing.set(driver);
    this.formError.set(null);
    if (driver === null) {
      this.form.reset();
    } else {
      this.form.reset({
        driver_employee_id: driver.driver_employee_id,
        driving_license_number: driver.driving_license_number ?? '',
        driving_license_categories: driver.driving_license_categories,
        driving_license_expiry_date: parseInstant(driver.driving_license_expiry_date),
        cqc_persone_number_it: driver.cqc_persone_number_it ?? '',
        cqc_persone_expiry_date: parseInstant(driver.cqc_persone_expiry_date),
        czv_certificate_number_ch: driver.czv_certificate_number_ch ?? '',
        czv_expiry_date: parseInstant(driver.czv_expiry_date),
        tachograph_card_number: driver.tachograph_card_number ?? '',
        tachograph_card_expiry_date: parseInstant(driver.tachograph_card_expiry_date),
      });
    }
    this.drawerOpen.set(true);
  }

  protected closeDriver(): void {
    this.drawerOpen.set(false);
    this.editing.set(null);
  }

  protected async saveDriver(): Promise<void> {
    const value = this.form.getRawValue();
    const text = (input: string): string | null => (input.trim() === '' ? null : input.trim());
    const day = (date: Date | null): string | null => (date ? toDateString(date) : null);
    const current = this.editing();
    const payload: PtrDriverPayload = {
      ...(current === null && value.driver_employee_id
        ? { driver_employee_id: value.driver_employee_id }
        : {}),
      driving_license_number: text(value.driving_license_number),
      driving_license_categories: value.driving_license_categories,
      driving_license_expiry_date: day(value.driving_license_expiry_date),
      cqc_persone_number_it: text(value.cqc_persone_number_it),
      cqc_persone_expiry_date: day(value.cqc_persone_expiry_date),
      czv_certificate_number_ch: text(value.czv_certificate_number_ch),
      czv_expiry_date: day(value.czv_expiry_date),
      tachograph_card_number: text(value.tachograph_card_number),
      tachograph_card_expiry_date: day(value.tachograph_card_expiry_date),
    };
    const outcome = await this.store.saveDriver(payload, current?.id);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('passengerTransport.notification.driverSaved'));
      this.closeDriver();
    } else {
      this.formError.set(outcome);
    }
  }

  protected async download(id: string, name: string): Promise<void> {
    try {
      downloadBlob(await this.store.download(id), name);
    } catch (error) {
      this.feedback.set(failureOf(error));
    }
  }

  private async upload(file: File): Promise<void> {
    if (!isTachographFile(file.name)) {
      this.feedback.set({
        ...failureOf(null),
        errorKey: 'passengerTransport.error.ddd_file_unrecognised',
      });
      return;
    }
    const outcome = await this.store.upload(file, this.store.driverFilter() ?? undefined);
    if (outcome.ok) {
      this.feedback.set(null);
      this.message.success(this.i18n.instant('passengerTransport.notification.dddUploaded'));
    } else {
      this.feedback.set(outcome);
    }
  }
}
