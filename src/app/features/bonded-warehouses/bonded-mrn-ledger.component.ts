import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import {
  BondedWarehousesApiService,
  BW_ALLOCATION_METHODS,
  BW_CUSTOMS_STATUSES,
  BW_DECLARATION_TYPES,
  BW_DISCHARGE_TYPES,
  BW_REGIME_TYPES,
  BW_USUAL_HANDLING_OPERATIONS,
  BwCustomsStatus,
  BwDischargePayload,
  BwInboundMrnPayload,
  BwMrnLot,
  BwRegimeType,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { BondedProductSelectComponent } from './bonded-product-select.component';
import { BondedLookupStore, BondedMrnStore } from './bonded-warehouses.stores';
import {
  BONDED_WAREHOUSES_MODULE,
  BwOutcome,
  customsStatusColor,
  isValidMrn,
  isValidTaric,
  normalizeMrn,
  todayIso,
  toNumber,
} from './bonded-warehouses.util';

/**
 * Bonded stock ledger per MRN (CDU 7100 / OZL): the filterable table of the MRN lots, the drill-down drawer with every IM4 / EX3 / T1 / usual
 * handling movement of a lot, the inbound registration form (IM7 / Passar) and the discharge form with the FIFO / Specific MRN simulator.
 */
@Component({
  selector: 'app-bonded-mrn-ledger',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    BondedProductSelectComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [BondedMrnStore],
  styleUrl: './bonded-warehouses.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.BONDED_WAREHOUSES_MRN_LEDGER' | translate"
      [subtitle]="'bondedWarehouses.section.ledgerSubtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (notice(); as text) {
      <nz-alert
        class="feedback"
        nzType="success"
        nzShowIcon
        nzCloseable
        [nzMessage]="text | translate"
      ></nz-alert>
    }

    <div class="toolbar">
      <label class="field" for="bw-f-mrn">
        <span>{{ 'bondedWarehouses.filter.mrn' | translate }}</span>
        <input nz-input id="bw-f-mrn" [(ngModel)]="mrn" (keyup.enter)="reload()" />
      </label>
      <label class="field" for="bw-f-taric">
        <span>{{ 'bondedWarehouses.filter.taric' | translate }}</span>
        <input nz-input id="bw-f-taric" [(ngModel)]="taric" (keyup.enter)="reload()" />
      </label>
      <label class="field" for="bw-f-regime">
        <span>{{ 'bondedWarehouses.filter.regime' | translate }}</span>
        <nz-select nzId="bw-f-regime" nzAllowClear [(ngModel)]="regime" (ngModelChange)="reload()">
          @for (item of customsRegimes; track item) {
            <nz-option
              [nzValue]="item"
              [nzLabel]="'bondedWarehouses.regime.' + item | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="bw-f-origin">
        <span>{{ 'bondedWarehouses.filter.origin' | translate }}</span>
        <input
          nz-input
          id="bw-f-origin"
          maxlength="2"
          [(ngModel)]="origin"
          (keyup.enter)="reload()"
        />
      </label>
      <label class="field" for="bw-f-status">
        <span>{{ 'bondedWarehouses.filter.status' | translate }}</span>
        <nz-select nzId="bw-f-status" nzAllowClear [(ngModel)]="status" (ngModelChange)="reload()">
          @for (item of statuses; track item) {
            <nz-option
              [nzValue]="item"
              [nzLabel]="'bondedWarehouses.customsStatus.' + item | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label
        for="bw-f-balance"
        nzId="bw-f-balance"
        nz-checkbox
        [(ngModel)]="hasBalance"
        (ngModelChange)="reload()"
      >
        {{ 'bondedWarehouses.filter.hasBalance' | translate }}
      </label>
      <span class="spacer"></span>
      <button nz-button type="button" data-test="export-csv" (click)="exportFile('csv')">
        {{ 'bondedWarehouses.action.exportCsv' | translate }}
      </button>
      <button nz-button type="button" data-test="export-pdf" (click)="exportFile('pdf')">
        {{ 'bondedWarehouses.action.exportPdf' | translate }}
      </button>
      @if (canWrite) {
        <button nz-button type="button" data-test="new-inbound" (click)="openInbound()">
          {{ 'bondedWarehouses.action.newInbound' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-test="new-discharge"
          (click)="openDischarge()"
        >
          {{ 'bondedWarehouses.action.discharge' | translate }}
        </button>
      }
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #lots
        nzSize="small"
        [nzFrontPagination]="false"
        [nzData]="store.lots()"
        [nzTotal]="store.meta()?.total ?? 0"
        [nzPageSize]="store.meta()?.per_page ?? 25"
        [nzPageIndex]="store.meta()?.current_page ?? 1"
        [nzScroll]="{ x: '1200px' }"
        (nzPageIndexChange)="page($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'bondedWarehouses.column.mrn' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.authorization' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.declaration' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.entryDate' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.taric' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.origin' | translate }}</th>
            <th scope="col" class="numeric">
              {{ 'bondedWarehouses.column.remaining' | translate }}
            </th>
            <th scope="col" class="numeric">
              {{ 'bondedWarehouses.column.suspendedDuty' | translate }}
            </th>
            <th scope="col" class="numeric">
              {{ 'bondedWarehouses.column.suspendedVat' | translate }}
            </th>
            <th scope="col" class="numeric">
              {{ 'bondedWarehouses.column.cguEngaged' | translate }}
            </th>
            <th scope="col">{{ 'bondedWarehouses.column.status' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (row of lots.data; track row.id) {
            <tr [attr.data-test]="'lot-' + row.id">
              <td>{{ row.mrn_number }} / {{ row.mrn_item_number }}</td>
              <td>{{ row.authorization_code }}</td>
              <td>{{ 'bondedWarehouses.declaration.' + row.declaration_type | translate }}</td>
              <td>{{ row.entry_date | date: 'shortDate' }}</td>
              <td>{{ row.taric_hs_code }}</td>
              <td>
                {{ row.country_of_origin }}
                @if (row.preferential_origin) {
                  <nz-tag nzColor="cyan">{{
                    'bondedWarehouses.tag.preferential' | translate
                  }}</nz-tag>
                }
              </td>
              <td class="numeric">
                {{ num(row.remaining_quantity) | number: '1.0-4' }} {{ row.unit_of_measure }}
              </td>
              <td class="numeric">
                {{ num(row.suspended_duty_amount) | currency: row.currency ?? 'EUR' }}
              </td>
              <td class="numeric">
                {{ num(row.suspended_vat_amount) | currency: row.currency ?? 'EUR' }}
              </td>
              <td class="numeric">
                {{ num(row.cgu_engaged_amount) | currency: row.currency ?? 'EUR' }}
              </td>
              <td>
                <nz-tag [nzColor]="color(row.customs_status)">{{
                  'bondedWarehouses.customsStatus.' + row.customs_status | translate
                }}</nz-tag>
              </td>
              <td>
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  [attr.data-test]="'open-' + row.id"
                  (click)="openDetail(row)"
                >
                  {{ 'bondedWarehouses.action.traceability' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="12">
                <nz-empty
                  [nzNotFoundContent]="'bondedWarehouses.empty.lots' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-drawer
      [nzVisible]="store.detail() !== null"
      nzPlacement="right"
      [nzWidth]="760"
      [nzTitle]="'bondedWarehouses.section.traceability' | translate"
      (nzOnClose)="store.closeDetail()"
    >
      <ng-container *nzDrawerContent>
        @if (store.detail(); as lot) {
          <nz-descriptions nzSize="small" [nzColumn]="2" nzBordered>
            <nz-descriptions-item [nzTitle]="'bondedWarehouses.column.mrn' | translate"
              >{{ lot.mrn_number }} / {{ lot.mrn_item_number }}</nz-descriptions-item
            >
            <nz-descriptions-item [nzTitle]="'bondedWarehouses.column.status' | translate">{{
              'bondedWarehouses.customsStatus.' + lot.customs_status | translate
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'bondedWarehouses.column.taric' | translate">{{
              lot.taric_hs_code
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'bondedWarehouses.column.origin' | translate">{{
              lot.country_of_origin
            }}</nz-descriptions-item>
            <nz-descriptions-item
              [nzTitle]="'bondedWarehouses.column.initialQuantity' | translate"
              >{{ num(lot.initial_quantity) | number: '1.0-4' }}</nz-descriptions-item
            >
            <nz-descriptions-item [nzTitle]="'bondedWarehouses.column.remaining' | translate">{{
              num(lot.remaining_quantity) | number: '1.0-4'
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'bondedWarehouses.column.netWeight' | translate"
              >{{ num(lot.remaining_net_weight_kg) | number: '1.0-3' }} /
              {{ num(lot.initial_net_weight_kg) | number: '1.0-3' }} kg</nz-descriptions-item
            >
            <nz-descriptions-item [nzTitle]="'bondedWarehouses.column.customsValue' | translate">{{
              num(lot.customs_statistical_value) | currency: lot.currency ?? 'EUR'
            }}</nz-descriptions-item>
          </nz-descriptions>

          <h4 class="section-title">{{ 'bondedWarehouses.section.discharges' | translate }}</h4>
          <nz-table
            #moves
            nzSize="small"
            [nzData]="lot.discharges ?? []"
            [nzShowPagination]="false"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'bondedWarehouses.column.date' | translate }}</th>
                <th scope="col">{{ 'bondedWarehouses.column.dischargeType' | translate }}</th>
                <th scope="col">{{ 'bondedWarehouses.column.dischargeMrn' | translate }}</th>
                <th scope="col" class="numeric">
                  {{ 'bondedWarehouses.column.quantity' | translate }}
                </th>
                <th scope="col" class="numeric">
                  {{ 'bondedWarehouses.column.duty' | translate }}
                </th>
                <th scope="col" class="numeric">{{ 'bondedWarehouses.column.vat' | translate }}</th>
                <th scope="col" class="numeric">
                  {{ 'bondedWarehouses.column.cguReleased' | translate }}
                </th>
              </tr>
            </thead>
            <tbody>
              @for (move of moves.data; track move.id) {
                <tr [attr.data-test]="'move-' + move.id">
                  <td>{{ move.discharge_date | date: 'shortDate' }}</td>
                  <td>
                    {{ 'bondedWarehouses.dischargeType.' + move.discharge_type | translate }}
                    @if (move.usual_handling_code) {
                      <nz-tag>{{
                        'bondedWarehouses.usualHandling.' + move.usual_handling_code | translate
                      }}</nz-tag>
                    }
                  </td>
                  <td>{{ move.discharge_mrn_number }}</td>
                  <td class="numeric">{{ num(move.discharged_quantity) | number: '1.0-4' }}</td>
                  <td class="numeric">
                    {{
                      num(move.paid_duty_amount) + num(move.extinguished_duty_amount)
                        | currency: lot.currency ?? 'EUR'
                    }}
                  </td>
                  <td class="numeric">
                    {{
                      num(move.paid_vat_amount) + num(move.extinguished_vat_amount)
                        | currency: lot.currency ?? 'EUR'
                    }}
                  </td>
                  <td class="numeric">
                    {{ num(move.cgu_released_amount) | currency: lot.currency ?? 'EUR' }}
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7">
                    <nz-empty
                      [nzNotFoundContent]="'bondedWarehouses.empty.discharges' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-drawer>

    <nz-drawer
      [nzVisible]="inboundOpen()"
      nzPlacement="right"
      [nzWidth]="720"
      [nzTitle]="'bondedWarehouses.section.inbound' | translate"
      (nzOnClose)="inboundOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as error) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="error.key | translate: error.params"
          ></nz-alert>
        }
        <form nz-form nzLayout="vertical" [formGroup]="inboundForm" (ngSubmit)="submitInbound()">
          <div class="form-grid">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-in-auth">{{
                'bondedWarehouses.field.authorization' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="bw-in-auth" formControlName="authorization_id">
                  @for (item of customsAuthorizations(); track item.id) {
                    <nz-option [nzValue]="item.id" [nzLabel]="item.authorization_code"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-in-mrn">{{
                'bondedWarehouses.field.mrn' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="bw-in-mrn" maxlength="18" formControlName="mrn_number" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-in-item">{{
                'bondedWarehouses.field.mrnItem' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  id="bw-in-item"
                  type="number"
                  min="1"
                  formControlName="mrn_item_number"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-in-decl">{{
                'bondedWarehouses.field.declarationType' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="bw-in-decl" formControlName="declaration_type">
                  @for (item of declarations; track item) {
                    <nz-option
                      [nzValue]="item"
                      [nzLabel]="'bondedWarehouses.declaration.' + item | translate"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-in-date">{{
                'bondedWarehouses.field.entryDate' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="bw-in-date" type="date" formControlName="entry_date" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-in-product">{{
                'bondedWarehouses.field.product' | translate
              }}</nz-form-label>
              <nz-form-control>
                <app-bonded-product-select
                  inputId="bw-in-product"
                  [(value)]="inboundProduct"
                ></app-bonded-product-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-in-taric">{{
                'bondedWarehouses.field.taric' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="bw-in-taric" maxlength="10" formControlName="taric_hs_code" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-in-origin">{{
                'bondedWarehouses.field.origin' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  id="bw-in-origin"
                  maxlength="2"
                  formControlName="country_of_origin"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="bw-in-pref">{{
                'bondedWarehouses.field.preferentialOrigin' | translate
              }}</nz-form-label>
              <nz-form-control>
                <label
                  for="bw-in-pref"
                  nzId="bw-in-pref"
                  nz-checkbox
                  formControlName="preferential_origin"
                  >{{ 'bondedWarehouses.field.preferentialOrigin' | translate }}</label
                >
              </nz-form-control>
            </nz-form-item>
            @if (inboundForm.controls.preferential_origin.value) {
              <nz-form-item>
                <nz-form-label nzRequired nzFor="bw-in-agreement">{{
                  'bondedWarehouses.field.agreementCode' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <input
                    nz-input
                    id="bw-in-agreement"
                    formControlName="preferential_agreement_code"
                  />
                </nz-form-control>
              </nz-form-item>
            }
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-in-qty">{{
                'bondedWarehouses.field.quantity' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  id="bw-in-qty"
                  type="number"
                  min="0"
                  step="any"
                  formControlName="initial_quantity"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="bw-in-uom">{{
                'bondedWarehouses.field.unit' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="bw-in-uom" maxlength="10" formControlName="unit_of_measure" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-in-net">{{
                'bondedWarehouses.field.netWeight' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  id="bw-in-net"
                  type="number"
                  min="0"
                  step="any"
                  formControlName="initial_net_weight_kg"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="bw-in-gross">{{
                'bondedWarehouses.field.grossWeight' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  id="bw-in-gross"
                  type="number"
                  min="0"
                  step="any"
                  formControlName="initial_gross_weight_kg"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-in-value">{{
                'bondedWarehouses.field.customsValue' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  id="bw-in-value"
                  type="number"
                  min="0"
                  step="any"
                  formControlName="customs_statistical_value"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="bw-in-duty">{{
                'bondedWarehouses.field.dutyRate' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  id="bw-in-duty"
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  formControlName="duty_rate_percent"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="bw-in-vat">{{
                'bondedWarehouses.field.vatRate' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input
                  nz-input
                  id="bw-in-vat"
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  formControlName="vat_rate_percent"
                />
              </nz-form-control>
            </nz-form-item>
          </div>
          <p class="hint">{{ 'bondedWarehouses.help.suspended' | translate }}</p>
          <div class="drawer-actions">
            <button
              nz-button
              nzType="primary"
              type="submit"
              data-test="save-inbound"
              [disabled]="inboundForm.invalid || inboundProduct() === null"
            >
              {{ 'bondedWarehouses.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="inboundOpen.set(false)">
              {{ 'bondedWarehouses.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>

    <nz-drawer
      [nzVisible]="dischargeOpen()"
      nzPlacement="right"
      [nzWidth]="860"
      [nzTitle]="'bondedWarehouses.section.discharge' | translate"
      (nzOnClose)="closeDischarge()"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as error) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="error.key | translate: error.params"
          ></nz-alert>
        }
        <form nz-form nzLayout="vertical" [formGroup]="dischargeForm" (ngSubmit)="simulate()">
          <div class="form-grid">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-dis-auth">{{
                'bondedWarehouses.field.authorization' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="bw-dis-auth" formControlName="authorization_id">
                  @for (item of customsAuthorizations(); track item.id) {
                    <nz-option [nzValue]="item.id" [nzLabel]="item.authorization_code"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-dis-type">{{
                'bondedWarehouses.field.dischargeType' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="bw-dis-type" formControlName="discharge_type">
                  @for (item of dischargeTypes; track item) {
                    <nz-option
                      [nzValue]="item"
                      [nzLabel]="'bondedWarehouses.dischargeType.' + item | translate"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-dis-method">{{
                'bondedWarehouses.field.allocationMethod' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="bw-dis-method" formControlName="allocation_method">
                  @for (item of methods; track item) {
                    <nz-option
                      [nzValue]="item"
                      [nzLabel]="'bondedWarehouses.allocation.' + item | translate"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-dis-date">{{
                'bondedWarehouses.field.dischargeDate' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input nz-input id="bw-dis-date" type="date" formControlName="discharge_date" />
              </nz-form-control>
            </nz-form-item>

            @if (dischargeForm.controls.allocation_method.value === 'FIFO') {
              <nz-form-item>
                <nz-form-label nzRequired nzFor="bw-dis-product">{{
                  'bondedWarehouses.field.product' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <app-bonded-product-select
                    inputId="bw-dis-product"
                    [(value)]="dischargeProduct"
                  ></app-bonded-product-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="bw-dis-qty">{{
                  'bondedWarehouses.field.quantity' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <input
                    nz-input
                    id="bw-dis-qty"
                    type="number"
                    min="0"
                    step="any"
                    formControlName="quantity"
                  />
                </nz-form-control>
              </nz-form-item>
            }

            @if (dischargeForm.controls.discharge_type.value === 'UsualHandling_Annex71_03') {
              <nz-form-item>
                <nz-form-label nzRequired nzFor="bw-dis-uh">{{
                  'bondedWarehouses.field.usualHandling' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <nz-select nzId="bw-dis-uh" formControlName="usual_handling_code">
                    @for (item of usualHandlings; track item) {
                      <nz-option
                        [nzValue]="item"
                        [nzLabel]="'bondedWarehouses.usualHandling.' + item | translate"
                      ></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item class="wide">
                <nz-form-label nzFor="bw-dis-notes">{{
                  'bondedWarehouses.field.notes' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <textarea
                    nz-input
                    id="bw-dis-notes"
                    rows="2"
                    formControlName="usual_handling_notes"
                  ></textarea>
                </nz-form-control>
              </nz-form-item>
              <p class="hint wide">{{ 'bondedWarehouses.help.usualHandling' | translate }}</p>
            } @else {
              <nz-form-item>
                <nz-form-label nzRequired nzFor="bw-dis-mrn">{{
                  'bondedWarehouses.field.dischargeMrn' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <input
                    nz-input
                    id="bw-dis-mrn"
                    maxlength="18"
                    formControlName="discharge_mrn_number"
                  />
                </nz-form-control>
              </nz-form-item>
            }
          </div>

          @if (dischargeForm.controls.allocation_method.value === 'Specific_MRN') {
            <h4 class="section-title">{{ 'bondedWarehouses.section.allocations' | translate }}</h4>
            @for (group of allocations.controls; track group; let index = $index) {
              <div class="toolbar" [formGroup]="group">
                <label class="field" [for]="'bw-dis-lot-' + index">
                  <span>{{ 'bondedWarehouses.field.mrnLot' | translate }}</span>
                  <nz-select [nzId]="'bw-dis-lot-' + index" formControlName="mrn_lot_id">
                    @for (lot of openLots(); track lot.id) {
                      <nz-option
                        [nzValue]="lot.id"
                        [nzLabel]="
                          lot.mrn_number +
                          ' / ' +
                          lot.mrn_item_number +
                          ' (' +
                          lot.remaining_quantity +
                          ')'
                        "
                      ></nz-option>
                    }
                  </nz-select>
                </label>
                <label class="field" [for]="'bw-dis-aq-' + index">
                  <span>{{ 'bondedWarehouses.field.quantity' | translate }}</span>
                  <input
                    nz-input
                    [id]="'bw-dis-aq-' + index"
                    type="number"
                    min="0"
                    step="any"
                    formControlName="quantity"
                  />
                </label>
                <button nz-button nzDanger type="button" (click)="removeAllocation(index)">
                  {{ 'bondedWarehouses.action.removeAllocation' | translate }}
                </button>
              </div>
            }
            <button nz-button type="button" data-test="add-allocation" (click)="addAllocation()">
              {{ 'bondedWarehouses.action.addAllocation' | translate }}
            </button>
          }

          <div class="drawer-actions">
            <button nz-button type="submit" data-test="simulate" [disabled]="!canSubmitDischarge()">
              {{ 'bondedWarehouses.action.simulate' | translate }}
            </button>
            <button
              nz-button
              nzType="primary"
              type="button"
              data-test="execute"
              [disabled]="
                !canSubmitDischarge() || store.plan() === null || store.plan()?.simulated === false
              "
              (click)="execute()"
            >
              {{ 'bondedWarehouses.action.execute' | translate }}
            </button>
            <button nz-button type="button" (click)="closeDischarge()">
              {{ 'bondedWarehouses.action.close' | translate }}
            </button>
          </div>
        </form>

        @if (store.plan(); as plan) {
          <h4 class="section-title">
            {{
              (plan.simulated
                ? 'bondedWarehouses.section.simulation'
                : 'bondedWarehouses.section.executed'
              ) | translate
            }}
          </h4>
          <div class="summary-grid" data-test="discharge-summary">
            <span
              >{{ 'bondedWarehouses.summary.quantity' | translate }}:
              <strong>{{ plan.summary.total_quantity | number: '1.0-4' }}</strong></span
            >
            <span
              >{{ 'bondedWarehouses.summary.customsValue' | translate }}:
              <strong>{{
                plan.summary.total_customs_value | currency: plan.summary.currency
              }}</strong></span
            >
            <span
              >{{ 'bondedWarehouses.summary.dutyDue' | translate }}:
              <strong>{{
                plan.summary.total_duty_due | currency: plan.summary.currency
              }}</strong></span
            >
            <span
              >{{ 'bondedWarehouses.summary.vatDue' | translate }}:
              <strong>{{
                plan.summary.total_vat_due | currency: plan.summary.currency
              }}</strong></span
            >
            <span
              >{{ 'bondedWarehouses.summary.extinguished' | translate }}:
              <strong>{{
                plan.summary.total_duty_extinguished + plan.summary.total_vat_extinguished
                  | currency: plan.summary.currency
              }}</strong></span
            >
            <span
              >{{ 'bondedWarehouses.summary.cguReleased' | translate }}:
              <strong>{{
                plan.summary.total_cgu_released | currency: plan.summary.currency
              }}</strong></span
            >
            <nz-tag [nzColor]="plan.summary.customs_debt_arises ? 'orange' : 'green'">
              {{
                (plan.summary.customs_debt_arises
                  ? 'bondedWarehouses.summary.debtArises'
                  : 'bondedWarehouses.summary.noDebt'
                ) | translate
              }}
            </nz-tag>
          </div>
          <nz-table #planTable nzSize="small" [nzData]="plan.lines" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col">{{ 'bondedWarehouses.column.mrn' | translate }}</th>
                <th scope="col">{{ 'bondedWarehouses.column.taric' | translate }}</th>
                <th scope="col" class="numeric">
                  {{ 'bondedWarehouses.column.quantity' | translate }}
                </th>
                <th scope="col" class="numeric">
                  {{ 'bondedWarehouses.column.netWeight' | translate }}
                </th>
                <th scope="col" class="numeric">
                  {{ 'bondedWarehouses.column.customsValue' | translate }}
                </th>
                <th scope="col" class="numeric">
                  {{ 'bondedWarehouses.column.duty' | translate }}
                </th>
                <th scope="col" class="numeric">{{ 'bondedWarehouses.column.vat' | translate }}</th>
                <th scope="col" class="numeric">
                  {{ 'bondedWarehouses.column.cguReleased' | translate }}
                </th>
              </tr>
            </thead>
            <tbody>
              @for (line of planTable.data; track line.mrn_lot_id) {
                <tr>
                  <td>{{ line.mrn_number }} / {{ line.mrn_item_number }}</td>
                  <td>{{ line.taric_hs_code }}</td>
                  <td class="numeric">{{ line.quantity | number: '1.0-4' }}</td>
                  <td class="numeric">{{ line.net_weight_kg | number: '1.0-3' }}</td>
                  <td class="numeric">
                    {{ line.released_customs_value | currency: plan.summary.currency }}
                  </td>
                  <td class="numeric">{{ line.duty_amount | currency: plan.summary.currency }}</td>
                  <td class="numeric">{{ line.vat_amount | currency: plan.summary.currency }}</td>
                  <td class="numeric">
                    {{ line.cgu_release_amount | currency: plan.summary.currency }}
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class BondedMrnLedgerComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(BondedWarehousesApiService);
  protected readonly store = inject(BondedMrnStore);
  protected readonly lookup = inject(BondedLookupStore);
  protected readonly canWrite = inject(PermissionsService).canWrite(BONDED_WAREHOUSES_MODULE);

  protected readonly customsRegimes: BwRegimeType[] = BW_REGIME_TYPES.filter(
    (item) => item !== 'VatDepot_Art50Bis',
  );
  protected readonly statuses = BW_CUSTOMS_STATUSES;
  protected readonly declarations = BW_DECLARATION_TYPES;
  protected readonly dischargeTypes = BW_DISCHARGE_TYPES;
  protected readonly methods = BW_ALLOCATION_METHODS;
  protected readonly usualHandlings = BW_USUAL_HANDLING_OPERATIONS;

  protected mrn = '';
  protected taric = '';
  protected origin = '';
  protected regime: BwRegimeType | null = null;
  protected status: BwCustomsStatus | null = null;
  protected hasBalance = false;

  protected readonly notice = signal<string | null>(null);
  protected readonly formError = signal<{ key: string; params: Record<string, string> } | null>(
    null,
  );
  protected readonly inboundOpen = signal(false);
  protected readonly dischargeOpen = signal(false);
  protected readonly inboundProduct = signal<string | null>(null);
  protected readonly dischargeProduct = signal<string | null>(null);
  protected readonly openLots = signal<BwMrnLot[]>([]);
  protected readonly customsAuthorizations = computed(() =>
    this.lookup.authorizations().filter((item) => item.regime_type !== 'VatDepot_Art50Bis'),
  );

  protected readonly num = toNumber;
  protected readonly color = customsStatusColor;

  protected readonly inboundForm = this.fb.nonNullable.group({
    authorization_id: ['', Validators.required],
    mrn_number: [
      '',
      [
        Validators.required,
        (control: { value: string }) => (isValidMrn(control.value) ? null : { mrn: true }),
      ],
    ],
    mrn_item_number: [1, [Validators.required, Validators.min(1)]],
    declaration_type: ['IM7' as (typeof BW_DECLARATION_TYPES)[number], Validators.required],
    entry_date: [todayIso(), Validators.required],
    taric_hs_code: [
      '',
      [
        Validators.required,
        (control: { value: string }) => (isValidTaric(control.value) ? null : { taric: true }),
      ],
    ],
    country_of_origin: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(2)],
    ],
    preferential_origin: [false],
    preferential_agreement_code: [''],
    initial_quantity: [0, [Validators.required, Validators.min(0.0001)]],
    unit_of_measure: ['EA'],
    initial_net_weight_kg: [0, [Validators.required, Validators.min(0)]],
    initial_gross_weight_kg: [0, Validators.min(0)],
    customs_statistical_value: [0, [Validators.required, Validators.min(0)]],
    duty_rate_percent: [0, [Validators.min(0), Validators.max(100)]],
    vat_rate_percent: [22, [Validators.min(0), Validators.max(100)]],
  });

  protected readonly dischargeForm = this.fb.nonNullable.group({
    authorization_id: ['', Validators.required],
    discharge_type: [
      'IM4_FreeCirculation' as (typeof BW_DISCHARGE_TYPES)[number],
      Validators.required,
    ],
    allocation_method: ['FIFO' as (typeof BW_ALLOCATION_METHODS)[number], Validators.required],
    discharge_date: [todayIso(), Validators.required],
    quantity: [0],
    discharge_mrn_number: [''],
    usual_handling_code: ['' as '' | (typeof BW_USUAL_HANDLING_OPERATIONS)[number]],
    usual_handling_notes: [''],
    allocations: this.fb.array([this.allocationGroup()]),
  });

  protected get allocations() {
    return this.dischargeForm.controls.allocations;
  }

  constructor() {
    this.dischargeForm.controls.authorization_id.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this.loadOpenLots());
  }

  ngOnInit(): void {
    void this.lookup.load();
    this.reload();
  }

  protected reload(): void {
    void this.store.load(this.filters(1));
  }

  protected page(index: number): void {
    void this.store.load(this.filters(index));
  }

  protected async exportFile(format: 'csv' | 'pdf'): Promise<void> {
    const { page: _page, per_page: _perPage, ...filters } = this.filters(1);
    this.report(await this.store.exportFile('mrn-lots', format, filters), null);
  }

  protected async openDetail(lot: BwMrnLot): Promise<void> {
    await this.store.open(lot.id);
  }

  protected openInbound(): void {
    this.formError.set(null);
    this.inboundProduct.set(null);
    this.inboundOpen.set(true);
  }

  protected async submitInbound(): Promise<void> {
    const value = this.inboundForm.getRawValue();
    const product = this.inboundProduct();
    if (product === null) {
      return;
    }
    const payload: BwInboundMrnPayload = {
      authorization_id: value.authorization_id,
      mrn_number: normalizeMrn(value.mrn_number),
      mrn_item_number: value.mrn_item_number,
      declaration_type: value.declaration_type,
      entry_date: value.entry_date,
      product_id: product,
      wms_lot_id: null,
      taric_hs_code: value.taric_hs_code,
      country_of_origin: value.country_of_origin.toUpperCase(),
      preferential_origin: value.preferential_origin,
      preferential_agreement_code: value.preferential_origin
        ? value.preferential_agreement_code
        : null,
      initial_quantity: value.initial_quantity,
      unit_of_measure: value.unit_of_measure,
      initial_net_weight_kg: value.initial_net_weight_kg,
      initial_gross_weight_kg:
        value.initial_gross_weight_kg > 0
          ? value.initial_gross_weight_kg
          : value.initial_net_weight_kg,
      customs_statistical_value: value.customs_statistical_value,
      duty_rate_percent: value.duty_rate_percent,
      vat_rate_percent: value.vat_rate_percent,
    };
    const outcome = await this.store.registerInbound(payload);
    this.report(outcome, 'bondedWarehouses.message.inboundRegistered');
    if (outcome.ok) {
      this.inboundOpen.set(false);
      void this.lookup.load(true);
      this.reload();
    }
  }

  protected openDischarge(): void {
    this.formError.set(null);
    this.store.clearPlan();
    this.dischargeProduct.set(null);
    this.dischargeOpen.set(true);
  }

  protected closeDischarge(): void {
    this.dischargeOpen.set(false);
    this.store.clearPlan();
  }

  protected async loadOpenLots(): Promise<void> {
    const authorizationId = this.dischargeForm.controls.authorization_id.value;
    if (authorizationId === '') {
      this.openLots.set([]);
      return;
    }
    try {
      const page = await firstValueFrom(
        this.api.listMrnLots({
          authorization_id: authorizationId,
          has_balance: true,
          per_page: 100,
        }),
      );
      this.openLots.set(page.data);
    } catch {
      this.openLots.set([]);
    }
  }

  protected addAllocation(): void {
    this.allocations.push(this.allocationGroup());
  }

  protected removeAllocation(index: number): void {
    if (this.allocations.length > 1) {
      this.allocations.removeAt(index);
    }
  }

  protected canSubmitDischarge(): boolean {
    const value = this.dischargeForm.getRawValue();
    if (value.authorization_id === '' || value.discharge_date === '') {
      return false;
    }
    const usual = value.discharge_type === 'UsualHandling_Annex71_03';
    if (usual && value.usual_handling_code === '') {
      return false;
    }
    if (value.allocation_method === 'FIFO') {
      return this.dischargeProduct() !== null && value.quantity > 0;
    }
    return value.allocations.some((row) => row.mrn_lot_id !== '' && row.quantity > 0);
  }

  protected async simulate(): Promise<void> {
    this.report(await this.store.simulate(this.dischargePayload()), null);
  }

  protected async execute(): Promise<void> {
    const outcome = await this.store.execute(this.dischargePayload());
    this.report(outcome, 'bondedWarehouses.message.dischargeExecuted');
    if (outcome.ok) {
      void this.lookup.load(true);
      this.reload();
    }
  }

  private dischargePayload(): BwDischargePayload {
    const value = this.dischargeForm.getRawValue();
    const usual = value.discharge_type === 'UsualHandling_Annex71_03';
    const fifo = value.allocation_method === 'FIFO';

    return {
      authorization_id: value.authorization_id,
      discharge_type: value.discharge_type,
      allocation_method: value.allocation_method,
      discharge_date: value.discharge_date,
      product_id: fifo ? this.dischargeProduct() : null,
      quantity: fifo ? value.quantity : null,
      allocations: fifo
        ? []
        : value.allocations.filter((row) => row.mrn_lot_id !== '' && row.quantity > 0),
      discharge_mrn_number:
        usual || value.discharge_mrn_number === ''
          ? null
          : normalizeMrn(value.discharge_mrn_number),
      usual_handling_code:
        usual && value.usual_handling_code !== '' ? value.usual_handling_code : null,
      usual_handling_notes:
        usual && value.usual_handling_notes !== '' ? value.usual_handling_notes : null,
    };
  }

  private allocationGroup() {
    return this.fb.nonNullable.group({ mrn_lot_id: [''], quantity: [0] });
  }

  private filters(page: number) {
    return {
      mrn: normalizeMrn(this.mrn),
      taric: this.taric,
      regime_type: this.regime,
      origin: this.origin.toUpperCase(),
      status: this.status,
      has_balance: this.hasBalance || undefined,
      page,
      per_page: 25,
    };
  }

  private report(outcome: BwOutcome, success: string | null): void {
    this.formError.set(
      outcome.ok
        ? null
        : { key: outcome.errorKey ?? 'bondedWarehouses.error.unknown', params: outcome.params },
    );
    this.notice.set(outcome.ok ? success : null);
  }
}
