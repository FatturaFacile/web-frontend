import { HttpErrorResponse } from '@angular/common/http';
import {
  WrActivityType,
  WrCertificatePayload,
  WrEnasarcoMandate,
  WrInlNotification,
  WrInlPayload,
  WrPaymentPayload,
  WrProblem,
  WrRecipient,
  WrRecipientPayload,
  WrRegime,
  WrSimulatePayload,
  WrThreshold,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`): read and maintain the registry, the declarations and the INL notices. */
export const WITHHOLDING_RECIPIENTS_MODULE = 'withholding_recipients';

/** Module key of the `settle` ability: post compensations, F24 and UniEmens flows, annual CU / AVS records. */
export const WITHHOLDING_RECIPIENTS_SETTLE_MODULE = 'withholding_recipients_settle';

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and bind the field errors of a 422. */
export interface WrOutcome {
  ok: boolean;
  /** Translation key of the refusal (`withholdingRecipients.error.<code>`), null on success. */
  errorKey: string | null;
  /** The text the API sent (validation message or problem detail), for the cases the key does not cover. */
  detail: string | null;
  errors: Record<string, string[]>;
}

export const WR_OK: WrOutcome = { ok: true, errorKey: null, detail: null, errors: {} };

export function errorKey(code: string | null | undefined): string {
  return `withholdingRecipients.error.${code ? code : 'generic'}`;
}

function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') {
    return blob.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** The problem details of a failed call; a failed download answers a Blob that holds the JSON. */
export async function problemOf(error: unknown): Promise<WrProblem | null> {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    try {
      return JSON.parse(await readBlobText(body)) as WrProblem;
    } catch {
      return null;
    }
  }
  return body !== null && typeof body === 'object' ? (body as WrProblem) : null;
}

/** The outcome of a failed call: the `code` of the problem picks the key, a 422 brings the field errors. */
export async function failureOf(error: unknown): Promise<WrOutcome> {
  const problem = await problemOf(error);
  const errors = problem?.errors ?? {};
  const first = Object.values(errors).flat()[0];
  return {
    ok: false,
    errorKey: errorKey(problem?.code),
    detail: first ?? problem?.detail ?? null,
    errors,
  };
}

// --- Numbers and dates ---

export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function blankToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/** Whether a decimal string is not zero (to show a line only when it matters). */
export function isNonZero(value: string | null | undefined): boolean {
  const parsed = toNumber(value);
  return parsed !== null && parsed !== 0;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `YYYY-MM-DD` of a local date. */
export function todayParam(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** The years of the year selectors: the current one and the four before it. */
export function selectableYears(now: Date = new Date()): number[] {
  const year = now.getFullYear();
  return [0, 1, 2, 3, 4].map((offset) => year - offset);
}

/** Whether the text is a month written as `YYYY-MM`. */
export function isMonthParam(value: string | null | undefined): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? '');
}

/** `12.5000` shown as `12.5%`: trailing zeros of the decimal string dropped. Display only. */
export function formatRate(value: string | number | null | undefined): string {
  const parsed = toNumber(value);
  return parsed === null ? '' : `${Number(parsed.toFixed(4))}%`;
}

// --- Regimes ---

export function isSwissRegime(regime: WrRegime | null | undefined): boolean {
  return regime === 'swiss_foreign_artist' || regime === 'swiss_de_minimis';
}

export function isAgentRegime(regime: WrRegime | null | undefined): boolean {
  return regime === 'agent_25bis';
}

export function isOccasionalRegime(regime: WrRegime | null | undefined): boolean {
  return regime === 'occasional_worker';
}

/** Occasional workers and amateur sports collaborators declare what they earned elsewhere (INPS and IRPEF thresholds). */
export function declaresThirdPartyIncome(regime: WrRegime | null | undefined): boolean {
  return regime === 'occasional_worker' || regime === 'amateur_sports';
}

export function regimeCurrency(regime: WrRegime | null | undefined): string {
  return isSwissRegime(regime) ? 'CHF' : 'EUR';
}

// --- Thresholds ---

export type ProgressStatus = 'normal' | 'active' | 'exception' | 'success';

/** Colour state of a threshold bar: normal under 80%, warning (active) under 100%, exception once the limit is reached. */
export function progressStatus(percent: number): ProgressStatus {
  if (percent >= 100) {
    return 'exception';
  }
  return percent >= 80 ? 'active' : 'normal';
}

/** A threshold the dashboard shows as one bar; the two amateur sports tiers share a bar. */
export interface ThresholdBar {
  key: string;
  current: string;
  limit: string;
  percent: number;
  /** The second tier of the bar (the IRPEF threshold of amateur sports), when there is one. */
  tier: WrThreshold | null;
}

/** Groups the thresholds of a recipient: `sports_5000` and `sports_15000` are one bar with two tiers. */
export function thresholdBars(thresholds: readonly WrThreshold[]): ThresholdBar[] {
  const second = thresholds.find((entry) => entry.key === 'sports_15000') ?? null;
  const hasFirst = thresholds.some((entry) => entry.key === 'sports_5000');
  const bars: ThresholdBar[] = [];

  for (const entry of thresholds) {
    if (entry.key === 'sports_15000' && hasFirst) {
      continue;
    }
    bars.push({
      key: entry.key,
      current: entry.current,
      limit: entry.limit,
      percent: entry.percent,
      tier: entry.key === 'sports_5000' ? second : null,
    });
  }
  return bars;
}

// --- Alerts, warnings and notes ---

export function alertKey(code: string): string {
  return `withholdingRecipients.alert.${code}`;
}

export function warningKey(code: string): string {
  return `withholdingRecipients.warning.${code}`;
}

export function noteKey(code: string): string {
  return `withholdingRecipients.note.${code}`;
}

export function thresholdKeyOf(key: string): string {
  return `withholdingRecipients.threshold.${key}`;
}

export function alertColor(code: string): string {
  switch (code) {
    case 'agent_certificate_expiring':
      return 'gold';
    case 'occasional_threshold_reached':
    case 'sports_threshold_reached':
      return 'orange';
    default:
      return 'red';
  }
}

export function certStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'green';
    case 'expiring':
      return 'gold';
    case 'expired':
      return 'red';
    default:
      return 'blue';
  }
}

export function inlStatusColor(status: string): string {
  switch (status) {
    case 'sent':
      return 'green';
    case 'cancelled':
      return 'default';
    default:
      return 'gold';
  }
}

// --- INL preventive communication ---

export type InlCoverage = 'not_required' | 'covered' | 'missing' | 'late' | 'expired';

/**
 * Whether a sent INL communication covers the work of an occasional worker on a date: `covered` needs a sent notice that
 * reached the inspectorate before the work started and spans the date; `late` is a notice sent after the start; `expired`
 * one that ended before the date; `missing` none at all. The API enforces the same rule when the payment is posted.
 */
export function inlCoverage(
  regime: WrRegime | null | undefined,
  notifications: readonly WrInlNotification[],
  date: string,
): InlCoverage {
  if (!isOccasionalRegime(regime)) {
    return 'not_required';
  }
  const sent = notifications.filter((notice) => notice.status === 'sent');
  const spanning = sent.filter(
    (notice) => notice.work_start_date <= date && date <= notice.work_end_date,
  );
  if (spanning.some((notice) => notice.sent_before_start)) {
    return 'covered';
  }
  if (spanning.length > 0) {
    return 'late';
  }
  if (sent.some((notice) => notice.work_end_date < date)) {
    return 'expired';
  }
  return 'missing';
}

/** Whether the posting of a compensation is blocked by the INL rule. */
export function isInlBlocking(coverage: InlCoverage): boolean {
  return coverage !== 'not_required' && coverage !== 'covered';
}

/** Translation key of the explanation of an INL coverage that blocks the posting. */
export function inlCoverageKey(coverage: InlCoverage): string {
  switch (coverage) {
    case 'late':
      return errorKey('inl_notification_late');
    case 'expired':
      return errorKey('inl_notification_expired');
    default:
      return errorKey('inl_notification_missing');
  }
}

export function canMarkInlSent(notice: Pick<WrInlNotification, 'status'>): boolean {
  return notice.status === 'draft';
}

export function canCancelInl(notice: Pick<WrInlNotification, 'status'>): boolean {
  return notice.status !== 'cancelled';
}

export function inlFileName(id: string, format: string): string {
  return `inl-${id}.${format}`;
}

export function f24FileName(month: string): string {
  return `f24-${month}.csv`;
}

export function uniEmensFileName(month: string): string {
  return `uniemens-${month}.xml`;
}

export function annualFileName(year: number): string {
  return `cu-${year}.csv`;
}

// --- Recipient form ---

/** The form of a recipient profile, in the raw types of the inputs. */
export interface RecipientFormValue {
  display_name: string;
  regime: WrRegime;
  tax_code: string;
  vat_number: string;
  avs_number: string;
  birth_date: string;
  country_of_residence: string;
  canton: string;
  enasarco_mandate: WrEnasarcoMandate | null;
  firr_enabled: boolean;
  is_cultural_sector: boolean;
  activity_type: WrActivityType | null;
  cu_causal: string | null;
  third_party_ytd_income: number | null;
  third_party_income_year: number | null;
  third_party_declared_on: string;
  is_active: boolean;
  notes: string;
}

export const DEFAULT_RECIPIENT_FORM: RecipientFormValue = {
  display_name: '',
  regime: 'occasional_worker',
  tax_code: '',
  vat_number: '',
  avs_number: '',
  birth_date: '',
  country_of_residence: '',
  canton: '',
  enasarco_mandate: null,
  firr_enabled: false,
  is_cultural_sector: false,
  activity_type: null,
  cu_causal: null,
  third_party_ytd_income: null,
  third_party_income_year: null,
  third_party_declared_on: '',
  is_active: true,
  notes: '',
};

export function recipientFormOf(recipient: WrRecipient): RecipientFormValue {
  return {
    display_name: recipient.display_name,
    regime: recipient.regime,
    tax_code: recipient.tax_code ?? '',
    vat_number: recipient.vat_number ?? '',
    avs_number: recipient.avs_number ?? '',
    birth_date: recipient.birth_date ?? '',
    country_of_residence: recipient.country_of_residence ?? '',
    canton: recipient.canton ?? '',
    enasarco_mandate: recipient.enasarco_mandate,
    firr_enabled: recipient.firr_enabled,
    is_cultural_sector: recipient.is_cultural_sector,
    activity_type: recipient.activity_type,
    cu_causal: recipient.cu_causal,
    third_party_ytd_income: toNumber(recipient.third_party_ytd_income),
    third_party_income_year: recipient.third_party_income_year,
    third_party_declared_on: recipient.third_party_declared_on ?? '',
    is_active: recipient.is_active,
    notes: recipient.notes ?? '',
  };
}

/**
 * The request of the recipient form. Only the fields that belong to the regime are sent: the identifiers of the country, the
 * Enasarco mandate and FIRR of an agent, the cultural sector flag and the activity of the Swiss regimes, the income declared
 * by a worker. The CU causal is sent only when the user picked one (otherwise the API proposes the regime default).
 */
export function recipientPayloadOf(form: RecipientFormValue): WrRecipientPayload {
  const swiss = isSwissRegime(form.regime);
  const agent = isAgentRegime(form.regime);
  const declares = declaresThirdPartyIncome(form.regime);
  const income = declares ? form.third_party_ytd_income : null;

  return {
    display_name: form.display_name.trim(),
    regime: form.regime,
    tax_code: swiss ? null : blankToNull(form.tax_code.toUpperCase()),
    vat_number: blankToNull(form.vat_number),
    avs_number: swiss ? blankToNull(form.avs_number) : null,
    birth_date: blankToNull(form.birth_date),
    country_of_residence: blankToNull(form.country_of_residence.toUpperCase()),
    canton: swiss ? blankToNull(form.canton.toUpperCase()) : null,
    enasarco_mandate: agent ? form.enasarco_mandate : null,
    firr_enabled: agent ? form.firr_enabled : false,
    is_cultural_sector: form.regime === 'swiss_de_minimis' ? form.is_cultural_sector : false,
    activity_type: form.regime === 'swiss_foreign_artist' ? form.activity_type : null,
    cu_causal: swiss ? null : form.cu_causal,
    third_party_ytd_income: income,
    third_party_income_year: income === null ? null : form.third_party_income_year,
    third_party_declared_on: income === null ? null : blankToNull(form.third_party_declared_on),
    is_active: form.is_active,
    notes: blankToNull(form.notes),
  };
}

/** Whether the recipient form can be sent: a name, the year of a declared third party income, a two letter canton. */
export function isRecipientFormValid(form: RecipientFormValue): boolean {
  if (form.display_name.trim() === '') {
    return false;
  }
  if (form.third_party_ytd_income !== null && form.third_party_ytd_income < 0) {
    return false;
  }
  if (
    declaresThirdPartyIncome(form.regime) &&
    form.third_party_ytd_income !== null &&
    form.third_party_income_year === null
  ) {
    return false;
  }
  if (isSwissRegime(form.regime) && form.canton.trim() !== '' && form.canton.trim().length !== 2) {
    return false;
  }
  if (form.regime === 'swiss_foreign_artist' && form.activity_type === null) {
    return false;
  }
  return true;
}

// --- Agent declarations ---

export interface CertificateFormValue {
  fiscal_year: number;
  received_on: string;
  valid_from: string;
  valid_to: string;
  pec_message_id: string;
  pec_archive_reference: string;
  notes: string;
}

export function emptyCertificateForm(now: Date = new Date()): CertificateFormValue {
  const year = now.getFullYear() + 1;
  return {
    fiscal_year: year,
    received_on: todayParam(now),
    valid_from: `${year}-01-01`,
    valid_to: `${year}-12-31`,
    pec_message_id: '',
    pec_archive_reference: '',
    notes: '',
  };
}

export function isCertificateFormValid(form: CertificateFormValue): boolean {
  return (
    form.fiscal_year >= 2000 &&
    form.received_on !== '' &&
    form.valid_from !== '' &&
    form.valid_to !== '' &&
    form.valid_to >= form.valid_from
  );
}

export function certificatePayloadOf(form: CertificateFormValue): WrCertificatePayload {
  return {
    fiscal_year: form.fiscal_year,
    received_on: form.received_on,
    valid_from: form.valid_from,
    valid_to: form.valid_to,
    pec_message_id: blankToNull(form.pec_message_id),
    pec_archive_reference: blankToNull(form.pec_archive_reference),
    notes: blankToNull(form.notes),
  };
}

// --- INL form ---

export interface InlFormValue {
  work_start_date: string;
  work_end_date: string;
  activity_description: string;
  work_place: string;
  estimated_compensation: number | null;
}

export const EMPTY_INL_FORM: InlFormValue = {
  work_start_date: '',
  work_end_date: '',
  activity_description: '',
  work_place: '',
  estimated_compensation: null,
};

export function isInlFormValid(form: InlFormValue): boolean {
  return (
    form.work_start_date !== '' &&
    form.work_end_date !== '' &&
    form.work_end_date >= form.work_start_date &&
    form.activity_description.trim() !== '' &&
    (form.estimated_compensation === null || form.estimated_compensation >= 0)
  );
}

export function inlPayloadOf(form: InlFormValue): WrInlPayload {
  return {
    work_start_date: form.work_start_date,
    work_end_date: form.work_end_date,
    activity_description: form.activity_description.trim(),
    work_place: blankToNull(form.work_place),
    estimated_compensation: form.estimated_compensation,
  };
}

// --- Simulator ---

/** The form of the simulator, in the raw types of the inputs. */
export interface SimulatorFormValue {
  /** A registered recipient; null runs the simulation on the ad-hoc facts below. */
  recipient_profile_id: string | null;
  regime: WrRegime;
  gross_amount: number | null;
  payment_date: string;
  service_date: string;
  performance_days: number | null;
  acquisition_expenses: number | null;
  birth_date: string;
  tax_code: string;
  enasarco_mandate: WrEnasarcoMandate | null;
  firr_enabled: boolean;
  is_cultural_sector: boolean;
  activity_type: WrActivityType | null;
  has_reduced_certificate: boolean;
  prior_company_income: number | null;
  third_party_income: number | null;
  prior_avs_base: number | null;
  canton: string;
}

export function defaultSimulatorForm(now: Date = new Date()): SimulatorFormValue {
  return {
    recipient_profile_id: null,
    regime: 'occasional_worker',
    gross_amount: null,
    payment_date: todayParam(now),
    service_date: '',
    performance_days: null,
    acquisition_expenses: null,
    birth_date: '',
    tax_code: '',
    enasarco_mandate: null,
    firr_enabled: false,
    is_cultural_sector: false,
    activity_type: null,
    has_reduced_certificate: false,
    prior_company_income: null,
    third_party_income: null,
    prior_avs_base: null,
    canton: '',
  };
}

/** The simulation runs once there is an amount, a payment date and (without a recipient) a regime. */
export function isSimulatorFormReady(form: SimulatorFormValue): boolean {
  if (form.gross_amount === null || !(form.gross_amount > 0) || form.payment_date === '') {
    return false;
  }
  if (form.service_date !== '' && form.service_date > form.payment_date) {
    return false;
  }
  return true;
}

/**
 * The request of the simulator. For a registered recipient only the payment facts travel (the API reads the profile);
 * for ad-hoc facts the ones that belong to the regime are added.
 */
export function simulatePayloadOf(form: SimulatorFormValue): WrSimulatePayload {
  const base: WrSimulatePayload = {
    gross_amount: form.gross_amount ?? 0,
    payment_date: form.payment_date,
    service_date: blankToNull(form.service_date),
    performance_days: form.performance_days,
    acquisition_expenses: form.acquisition_expenses,
  };

  if (form.recipient_profile_id) {
    return { ...base, recipient_profile_id: form.recipient_profile_id };
  }

  const swiss = isSwissRegime(form.regime);
  const agent = isAgentRegime(form.regime);

  return {
    ...base,
    regime: form.regime,
    birth_date: blankToNull(form.birth_date),
    tax_code: swiss ? null : blankToNull(form.tax_code.toUpperCase()),
    enasarco_mandate: agent ? form.enasarco_mandate : null,
    firr_enabled: agent ? form.firr_enabled : false,
    has_reduced_certificate: agent ? form.has_reduced_certificate : false,
    is_cultural_sector: form.regime === 'swiss_de_minimis' ? form.is_cultural_sector : false,
    activity_type: form.regime === 'swiss_foreign_artist' ? form.activity_type : null,
    prior_company_income: declaresThirdPartyIncome(form.regime) ? form.prior_company_income : null,
    third_party_income: declaresThirdPartyIncome(form.regime) ? form.third_party_income : null,
    prior_avs_base: form.regime === 'swiss_de_minimis' ? form.prior_avs_base : null,
    canton: swiss ? blankToNull(form.canton.toUpperCase()) : null,
  };
}

// --- Settlements ---

/** A payment to post, in the raw types of the inputs. */
export interface PaymentFormValue {
  recipient_profile_id: string | null;
  gross_amount: number | null;
  payment_date: string;
  service_date: string;
  document_number: string;
  payment_reference: string;
  performance_days: number | null;
  acquisition_expenses: number | null;
  notes: string;
}

export function emptyPaymentForm(now: Date = new Date()): PaymentFormValue {
  return {
    recipient_profile_id: null,
    gross_amount: null,
    payment_date: todayParam(now),
    service_date: '',
    document_number: '',
    payment_reference: '',
    performance_days: null,
    acquisition_expenses: null,
    notes: '',
  };
}

export function isPaymentFormValid(form: PaymentFormValue): boolean {
  return (
    form.recipient_profile_id !== null &&
    form.gross_amount !== null &&
    form.gross_amount > 0 &&
    form.payment_date !== '' &&
    (form.service_date === '' || form.service_date <= form.payment_date)
  );
}

/** The request of a posting; the form must be valid. */
export function paymentPayloadOf(form: PaymentFormValue): WrPaymentPayload {
  return {
    recipient_profile_id: form.recipient_profile_id ?? '',
    gross_amount: form.gross_amount ?? 0,
    payment_date: form.payment_date,
    service_date: blankToNull(form.service_date),
    document_number: blankToNull(form.document_number),
    payment_reference: blankToNull(form.payment_reference),
    performance_days: form.performance_days,
    acquisition_expenses: form.acquisition_expenses,
    notes: blankToNull(form.notes),
  };
}

/** The largest batch the API accepts in one call. */
export const MAX_BATCH_ROWS = 200;

export function isBatchValid(rows: readonly PaymentFormValue[]): boolean {
  return rows.length > 0 && rows.length <= MAX_BATCH_ROWS && rows.every(isPaymentFormValid);
}

/** The tax code of an F24 line with its reference period (`1040 05/2026`); codes are 1040, 1038 or C10. */
export function f24CodeLabel(
  taxCode: string,
  month: string | number | null,
  year: string | number | null,
): string {
  const parsed = toNumber(month);
  return parsed && year ? `${taxCode} ${pad(parsed)}/${year}` : taxCode;
}

/** Groups the lines of an F24 preview by section (erario, inps), keeping the order of first appearance. */
export function groupF24Lines<T extends { section: string }>(
  lines: readonly T[],
): { section: string; lines: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const line of lines) {
    groups.set(line.section, [...(groups.get(line.section) ?? []), line]);
  }
  return [...groups.entries()].map(([section, grouped]) => ({ section, lines: grouped }));
}
