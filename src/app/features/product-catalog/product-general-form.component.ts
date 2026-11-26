import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { PcKitType, PcProductPayload, PcProductType, PcUnit, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { ProductEditorStore } from './product-editor.store';
import {
  emptyProduct,
  isGtinValid,
  isTaricValid,
  isTaresValid,
  PcOutcome,
  productToPayload,
  stockRules,
  unitLabel,
} from './product-catalog.util';

/** The general data, the prices and the CH / IT customs and tax classification of a product. */
@Component({
  selector: 'app-pc-general-form',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    TranslatePipe,
  ],
  styleUrl: './product-catalog.scss',
  template: `
    @if (failure(); as problem) {
      <nz-alert
        nzType="error"
        nzShowIcon
        class="form-alert"
        [nzMessage]="problem.errorKey ?? '' | translate: problem.params"
        [nzDescription]="problem.detail"
      ></nz-alert>
    }

    <section>
      <h4>{{ 'productCatalog.section.general' | translate }}</h4>
      <div class="grid">
        <label class="field" for="pc-sku">
          <span>{{ 'productCatalog.field.sku' | translate }}</span>
          <input nz-input id="pc-sku" [ngModel]="form().sku" (ngModelChange)="set('sku', $event)" />
          @for (message of fieldErrors()['sku'] ?? []; track message) {
            <small class="error">{{ message }}</small>
          }
        </label>
        <label class="field wide" for="pc-name">
          <span>{{ 'productCatalog.field.name' | translate }}</span>
          <input
            nz-input
            id="pc-name"
            [ngModel]="form().name"
            (ngModelChange)="set('name', $event)"
          />
          @for (message of fieldErrors()['name'] ?? []; track message) {
            <small class="error">{{ message }}</small>
          }
        </label>
        <label class="field" for="pc-type">
          <span>{{ 'productCatalog.field.productType' | translate }}</span>
          <nz-select
            nzId="pc-type"
            [ngModel]="form().product_type"
            (ngModelChange)="setType($event)"
          >
            @for (type of store.lookups()?.product_types ?? []; track type) {
              <nz-option
                [nzValue]="type"
                [nzLabel]="'productCatalog.productType.' + type | translate"
              ></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="pc-kit">
          <span>{{ 'productCatalog.field.kitType' | translate }}</span>
          <nz-select
            nzId="pc-kit"
            nzAllowClear
            [nzDisabled]="!rules().kitAllowed || store.isVariant()"
            [ngModel]="form().kit_type ?? null"
            (ngModelChange)="setKit($event)"
          >
            @for (kit of store.lookups()?.kit_types ?? []; track kit) {
              <nz-option
                [nzValue]="kit"
                [nzLabel]="'productCatalog.kitType.' + kit | translate"
              ></nz-option>
            }
          </nz-select>
          @if (form().kit_type) {
            <small>{{ 'productCatalog.hint.' + form().kit_type | translate }}</small>
          }
        </label>
        <label class="field" for="pc-unit">
          <span>{{ 'productCatalog.field.stockUnit' | translate }}</span>
          <nz-select
            nzId="pc-unit"
            nzAllowClear
            [ngModel]="form().unit_of_measure_id ?? null"
            (ngModelChange)="set('unit_of_measure_id', $event)"
          >
            @for (unit of store.units(); track unit.id) {
              <nz-option [nzValue]="unit.id" [nzLabel]="unitName(unit)"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="pc-cost">
          <span>{{ 'productCatalog.field.costPrice' | translate }}</span>
          <input
            nz-input
            id="pc-cost"
            inputmode="decimal"
            [ngModel]="form().cost_price"
            (ngModelChange)="set('cost_price', $event)"
          />
        </label>
        <label class="field" for="pc-price">
          <span>{{ 'productCatalog.field.salePrice' | translate }}</span>
          <input
            nz-input
            id="pc-price"
            inputmode="decimal"
            [ngModel]="form().sale_price"
            (ngModelChange)="set('sale_price', $event)"
          />
        </label>
        <label class="field" for="pc-tax">
          <span>{{ 'productCatalog.field.taxRate' | translate }}</span>
          <input
            nz-input
            id="pc-tax"
            inputmode="decimal"
            [ngModel]="form().tax_rate"
            (ngModelChange)="set('tax_rate', $event)"
          />
        </label>
        <label class="field" for="pc-barcode">
          <span>{{ 'productCatalog.field.barcode' | translate }}</span>
          <input
            nz-input
            id="pc-barcode"
            [ngModel]="form().barcode ?? ''"
            (ngModelChange)="set('barcode', $event)"
          />
          @if (!barcodeValid()) {
            <small class="error">{{
              'productCatalog.error.gtin_invalid' | translate: { gtin: form().barcode }
            }}</small>
          } @else {
            <small>{{ 'productCatalog.hint.gtin' | translate }}</small>
          }
        </label>
        @if (!store.product()) {
          <div class="field switch">
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label
              nz-checkbox
              id="pc-gen-barcode"
              [ngModel]="generate()"
              (ngModelChange)="generate.set($event)"
            >
              {{ 'productCatalog.field.generateBarcode' | translate }}
            </label>
          </div>
        }
        <label class="field switch" for="pc-track">
          <span>{{ 'productCatalog.field.trackInventory' | translate }}</span>
          <nz-switch
            nzId="pc-track"
            [nzDisabled]="rules().locked"
            [ngModel]="form().track_inventory"
            (ngModelChange)="set('track_inventory', $event)"
          ></nz-switch>
          @if (rules().locked) {
            <small>{{ 'productCatalog.hint.notStocked' | translate }}</small>
          }
        </label>
        <label class="field switch" for="pc-active">
          <span>{{ 'productCatalog.field.isActive' | translate }}</span>
          <nz-switch
            nzId="pc-active"
            [ngModel]="form().is_active"
            (ngModelChange)="set('is_active', $event)"
          ></nz-switch>
        </label>
        <label class="field" for="pc-category">
          <span>{{ 'productCatalog.field.category' | translate }}</span>
          <nz-select
            nzId="pc-category"
            nzAllowClear
            [ngModel]="form().category_id ?? null"
            (ngModelChange)="set('category_id', $event)"
          >
            @for (category of store.lookups()?.categories ?? []; track category.id) {
              <nz-option [nzValue]="category.id" [nzLabel]="category.name"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="pc-brand">
          <span>{{ 'productCatalog.field.brand' | translate }}</span>
          <nz-select
            nzId="pc-brand"
            nzAllowClear
            [ngModel]="form().brand_id ?? null"
            (ngModelChange)="set('brand_id', $event)"
          >
            @for (brand of store.lookups()?.brands ?? []; track brand.id) {
              <nz-option [nzValue]="brand.id" [nzLabel]="brand.name"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field wide" for="pc-description">
          <span>{{ 'productCatalog.field.description' | translate }}</span>
          <textarea
            nz-input
            id="pc-description"
            rows="2"
            [ngModel]="form().description ?? ''"
            (ngModelChange)="set('description', $event)"
          ></textarea>
        </label>
      </div>
    </section>

    <section>
      <h4>{{ 'productCatalog.section.classification' | translate }}</h4>
      <div class="grid">
        <label class="field" for="pc-tares">
          <span>{{ 'productCatalog.field.tares' | translate }}</span>
          <input
            nz-input
            id="pc-tares"
            maxlength="8"
            [ngModel]="form().tares_code ?? ''"
            (ngModelChange)="set('tares_code', $event)"
          />
          @if (!taresValid()) {
            <small class="error">{{ 'productCatalog.hint.taresFormat' | translate }}</small>
          } @else {
            <small>{{ 'productCatalog.hint.tares' | translate }}</small>
          }
        </label>
        <label class="field" for="pc-taric">
          <span>{{ 'productCatalog.field.taric' | translate }}</span>
          <input
            nz-input
            id="pc-taric"
            maxlength="10"
            [ngModel]="form().taric_code ?? ''"
            (ngModelChange)="set('taric_code', $event)"
          />
          @if (!taricValid()) {
            <small class="error">{{ 'productCatalog.hint.taricFormat' | translate }}</small>
          } @else {
            <small>{{ 'productCatalog.hint.taric' | translate }}</small>
          }
        </label>
        <label class="field" for="pc-country">
          <span>{{ 'productCatalog.field.country' | translate }}</span>
          <input
            nz-input
            id="pc-country"
            maxlength="2"
            [ngModel]="form().country_of_origin ?? ''"
            (ngModelChange)="set('country_of_origin', ($event ?? '').toUpperCase())"
          />
          <small>{{ 'productCatalog.hint.country' | translate }}</small>
        </label>
        <label class="field" for="pc-duty">
          <span>{{ 'productCatalog.field.dutyRate' | translate }}</span>
          <input
            nz-input
            id="pc-duty"
            inputmode="decimal"
            [ngModel]="form().customs_duty_rate ?? ''"
            (ngModelChange)="set('customs_duty_rate', $event)"
          />
        </label>
        <label class="field" for="pc-net">
          <span>{{ 'productCatalog.field.netWeight' | translate }}</span>
          <input
            nz-input
            id="pc-net"
            inputmode="decimal"
            [ngModel]="form().net_weight_kg ?? ''"
            (ngModelChange)="set('net_weight_kg', $event)"
          />
        </label>
        <label class="field" for="pc-gross">
          <span>{{ 'productCatalog.field.grossWeight' | translate }}</span>
          <input
            nz-input
            id="pc-gross"
            inputmode="decimal"
            [ngModel]="form().gross_weight_kg ?? ''"
            (ngModelChange)="set('gross_weight_kg', $event)"
          />
        </label>
        <label class="field" for="pc-vat-it">
          <span>{{ 'productCatalog.field.vatIt' | translate }}</span>
          <nz-select
            nzId="pc-vat-it"
            nzAllowClear
            [ngModel]="form().vat_code_it_id ?? null"
            (ngModelChange)="set('vat_code_it_id', $event)"
          >
            @for (code of store.vatCodesIt(); track code.id) {
              <nz-option
                [nzValue]="code.id"
                [nzLabel]="code.code + ' (' + code.rate + '%)'"
              ></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="pc-vat-ch">
          <span>{{ 'productCatalog.field.vatCh' | translate }}</span>
          <nz-select
            nzId="pc-vat-ch"
            nzAllowClear
            [ngModel]="form().vat_code_ch_id ?? null"
            (ngModelChange)="set('vat_code_ch_id', $event)"
          >
            @for (code of store.vatCodesCh(); track code.id) {
              <nz-option
                [nzValue]="code.id"
                [nzLabel]="code.code + ' (' + code.rate + '%)'"
              ></nz-option>
            }
          </nz-select>
        </label>
      </div>
    </section>

    <div class="form-footer">
      <button nz-button type="button" (click)="cancelled.emit()">
        {{ 'productCatalog.action.cancel' | translate }}
      </button>
      @if (canWrite()) {
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="!valid() || store.saving()"
          [nzLoading]="store.saving()"
          (click)="submit()"
        >
          {{ 'productCatalog.action.save' | translate }}
        </button>
      }
    </div>
  `,
})
export class ProductGeneralFormComponent {
  protected readonly store = inject(ProductEditorStore);
  private readonly i18n = inject(TranslateService);

  readonly canWrite = input.required<boolean>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  protected readonly form = signal<PcProductPayload>(emptyProduct());
  protected readonly generate = signal(false);
  protected readonly failure = signal<PcOutcome | null>(null);
  protected readonly fieldErrors = computed(() => this.failure()?.errors ?? {});

  protected readonly rules = computed(() =>
    stockRules(
      (this.form().product_type ?? 'storable') as PcProductType,
      (this.form().kit_type ?? null) as PcKitType | null,
    ),
  );
  protected readonly barcodeValid = computed(() => isGtinValid(this.form().barcode));
  protected readonly taresValid = computed(() => isTaresValid(this.form().tares_code));
  protected readonly taricValid = computed(() => isTaricValid(this.form().taric_code));
  protected readonly valid = computed(
    () =>
      (this.form().sku ?? '').trim() !== '' &&
      (this.form().name ?? '').trim() !== '' &&
      this.barcodeValid() &&
      this.taresValid() &&
      this.taricValid(),
  );

  protected unitName(unit: PcUnit): string {
    return unitLabel(unit, (key) => this.i18n.instant(key));
  }

  constructor() {
    // The form follows the product the store has open (a new product starts from the defaults).
    effect(() => {
      const product = this.store.product();
      this.form.set(product === null ? emptyProduct() : productToPayload(product));
      this.failure.set(null);
    });
  }

  protected set<K extends keyof PcProductPayload>(
    key: K,
    value: PcProductPayload[K] | undefined,
  ): void {
    this.form.update((current) => ({ ...current, [key]: value ?? null }));
  }

  protected setType(type: PcProductType): void {
    this.form.update((current) => {
      const rules = stockRules(type, current.kit_type ?? null);
      return {
        ...current,
        product_type: type,
        kit_type: rules.kitAllowed ? (current.kit_type ?? null) : null,
        track_inventory: stockRules(type, rules.kitAllowed ? (current.kit_type ?? null) : null)
          .tracksStock
          ? (current.track_inventory ?? true)
          : false,
      };
    });
  }

  protected setKit(kit: PcKitType | null): void {
    this.form.update((current) => ({
      ...current,
      kit_type: kit,
      track_inventory: stockRules((current.product_type ?? 'storable') as PcProductType, kit)
        .tracksStock,
    }));
  }

  protected async submit(): Promise<void> {
    const payload: PcProductPayload = { ...this.form() };
    if (this.generate() && !payload.barcode) {
      payload.generate_barcode = true;
    }
    const outcome = await this.store.save(payload);
    this.failure.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.saved.emit();
    }
  }
}
