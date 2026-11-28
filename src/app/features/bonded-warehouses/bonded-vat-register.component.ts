import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  BW_VAT_EXTRACTION_TYPES,
  BW_VAT_INBOUND_TYPES,
  BW_VAT_MOVEMENT_TYPES,
  BwVatExtractionPayload,
  BwVatInboundPayload,
  BwVatMovementType,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { BondedProductSelectComponent } from './bonded-product-select.component';
import { BondedLookupStore, BondedVatStore } from './bonded-warehouses.stores';
import {
  BONDED_WAREHOUSES_MODULE,
  BwOutcome,
  extractionBase,
  extractionVat,
  todayIso,
  toNumber,
} from './bonded-warehouses.util';

/**
 * Telematic load / unload register of the IVA warehouses (Art. 50-bis DL 331/93) in progressive order, with the load form and the one-click
 * extraction drawer: it adds the goods value and the storage and processing services, previews the VAT, picks TD22 or TD23 (with the F24
 * reference and date) and emits the electronic self-invoice, then links to it.
 */
@Component({
  selector: 'app-bonded-vat-register',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
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
  providers: [BondedVatStore],
  styleUrl: './bonded-warehouses.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.BONDED_WAREHOUSES_VAT_REGISTER' | translate"
      [subtitle]="'bondedWarehouses.section.vatSubtitle' | translate"
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
      <label class="field" for="bw-v-auth">
        <span>{{ 'bondedWarehouses.filter.authorization' | translate }}</span>
        <nz-select
          nzId="bw-v-auth"
          nzAllowClear
          [(ngModel)]="authorizationId"
          (ngModelChange)="reload()"
        >
          @for (item of depots(); track item.id) {
            <nz-option [nzValue]="item.id" [nzLabel]="item.authorization_code"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="bw-v-type">
        <span>{{ 'bondedWarehouses.filter.movementType' | translate }}</span>
        <nz-select
          nzId="bw-v-type"
          nzAllowClear
          [(ngModel)]="movementType"
          (ngModelChange)="reload()"
        >
          @for (item of movementTypes; track item) {
            <nz-option
              [nzValue]="item"
              [nzLabel]="'bondedWarehouses.vatMovement.' + item | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="bw-v-from">
        <span>{{ 'bondedWarehouses.filter.dateFrom' | translate }}</span>
        <input
          nz-input
          id="bw-v-from"
          type="date"
          [(ngModel)]="dateFrom"
          (ngModelChange)="reload()"
        />
      </label>
      <label class="field" for="bw-v-to">
        <span>{{ 'bondedWarehouses.filter.dateTo' | translate }}</span>
        <input nz-input id="bw-v-to" type="date" [(ngModel)]="dateTo" (ngModelChange)="reload()" />
      </label>
      <span class="spacer"></span>
      <button nz-button type="button" data-test="export-csv" (click)="exportFile('csv')">
        {{ 'bondedWarehouses.action.exportCsv' | translate }}
      </button>
      <button nz-button type="button" data-test="export-pdf" (click)="exportFile('pdf')">
        {{ 'bondedWarehouses.action.exportPdf' | translate }}
      </button>
      @if (canWrite) {
        <button nz-button type="button" data-test="new-vat-inbound" (click)="openInbound()">
          {{ 'bondedWarehouses.action.newVatInbound' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-test="new-extraction"
          (click)="openExtraction()"
        >
          {{ 'bondedWarehouses.action.newExtraction' | translate }}
        </button>
      }
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #register
        nzSize="small"
        [nzFrontPagination]="false"
        [nzData]="store.entries()"
        [nzTotal]="store.meta()?.total ?? 0"
        [nzPageSize]="store.meta()?.per_page ?? 25"
        [nzPageIndex]="store.meta()?.current_page ?? 1"
        [nzScroll]="{ x: '1100px' }"
        (nzPageIndexChange)="page($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'bondedWarehouses.column.progressive' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.date' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.movementType' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.lot' | translate }}</th>
            <th scope="col" class="numeric">
              {{ 'bondedWarehouses.column.quantity' | translate }}
            </th>
            <th scope="col" class="numeric">
              {{ 'bondedWarehouses.column.goodsValue' | translate }}
            </th>
            <th scope="col" class="numeric">
              {{ 'bondedWarehouses.column.servicesValue' | translate }}
            </th>
            <th scope="col" class="numeric">
              {{ 'bondedWarehouses.column.taxableBase' | translate }}
            </th>
            <th scope="col" class="numeric">{{ 'bondedWarehouses.column.vat' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.document' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.f24' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of register.data; track row.id) {
            <tr [attr.data-test]="'vat-row-' + row.id">
              <td>{{ row.register_progressive_number }}</td>
              <td>{{ row.movement_date | date: 'shortDate' }}</td>
              <td>{{ 'bondedWarehouses.vatMovement.' + row.movement_type | translate }}</td>
              <td>{{ row.lot_reference }}</td>
              <td class="numeric">{{ num(row.quantity) | number: '1.0-4' }}</td>
              <td class="numeric">{{ num(row.base_goods_value) | currency: 'EUR' }}</td>
              <td class="numeric">
                {{ num(row.storage_and_processing_services_value) | currency: 'EUR' }}
              </td>
              <td class="numeric">
                {{ num(row.total_taxable_extraction_base) | currency: 'EUR' }}
              </td>
              <td class="numeric">{{ num(row.vat_amount) | currency: 'EUR' }}</td>
              <td>
                @if (row.self_invoice_id; as invoiceId) {
                  <a
                    [routerLink]="['/sales/invoices']"
                    [queryParams]="{ highlight: invoiceId }"
                    [attr.data-test]="'invoice-link-' + row.id"
                  >
                    <nz-tag nzColor="blue">{{
                      'bondedWarehouses.sdiType.' + row.sdi_document_type | translate
                    }}</nz-tag>
                  </a>
                }
              </td>
              <td>
                @if (row.f24_payment_reference) {
                  {{ row.f24_payment_reference }} · {{ row.f24_payment_date | date: 'shortDate' }}
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="11">
                <nz-empty
                  [nzNotFoundContent]="'bondedWarehouses.empty.register' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-drawer
      [nzVisible]="inboundOpen()"
      nzPlacement="right"
      [nzWidth]="560"
      [nzTitle]="'bondedWarehouses.section.vatInbound' | translate"
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
              <nz-form-label nzRequired nzFor="bw-vi-auth">{{
                'bondedWarehouses.field.authorization' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="bw-vi-auth" formControlName="authorization_id">
                  @for (item of depots(); track item.id) {
                    <nz-option [nzValue]="item.id" [nzLabel]="item.authorization_code"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-vi-type">{{
                'bondedWarehouses.field.movementType' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="bw-vi-type" formControlName="movement_type">
                  @for (item of inboundTypes; track item) {
                    <nz-option
                      [nzValue]="item"
                      [nzLabel]="'bondedWarehouses.vatMovement.' + item | translate"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-vi-date">{{
                'bondedWarehouses.field.movementDate' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="bw-vi-date" type="date" formControlName="movement_date"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-vi-product">{{
                'bondedWarehouses.field.product' | translate
              }}</nz-form-label>
              <nz-form-control
                ><app-bonded-product-select
                  inputId="bw-vi-product"
                  [(value)]="inboundProduct"
                ></app-bonded-product-select
              ></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="bw-vi-lot">{{
                'bondedWarehouses.field.lotReference' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="bw-vi-lot" formControlName="lot_reference"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-vi-qty">{{
                'bondedWarehouses.field.quantity' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input
                  nz-input
                  id="bw-vi-qty"
                  type="number"
                  min="0"
                  step="any"
                  formControlName="quantity"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-vi-value">{{
                'bondedWarehouses.field.goodsValue' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input
                  nz-input
                  id="bw-vi-value"
                  type="number"
                  min="0"
                  step="any"
                  formControlName="base_goods_value"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item class="wide">
              <nz-form-label nzFor="bw-vi-notes">{{
                'bondedWarehouses.field.notes' | translate
              }}</nz-form-label>
              <nz-form-control>
                <textarea nz-input id="bw-vi-notes" rows="2" formControlName="notes"></textarea>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="drawer-actions">
            <button
              nz-button
              nzType="primary"
              type="submit"
              data-test="save-vat-inbound"
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
      [nzVisible]="extractionOpen()"
      nzPlacement="right"
      [nzWidth]="640"
      [nzTitle]="'bondedWarehouses.section.extraction' | translate"
      (nzOnClose)="closeExtraction()"
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
        <form nz-form nzLayout="vertical" [formGroup]="extractionForm" (ngSubmit)="preview()">
          <div class="form-grid">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-ex-auth">{{
                'bondedWarehouses.field.authorization' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="bw-ex-auth" formControlName="authorization_id">
                  @for (item of depots(); track item.id) {
                    <nz-option [nzValue]="item.id" [nzLabel]="item.authorization_code"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-ex-type">{{
                'bondedWarehouses.field.documentType' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="bw-ex-type" formControlName="movement_type">
                  @for (item of extractionTypes; track item) {
                    <nz-option
                      [nzValue]="item"
                      [nzLabel]="'bondedWarehouses.vatMovement.' + item | translate"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-ex-date">{{
                'bondedWarehouses.field.movementDate' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="bw-ex-date" type="date" formControlName="movement_date"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-ex-product">{{
                'bondedWarehouses.field.product' | translate
              }}</nz-form-label>
              <nz-form-control
                ><app-bonded-product-select
                  inputId="bw-ex-product"
                  [(value)]="extractionProduct"
                ></app-bonded-product-select
              ></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="bw-ex-lot">{{
                'bondedWarehouses.field.lotReference' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="bw-ex-lot" formControlName="lot_reference"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-ex-qty">{{
                'bondedWarehouses.field.quantity' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input
                  nz-input
                  id="bw-ex-qty"
                  type="number"
                  min="0"
                  step="any"
                  formControlName="quantity"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-ex-goods">{{
                'bondedWarehouses.field.goodsValue' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input
                  nz-input
                  id="bw-ex-goods"
                  type="number"
                  min="0"
                  step="any"
                  formControlName="base_goods_value"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="bw-ex-services">{{
                'bondedWarehouses.field.servicesValue' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input
                  nz-input
                  id="bw-ex-services"
                  type="number"
                  min="0"
                  step="any"
                  formControlName="storage_and_processing_services_value"
              /></nz-form-control>
            </nz-form-item>
            @if (extractionForm.controls.movement_type.value !== 'Extraction_LetterOfIntent') {
              <nz-form-item>
                <nz-form-label nzFor="bw-ex-rate">{{
                  'bondedWarehouses.field.vatRate' | translate
                }}</nz-form-label>
                <nz-form-control
                  ><input
                    nz-input
                    id="bw-ex-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    formControlName="vat_rate_percent"
                /></nz-form-control>
              </nz-form-item>
            }
            @if (extractionForm.controls.movement_type.value === 'Extraction_TD23') {
              <nz-form-item>
                <nz-form-label nzRequired nzFor="bw-ex-f24">{{
                  'bondedWarehouses.field.f24Reference' | translate
                }}</nz-form-label>
                <nz-form-control
                  ><input nz-input id="bw-ex-f24" formControlName="f24_payment_reference"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="bw-ex-f24date">{{
                  'bondedWarehouses.field.f24Date' | translate
                }}</nz-form-label>
                <nz-form-control
                  ><input
                    nz-input
                    id="bw-ex-f24date"
                    type="date"
                    formControlName="f24_payment_date"
                /></nz-form-control>
              </nz-form-item>
            }
          </div>

          <div class="summary-grid" data-test="extraction-calc">
            <span
              >{{ 'bondedWarehouses.summary.taxableBase' | translate }}:
              <strong>{{ base() | currency: 'EUR' }}</strong></span
            >
            <span
              >{{ 'bondedWarehouses.summary.vatAmount' | translate }}:
              <strong>{{ vat() | currency: 'EUR' }}</strong></span
            >
            <span
              >{{ 'bondedWarehouses.summary.documentType' | translate }}:
              <strong>{{ 'bondedWarehouses.sdiType.' + documentType() | translate }}</strong></span
            >
          </div>
          @if (store.preview(); as preview) {
            <nz-alert
              class="feedback"
              data-test="extraction-preview"
              [nzType]="preview.sufficient_stock ? 'info' : 'warning'"
              nzShowIcon
              [nzMessage]="
                (preview.sufficient_stock
                  ? 'bondedWarehouses.preview.stockOk'
                  : 'bondedWarehouses.preview.stockShort'
                ) | translate: { available: preview.available_quantity }
              "
            ></nz-alert>
          }
          <p class="hint">{{ 'bondedWarehouses.help.extraction' | translate }}</p>
          <div class="drawer-actions">
            <button nz-button type="submit" data-test="preview" [disabled]="!extractionReady()">
              {{ 'bondedWarehouses.action.preview' | translate }}
            </button>
            <button
              nz-button
              nzType="primary"
              type="button"
              data-test="emit"
              [disabled]="!extractionReady()"
              (click)="emit()"
            >
              {{ 'bondedWarehouses.action.emitSelfInvoice' | translate }}
            </button>
            <button nz-button type="button" (click)="closeExtraction()">
              {{ 'bondedWarehouses.action.close' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class BondedVatRegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  protected readonly store = inject(BondedVatStore);
  protected readonly lookup = inject(BondedLookupStore);
  protected readonly canWrite = inject(PermissionsService).canWrite(BONDED_WAREHOUSES_MODULE);

  protected readonly movementTypes = BW_VAT_MOVEMENT_TYPES;
  protected readonly inboundTypes = BW_VAT_INBOUND_TYPES;
  protected readonly extractionTypes = BW_VAT_EXTRACTION_TYPES;

  protected readonly authorizationId = signal<string | null>(null);
  protected movementType: BwVatMovementType | null = null;
  protected dateFrom = '';
  protected dateTo = '';

  protected readonly notice = signal<string | null>(null);
  protected readonly formError = signal<{ key: string; params: Record<string, string> } | null>(
    null,
  );
  protected readonly inboundOpen = signal(false);
  protected readonly extractionOpen = signal(false);
  protected readonly inboundProduct = signal<string | null>(null);
  protected readonly extractionProduct = signal<string | null>(null);
  protected readonly depots = computed(() =>
    this.lookup.authorizations().filter((item) => item.regime_type === 'VatDepot_Art50Bis'),
  );
  protected readonly num = toNumber;

  protected readonly inboundForm = this.fb.nonNullable.group({
    authorization_id: ['', Validators.required],
    movement_type: [
      'Inbound_FreeCirculation' as (typeof BW_VAT_INBOUND_TYPES)[number],
      Validators.required,
    ],
    movement_date: [todayIso(), Validators.required],
    lot_reference: [''],
    quantity: [0, [Validators.required, Validators.min(0.0001)]],
    base_goods_value: [0, [Validators.required, Validators.min(0)]],
    notes: [''],
  });

  protected readonly extractionForm = this.fb.nonNullable.group({
    authorization_id: ['', Validators.required],
    movement_type: [
      'Extraction_TD22' as (typeof BW_VAT_EXTRACTION_TYPES)[number],
      Validators.required,
    ],
    movement_date: [todayIso(), Validators.required],
    lot_reference: [''],
    quantity: [0, [Validators.required, Validators.min(0.0001)]],
    base_goods_value: [0, [Validators.required, Validators.min(0)]],
    storage_and_processing_services_value: [0, Validators.min(0)],
    vat_rate_percent: [22, [Validators.min(0), Validators.max(100)]],
    f24_payment_reference: [''],
    f24_payment_date: [''],
  });

  /** Live calculation of the extraction: goods + services is the taxable base (Art. 50-bis c. 4). */
  private readonly values = signal(this.extractionForm.getRawValue());
  protected readonly base = computed(() =>
    extractionBase(
      this.values().base_goods_value,
      this.values().storage_and_processing_services_value,
    ),
  );
  protected readonly vat = computed(() =>
    extractionVat(
      this.base(),
      this.values().movement_type === 'Extraction_LetterOfIntent'
        ? 0
        : this.values().vat_rate_percent,
    ),
  );
  protected readonly documentType = computed(() =>
    this.values().movement_type === 'Extraction_TD23' ? 'TD23' : 'TD22',
  );

  constructor() {
    this.extractionForm.valueChanges.subscribe(() =>
      this.values.set(this.extractionForm.getRawValue()),
    );
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
    this.report(await this.store.exportFile(format, filters), null);
  }

  protected openInbound(): void {
    this.formError.set(null);
    this.inboundProduct.set(null);
    this.inboundOpen.set(true);
  }

  protected async submitInbound(): Promise<void> {
    const product = this.inboundProduct();
    if (product === null) {
      return;
    }
    const value = this.inboundForm.getRawValue();
    const payload: BwVatInboundPayload = {
      ...value,
      product_id: product,
      lot_reference: value.lot_reference === '' ? null : value.lot_reference,
      notes: value.notes === '' ? null : value.notes,
    };
    const outcome = await this.store.registerInbound(payload);
    this.report(outcome, 'bondedWarehouses.message.vatInboundRegistered');
    if (outcome.ok) {
      this.inboundOpen.set(false);
      this.reload();
    }
  }

  protected openExtraction(): void {
    this.formError.set(null);
    this.store.clearPreview();
    this.extractionProduct.set(null);
    this.extractionOpen.set(true);
  }

  protected closeExtraction(): void {
    this.extractionOpen.set(false);
    this.store.clearPreview();
  }

  protected extractionReady(): boolean {
    const value = this.values();
    if (this.extractionProduct() === null || value.authorization_id === '' || value.quantity <= 0) {
      return false;
    }
    return !(
      value.movement_type === 'Extraction_TD23' &&
      (value.f24_payment_reference === '' || value.f24_payment_date === '')
    );
  }

  protected async preview(): Promise<void> {
    this.report(await this.store.previewExtraction(this.extractionPayload()), null);
  }

  protected async emit(): Promise<void> {
    const outcome = await this.store.extract(this.extractionPayload());
    this.report(outcome, 'bondedWarehouses.message.extractionEmitted');
    if (outcome.ok) {
      this.closeExtraction();
      this.reload();
    }
  }

  private extractionPayload(): BwVatExtractionPayload {
    const value = this.extractionForm.getRawValue();
    const td23 = value.movement_type === 'Extraction_TD23';

    return {
      authorization_id: value.authorization_id,
      movement_type: value.movement_type,
      movement_date: value.movement_date,
      product_id: this.extractionProduct() ?? '',
      lot_reference: value.lot_reference === '' ? null : value.lot_reference,
      quantity: value.quantity,
      base_goods_value: value.base_goods_value,
      storage_and_processing_services_value: value.storage_and_processing_services_value,
      vat_rate_percent: value.vat_rate_percent,
      f24_payment_reference: td23 ? value.f24_payment_reference : null,
      f24_payment_date: td23 ? value.f24_payment_date : null,
    };
  }

  private filters(page: number) {
    return {
      authorization_id: this.authorizationId(),
      movement_type: this.movementType,
      date_from: this.dateFrom,
      date_to: this.dateTo,
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
