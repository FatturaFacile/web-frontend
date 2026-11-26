import { EnvironmentProviders, Provider, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { vi } from 'vitest';
import { icons } from '../../icons-provider';
import {
  PcAttribute,
  PcEnvelope,
  PcLookups,
  PcPage,
  PcProduct,
  PcProductDetail,
  PermissionsService,
  ProductCatalogApiService,
  TranslateService,
} from '@core';

/** Wraps data in the envelope the API answers. */
export function wrap<T>(data: T): PcEnvelope<T> {
  return { success: true, message: 'ok', data };
}

export function page<T>(data: T[], total = data.length): PcPage<T> {
  return {
    success: true,
    message: 'ok',
    data,
    meta: { current_page: 1, per_page: 25, total, last_page: 1 },
  };
}

export function translateSpy() {
  return {
    instant: vi.fn((key: string) => key),
    translate: vi.fn((key: string) => key),
    currentLanguage: signal('en'),
  };
}

export const lookups: PcLookups = {
  product_types: ['storable', 'consumable', 'service', 'digital'],
  kit_types: ['phantom', 'physical'],
  packaging_roles: ['purchase', 'sales', 'logistic'],
  rounding_modes: ['half_up', 'up', 'down', 'none'],
  delta_types: ['fixed', 'percent'],
  import_modes: ['dry_run', 'atomic', 'partial'],
  units: [
    { id: 'u-pz', code: 'PZ', name: 'Piece' },
    { id: 'u-ct', code: 'CT', name: 'Carton' },
  ],
  vat_codes: [
    { id: 'v-it', code: 'IVA22', country: 'IT', rate: '22.00' },
    { id: 'v-ch', code: 'CH_MWST_81', country: 'CH', rate: '8.10' },
  ],
  categories: [{ id: 'c-1', name: 'Apparel' }],
  brands: [{ id: 'b-1', name: 'Acme' }],
};

export function product(id: string, overrides: Partial<PcProduct> = {}): PcProduct {
  return {
    id,
    sku: `SKU-${id}`,
    name: `Product ${id}`,
    description: null,
    product_type: 'storable',
    kit_type: null,
    is_variant: false,
    parent_id: null,
    attributes: {},
    unit_of_measure_id: 'u-pz',
    unit_measure: 'PZ',
    purchase_uom_id: null,
    sales_uom_id: null,
    uom_rounding: 'half_up',
    uom_precision: 4,
    barcode: null,
    cost_price: '10.0000',
    sale_price: '25.0000',
    tax_rate: '22.00',
    price_delta: null,
    price_delta_type: null,
    cost_delta: null,
    cost_delta_type: null,
    price_overridden: false,
    cost_overridden: false,
    track_inventory: true,
    is_active: true,
    category_id: null,
    brand_id: null,
    min_stock: null,
    tares_code: null,
    taric_code: null,
    customs_taric_code_id: null,
    country_of_origin: null,
    customs_duty_rate: null,
    net_weight_kg: null,
    gross_weight_kg: null,
    vat_code_it_id: null,
    vat_code_ch_id: null,
    ...overrides,
  };
}

export function detail(id: string, overrides: Partial<PcProductDetail> = {}): PcProductDetail {
  return {
    ...product(id),
    axes: [],
    variants: [],
    packagings: [],
    kit_components: [],
    ...overrides,
  };
}

export const sizeAttribute: PcAttribute = {
  id: 'a-size',
  code: 'size',
  name: { en: 'Size', it: 'Taglia' },
  sku_token: 'SIZ',
  sort_order: 0,
  is_active: true,
  values: [
    {
      id: 'v-s',
      code: 's',
      label: { en: 'S' },
      sku_token: 'S',
      price_delta: null,
      price_delta_type: null,
      cost_delta: null,
      cost_delta_type: null,
    },
    {
      id: 'v-xl',
      code: 'xl',
      label: { en: 'XL' },
      sku_token: 'XL',
      price_delta: '2.0000',
      price_delta_type: 'fixed',
      cost_delta: null,
      cost_delta_type: null,
    },
  ],
};

export const colorAttribute: PcAttribute = {
  id: 'a-color',
  code: 'color',
  name: { en: 'Colour', it: 'Colore' },
  sku_token: 'COL',
  sort_order: 1,
  is_active: true,
  values: [
    {
      id: 'v-blk',
      code: 'black',
      label: { en: 'Black', it: 'Nero' },
      sku_token: 'BLK',
      price_delta: null,
      price_delta_type: null,
      cost_delta: null,
      cost_delta_type: null,
    },
    {
      id: 'v-wht',
      code: 'white',
      label: { en: 'White' },
      sku_token: 'WHT',
      price_delta: null,
      price_delta_type: null,
      cost_delta: null,
      cost_delta_type: null,
    },
  ],
};

/** The providers every component of the module needs, with the API double and the write permission switch. */
export function baseProviders(
  api: unknown,
  canWrite: (module?: string) => boolean = () => true,
): (Provider | EnvironmentProviders)[] {
  return [
    provideRouter([]),
    { provide: ProductCatalogApiService, useValue: api },
    { provide: PermissionsService, useValue: { canWrite } },
    { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
    { provide: TranslateService, useValue: translateSpy() },
    provideNzIcons(icons),
  ];
}
