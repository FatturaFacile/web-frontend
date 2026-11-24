import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ContactResource,
  CrmApiService,
  GeneralLedgerApiService,
  I18nService,
  PermissionsService,
  US_EXEMPTION_REASONS,
  US_NEXUS_TYPES,
  US_TAX_LEVELS,
  UsExemptionReason,
  UsNexusType,
  UsTaxCalculation,
  UsTaxExemptionCertificate,
  UsTaxJurisdiction,
  UsTaxLevel,
  UsTaxLookup,
  UsTaxNexus,
  UsTaxRate,
} from '@core';
import { IconActionDirective, MoneyPipe, TranslatePipe } from '@shared';

/** A rate with the jurisdiction it belongs to, for the rates table. */
interface RateRow {
  rate: UsTaxRate;
  jurisdiction: UsTaxJurisdiction;
}

/** US sales tax: jurisdictions with dated rates, nexus states, rate lookup, exemption certificates and a calculation preview. */
@Component({
  selector: 'app-gl-us-sales-tax',
  styleUrl: './gl-localization.scss',
  imports: [
    FormsModule,
    IconActionDirective,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    <nz-tabs>
      <nz-tab [nzTitle]="'GL.US_JURISDICTIONS' | translate">
        @if (canWrite) {
          <div class="filters">
            <button
              nz-button
              type="button"
              [nzLoading]="preloading()"
              (click)="preload()"
            >
              {{ 'GL.US_PRELOAD' | translate }}
            </button>
            <span>{{ 'GL.US_PRELOAD_HINT' | translate }}</span>
          </div>
        }
        <nz-table nzSize="small" [nzData]="jurisdictions()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'GL.US_CODE' | translate }}</th>
              <th>{{ 'GL.US_NAME' | translate }}</th>
              <th>{{ 'GL.US_STATE' | translate }}</th>
              <th>{{ 'GL.US_LEVEL' | translate }}</th>
              <th>{{ 'GL.US_AREA' | translate }}</th>
              <th class="num">{{ 'GL.US_CURRENT_RATE' | translate }}</th>
              @if (canWrite) {
                <th>{{ 'GL.US_ACTIONS' | translate }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (jurisdiction of jurisdictions(); track jurisdiction.id) {
              <tr>
                <td>{{ jurisdiction.code }}</td>
                <td>{{ jurisdiction.name }}</td>
                <td>{{ jurisdiction.state }}</td>
                <td>
                  <nz-tag>{{
                    'GL.US_LEVEL_' + jurisdiction.level.toUpperCase() | translate
                  }}</nz-tag>
                </td>
                <td>
                  {{ jurisdiction.county ?? jurisdiction.city ?? jurisdiction.zip_prefix ?? '' }}
                </td>
                <td class="num">{{ currentRate(jurisdiction) }}</td>
                @if (canWrite) {
                  <td>
                    <button
                      nz-button
                      nzType="text"
                      type="button"
                      appIconAction="edit"
                      (click)="editJurisdiction(jurisdiction)"
                    ></button>
                    <button
                      nz-button
                      nzType="text"
                      nzDanger
                      type="button"
                      appIconAction="delete"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'GL.US_DELETE_CONFIRM' | translate"
                      (nzOnConfirm)="removeJurisdiction(jurisdiction)"
                    ></button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </nz-table>

        <nz-card class="section" [nzTitle]="'GL.US_RATES' | translate">
          <nz-table nzSize="small" [nzData]="rateRows()" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'GL.US_JURISDICTION' | translate }}</th>
                <th class="num">{{ 'GL.US_RATE_PERCENT' | translate }}</th>
                <th>{{ 'GL.US_EFFECTIVE_FROM' | translate }}</th>
                <th>{{ 'GL.US_EFFECTIVE_TO' | translate }}</th>
                <th>{{ 'GL.US_APPLIES_TO_SHIPPING' | translate }}</th>
                @if (canWrite) {
                  <th>{{ 'GL.US_ACTIONS' | translate }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rateRows(); track row.rate.id) {
                <tr>
                  <td>{{ row.jurisdiction.code }} {{ row.jurisdiction.name }}</td>
                  <td class="num">{{ row.rate.rate_percent }}%</td>
                  <td>{{ row.rate.effective_from }}</td>
                  <td>{{ row.rate.effective_to }}</td>
                  <td>{{ (row.rate.applies_to_shipping ? 'GL.YES' : 'GL.NO') | translate }}</td>
                  @if (canWrite) {
                    <td>
                      <button
                        nz-button
                        nzType="text"
                        type="button"
                        appIconAction="edit"
                        (click)="editRate(row)"
                      ></button>
                      <button
                        nz-button
                        nzType="text"
                        nzDanger
                        type="button"
                        appIconAction="delete"
                        nz-popconfirm
                        [nzPopconfirmTitle]="'GL.US_DELETE_CONFIRM' | translate"
                        (nzOnConfirm)="removeRate(row.rate)"
                      ></button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>

        @if (canWrite) {
          <nz-card
            class="section"
            [nzTitle]="(editingJurisdictionId() ? 'GL.US_EDIT_JURISDICTION' : 'GL.US_ADD_JURISDICTION') | translate"
          >
            <div class="filters">
              <input
                nz-input
                class="field"
                [attr.aria-label]="'GL.US_CODE' | translate"
                [placeholder]="'GL.US_CODE' | translate"
                [(ngModel)]="jurisdictionCode"
                maxlength="40"
              />
              <input
                nz-input
                class="field"
                [attr.aria-label]="'GL.US_NAME' | translate"
                [placeholder]="'GL.US_NAME' | translate"
                [(ngModel)]="jurisdictionName"
                maxlength="160"
              />
              <input
                nz-input
                class="field"
                [attr.aria-label]="'GL.US_STATE' | translate"
                [placeholder]="'GL.US_STATE' | translate"
                [(ngModel)]="jurisdictionState"
                [disabled]="!!editingJurisdictionId()"
                maxlength="2"
              />
              <nz-select
                class="select-sm"
                [attr.aria-label]="'GL.US_LEVEL' | translate"
                [(ngModel)]="jurisdictionLevel"
                [nzDisabled]="!!editingJurisdictionId()"
              >
                @for (level of levels; track level) {
                  <nz-option
                    [nzValue]="level"
                    [nzLabel]="'GL.US_LEVEL_' + level.toUpperCase() | translate"
                  />
                }
              </nz-select>
              @if (jurisdictionLevel === 'county') {
                <input
                  nz-input
                  class="field"
                  [attr.aria-label]="'GL.US_COUNTY' | translate"
                  [placeholder]="'GL.US_COUNTY' | translate"
                  [(ngModel)]="jurisdictionCounty"
                  maxlength="80"
                />
              }
              @if (jurisdictionLevel === 'city') {
                <input
                  nz-input
                  class="field"
                  [attr.aria-label]="'GL.US_CITY' | translate"
                  [placeholder]="'GL.US_CITY' | translate"
                  [(ngModel)]="jurisdictionCity"
                  maxlength="80"
                />
              }
              @if (jurisdictionLevel === 'special') {
                <input
                  nz-input
                  class="field"
                  [attr.aria-label]="'GL.US_ZIP_PREFIX' | translate"
                  [placeholder]="'GL.US_ZIP_PREFIX' | translate"
                  [(ngModel)]="jurisdictionZipPrefix"
                  maxlength="10"
                />
              }
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="!jurisdictionValid()"
                [nzLoading]="saving()"
                (click)="saveJurisdiction()"
              >
                {{ (editingJurisdictionId() ? 'GL.US_SAVE' : 'GL.US_ADD') | translate }}
              </button>
              @if (editingJurisdictionId()) {
                <button nz-button type="button" (click)="resetJurisdictionForm()">
                  {{ 'GL.US_CANCEL_EDIT' | translate }}
                </button>
              }
            </div>
          </nz-card>

          <nz-card
            class="section"
            [nzTitle]="(editingRateId() ? 'GL.US_EDIT_RATE' : 'GL.US_ADD_RATE') | translate"
          >
            <div class="filters">
              <nz-select
                class="select-sm"
                [attr.aria-label]="'GL.US_JURISDICTION' | translate"
                [nzPlaceHolder]="'GL.US_JURISDICTION' | translate"
                [(ngModel)]="rateJurisdictionId"
                [nzDisabled]="!!editingRateId()"
              >
                @for (jurisdiction of jurisdictions(); track jurisdiction.id) {
                  <nz-option
                    [nzValue]="jurisdiction.id"
                    [nzLabel]="jurisdiction.code + ' ' + jurisdiction.name"
                  />
                }
              </nz-select>
              <nz-input-number
                [nzMin]="0"
                [nzMax]="25"
                [nzStep]="0.25"
                [nzPrecision]="4"
                [nzPlaceHolder]="'GL.US_RATE_PERCENT' | translate"
                [(ngModel)]="ratePercent"
              />
              <label for="us-rate-from">{{ 'GL.US_EFFECTIVE_FROM' | translate }}</label>
              <input
                class="date-input"
                id="us-rate-from"
                nz-input
                type="date"
                [(ngModel)]="rateFrom"
              />
              @if (editingRateId()) {
                <label for="us-rate-to">{{ 'GL.US_EFFECTIVE_TO' | translate }}</label>
                <input
                  class="date-input"
                  id="us-rate-to"
                  nz-input
                  type="date"
                  [(ngModel)]="rateTo"
                />
              }
              <!-- nz-checkbox renders its own input inside the label -->
              <label for="gl-us-sales-tax-field-2" nzId="gl-us-sales-tax-field-2" nz-checkbox [(ngModel)]="rateAppliesToShipping">{{
                'GL.US_APPLIES_TO_SHIPPING' | translate
              }}</label>
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="!rateValid()"
                [nzLoading]="saving()"
                (click)="saveRate()"
              >
                {{ (editingRateId() ? 'GL.US_SAVE' : 'GL.US_ADD') | translate }}
              </button>
              @if (editingRateId()) {
                <button nz-button type="button" (click)="resetRateForm()">
                  {{ 'GL.US_CANCEL_EDIT' | translate }}
                </button>
              }
            </div>
          </nz-card>
        }
      </nz-tab>

      <nz-tab [nzTitle]="'GL.US_NEXUS' | translate">
        <nz-table nzSize="small" [nzData]="nexus()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'GL.US_STATE' | translate }}</th>
              <th>{{ 'GL.US_NEXUS_TYPE' | translate }}</th>
              <th>{{ 'GL.US_ESTABLISHED_ON' | translate }}</th>
              <th>{{ 'GL.US_ENDED_ON' | translate }}</th>
              <th>{{ 'GL.US_REGISTRATION_NUMBER' | translate }}</th>
              @if (canWrite) {
                <th>{{ 'GL.US_ACTIONS' | translate }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of nexus(); track row.id) {
              <tr>
                <td>{{ row.state }}</td>
                <td>{{ 'GL.US_NEXUS_' + row.nexus_type.toUpperCase() | translate }}</td>
                <td>{{ row.established_on }}</td>
                <td>{{ row.ended_on }}</td>
                <td>{{ row.registration_number }}</td>
                @if (canWrite) {
                  <td>
                    <button
                      nz-button
                      nzType="text"
                      type="button"
                      appIconAction="edit"
                      (click)="editNexus(row)"
                    ></button>
                    <button
                      nz-button
                      nzType="text"
                      nzDanger
                      type="button"
                      appIconAction="delete"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'GL.US_DELETE_CONFIRM' | translate"
                      (nzOnConfirm)="removeNexus(row)"
                    ></button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </nz-table>

        @if (canWrite) {
          <nz-card
            class="section"
            [nzTitle]="(editingNexusId() ? 'GL.US_EDIT_NEXUS' : 'GL.US_ADD_NEXUS') | translate"
          >
            <div class="filters">
              <input
                nz-input
                class="field"
                [attr.aria-label]="'GL.US_STATE' | translate"
                [placeholder]="'GL.US_STATE' | translate"
                [(ngModel)]="nexusState"
                [disabled]="!!editingNexusId()"
                maxlength="2"
              />
              <nz-select
                class="select-sm"
                [attr.aria-label]="'GL.US_NEXUS_TYPE' | translate"
                [(ngModel)]="nexusType"
              >
                @for (type of nexusTypes; track type) {
                  <nz-option
                    [nzValue]="type"
                    [nzLabel]="'GL.US_NEXUS_' + type.toUpperCase() | translate"
                  />
                }
              </nz-select>
              <label for="us-nexus-from">{{ 'GL.US_ESTABLISHED_ON' | translate }}</label>
              <input
                class="date-input"
                id="us-nexus-from"
                nz-input
                type="date"
                [(ngModel)]="nexusEstablishedOn"
              />
              @if (editingNexusId()) {
                <label for="us-nexus-to">{{ 'GL.US_ENDED_ON' | translate }}</label>
                <input
                  class="date-input"
                  id="us-nexus-to"
                  nz-input
                  type="date"
                  [(ngModel)]="nexusEndedOn"
                />
              }
              <input
                nz-input
                class="field"
                [attr.aria-label]="'GL.US_REGISTRATION_NUMBER' | translate"
                [placeholder]="'GL.US_REGISTRATION_NUMBER' | translate"
                [(ngModel)]="nexusRegistration"
                maxlength="60"
              />
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="!nexusValid()"
                [nzLoading]="saving()"
                (click)="saveNexus()"
              >
                {{ (editingNexusId() ? 'GL.US_SAVE' : 'GL.US_ADD') | translate }}
              </button>
              @if (editingNexusId()) {
                <button nz-button type="button" (click)="resetNexusForm()">
                  {{ 'GL.US_CANCEL_EDIT' | translate }}
                </button>
              }
            </div>
          </nz-card>
        }
      </nz-tab>

      <nz-tab [nzTitle]="'GL.US_LOOKUP' | translate">
        <p>{{ 'GL.US_LOOKUP_HINT' | translate }}</p>
        <div class="filters">
          <input
            nz-input
            class="field"
            [attr.aria-label]="'GL.US_ZIP' | translate"
            [placeholder]="'GL.US_ZIP' | translate"
            [(ngModel)]="lookupZip"
            maxlength="10"
          />
          <input
            nz-input
            class="field"
            [attr.aria-label]="'GL.US_STATE' | translate"
            [placeholder]="'GL.US_STATE' | translate"
            [(ngModel)]="lookupState"
            maxlength="2"
          />
          <input
            nz-input
            class="field"
            [attr.aria-label]="'GL.US_COUNTY' | translate"
            [placeholder]="'GL.US_COUNTY' | translate"
            [(ngModel)]="lookupCounty"
            maxlength="80"
          />
          <input
            nz-input
            class="field"
            [attr.aria-label]="'GL.US_CITY' | translate"
            [placeholder]="'GL.US_CITY' | translate"
            [(ngModel)]="lookupCity"
            maxlength="80"
          />
          <label for="us-lookup-date">{{ 'GL.US_DATE' | translate }}</label>
          <input
            class="date-input"
            id="us-lookup-date"
            nz-input
            type="date"
            [(ngModel)]="lookupDate"
          />
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="!lookupValid()"
            [nzLoading]="looking()"
            (click)="lookup()"
          >
            {{ 'GL.US_LOOKUP_ACTION' | translate }}
          </button>
        </div>
        @if (lookupResult(); as found) {
          <div class="result">
            <nz-tag>{{ found.state }}</nz-tag>
            @if (!found.has_nexus) {
              <nz-tag nzColor="warning">{{ 'GL.US_NO_NEXUS_INFO' | translate }}</nz-tag>
            }
            <nz-table nzSize="small" [nzData]="found.lines" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'GL.US_JURISDICTION' | translate }}</th>
                  <th>{{ 'GL.US_LEVEL' | translate }}</th>
                  <th class="num">{{ 'GL.US_RATE_PERCENT' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (line of found.lines; track line.jurisdiction_id) {
                  <tr>
                    <td>{{ line.code }} {{ line.name }}</td>
                    <td>{{ 'GL.US_LEVEL_' + line.level.toUpperCase() | translate }}</td>
                    <td class="num">{{ line.rate_percent }}%</td>
                  </tr>
                }
              </tbody>
            </nz-table>
            <p class="num">
              <strong>{{ 'GL.US_TOTAL_RATE' | translate }}: {{ found.rate_percent }}%</strong>
            </p>
          </div>
        }
      </nz-tab>

      <nz-tab [nzTitle]="'GL.US_CERTIFICATES' | translate">
        <p>{{ 'GL.US_CERTIFICATES_HINT' | translate }}</p>
        <nz-table nzSize="small" [nzData]="certificates()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'GL.US_CUSTOMER' | translate }}</th>
              <th>{{ 'GL.US_STATE' | translate }}</th>
              <th>{{ 'GL.US_JURISDICTION' | translate }}</th>
              <th>{{ 'GL.US_CERT_NUMBER' | translate }}</th>
              <th>{{ 'GL.US_CERT_REASON' | translate }}</th>
              <th>{{ 'GL.US_CERT_ISSUED_ON' | translate }}</th>
              <th>{{ 'GL.US_CERT_EXPIRES_ON' | translate }}</th>
              <th>{{ 'GL.US_CERT_ACTIVE' | translate }}</th>
              @if (canWrite) {
                <th>{{ 'GL.US_ACTIONS' | translate }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (certificate of certificates(); track certificate.id) {
              <tr>
                <td>{{ contactName(certificate.contact_id) }}</td>
                <td>{{ certificate.state }}</td>
                <td>{{ jurisdictionLabel(certificate.jurisdiction_id) }}</td>
                <td>{{ certificate.certificate_number }}</td>
                <td>{{ 'GL.US_CERT_REASON_' + certificate.reason.toUpperCase() | translate }}</td>
                <td>{{ certificate.issued_on }}</td>
                <td>{{ certificate.expires_on }}</td>
                <td>{{ (certificate.is_active ? 'GL.YES' : 'GL.NO') | translate }}</td>
                @if (canWrite) {
                  <td>
                    <button
                      nz-button
                      nzType="text"
                      type="button"
                      appIconAction="edit"
                      (click)="editCertificate(certificate)"
                    ></button>
                    <button
                      nz-button
                      nzType="text"
                      nzDanger
                      type="button"
                      appIconAction="delete"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'GL.US_DELETE_CONFIRM' | translate"
                      (nzOnConfirm)="removeCertificate(certificate)"
                    ></button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </nz-table>

        @if (canWrite) {
          <nz-card
            class="section"
            [nzTitle]="(editingCertificateId() ? 'GL.US_CERT_EDIT' : 'GL.US_CERT_ADD') | translate"
          >
            <div class="filters">
              <nz-select
                class="select-sm"
                nzShowSearch
                [attr.aria-label]="'GL.US_CUSTOMER' | translate"
                [nzPlaceHolder]="'GL.US_CUSTOMER' | translate"
                [(ngModel)]="certContactId"
                [nzDisabled]="!!editingCertificateId()"
              >
                @for (contact of contacts(); track contact.id) {
                  <nz-option [nzValue]="contact.id" [nzLabel]="contactName(contact.id)" />
                }
              </nz-select>
              <input
                nz-input
                class="field"
                [attr.aria-label]="'GL.US_STATE' | translate"
                [placeholder]="'GL.US_STATE' | translate"
                [(ngModel)]="certState"
                [disabled]="!!editingCertificateId()"
                maxlength="2"
              />
              <nz-select
                class="select-sm"
                [attr.aria-label]="'GL.US_JURISDICTION' | translate"
                [nzPlaceHolder]="'GL.US_CERT_ALL_JURISDICTIONS' | translate"
                nzAllowClear
                [(ngModel)]="certJurisdictionId"
              >
                @for (jurisdiction of jurisdictions(); track jurisdiction.id) {
                  <nz-option
                    [nzValue]="jurisdiction.id"
                    [nzLabel]="jurisdiction.code + ' ' + jurisdiction.name"
                  />
                }
              </nz-select>
              <input
                nz-input
                class="field"
                [attr.aria-label]="'GL.US_CERT_NUMBER' | translate"
                [placeholder]="'GL.US_CERT_NUMBER' | translate"
                [(ngModel)]="certNumber"
                maxlength="60"
              />
              <nz-select
                class="select-sm"
                [attr.aria-label]="'GL.US_CERT_REASON' | translate"
                [(ngModel)]="certReason"
              >
                @for (reason of reasons; track reason) {
                  <nz-option
                    [nzValue]="reason"
                    [nzLabel]="'GL.US_CERT_REASON_' + reason.toUpperCase() | translate"
                  />
                }
              </nz-select>
              <label for="us-cert-issued">{{ 'GL.US_CERT_ISSUED_ON' | translate }}</label>
              <input
                class="date-input"
                id="us-cert-issued"
                nz-input
                type="date"
                [(ngModel)]="certIssuedOn"
              />
              <label for="us-cert-expires">{{ 'GL.US_CERT_EXPIRES_ON' | translate }}</label>
              <input
                class="date-input"
                id="us-cert-expires"
                nz-input
                type="date"
                [(ngModel)]="certExpiresOn"
              />
              <!-- nz-checkbox renders its own input inside the label -->
              <label for="gl-us-sales-tax-field" nzId="gl-us-sales-tax-field" nz-checkbox [(ngModel)]="certActive">{{ 'GL.US_CERT_ACTIVE' | translate }}</label>
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="!certificateValid()"
                [nzLoading]="saving()"
                (click)="saveCertificate()"
              >
                {{ (editingCertificateId() ? 'GL.US_SAVE' : 'GL.US_ADD') | translate }}
              </button>
              @if (editingCertificateId()) {
                <button nz-button type="button" (click)="resetCertificateForm()">
                  {{ 'GL.US_CANCEL_EDIT' | translate }}
                </button>
              }
            </div>
          </nz-card>
        }
      </nz-tab>

      <nz-tab [nzTitle]="'GL.US_CALCULATOR' | translate">
        <p>{{ 'GL.US_CALCULATOR_HINT' | translate }}</p>
        <div class="filters">
          <input
            nz-input
            class="field"
            [attr.aria-label]="'GL.US_STATE' | translate"
            [placeholder]="'GL.US_STATE' | translate"
            [(ngModel)]="calcState"
            maxlength="2"
          />
          <input
            nz-input
            class="field"
            [attr.aria-label]="'GL.US_COUNTY' | translate"
            [placeholder]="'GL.US_COUNTY' | translate"
            [(ngModel)]="calcCounty"
            maxlength="80"
          />
          <input
            nz-input
            class="field"
            [attr.aria-label]="'GL.US_CITY' | translate"
            [placeholder]="'GL.US_CITY' | translate"
            [(ngModel)]="calcCity"
            maxlength="80"
          />
          <input
            nz-input
            class="field"
            [attr.aria-label]="'GL.US_ZIP' | translate"
            [placeholder]="'GL.US_ZIP' | translate"
            [(ngModel)]="calcZip"
            maxlength="10"
          />
          <nz-select
            class="select-sm"
            nzShowSearch
            nzAllowClear
            [attr.aria-label]="'GL.US_CUSTOMER' | translate"
            [nzPlaceHolder]="'GL.US_CUSTOMER' | translate"
            [(ngModel)]="calcCustomerId"
          >
            @for (contact of contacts(); track contact.id) {
              <nz-option [nzValue]="contact.id" [nzLabel]="contactName(contact.id)" />
            }
          </nz-select>
          <label for="us-calc-date">{{ 'GL.US_DATE' | translate }}</label>
          <input class="date-input" id="us-calc-date" nz-input type="date" [(ngModel)]="calcDate" />
          <nz-input-number
            [nzMin]="0"
            [nzPrecision]="2"
            [nzPlaceHolder]="'GL.US_TAXABLE_AMOUNT' | translate"
            [(ngModel)]="calcTaxable"
          />
          <nz-input-number
            [nzMin]="0"
            [nzPrecision]="2"
            [nzPlaceHolder]="'GL.US_SHIPPING_AMOUNT' | translate"
            [(ngModel)]="calcShipping"
          />
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="!calcValid()"
            [nzLoading]="calculating()"
            (click)="calculate()"
          >
            {{ 'GL.US_CALCULATE' | translate }}
          </button>
        </div>
        @if (calculation(); as result) {
          <div class="result">
            @if (!result.has_nexus) {
              <nz-tag nzColor="warning">{{ 'GL.US_NO_NEXUS' | translate }}</nz-tag>
            }
            @if (result.reason === 'exempt') {
              <nz-tag nzColor="success">{{ 'GL.US_EXEMPT_ALL' | translate }}</nz-tag>
            }
            <nz-table nzSize="small" [nzData]="result.lines" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'GL.US_JURISDICTION' | translate }}</th>
                  <th>{{ 'GL.US_LEVEL' | translate }}</th>
                  <th class="num">{{ 'GL.US_RATE_PERCENT' | translate }}</th>
                  <th class="num">{{ 'GL.US_TAX' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (line of result.lines; track line.jurisdiction_id) {
                  <tr>
                    <td>
                      {{ line.code }} {{ line.name }}
                      @if (line.exempt) {
                        <nz-tag nzColor="success">{{ 'GL.US_EXEMPT' | translate }}</nz-tag>
                      }
                    </td>
                    <td>{{ 'GL.US_LEVEL_' + line.level.toUpperCase() | translate }}</td>
                    <td class="num">{{ line.rate_percent }}%</td>
                    <td class="num">{{ line.tax | money: 'USD' }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
            <p class="num">
              <strong
                >{{ 'GL.US_TOTAL_RATE' | translate }}: {{ result.rate_percent }}% -
                {{ 'GL.US_TAX_TOTAL' | translate }}: {{ result.tax_total | money: 'USD' }}</strong
              >
              @if (result.exempt_tax !== '0.00') {
                <br />{{ 'GL.US_EXEMPT_TAX' | translate }}: {{ result.exempt_tax | money: 'USD' }}
              }
            </p>
          </div>
        }
      </nz-tab>
    </nz-tabs>
  `,
})
export class GlUsSalesTaxComponent implements OnInit {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly crm = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly levels = US_TAX_LEVELS;
  protected readonly nexusTypes = US_NEXUS_TYPES;
  protected readonly reasons = US_EXEMPTION_REASONS;
  protected readonly jurisdictions = signal<UsTaxJurisdiction[]>([]);
  protected readonly nexus = signal<UsTaxNexus[]>([]);
  protected readonly certificates = signal<UsTaxExemptionCertificate[]>([]);
  protected readonly contacts = signal<ContactResource[]>([]);
  protected readonly calculation = signal<UsTaxCalculation | null>(null);
  protected readonly lookupResult = signal<UsTaxLookup | null>(null);
  protected readonly saving = signal(false);
  protected readonly calculating = signal(false);
  protected readonly looking = signal(false);
  protected readonly preloading = signal(false);
  protected readonly editingJurisdictionId = signal<string | null>(null);
  protected readonly editingRateId = signal<string | null>(null);
  protected readonly editingNexusId = signal<string | null>(null);
  protected readonly editingCertificateId = signal<string | null>(null);

  protected jurisdictionCode = '';
  protected jurisdictionName = '';
  protected jurisdictionState = '';
  protected jurisdictionLevel: UsTaxLevel = 'state';
  protected jurisdictionCounty = '';
  protected jurisdictionCity = '';
  protected jurisdictionZipPrefix = '';

  protected rateJurisdictionId: string | null = null;
  protected ratePercent: number | null = null;
  protected rateFrom = '';
  protected rateTo = '';
  protected rateAppliesToShipping = false;

  protected nexusState = '';
  protected nexusType: UsNexusType = 'physical';
  protected nexusEstablishedOn = '';
  protected nexusEndedOn = '';
  protected nexusRegistration = '';

  protected lookupZip = '';
  protected lookupState = '';
  protected lookupCounty = '';
  protected lookupCity = '';
  protected lookupDate = '';

  protected certContactId: string | null = null;
  protected certState = '';
  protected certJurisdictionId: string | null = null;
  protected certNumber = '';
  protected certReason: UsExemptionReason = 'resale';
  protected certIssuedOn = '';
  protected certExpiresOn = '';
  protected certActive = true;

  protected calcState = '';
  protected calcCounty = '';
  protected calcCity = '';
  protected calcZip = '';
  protected calcDate = '';
  protected calcCustomerId: string | null = null;
  protected calcTaxable: number | null = null;
  protected calcShipping: number | null = null;

  ngOnInit(): void {
    this.loadJurisdictions();
    this.loadNexus();
    this.loadCertificates();
    this.crm.getContacts({ per_page: 200 }).subscribe({ next: (res) => this.contacts.set(res.data) });
  }

  /** The rate in force today: the open-ended rate, or the one whose period contains today. */
  protected currentRate(jurisdiction: UsTaxJurisdiction): string {
    const today = new Date().toISOString().slice(0, 10);
    const rate = jurisdiction.rates.find(
      (item) =>
        item.effective_from <= today && (item.effective_to === null || item.effective_to >= today),
    );

    return rate ? `${rate.rate_percent}%` : '';
  }

  protected rateRows(): RateRow[] {
    return this.jurisdictions().flatMap((jurisdiction) =>
      jurisdiction.rates.map((rate) => ({ rate, jurisdiction })),
    );
  }

  protected contactName(id: string): string {
    const contact = this.contacts().find((item) => item.id === id);
    const name = contact?.company_name || `${contact?.first_name ?? ''} ${contact?.last_name ?? ''}`.trim();

    return name || id;
  }

  protected jurisdictionLabel(id: string | null): string {
    const jurisdiction = this.jurisdictions().find((item) => item.id === id);

    return jurisdiction ? `${jurisdiction.code} ${jurisdiction.name}` : this.i18n.translate('GL.US_CERT_ALL_JURISDICTIONS');
  }

  protected jurisdictionValid(): boolean {
    const areaOk =
      (this.jurisdictionLevel !== 'county' || !!this.jurisdictionCounty.trim()) &&
      (this.jurisdictionLevel !== 'city' || !!this.jurisdictionCity.trim()) &&
      (this.jurisdictionLevel !== 'special' || !!this.jurisdictionZipPrefix.trim());

    return (
      !!this.jurisdictionCode.trim() &&
      !!this.jurisdictionName.trim() &&
      /^[A-Za-z]{2}$/.test(this.jurisdictionState) &&
      areaOk
    );
  }

  protected rateValid(): boolean {
    return (
      !!this.rateJurisdictionId &&
      this.ratePercent !== null &&
      !!this.rateFrom &&
      !(this.rateTo && this.rateTo < this.rateFrom)
    );
  }

  protected nexusValid(): boolean {
    return (
      /^[A-Za-z]{2}$/.test(this.nexusState) &&
      !!this.nexusEstablishedOn &&
      !(this.nexusEndedOn && this.nexusEndedOn < this.nexusEstablishedOn)
    );
  }

  protected certificateValid(): boolean {
    return (
      !!this.certContactId &&
      /^[A-Za-z]{2}$/.test(this.certState) &&
      !!this.certNumber.trim() &&
      !!this.certIssuedOn &&
      !(this.certExpiresOn && this.certExpiresOn < this.certIssuedOn)
    );
  }

  protected lookupValid(): boolean {
    return /^[A-Za-z]{2}$/.test(this.lookupState) || !!this.lookupZip.trim();
  }

  protected calcValid(): boolean {
    return /^[A-Za-z]{2}$/.test(this.calcState) && this.calcTaxable !== null;
  }

  protected preload(): void {
    this.preloading.set(true);
    this.api.preloadUsTaxRates().subscribe({
      next: (res) => {
        this.preloading.set(false);
        this.message.success(
          this.i18n.translate('GL.US_PRELOAD_DONE', {
            created: res.data.created,
            skipped: res.data.skipped,
          }),
        );
        this.loadJurisdictions();
      },
      error: () => this.preloading.set(false),
    });
  }

  protected editJurisdiction(jurisdiction: UsTaxJurisdiction): void {
    this.editingJurisdictionId.set(jurisdiction.id);
    this.jurisdictionCode = jurisdiction.code;
    this.jurisdictionName = jurisdiction.name;
    this.jurisdictionState = jurisdiction.state;
    this.jurisdictionLevel = jurisdiction.level;
    this.jurisdictionCounty = jurisdiction.county ?? '';
    this.jurisdictionCity = jurisdiction.city ?? '';
    this.jurisdictionZipPrefix = jurisdiction.zip_prefix ?? '';
  }

  protected resetJurisdictionForm(): void {
    this.editingJurisdictionId.set(null);
    this.jurisdictionCode = '';
    this.jurisdictionName = '';
    this.jurisdictionState = '';
    this.jurisdictionLevel = 'state';
    this.jurisdictionCounty = '';
    this.jurisdictionCity = '';
    this.jurisdictionZipPrefix = '';
  }

  protected saveJurisdiction(): void {
    if (!this.jurisdictionValid()) {
      return;
    }
    const county = this.jurisdictionLevel === 'county' ? this.jurisdictionCounty.trim() : null;
    const city = this.jurisdictionLevel === 'city' ? this.jurisdictionCity.trim() : null;
    const zipPrefix = this.jurisdictionLevel === 'special' ? this.jurisdictionZipPrefix.trim() : null;
    const editingId = this.editingJurisdictionId();
    this.saving.set(true);
    const request = editingId
      ? this.api.updateUsTaxJurisdiction(editingId, {
          code: this.jurisdictionCode.trim(),
          name: this.jurisdictionName.trim(),
          county,
          city,
          zip_prefix: zipPrefix,
        })
      : this.api.createUsTaxJurisdiction({
          code: this.jurisdictionCode.trim(),
          name: this.jurisdictionName.trim(),
          state: this.jurisdictionState.toUpperCase(),
          level: this.jurisdictionLevel,
          county,
          city,
          zip_prefix: zipPrefix,
        });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('GL.US_SAVED'));
        this.resetJurisdictionForm();
        this.loadJurisdictions();
      },
      error: () => this.saving.set(false),
    });
  }

  protected removeJurisdiction(jurisdiction: UsTaxJurisdiction): void {
    this.api.deleteUsTaxJurisdiction(jurisdiction.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.US_DELETED'));
        if (this.editingJurisdictionId() === jurisdiction.id) {
          this.resetJurisdictionForm();
        }
        this.loadJurisdictions();
      },
    });
  }

  protected editRate(row: RateRow): void {
    this.editingRateId.set(row.rate.id);
    this.rateJurisdictionId = row.jurisdiction.id;
    this.ratePercent = Number(row.rate.rate_percent);
    this.rateFrom = row.rate.effective_from;
    this.rateTo = row.rate.effective_to ?? '';
    this.rateAppliesToShipping = row.rate.applies_to_shipping;
  }

  protected resetRateForm(): void {
    this.editingRateId.set(null);
    this.rateJurisdictionId = null;
    this.ratePercent = null;
    this.rateFrom = '';
    this.rateTo = '';
    this.rateAppliesToShipping = false;
  }

  protected saveRate(): void {
    if (!this.rateValid() || this.rateJurisdictionId === null || this.ratePercent === null) {
      return;
    }
    const editingId = this.editingRateId();
    this.saving.set(true);
    const request = editingId
      ? this.api.updateUsTaxRate(editingId, {
          rate_percent: this.ratePercent,
          effective_from: this.rateFrom,
          effective_to: this.rateTo || null,
          applies_to_shipping: this.rateAppliesToShipping,
        })
      : this.api.createUsTaxRate(this.rateJurisdictionId, {
          rate_percent: this.ratePercent,
          effective_from: this.rateFrom,
          applies_to_shipping: this.rateAppliesToShipping,
        });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('GL.US_SAVED'));
        this.resetRateForm();
        this.loadJurisdictions();
      },
      error: () => this.saving.set(false),
    });
  }

  protected removeRate(rate: UsTaxRate): void {
    this.api.deleteUsTaxRate(rate.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.US_DELETED'));
        if (this.editingRateId() === rate.id) {
          this.resetRateForm();
        }
        this.loadJurisdictions();
      },
    });
  }

  protected editNexus(row: UsTaxNexus): void {
    this.editingNexusId.set(row.id);
    this.nexusState = row.state;
    this.nexusType = row.nexus_type;
    this.nexusEstablishedOn = row.established_on;
    this.nexusEndedOn = row.ended_on ?? '';
    this.nexusRegistration = row.registration_number ?? '';
  }

  protected resetNexusForm(): void {
    this.editingNexusId.set(null);
    this.nexusState = '';
    this.nexusType = 'physical';
    this.nexusEstablishedOn = '';
    this.nexusEndedOn = '';
    this.nexusRegistration = '';
  }

  protected saveNexus(): void {
    if (!this.nexusValid()) {
      return;
    }
    const editingId = this.editingNexusId();
    this.saving.set(true);
    const request = editingId
      ? this.api.updateUsTaxNexus(editingId, {
          nexus_type: this.nexusType,
          established_on: this.nexusEstablishedOn,
          ended_on: this.nexusEndedOn || null,
          registration_number: this.nexusRegistration.trim() || null,
        })
      : this.api.createUsTaxNexus({
          state: this.nexusState.toUpperCase(),
          nexus_type: this.nexusType,
          established_on: this.nexusEstablishedOn,
          registration_number: this.nexusRegistration.trim() || null,
        });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('GL.US_SAVED'));
        this.resetNexusForm();
        this.loadNexus();
      },
      error: () => this.saving.set(false),
    });
  }

  protected removeNexus(row: UsTaxNexus): void {
    this.api.deleteUsTaxNexus(row.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.US_DELETED'));
        if (this.editingNexusId() === row.id) {
          this.resetNexusForm();
        }
        this.loadNexus();
      },
    });
  }

  protected lookup(): void {
    if (!this.lookupValid()) {
      return;
    }
    this.looking.set(true);
    this.api
      .lookupUsTaxRate({
        state: this.lookupState.trim().toUpperCase() || null,
        zip: this.lookupZip.trim() || null,
        county: this.lookupCounty.trim() || null,
        city: this.lookupCity.trim() || null,
        date: this.lookupDate || null,
      })
      .subscribe({
        next: (res) => {
          this.looking.set(false);
          this.lookupResult.set(res.data);
        },
        error: () => this.looking.set(false),
      });
  }

  protected editCertificate(certificate: UsTaxExemptionCertificate): void {
    this.editingCertificateId.set(certificate.id);
    this.certContactId = certificate.contact_id;
    this.certState = certificate.state;
    this.certJurisdictionId = certificate.jurisdiction_id;
    this.certNumber = certificate.certificate_number;
    this.certReason = certificate.reason;
    this.certIssuedOn = certificate.issued_on;
    this.certExpiresOn = certificate.expires_on ?? '';
    this.certActive = certificate.is_active;
  }

  protected resetCertificateForm(): void {
    this.editingCertificateId.set(null);
    this.certContactId = null;
    this.certState = '';
    this.certJurisdictionId = null;
    this.certNumber = '';
    this.certReason = 'resale';
    this.certIssuedOn = '';
    this.certExpiresOn = '';
    this.certActive = true;
  }

  protected saveCertificate(): void {
    if (!this.certificateValid() || this.certContactId === null) {
      return;
    }
    const editingId = this.editingCertificateId();
    this.saving.set(true);
    const request = editingId
      ? this.api.updateUsTaxExemptionCertificate(editingId, {
          jurisdiction_id: this.certJurisdictionId,
          certificate_number: this.certNumber.trim(),
          reason: this.certReason,
          issued_on: this.certIssuedOn,
          expires_on: this.certExpiresOn || null,
          is_active: this.certActive,
        })
      : this.api.createUsTaxExemptionCertificate({
          contact_id: this.certContactId,
          state: this.certState.toUpperCase(),
          jurisdiction_id: this.certJurisdictionId,
          certificate_number: this.certNumber.trim(),
          reason: this.certReason,
          issued_on: this.certIssuedOn,
          expires_on: this.certExpiresOn || null,
          is_active: this.certActive,
        });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('GL.US_SAVED'));
        this.resetCertificateForm();
        this.loadCertificates();
      },
      error: () => this.saving.set(false),
    });
  }

  protected removeCertificate(certificate: UsTaxExemptionCertificate): void {
    this.api.deleteUsTaxExemptionCertificate(certificate.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.US_DELETED'));
        if (this.editingCertificateId() === certificate.id) {
          this.resetCertificateForm();
        }
        this.loadCertificates();
      },
    });
  }

  protected calculate(): void {
    if (!this.calcValid() || this.calcTaxable === null) {
      return;
    }
    this.calculating.set(true);
    this.api
      .calculateUsSalesTax({
        state: this.calcState.toUpperCase(),
        date: this.calcDate || null,
        taxable_amount: this.calcTaxable,
        shipping_amount: this.calcShipping,
        county: this.calcCounty.trim() || null,
        city: this.calcCity.trim() || null,
        zip: this.calcZip.trim() || null,
        customer_id: this.calcCustomerId,
      })
      .subscribe({
        next: (res) => {
          this.calculating.set(false);
          this.calculation.set(res.data);
        },
        error: () => this.calculating.set(false),
      });
  }

  private loadJurisdictions(): void {
    this.api.getUsTaxJurisdictions().subscribe({ next: (res) => this.jurisdictions.set(res.data) });
  }

  private loadNexus(): void {
    this.api.getUsTaxNexus().subscribe({ next: (res) => this.nexus.set(res.data) });
  }

  private loadCertificates(): void {
    this.api.getUsTaxExemptionCertificates().subscribe({ next: (res) => this.certificates.set(res.data) });
  }
}
