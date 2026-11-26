import { HttpErrorResponse } from '@angular/common/http';
import {
  PcAttribute,
  PcAttributeValue,
  PcKitLinePayload,
  PcKitType,
  PcMatrixAxis,
  PcPackaging,
  PcPackagingPayload,
  PcProblem,
  PcProduct,
  PcProductPayload,
  PcProductType,
  PcUnit,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`). */
export const PRODUCT_CATALOG_MODULE = 'product_catalog';

/** Largest matrix the API accepts. */
export const PC_MAX_COMBINATIONS = 500;

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and the field errors of a 422. */
export interface PcOutcome {
  ok: boolean;
  /** Translation key of the refusal (`productCatalog.error.<code>`), null on success. */
  errorKey: string | null;
  code: string | null;
  detail: string | null;
  params: Record<string, string | number>;
  errors: Record<string, string[]>;
}

export const PC_OK: PcOutcome = {
  ok: true,
  errorKey: null,
  code: null,
  detail: null,
  params: {},
  errors: {},
};

export function errorKey(code: string | null | undefined): string {
  return `productCatalog.error.${code ? code : 'generic'}`;
}

export function problemOf(error: unknown): PcProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as PcProblem) : null;
}

function scalarParams(
  params: Record<string, unknown> | undefined,
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === 'string' || typeof value === 'number') {
      result[key] = value;
    }
  }
  return result;
}

/** The outcome of a failed call: the `code` of the problem picks the key, a 422 brings the field errors. */
export function failureOf(error: unknown): PcOutcome {
  const problem = problemOf(error);
  const errors = problem?.errors ?? {};
  const first = Object.values(errors).flat()[0];
  return {
    ok: false,
    errorKey: errorKey(problem?.code),
    code: problem?.code ?? null,
    detail: first ?? problem?.detail ?? null,
    params: scalarParams(problem?.params),
    errors,
  };
}

/** Saves a downloaded blob under a file name. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Exact decimals (BigInt on scaled integers: no floating point enters a quantity) ---

const SCALE = 6;

function parts(value: string): { negative: boolean; whole: string; fraction: string } | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (match === null) {
    return null;
  }
  return {
    negative: match[1] === '-',
    whole: match[2],
    fraction: (match[3] ?? '').padEnd(SCALE, '0'),
  };
}

/** A decimal string as an integer scaled by 10^6, or null when it is not a decimal number. */
export function toScaled(value: string | number | null | undefined): bigint | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const decomposed = parts(String(value));
  if (decomposed === null) {
    return null;
  }
  const scaled = BigInt(decomposed.whole + decomposed.fraction.slice(0, SCALE));
  return decomposed.negative ? -scaled : scaled;
}

export function fromScaled(scaled: bigint, decimals = SCALE): string {
  const negative = scaled < 0n;
  const text = (negative ? -scaled : scaled).toString().padStart(SCALE + 1, '0');
  const whole = text.slice(0, text.length - SCALE);
  const fraction = text.slice(text.length - SCALE).slice(0, decimals);
  const body = decimals > 0 ? `${whole}.${fraction}` : whole;
  return negative ? `-${body}` : body;
}

/** Removes trailing zeros of a decimal string (`12.500000` becomes `12.5`). */
export function trimDecimal(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') || '0' : value;
}

/** The name of a unit of measure: the dictionary text of its code, the name stored with the unit when the dictionary has none. */
export function unitLabel(unit: PcUnit, instant: (key: string) => string): string {
  const key = `productCatalog.unit.${unit.code}`;
  const text = instant(key);
  return text === '' || text === key ? unit.name : text;
}

// --- Variant matrix ---

export function matrixCount(axes: PcMatrixAxis[]): number {
  return axes.length === 0 ? 0 : axes.reduce((total, axis) => total * axis.value_ids.length, 1);
}

/** The cartesian product of the chosen values, in the order of the axes (the order of the SKU tokens). */
export function matrixCombinations(axes: PcMatrixAxis[]): string[][] {
  if (axes.length === 0 || axes.some((axis) => axis.value_ids.length === 0)) {
    return [];
  }
  let combinations: string[][] = [[]];
  for (const axis of axes) {
    combinations = combinations.flatMap((combination) =>
      axis.value_ids.map((valueId) => [...combination, valueId]),
    );
  }
  return combinations;
}

export function matrixKey(valueIds: string[]): string {
  return valueIds.join('|');
}

export function matrixTooLarge(axes: PcMatrixAxis[]): boolean {
  return matrixCount(axes) > PC_MAX_COMBINATIONS;
}

/** Toggles a value in the axis of an attribute; an axis without values disappears. */
export function toggleAxisValue(
  axes: PcMatrixAxis[],
  attributeId: string,
  valueId: string,
): PcMatrixAxis[] {
  const axis = axes.find((candidate) => candidate.attribute_id === attributeId);
  if (axis === undefined) {
    return [...axes, { attribute_id: attributeId, value_ids: [valueId] }];
  }
  const values = axis.value_ids.includes(valueId)
    ? axis.value_ids.filter((id) => id !== valueId)
    : [...axis.value_ids, valueId];
  return values.length === 0
    ? axes.filter((candidate) => candidate.attribute_id !== attributeId)
    : axes.map((candidate) =>
        candidate.attribute_id === attributeId ? { ...candidate, value_ids: values } : candidate,
      );
}

/** The label of an attribute value in a locale (English, then the code, as the API does). */
export function valueLabel(value: PcAttributeValue, locale: string): string {
  const label = value.label as Record<string, string | undefined>;
  return label[locale] ?? label['en'] ?? value.code;
}

export function attributeName(attribute: PcAttribute, locale: string): string {
  const name = attribute.name as Record<string, string | undefined>;
  return name[locale] ?? name['en'] ?? attribute.code;
}

// --- Defaults, payloads and checks ---

export function emptyProduct(): PcProductPayload {
  return {
    sku: '',
    name: '',
    description: null,
    product_type: 'storable',
    kit_type: null,
    unit_of_measure_id: null,
    uom_rounding: 'half_up',
    uom_precision: 4,
    barcode: null,
    cost_price: '0',
    sale_price: '0',
    tax_rate: '22',
    track_inventory: true,
    is_active: true,
    tares_code: null,
    taric_code: null,
    country_of_origin: null,
    vat_code_it_id: null,
    vat_code_ch_id: null,
  };
}

export function productToPayload(product: PcProduct): PcProductPayload {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description,
    product_type: product.product_type,
    kit_type: product.kit_type,
    unit_of_measure_id: product.unit_of_measure_id,
    uom_rounding: product.uom_rounding,
    uom_precision: product.uom_precision,
    barcode: product.barcode,
    cost_price: product.cost_price,
    sale_price: product.sale_price,
    tax_rate: product.tax_rate,
    category_id: product.category_id,
    brand_id: product.brand_id,
    track_inventory: product.track_inventory,
    is_active: product.is_active,
    price_delta: product.price_delta,
    price_delta_type: product.price_delta_type,
    cost_delta: product.cost_delta,
    cost_delta_type: product.cost_delta_type,
    price_overridden: product.price_overridden,
    cost_overridden: product.cost_overridden,
    tares_code: product.tares_code,
    taric_code: product.taric_code,
    country_of_origin: product.country_of_origin,
    customs_duty_rate: product.customs_duty_rate,
    net_weight_kg: product.net_weight_kg,
    gross_weight_kg: product.gross_weight_kg,
    vat_code_it_id: product.vat_code_it_id,
    vat_code_ch_id: product.vat_code_ch_id,
  };
}

/** Empty strings become null, so a cleared optional field clears it on the API. */
export function cleanPayload(payload: PcProductPayload): PcProductPayload {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    cleaned[key] = typeof value === 'string' && value.trim() === '' ? null : value;
  }
  // The required text fields keep the empty string so the API reports them.
  cleaned['sku'] = payload.sku ?? '';
  cleaned['name'] = payload.name ?? '';
  return cleaned as PcProductPayload;
}

/** The rules between type and kit the form applies (the API enforces the same): services and digital goods are not stocked. */
export function stockRules(
  type: PcProductType,
  kit: PcKitType | null,
): { tracksStock: boolean; locked: boolean; kitAllowed: boolean } {
  const stocked = type === 'storable' || type === 'consumable';
  if (kit !== null) {
    return { tracksStock: kit === 'physical', locked: true, kitAllowed: stocked };
  }
  return { tracksStock: stocked, locked: !stocked, kitAllowed: stocked };
}

/** GS1 check digit of a barcode of 8, 12, 13 or 14 digits; other barcodes are not checked. */
export function isGtinValid(code: string | null | undefined): boolean {
  if (code === null || code === undefined || code === '' || !/^\d+$/.test(code)) {
    return true;
  }
  if (![8, 12, 13, 14].includes(code.length)) {
    return true;
  }
  const digits = code.split('').map(Number);
  const check = digits.pop() ?? 0;
  let sum = 0;
  digits.reverse().forEach((digit, index) => {
    sum += digit * (index % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

/** Italian and Swiss customs formats: Tares 8 digits, TARIC / CN 6, 8 or 10 digits. */
export function isTaresValid(code: string | null | undefined): boolean {
  return code === null || code === undefined || code === '' || /^\d{8}$/.test(code);
}

export function isTaricValid(code: string | null | undefined): boolean {
  return code === null || code === undefined || code === '' || /^\d{6}(\d{2}(\d{2})?)?$/.test(code);
}

// --- Kits ---

export function emptyKitLine(): PcKitLinePayload {
  return { component_id: '', quantity: '1', is_optional: false };
}

/** Problems of a bill of materials the form shows before saving (the API checks cycles and types). */
export function kitProblems(productId: string, lines: PcKitLinePayload[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (line.component_id === '') {
      problems.push('productCatalog.error.component_not_found');
      continue;
    }
    if (line.component_id === productId) {
      problems.push('productCatalog.error.kit_contains_itself');
    }
    if (seen.has(line.component_id)) {
      problems.push('productCatalog.error.duplicate_component');
    }
    seen.add(line.component_id);
    const quantity = toScaled(line.quantity);
    if (quantity === null || quantity <= 0n) {
      problems.push('productCatalog.error.component_quantity_invalid');
    }
  }
  return [...new Set(problems)];
}

// --- Units of measure ---

export function emptyLevel(): PcPackagingPayload['levels'][number] {
  return {
    code: '',
    uom_id: '',
    units_per_parent: '1',
    parent_code: null,
    role: 'logistic',
    gtin: null,
  };
}

export function packagingToPayload(
  packagings: PcPackaging[],
  byId = new Map<string, string>(),
): PcPackagingPayload['levels'] {
  const codes = new Map<string, string>(packagings.map((p) => [p.id ?? '', p.code]));
  return packagings.map((packaging) => ({
    code: packaging.code,
    uom_id: packaging.uom_id,
    units_per_parent: packaging.units_per_parent,
    parent_code:
      packaging.parent_packaging_id !== null && packaging.parent_packaging_id !== undefined
        ? (codes.get(packaging.parent_packaging_id) ??
          byId.get(packaging.parent_packaging_id) ??
          null)
        : null,
    role: packaging.role,
    gtin: packaging.gtin,
  }));
}

/**
 * The factor to the base unit of every level, chained from the parents (the same arithmetic as the API). Returns the problems
 * found: an unknown parent or a cycle.
 */
export function chainFactors(levels: PcPackagingPayload['levels']): {
  factors: Record<string, string>;
  problems: string[];
} {
  const byCode = new Map(levels.map((level) => [level.code.toUpperCase(), level]));
  const factors: Record<string, string> = {};
  const problems: string[] = [];

  const resolve = (code: string, trail: string[]): bigint | null => {
    const known = factors[code];
    if (known !== undefined) {
      return toScaled(known);
    }
    if (trail.includes(code)) {
      problems.push('productCatalog.error.packaging_cycle');
      return null;
    }
    const level = byCode.get(code);
    const units = toScaled(level?.units_per_parent ?? null);
    if (level === undefined || units === null || units <= 0n) {
      problems.push('productCatalog.error.packaging_quantity_invalid');
      return null;
    }
    let factor = units;
    if (level.parent_code !== null && level.parent_code !== '') {
      const parent = level.parent_code.toUpperCase();
      if (!byCode.has(parent)) {
        problems.push('productCatalog.error.packaging_parent_unknown');
        return null;
      }
      const parentFactor = resolve(parent, [...trail, code]);
      if (parentFactor === null) {
        return null;
      }
      factor = (parentFactor * units) / 10n ** BigInt(SCALE);
    }
    factors[code] = fromScaled(factor);
    return factor;
  };

  for (const code of byCode.keys()) {
    resolve(code, []);
  }
  return { factors, problems: [...new Set(problems)] };
}
