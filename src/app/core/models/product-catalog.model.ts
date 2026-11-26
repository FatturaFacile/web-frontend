/** Product catalog (Mod 052 / Issue #248): types, variants, kits, units of measure, CH / IT classification and bulk exchange. */

export const PC_PRODUCT_TYPES = ['storable', 'consumable', 'service', 'digital'] as const;
export type PcProductType = (typeof PC_PRODUCT_TYPES)[number];

export const PC_KIT_TYPES = ['phantom', 'physical'] as const;
export type PcKitType = (typeof PC_KIT_TYPES)[number];

export const PC_PACKAGING_ROLES = ['purchase', 'sales', 'logistic'] as const;
export type PcPackagingRole = (typeof PC_PACKAGING_ROLES)[number];

export const PC_ROUNDING_MODES = ['half_up', 'up', 'down', 'none'] as const;
export type PcRoundingMode = (typeof PC_ROUNDING_MODES)[number];

export const PC_DELTA_TYPES = ['fixed', 'percent'] as const;
export type PcDeltaType = (typeof PC_DELTA_TYPES)[number];

export const PC_IMPORT_MODES = ['dry_run', 'atomic', 'partial'] as const;
export type PcImportMode = (typeof PC_IMPORT_MODES)[number];

/** The locales of the labels of attributes and values. */
export const PC_LOCALES = ['it', 'de', 'fr', 'en'] as const;
export type PcLocale = (typeof PC_LOCALES)[number];
export type PcLocalized = Partial<Record<PcLocale, string>>;

// --- Envelopes ---

export interface PcPageMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface PcEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PcPageMeta;
}

export interface PcPage<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: PcPageMeta;
}

/** RFC 7807 problem the API answers with: `code` is the translation key suffix, `params` feed the text. */
export interface PcProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  params?: Record<string, unknown>;
  errors?: Record<string, string[]>;
}

// --- Products ---

export interface PcProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  product_type: PcProductType;
  kit_type: PcKitType | null;
  is_variant: boolean;
  parent_id: string | null;
  parent_sku?: string | null;
  variants_count?: number;
  attributes: Record<string, string>;
  unit_of_measure_id: string | null;
  unit_measure: string | null;
  purchase_uom_id: string | null;
  sales_uom_id: string | null;
  uom_rounding: PcRoundingMode;
  uom_precision: number;
  barcode: string | null;
  cost_price: string;
  sale_price: string;
  tax_rate: string;
  price_delta: string | null;
  price_delta_type: PcDeltaType | null;
  cost_delta: string | null;
  cost_delta_type: PcDeltaType | null;
  price_overridden: boolean;
  cost_overridden: boolean;
  track_inventory: boolean;
  is_active: boolean;
  category_id: string | null;
  brand_id: string | null;
  min_stock: string | null;
  tares_code: string | null;
  taric_code: string | null;
  customs_taric_code_id: string | null;
  country_of_origin: string | null;
  customs_duty_rate: string | null;
  net_weight_kg: string | null;
  gross_weight_kg: string | null;
  vat_code_it_id: string | null;
  vat_code_ch_id: string | null;
}

export interface PcVariant extends PcProduct {
  value_ids: string[];
}

export interface PcPackaging {
  id?: string;
  code: string;
  role: PcPackagingRole;
  uom_id: string;
  parent_packaging_id?: string | null;
  units_per_parent: string;
  quantity_base?: string;
  level?: number;
  gtin: string | null;
}

export interface PcKitComponent {
  id?: string;
  component_id: string;
  sku: string | null;
  name: string | null;
  quantity: string;
  is_optional: boolean;
}

export interface PcMatrixAxis {
  attribute_id: string;
  value_ids: string[];
}

export interface PcProductDetail extends PcProduct {
  axes: { attribute_id: string; sort_order: number }[];
  variants: PcVariant[];
  packagings: PcPackaging[];
  kit_components: PcKitComponent[];
}

export interface PcProductFilters {
  q?: string;
  kind?: 'catalog' | 'variants' | 'all';
  product_type?: PcProductType | '';
  kit_type?: PcKitType | '';
  country_of_origin?: string;
  is_active?: boolean | '';
  per_page?: number;
  page?: number;
}

/** What the form sends: the general, unit, price and classification fields (the API accepts any subset on update). */
export type PcProductPayload = Partial<
  Pick<
    PcProduct,
    | 'sku'
    | 'name'
    | 'description'
    | 'product_type'
    | 'kit_type'
    | 'unit_of_measure_id'
    | 'uom_rounding'
    | 'uom_precision'
    | 'barcode'
    | 'tax_rate'
    | 'category_id'
    | 'brand_id'
    | 'track_inventory'
    | 'is_active'
    | 'price_delta_type'
    | 'cost_delta_type'
    | 'price_overridden'
    | 'cost_overridden'
    | 'tares_code'
    | 'taric_code'
    | 'customs_taric_code_id'
    | 'country_of_origin'
    | 'vat_code_it_id'
    | 'vat_code_ch_id'
  >
> & {
  cost_price?: string | number;
  sale_price?: string | number;
  price_delta?: string | number | null;
  cost_delta?: string | number | null;
  min_stock?: string | number | null;
  customs_duty_rate?: string | number | null;
  net_weight_kg?: string | number | null;
  gross_weight_kg?: string | number | null;
  generate_barcode?: boolean;
};

// --- Attributes ---

export interface PcAttributeValue {
  id?: string;
  code: string;
  label: PcLocalized;
  sku_token: string;
  price_delta: string | null;
  price_delta_type: PcDeltaType | null;
  cost_delta: string | null;
  cost_delta_type: PcDeltaType | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface PcAttribute {
  id: string;
  code: string;
  name: PcLocalized;
  sku_token: string;
  sort_order: number;
  is_active: boolean;
  values: PcAttributeValue[];
}

export interface PcAttributePayload {
  code?: string;
  name: PcLocalized;
  sku_token?: string | null;
  is_active?: boolean;
  values: PcAttributeValue[];
}

// --- Matrix, kits, units ---

export interface PcMatrixOverride {
  sku?: string | null;
  barcode?: string | null;
  sale_price?: string | number | null;
  cost_price?: string | number | null;
}

export interface PcMatrixRequest {
  axes: PcMatrixAxis[];
  overrides?: Record<string, PcMatrixOverride>;
  generate_barcodes?: boolean;
}

export interface PcMatrixCombination {
  key: string;
  values: string[];
  labels: Record<string, string>;
  sku: string;
  sale_price: string;
  cost_price: string;
  exists: boolean;
}

export interface PcMatrixPreview {
  total: number;
  new: number;
  combinations: PcMatrixCombination[];
}

export interface PcMatrixResult {
  created: PcProduct[];
  skipped: number;
}

export interface PcKitLinePayload {
  component_id: string;
  quantity: string | number;
  is_optional: boolean;
}

export interface PcExplodedLine {
  product_id: string;
  sku: string;
  name: string;
  quantity: string;
  via_kits: string[];
}

export interface PcExplosion {
  commercial: {
    product_id: string;
    sku: string;
    name: string;
    quantity: string;
    kit_type: PcKitType | null;
  }[];
  warehouse: PcExplodedLine[];
}

export interface PcPackagingPayload {
  uom_rounding: PcRoundingMode;
  uom_precision: number;
  levels: {
    code: string;
    uom_id: string;
    units_per_parent: string | number;
    parent_code: string | null;
    role: PcPackagingRole;
    gtin: string | null;
  }[];
}

export interface PcConversion {
  base: string;
  units: Record<string, string>;
  split: { parts: { unit: string; quantity: string }[]; remainder: string };
}

// --- Lookups ---

export interface PcUnit {
  id: string;
  code: string;
  name: string;
}

export interface PcVatCode {
  id: string;
  code: string;
  country: 'IT' | 'CH';
  rate: string;
}

export interface PcNamed {
  id: string;
  name: string;
}

export interface PcCustomsCode {
  id: string;
  code: string;
  level: string;
  description: string;
}

export interface PcLookups {
  product_types: PcProductType[];
  kit_types: PcKitType[];
  packaging_roles: PcPackagingRole[];
  rounding_modes: PcRoundingMode[];
  delta_types: PcDeltaType[];
  import_modes: PcImportMode[];
  units: PcUnit[];
  vat_codes: PcVatCode[];
  categories: PcNamed[];
  brands: PcNamed[];
}

// --- Import and export ---

export interface PcImportError {
  line: number;
  sku: string | null;
  field: string;
  message: string;
}

export interface PcImportReport {
  mode: PcImportMode;
  committed: boolean;
  total: number;
  created: number;
  updated: number;
  failed: number;
  errors: PcImportError[];
}

export interface PcImportSchema {
  columns: string[];
  required: string[];
  modes: PcImportMode[];
  max_rows: number;
}
