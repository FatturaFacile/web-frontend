import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import {
  FiscalPreferences,
  FundSettings,
  InvoiceDetailResource,
  TaxPreviewItem,
  TaxPreviewRequest,
  WithholdingSettings,
} from '@core';

/**
 * Italian fiscal controls of the invoice drawer (issue #286). Control names match the backend payload keys
 * (`split_payment`, `fund`, `withholding`, `enasarco`, ...) so `applyServerErrors` binds 422 errors to them.
 */
export type FundGroup = FormGroup<{
  type: FormControl<string>;
  percent: FormControl<number>;
  vat_rate: FormControl<number | null>;
  natura: FormControl<string | null>;
  withholding_applies: FormControl<boolean>;
}>;

export type WithholdingGroup = FormGroup<{
  type: FormControl<string>;
  reason: FormControl<string>;
  rate: FormControl<number>;
  taxable_percent: FormControl<number | null>;
  includes_fund: FormControl<boolean>;
}>;

/** Neutral starting values when the tenant has no default (codes only; rates are user input). */
const EMPTY_FUND: Required<FundSettings> = {
  type: 'TC22',
  percent: 0,
  vat_rate: null,
  natura: null,
  withholding_applies: false,
};
const EMPTY_WITHHOLDING: Required<WithholdingSettings> = {
  type: 'RT01',
  reason: 'A',
  rate: 0,
  taxable_percent: 100,
  includes_fund: false,
};

export function createFiscalControls(fb: NonNullableFormBuilder) {
  return {
    split_payment: fb.control(false),
    reverse_charge: fb.control(false),
    vat_payability: fb.control<'I' | 'D'>('I'),
    stamp_duty_charged_to_customer: fb.control(true),
    fund_enabled: fb.control(false),
    fund: fb.group({
      type: fb.control(EMPTY_FUND.type, Validators.required),
      percent: fb.control(EMPTY_FUND.percent, [Validators.min(0), Validators.max(100)]),
      vat_rate: new FormControl<number | null>(null),
      natura: new FormControl<string | null>(null),
      withholding_applies: fb.control(false),
    }) as FundGroup,
    withholding_enabled: fb.control(false),
    withholding: fb.group({
      type: fb.control(EMPTY_WITHHOLDING.type, Validators.required),
      reason: fb.control(EMPTY_WITHHOLDING.reason, Validators.required),
      rate: fb.control(EMPTY_WITHHOLDING.rate, [Validators.min(0), Validators.max(100)]),
      taxable_percent: new FormControl<number | null>(100),
      includes_fund: fb.control(false),
    }) as WithholdingGroup,
    enasarco: fb.control(false),
  };
}

export interface FiscalFormValue {
  split_payment: boolean;
  reverse_charge: boolean;
  vat_payability: 'I' | 'D';
  stamp_duty_charged_to_customer: boolean;
  fund_enabled: boolean;
  fund: Required<FundSettings>;
  withholding_enabled: boolean;
  withholding: Required<WithholdingSettings>;
  enasarco: boolean;
}

export interface FiscalItemValue {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_percentage: number;
  natura: string | null;
  withholding_applies: boolean;
  fund_applies: boolean;
}

const num = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || Number.isNaN(n) ? fallback : n;
};
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : num(v, 0);

/** The `fiscal` preference group, or `null` while the tenant has none (`[]` on the wire). */
export function fiscalPreferences(raw: unknown): FiscalPreferences | null {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as FiscalPreferences) : null;
}

/** Form values for the drawer defaults: an existing invoice (duplicate) wins over tenant preferences. */
export function fiscalDefaults(
  prefs: FiscalPreferences | null,
  tpl: InvoiceDetailResource | null,
): FiscalFormValue {
  const tplHasFiscal = !!tpl && (tpl.fund !== undefined || tpl.withholding !== undefined);
  const fund = tplHasFiscal ? tpl!.fund : prefs?.default_fund;
  const withholding = tplHasFiscal ? tpl!.withholding : prefs?.default_withholding;
  const payability = tpl?.vat_payability;
  return {
    split_payment: !!tpl?.split_payment || payability === 'S',
    reverse_charge: !!tpl?.reverse_charge,
    vat_payability: payability === 'D' ? 'D' : 'I',
    stamp_duty_charged_to_customer:
      tpl?.stamp_duty_charged_to_customer ?? prefs?.stamp_duty_charge_mode !== 'issuer',
    fund_enabled: !!fund,
    fund: {
      type: fund?.type ?? EMPTY_FUND.type,
      percent: num(fund?.percent, EMPTY_FUND.percent),
      vat_rate: numOrNull(fund?.vat_rate),
      natura: fund?.natura ?? null,
      withholding_applies: !!fund?.withholding_applies,
    },
    withholding_enabled: !!withholding,
    withholding: {
      type: withholding?.type ?? EMPTY_WITHHOLDING.type,
      reason: withholding?.reason ?? EMPTY_WITHHOLDING.reason,
      rate: num(withholding?.rate, EMPTY_WITHHOLDING.rate),
      taxable_percent: numOrNull(withholding?.taxable_percent ?? EMPTY_WITHHOLDING.taxable_percent),
      includes_fund: !!withholding?.includes_fund,
    },
    enasarco: tplHasFiscal ? !!tpl!.enasarco : !!prefs?.enasarco_enabled,
  };
}

export type FiscalPayload = Omit<TaxPreviewRequest, 'items' | 'contact_id' | 'date'>;

/**
 * Fiscal part of the preview / create payload. Every block is explicit (`null` = disabled) because the drawer
 * already shows the tenant defaults; for a forfettario tenant ritenuta, split payment and reverse charge are
 * omitted (the backend rejects them with `forfettario_incompatible`).
 */
export function buildFiscalPayload(
  v: FiscalFormValue,
  opts: { forfettario: boolean; hasContact: boolean },
): FiscalPayload {
  const payload: FiscalPayload = {
    stamp_duty_charged_to_customer: v.stamp_duty_charged_to_customer,
    fund: v.fund_enabled
      ? {
          type: v.fund.type,
          percent: num(v.fund.percent, 0),
          vat_rate: numOrNull(v.fund.vat_rate),
          natura: v.fund.natura || null,
          withholding_applies: v.fund.withholding_applies,
        }
      : null,
    // The backend requires a contact with ENASARCO; without one the block is left out of the preview.
    enasarco: v.enasarco && opts.hasContact ? { enabled: true } : null,
  };
  if (!opts.forfettario) {
    payload.split_payment = v.split_payment;
    payload.reverse_charge = v.reverse_charge;
    payload.vat_payability = v.split_payment ? 'S' : v.vat_payability;
    payload.withholding = v.withholding_enabled
      ? {
          type: v.withholding.type,
          reason: v.withholding.reason,
          rate: num(v.withholding.rate, 0),
          taxable_percent: numOrNull(v.withholding.taxable_percent),
          includes_fund: v.withholding.includes_fund,
        }
      : null;
  }
  return payload;
}

export function fiscalItem(i: FiscalItemValue): TaxPreviewItem & { description: string } {
  return {
    description: i.description,
    quantity: i.quantity,
    unit_price: i.unit_price,
    tax_rate: i.tax_rate,
    discount_percentage: i.discount_percentage,
    natura: i.natura || null,
    withholding_applies: i.withholding_applies,
    fund_applies: i.fund_applies,
  };
}

/** Lines the backend can price (it rejects quantity <= 0 or rates outside 0-100). */
export function isPreviewable(items: FiscalItemValue[]): boolean {
  return (
    items.length > 0 &&
    items.every(
      (i) =>
        Number(i.quantity) > 0 &&
        Number(i.unit_price) >= 0 &&
        Number(i.tax_rate) >= 0 &&
        Number(i.tax_rate) <= 100,
    )
  );
}
