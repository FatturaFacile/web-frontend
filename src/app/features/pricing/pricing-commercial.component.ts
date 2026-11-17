import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ContactResource,
  CrmApiService,
  CustomerSpecialPrice,
  DISCOUNT_MODES,
  DiscountMode,
  InventoryApiService,
  MARGIN_COST_BASES,
  MARGIN_SCOPES,
  MarginCostBasis,
  MarginPolicy,
  MarginScope,
  PricingApiService,
  PricingPromotion,
  PricingPromotionRequest,
  ProductItem,
  PROMOTION_TYPES,
  PromotionRules,
  PromotionType,
  TranslateService,
  VAT_TREATMENTS,
  VatTreatment,
} from '@core';
import {
  IconActionDirective,
  ModalActionsDirective,
  PageHeaderComponent,
  TranslatePipe,
} from '@shared';
import { apiErrorText, blankToNull, contactLabel, decimalOrNull } from '../rebates/rebates.util';
import { parseDiscountCascade, previewCascade } from './pricing.util';

/** Customer special prices, time-bounded promotions (3x2, bundles, free gifts, cart tiers) and margin guardrail thresholds. */
@Component({
  selector: 'app-pricing-commercial',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="'PRICING.COMMERCIAL_TITLE' | translate"
      [subtitle]="'PRICING.COMMERCIAL_SUBTITLE' | translate"
    ></app-page-header>

    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'PRICING.TAB_SPECIAL' | translate">
          <div class="toolbar">
            <button
              nz-button
              nzType="primary"
              (click)="openSpecial()"
              appIconAction="create"
            ></button>
          </div>
          <nz-table #specialTable [nzData]="specials()" nzSize="small" [nzPageSize]="25">
            <thead>
              <tr>
                <th>{{ 'PRICING.CUSTOMER' | translate }}</th>
                <th>{{ 'PRICING.PRODUCT' | translate }}</th>
                <th class="num">{{ 'PRICING.FIXED_PRICE' | translate }}</th>
                <th>{{ 'PRICING.CASCADE' | translate }}</th>
                <th>{{ 'PRICING.VALIDITY' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of specialTable.data; track row.id) {
                <tr>
                  <td>{{ customerName(row.customer_id) }}</td>
                  <td>{{ productName(row.product_id) }}</td>
                  <td class="num">{{ row.fixed_price ?? '-' }} {{ row.currency }}</td>
                  <td>{{ row.discount_cascade ?? '' }}</td>
                  <td>{{ row.valid_from ?? '…' }} - {{ row.valid_to ?? '…' }}</td>
                  <td>
                    <button
                      nz-button
                      nzType="text"
                      nzDanger
                      appIconAction="delete"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'PRICING.DELETE_CONFIRM' | translate"
                      (nzOnConfirm)="removeSpecial(row)"
                    ></button>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'PRICING.TAB_PROMOTIONS' | translate">
          <div class="toolbar">
            <button
              nz-button
              nzType="primary"
              (click)="openPromotion()"
              appIconAction="create"
            ></button>
          </div>
          <nz-table #promoTable [nzData]="promotions()" nzSize="small" [nzPageSize]="25">
            <thead>
              <tr>
                <th>{{ 'PRICING.CODE' | translate }}</th>
                <th>{{ 'PRICING.NAME' | translate }}</th>
                <th>{{ 'PRICING.TYPE' | translate }}</th>
                <th>{{ 'PRICING.VALIDITY' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of promoTable.data; track row.id) {
                <tr>
                  <td>{{ row.code }}</td>
                  <td>
                    {{ row.name }}
                    @if (!row.is_active) {
                      <nz-tag>{{ 'PRICING.INACTIVE' | translate }}</nz-tag>
                    }
                  </td>
                  <td>
                    {{ 'PRICING.PROMO_' + row.type | translate }}
                    @if (row.type === 'FREE_GIFT' && row.rules.vat_treatment) {
                      <nz-tag>{{ 'PRICING.' + row.rules.vat_treatment | translate }}</nz-tag>
                    }
                  </td>
                  <td>{{ row.valid_from ?? '…' }} - {{ row.valid_to ?? '…' }}</td>
                  <td>
                    <button
                      nz-button
                      nzType="text"
                      nzDanger
                      appIconAction="delete"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'PRICING.DELETE_CONFIRM' | translate"
                      (nzOnConfirm)="removePromotion(row)"
                    ></button>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'PRICING.TAB_MARGIN' | translate">
          <div class="toolbar">
            <button
              nz-button
              nzType="primary"
              (click)="openPolicy()"
              appIconAction="create"
            ></button>
          </div>
          <nz-table #policyTable [nzData]="policies()" nzSize="small" [nzPageSize]="25">
            <thead>
              <tr>
                <th>{{ 'PRICING.SCOPE' | translate }}</th>
                <th class="num">{{ 'PRICING.MIN_MARGIN' | translate }}</th>
                <th>{{ 'PRICING.COST_BASIS' | translate }}</th>
                <th>{{ 'PRICING.BLOCKING' | translate }}</th>
                <th>{{ 'PRICING.APPROVAL_ROLE' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of policyTable.data; track row.id) {
                <tr>
                  <td>{{ 'PRICING.SCOPE_' + row.scope | translate }}</td>
                  <td class="num">{{ row.min_margin_percent | number: '1.0-2' }} %</td>
                  <td>{{ 'PRICING.' + row.cost_basis | translate }}</td>
                  <td>
                    <nz-tag [nzColor]="row.block_on_violation ? 'red' : 'orange'">{{
                      (row.block_on_violation ? 'PRICING.BLOCKING' : 'PRICING.WARNING_ONLY')
                        | translate
                    }}</nz-tag>
                  </td>
                  <td>{{ row.requires_approval_role ?? '' }}</td>
                  <td>
                    <button
                      nz-button
                      nzType="text"
                      nzDanger
                      appIconAction="delete"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'PRICING.DELETE_CONFIRM' | translate"
                      (nzOnConfirm)="removePolicy(row)"
                    ></button>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>
      </nz-tabs>
    </nz-card>

    <nz-modal
      [(nzVisible)]="specialVisible"
      [nzTitle]="'PRICING.NEW_SPECIAL' | translate"
      (nzOnCancel)="specialVisible.set(false)"
      (nzOnOk)="saveSpecial()"
      okAction="save"
      [nzOkDisabled]="specialForm.invalid || !specialCascadeValid()"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="specialForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="sp-customer">{{
              'PRICING.CUSTOMER' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select id="sp-customer" formControlName="customer_id" nzShowSearch>
                @for (customer of customers(); track customer.id) {
                  <nz-option [nzValue]="customer.id" [nzLabel]="label(customer)"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="sp-product">{{
              'PRICING.PRODUCT' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select id="sp-product" formControlName="product_id" nzShowSearch>
                @for (product of products(); track product.id) {
                  <nz-option
                    [nzValue]="product.id"
                    [nzLabel]="product.sku + ' · ' + product.name"
                  ></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="sp-currency">{{
                'PRICING.CURRENCY' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="sp-currency" formControlName="currency" maxlength="3"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="sp-price">{{
                'PRICING.FIXED_PRICE' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input
                  nz-input
                  id="sp-price"
                  type="number"
                  min="0"
                  step="any"
                  formControlName="fixed_price"
              /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="sp-cascade">{{ 'PRICING.CASCADE' | translate }}</nz-form-label>
              <nz-form-control
                ><input
                  nz-input
                  id="sp-cascade"
                  formControlName="discount_cascade"
                  placeholder="30+5+2"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="sp-mode">{{
                'PRICING.DISCOUNT_MODE' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select id="sp-mode" formControlName="discount_mode">
                  @for (mode of modes; track mode) {
                    <nz-option
                      [nzValue]="mode"
                      [nzLabel]="'PRICING.MODE_' + mode | translate"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <p class="cascade-preview" data-testid="special-preview" aria-live="polite">
            @if (specialCascadeValid()) {
              {{ 'PRICING.PREVIEW' | translate }} (100):
              {{ specialPreview().net | number: '1.2-4' }} ({{
                specialPreview().effectivePercent | number: '1.0-2'
              }}
              %)
            } @else {
              {{ 'PRICING.CASCADE_INVALID' | translate }}
            }
          </p>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="sp-from">{{ 'PRICING.VALID_FROM' | translate }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="sp-from" type="date" formControlName="valid_from"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="sp-to">{{ 'PRICING.VALID_TO' | translate }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="sp-to" type="date" formControlName="valid_to"
              /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [(nzVisible)]="promotionVisible"
      [nzTitle]="'PRICING.NEW_PROMOTION' | translate"
      (nzOnCancel)="promotionVisible.set(false)"
      (nzOnOk)="savePromotion()"
      okAction="save"
      [nzOkDisabled]="promotionForm.invalid"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="promotionForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="pm-code">{{
                'PRICING.CODE' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="pm-code" formControlName="code" maxlength="40"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="pm-name">{{
                'PRICING.NAME' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="pm-name" formControlName="name" maxlength="160"
              /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="pm-type">{{
              'PRICING.TYPE' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select id="pm-type" formControlName="type">
                @for (type of promotionTypes; track type) {
                  <nz-option
                    [nzValue]="type"
                    [nzLabel]="'PRICING.PROMO_' + type | translate"
                  ></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          @switch (promotionType()) {
            @case ('BUY_X_GET_Y') {
              <div class="form-row">
                <nz-form-item>
                  <nz-form-label nzFor="pm-buy">{{ 'PRICING.BUY_QTY' | translate }}</nz-form-label>
                  <nz-form-control
                    ><input nz-input id="pm-buy" type="number" min="2" formControlName="buy_qty"
                  /></nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label nzFor="pm-pay">{{ 'PRICING.PAY_QTY' | translate }}</nz-form-label>
                  <nz-form-control
                    ><input nz-input id="pm-pay" type="number" min="1" formControlName="pay_qty"
                  /></nz-form-control>
                </nz-form-item>
              </div>
            }
            @case ('FREE_GIFT') {
              <nz-form-item>
                <nz-form-label nzFor="pm-gift">{{
                  'PRICING.GIFT_PRODUCT' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <nz-select id="pm-gift" formControlName="gift_product_id" nzShowSearch>
                    @for (product of products(); track product.id) {
                      <nz-option
                        [nzValue]="product.id"
                        [nzLabel]="product.sku + ' · ' + product.name"
                      ></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="pm-trigger">{{
                  'PRICING.TRIGGER_AMOUNT' | translate
                }}</nz-form-label>
                <nz-form-control
                  ><input
                    nz-input
                    id="pm-trigger"
                    type="number"
                    min="0"
                    step="any"
                    formControlName="trigger_min_amount"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="pm-vat">{{
                  'PRICING.VAT_TREATMENT' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <nz-select id="pm-vat" formControlName="vat_treatment">
                    @for (treatment of vatTreatments; track treatment) {
                      <nz-option
                        [nzValue]="treatment"
                        [nzLabel]="'PRICING.' + treatment | translate"
                      ></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            }
            @case ('BUNDLE_DISCOUNT') {
              <nz-form-item>
                <nz-form-label nzFor="pm-bundle">{{
                  'PRICING.BUNDLE_PRODUCTS' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <nz-select
                    id="pm-bundle"
                    formControlName="product_ids"
                    nzMode="multiple"
                    nzShowSearch
                  >
                    @for (product of products(); track product.id) {
                      <nz-option
                        [nzValue]="product.id"
                        [nzLabel]="product.sku + ' · ' + product.name"
                      ></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="pm-percent">{{
                  'PRICING.DISCOUNT_PERCENT' | translate
                }}</nz-form-label>
                <nz-form-control
                  ><input
                    nz-input
                    id="pm-percent"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    formControlName="discount_percent"
                /></nz-form-control>
              </nz-form-item>
            }
            @case ('CART_VALUE_TIER') {
              <div class="form-row">
                <nz-form-item>
                  <nz-form-label nzFor="pm-tier-amount">{{
                    'PRICING.TRIGGER_AMOUNT' | translate
                  }}</nz-form-label>
                  <nz-form-control
                    ><input
                      nz-input
                      id="pm-tier-amount"
                      type="number"
                      min="0"
                      step="any"
                      formControlName="trigger_min_amount"
                  /></nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label nzFor="pm-tier-percent">{{
                    'PRICING.DISCOUNT_PERCENT' | translate
                  }}</nz-form-label>
                  <nz-form-control
                    ><input
                      nz-input
                      id="pm-tier-percent"
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      formControlName="discount_percent"
                  /></nz-form-control>
                </nz-form-item>
              </div>
            }
          }
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="pm-from">{{ 'PRICING.VALID_FROM' | translate }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="pm-from" type="date" formControlName="valid_from"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="pm-to">{{ 'PRICING.VALID_TO' | translate }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="pm-to" type="date" formControlName="valid_to"
              /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-control>
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label nz-checkbox formControlName="is_stackable">{{
                'PRICING.STACKABLE' | translate
              }}</label>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [(nzVisible)]="policyVisible"
      [nzTitle]="'PRICING.NEW_POLICY' | translate"
      (nzOnCancel)="policyVisible.set(false)"
      (nzOnOk)="savePolicy()"
      okAction="save"
      [nzOkDisabled]="policyForm.invalid"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="policyForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="mp-scope">{{
              'PRICING.SCOPE' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select id="mp-scope" formControlName="scope">
                @for (scope of scopes; track scope) {
                  <nz-option
                    [nzValue]="scope"
                    [nzLabel]="'PRICING.SCOPE_' + scope | translate"
                  ></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          @if (policyForm.controls.scope.value === 'PRODUCT') {
            <nz-form-item>
              <nz-form-label nzFor="mp-product">{{ 'PRICING.PRODUCT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="mp-product" formControlName="scope_id" nzShowSearch>
                  @for (product of products(); track product.id) {
                    <nz-option
                      [nzValue]="product.id"
                      [nzLabel]="product.sku + ' · ' + product.name"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          }
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="mp-min"
                >{{ 'PRICING.MIN_MARGIN' | translate }} (%)</nz-form-label
              >
              <nz-form-control
                ><input
                  nz-input
                  id="mp-min"
                  type="number"
                  min="-100"
                  max="100"
                  step="any"
                  formControlName="min_margin_percent"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="mp-basis">{{ 'PRICING.COST_BASIS' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="mp-basis" formControlName="cost_basis">
                  @for (basis of costBases; track basis) {
                    <nz-option
                      [nzValue]="basis"
                      [nzLabel]="'PRICING.' + basis | translate"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="mp-role">{{ 'PRICING.APPROVAL_ROLE' | translate }}</nz-form-label>
            <nz-form-control
              ><input nz-input id="mp-role" formControlName="requires_approval_role" maxlength="40"
            /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-control>
              <nz-switch
                formControlName="block_on_violation"
                [attr.aria-label]="'PRICING.BLOCKING' | translate"
              ></nz-switch>
              {{ 'PRICING.BLOCKING' | translate }}
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styleUrl: './pricing.scss',
})
export class PricingCommercialComponent implements OnInit {
  private readonly api = inject(PricingApiService);
  private readonly inventory = inject(InventoryApiService);
  private readonly crm = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly modes = DISCOUNT_MODES;
  readonly promotionTypes = PROMOTION_TYPES;
  readonly vatTreatments = VAT_TREATMENTS;
  readonly scopes = MARGIN_SCOPES;
  readonly costBases = MARGIN_COST_BASES;

  readonly specials = signal<CustomerSpecialPrice[]>([]);
  readonly promotions = signal<PricingPromotion[]>([]);
  readonly policies = signal<MarginPolicy[]>([]);
  readonly customers = signal<ContactResource[]>([]);
  readonly products = signal<ProductItem[]>([]);

  readonly specialVisible = signal(false);
  readonly promotionVisible = signal(false);
  readonly policyVisible = signal(false);

  readonly specialForm = this.fb.group({
    customer_id: ['', [Validators.required]],
    product_id: ['', [Validators.required]],
    currency: ['CHF', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    fixed_price: this.fb.control<number | null>(null, [Validators.min(0)]),
    discount_cascade: [''],
    discount_mode: ['MULTIPLICATIVE' as DiscountMode],
    valid_from: [''],
    valid_to: [''],
  });

  readonly promotionForm = this.fb.group({
    code: ['', [Validators.required]],
    name: ['', [Validators.required]],
    type: ['BUY_X_GET_Y' as PromotionType, [Validators.required]],
    buy_qty: this.fb.control<number | null>(3),
    pay_qty: this.fb.control<number | null>(2),
    gift_product_id: [''],
    trigger_min_amount: this.fb.control<number | null>(null),
    vat_treatment: ['WITHOUT_VAT_RECOURSE' as VatTreatment],
    product_ids: this.fb.control<string[]>([]),
    discount_percent: this.fb.control<number | null>(null),
    valid_from: [''],
    valid_to: [''],
    is_stackable: [false],
  });

  readonly policyForm = this.fb.group({
    scope: ['GLOBAL' as MarginScope, [Validators.required]],
    scope_id: [''],
    min_margin_percent: this.fb.control<number | null>(15, [Validators.required]),
    cost_basis: ['LAST_PURCHASE_COST' as MarginCostBasis],
    block_on_violation: [true],
    requires_approval_role: [''],
  });

  private readonly specialValue = signal(this.specialForm.getRawValue());
  private readonly promotionValue = signal(this.promotionForm.getRawValue());

  readonly specialCascadeValid = computed(
    () => parseDiscountCascade(this.specialValue().discount_cascade) !== null,
  );
  readonly specialPreview = computed(() =>
    previewCascade(
      100,
      this.specialValue().discount_cascade,
      this.specialValue().discount_mode,
      'NONE',
    ),
  );
  readonly promotionType = computed(() => this.promotionValue().type);

  ngOnInit(): void {
    this.specialForm.valueChanges.subscribe(() =>
      this.specialValue.set(this.specialForm.getRawValue()),
    );
    this.promotionForm.valueChanges.subscribe(() =>
      this.promotionValue.set(this.promotionForm.getRawValue()),
    );
    this.reload();
    this.inventory
      .getProducts({ per_page: 100 })
      .subscribe({
        next: (response) => this.products.set(response.data),
        error: () => this.products.set([]),
      });
    this.crm
      .getClients({ per_page: 100 })
      .subscribe({
        next: (response) => this.customers.set(response.data),
        error: () => this.customers.set([]),
      });
  }

  label(customer: ContactResource): string {
    return contactLabel(customer);
  }

  customerName(id: string): string {
    const customer = this.customers().find((candidate) => candidate.id === id);
    return customer ? contactLabel(customer) : id;
  }

  productName(id: string): string {
    const product = this.products().find((candidate) => candidate.id === id);
    return product ? `${product.sku} · ${product.name}` : id;
  }

  reload(): void {
    this.api
      .getSpecialPrices({ per_page: 100 })
      .subscribe((response) => this.specials.set(response.data));
    this.api
      .getPromotions({ per_page: 100 })
      .subscribe((response) => this.promotions.set(response.data));
    this.api.getMarginPolicies().subscribe((response) => this.policies.set(response.data));
  }

  openSpecial(): void {
    this.specialForm.reset({
      customer_id: '',
      product_id: '',
      currency: 'CHF',
      fixed_price: null,
      discount_cascade: '',
      discount_mode: 'MULTIPLICATIVE',
      valid_from: '',
      valid_to: '',
    });
    this.specialVisible.set(true);
  }

  saveSpecial(): void {
    const value = this.specialForm.getRawValue();
    this.api
      .createSpecialPrice({
        customer_id: value.customer_id,
        product_id: value.product_id,
        currency: value.currency.toUpperCase(),
        fixed_price: decimalOrNull(value.fixed_price),
        discount_cascade: blankToNull(value.discount_cascade),
        discount_mode: value.discount_mode,
        valid_from: blankToNull(value.valid_from),
        valid_to: blankToNull(value.valid_to),
      })
      .subscribe(this.done(this.specialVisible));
  }

  removeSpecial(row: CustomerSpecialPrice): void {
    this.api.deleteSpecialPrice(row.id).subscribe(this.done());
  }

  openPromotion(): void {
    this.promotionForm.reset();
    this.promotionVisible.set(true);
  }

  savePromotion(): void {
    const value = this.promotionForm.getRawValue();
    const rules = this.rulesFor(value.type, value);
    const payload: PricingPromotionRequest = {
      code: value.code,
      name: value.name,
      type: value.type,
      rules,
      valid_from: blankToNull(value.valid_from),
      valid_to: blankToNull(value.valid_to),
      is_stackable: value.is_stackable,
    };
    this.api.createPromotion(payload).subscribe(this.done(this.promotionVisible));
  }

  removePromotion(row: PricingPromotion): void {
    this.api.deletePromotion(row.id).subscribe(this.done());
  }

  openPolicy(): void {
    this.policyForm.reset();
    this.policyVisible.set(true);
  }

  savePolicy(): void {
    const value = this.policyForm.getRawValue();
    this.api
      .createMarginPolicy({
        scope: value.scope,
        scope_id: value.scope === 'GLOBAL' ? null : blankToNull(value.scope_id),
        min_margin_percent: String(value.min_margin_percent),
        cost_basis: value.cost_basis,
        block_on_violation: value.block_on_violation,
        requires_approval_role: blankToNull(value.requires_approval_role),
      })
      .subscribe(this.done(this.policyVisible));
  }

  removePolicy(row: MarginPolicy): void {
    this.api.deleteMarginPolicy(row.id).subscribe(this.done());
  }

  private rulesFor(
    type: PromotionType,
    value: ReturnType<typeof this.promotionForm.getRawValue>,
  ): PromotionRules {
    switch (type) {
      case 'BUY_X_GET_Y':
        return { buy_qty: Number(value.buy_qty), pay_qty: Number(value.pay_qty) };
      case 'FREE_GIFT':
        return {
          gift_product_id: value.gift_product_id || null,
          gift_quantity: 1,
          trigger_min_amount: Number(value.trigger_min_amount ?? 0),
          vat_treatment: value.vat_treatment,
        };
      case 'BUNDLE_DISCOUNT':
        return {
          product_ids: value.product_ids,
          min_each: 1,
          discount_percent: Number(value.discount_percent ?? 0),
        };
      default:
        return {
          tiers: [
            {
              min_amount: Number(value.trigger_min_amount ?? 0),
              discount_percent: Number(value.discount_percent ?? 0),
            },
          ],
        };
    }
  }

  private done(modal?: { set: (value: boolean) => void }): {
    next: () => void;
    error: (error: unknown) => void;
  } {
    return {
      next: () => {
        this.message.success(this.translate.instant('PRICING.SAVED'));
        modal?.set(false);
        this.reload();
      },
      error: (error: unknown) =>
        this.message.error(apiErrorText(error) ?? this.translate.instant('PRICING.ACTION_ERROR')),
    };
  }
}
