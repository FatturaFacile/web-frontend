import { HttpErrorResponse } from '@angular/common/http';
import {
  AgcAccrualBasis,
  AgcAgentPayload,
  AgcAgentProfile,
  AgcAgentType,
  AgcEntryStatus,
  AgcFiscalBracket,
  AgcFiscalOverridePayload,
  AgcFiscalParameter,
  AgcFiscalRegime,
  AgcLedgerEntry,
  AgcPeriodType,
  AgcProblem,
  AgcRule,
  AgcRulePayload,
  AgcRuleTier,
  AgcRuleTierPayload,
  AgcStatement,
  AgcStatementPreview,
  AgcStatementStatus,
  AgcZone,
  AgcZonePayload,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`): read and maintain conditions, rules, zones and the ledger. */
export const AGENT_COMMISSIONS_MODULE = 'agent_commissions';

/** Module key of the `settle` ability: approve, invoice, pay and send statements, fiscal parameters, exports. */
export const AGENT_COMMISSIONS_SETTLE_MODULE = 'agent_commissions_settle';

/** Entry statuses of a commission that is not (fully) payable yet. */
export const LOCKED_ENTRY_STATUSES: readonly AgcEntryStatus[] = [
  'pending_collection',
  'awaiting_reconciliation',
  'partially_eligible',
];

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and bind the field errors of a 422. */
export interface AgcOutcome {
  ok: boolean;
  /** Translation key of the refusal (`agentCommissions.error.<code>`), null on success. */
  errorKey: string | null;
  /** The text the API sent (validation message or problem detail), for the cases the key does not cover. */
  detail: string | null;
  errors: Record<string, string[]>;
}

export const AGC_OK: AgcOutcome = { ok: true, errorKey: null, detail: null, errors: {} };

export function errorKey(code: string | null | undefined): string {
  return `agentCommissions.error.${code ? code : 'generic'}`;
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
export async function problemOf(error: unknown): Promise<AgcProblem | null> {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    try {
      return JSON.parse(await readBlobText(body)) as AgcProblem;
    } catch {
      return null;
    }
  }
  return body !== null && typeof body === 'object' ? (body as AgcProblem) : null;
}

/** The outcome of a failed call: the `code` of the problem picks the key, a 422 brings the field errors. */
export async function failureOf(error: unknown): Promise<AgcOutcome> {
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

// --- Labels and colours ---

export function entryStatusColor(status: AgcEntryStatus): string {
  switch (status) {
    case 'eligible':
      return 'green';
    case 'settled':
      return 'blue';
    case 'partially_eligible':
      return 'gold';
    case 'awaiting_reconciliation':
      return 'orange';
    case 'pending_collection':
      return 'volcano';
    default:
      return 'default';
  }
}

export function statementStatusColor(status: AgcStatementStatus): string {
  switch (status) {
    case 'approved':
      return 'cyan';
    case 'invoiced':
      return 'blue';
    case 'paid':
      return 'green';
    case 'void':
      return 'default';
    default:
      return 'gold';
  }
}

/** A cash-basis commission that waits for a collection reconciled with the bank. */
export function isLockedEntry(entry: Pick<AgcLedgerEntry, 'accrual_basis' | 'status'>): boolean {
  return entry.accrual_basis === 'collected' && LOCKED_ENTRY_STATUSES.includes(entry.status);
}

/** Translation key of the lock tag shown next to the status of a cash-basis entry that is not payable yet. */
export const LOCK_HINT_KEY = 'agentCommissions.ledger.lockHint';

// --- Statement workflow ---

export function canApproveStatement(statement: Pick<AgcStatement, 'status'>): boolean {
  return statement.status === 'draft';
}

export function canVoidStatement(statement: Pick<AgcStatement, 'status'>): boolean {
  return statement.status === 'draft' || statement.status === 'approved';
}

/** The invoice is prepared for an approved statement of an agent that is not settled on salary. */
export function canPrepareSelfBilling(
  statement: Pick<AgcStatement, 'status' | 'settlement_channel'>,
): boolean {
  return statement.status === 'approved' && statement.settlement_channel !== 'salary';
}

export function canPayStatement(statement: Pick<AgcStatement, 'status'>): boolean {
  return statement.status === 'approved' || statement.status === 'invoiced';
}

export function canSendStatement(statement: Pick<AgcStatement, 'status'>): boolean {
  return statement.status !== 'void';
}

// --- Agents ---

/** Enasarco and the AEC are the Italian regimes: they carry a mandate and the social security contributions. */
export function isItalianRegime(regime: AgcFiscalRegime | null | undefined): boolean {
  return regime === 'enasarco' || regime === 'aec';
}

export function isSubAgentType(type: AgcAgentType | null | undefined): boolean {
  return type === 'sub_agent';
}

/** An agent can be the parent of a sub-agent only when it is not a sub-agent itself. */
export function parentCandidates(
  agents: readonly AgcAgentProfile[],
  editingId: string | null,
): AgcAgentProfile[] {
  return agents.filter(
    (agent) => agent.id !== editingId && agent.parent_agent_profile_id === null && agent.is_active,
  );
}

export function agentName(
  agent: Pick<AgcAgentProfile, 'representative'> | null | undefined,
): string {
  return agent?.representative?.name ?? '';
}

/** The form of an agent profile, in the raw types of the inputs. */
export interface AgentFormValue {
  sales_representative_id: string | null;
  agent_type: AgcAgentType;
  fiscal_regime: AgcFiscalRegime;
  enasarco_mandate: 'single' | 'multi' | null;
  parent_agent_profile_id: string | null;
  parent_split_mode: 'additional_rate' | 'share_of_commission' | null;
  parent_split_value: number | null;
  accrual_basis: AgcAccrualBasis;
  default_rate: number | null;
  settlement_channel: 'invoice' | 'salary';
  has_own_organization: boolean;
  vat_applies: boolean;
  firr_enabled: boolean;
  enasarco_registration_number: string;
  tax_code: string;
  vat_number: string;
  contract_start: string;
  contract_end: string;
  notes: string;
  is_active: boolean;
}

export const DEFAULT_AGENT_FORM: AgentFormValue = {
  sales_representative_id: null,
  agent_type: 'direct',
  fiscal_regime: 'enasarco',
  enasarco_mandate: 'single',
  parent_agent_profile_id: null,
  parent_split_mode: null,
  parent_split_value: null,
  accrual_basis: 'invoiced',
  default_rate: null,
  settlement_channel: 'invoice',
  has_own_organization: false,
  vat_applies: true,
  firr_enabled: true,
  enasarco_registration_number: '',
  tax_code: '',
  vat_number: '',
  contract_start: '',
  contract_end: '',
  notes: '',
  is_active: true,
};

export function agentFormOf(agent: AgcAgentProfile): AgentFormValue {
  return {
    sales_representative_id: agent.sales_representative_id,
    agent_type: agent.agent_type,
    fiscal_regime: agent.fiscal_regime,
    enasarco_mandate: agent.enasarco_mandate,
    parent_agent_profile_id: agent.parent_agent_profile_id,
    parent_split_mode: agent.parent_split_mode,
    parent_split_value: toNumber(agent.parent_split_value),
    accrual_basis: agent.accrual_basis,
    default_rate: toNumber(agent.default_rate),
    settlement_channel: agent.settlement_channel,
    has_own_organization: agent.has_own_organization,
    vat_applies: agent.vat_applies,
    firr_enabled: agent.firr_enabled,
    enasarco_registration_number: agent.enasarco_registration_number ?? '',
    tax_code: agent.tax_code ?? '',
    vat_number: agent.vat_number ?? '',
    contract_start: agent.contract_start ?? '',
    contract_end: agent.contract_end ?? '',
    notes: agent.notes ?? '',
    is_active: agent.is_active,
  };
}

/**
 * The request of the agent form. The parent and its split are sent only for a sub-agent, the mandate only for an Italian
 * regime, and the representative only on creation (the update refuses it).
 */
export function agentPayloadOf(form: AgentFormValue, creating: boolean): AgcAgentPayload {
  const subAgent = isSubAgentType(form.agent_type);
  const hasParent = subAgent && form.parent_agent_profile_id !== null;

  return {
    ...(creating && form.sales_representative_id
      ? { sales_representative_id: form.sales_representative_id }
      : {}),
    agent_type: form.agent_type,
    fiscal_regime: form.fiscal_regime,
    enasarco_mandate: isItalianRegime(form.fiscal_regime) ? form.enasarco_mandate : null,
    parent_agent_profile_id: hasParent ? form.parent_agent_profile_id : null,
    parent_split_mode: hasParent ? form.parent_split_mode : null,
    parent_split_value: hasParent ? form.parent_split_value : null,
    accrual_basis: form.accrual_basis,
    default_rate: form.default_rate,
    settlement_channel: form.settlement_channel,
    has_own_organization: form.has_own_organization,
    vat_applies: form.vat_applies,
    firr_enabled: isItalianRegime(form.fiscal_regime) ? form.firr_enabled : false,
    enasarco_registration_number: blankToNull(form.enasarco_registration_number),
    tax_code: blankToNull(form.tax_code),
    vat_number: blankToNull(form.vat_number),
    contract_start: blankToNull(form.contract_start),
    contract_end: blankToNull(form.contract_end),
    notes: blankToNull(form.notes),
    is_active: form.is_active,
  };
}

/** Whether the form can be sent: a representative on creation, and the split of a sub-agent with its parent. */
export function isAgentFormValid(form: AgentFormValue, creating: boolean): boolean {
  if (creating && !form.sales_representative_id) {
    return false;
  }
  if (form.contract_start && form.contract_end && form.contract_end < form.contract_start) {
    return false;
  }
  if (isSubAgentType(form.agent_type) && form.parent_agent_profile_id) {
    return form.parent_split_mode !== null && inRange(form.parent_split_value, 0, 100);
  }
  return form.default_rate === null || inRange(form.default_rate, 0, 100);
}

// --- Rules ---

/** A row of the tier editor, in the raw types of the inputs. */
export interface TierRow {
  from: number | null;
  to: number | null;
  rate: number | null;
}

export function emptyTierRow(previous?: TierRow): TierRow {
  return { from: previous?.to ?? 0, to: null, rate: null };
}

export function tierRowsOf(tiers: readonly AgcRuleTier[] | undefined): TierRow[] {
  return (tiers ?? []).map((tier) => ({
    from: toNumber(tier.threshold_from),
    to: toNumber(tier.threshold_to),
    rate: toNumber(tier.rate),
  }));
}

/**
 * Progressive tiers must start at zero, follow each other without gap or overlap, and only the last one may be open
 * ended; each tier needs a rate between 0 and 100. This mirrors what the API enforces (`invalid_tiers`).
 */
export function tiersAreValid(rows: readonly TierRow[]): boolean {
  if (rows.length === 0) {
    return true;
  }
  const sorted = [...rows].sort((a, b) => (a.from ?? 0) - (b.from ?? 0));
  let expectedFrom = 0;
  for (let index = 0; index < sorted.length; index++) {
    const row = sorted[index];
    if (row.from === null || row.rate === null || !inRange(row.rate, 0, 100)) {
      return false;
    }
    if (row.from !== expectedFrom) {
      return false;
    }
    if (row.to === null) {
      if (index !== sorted.length - 1) {
        return false;
      }
    } else {
      if (row.to <= row.from) {
        return false;
      }
      expectedFrom = row.to;
    }
  }
  return true;
}

export function tierPayloadOf(rows: readonly TierRow[]): AgcRuleTierPayload[] {
  return rows.map((row) => ({
    threshold_from: row.from ?? 0,
    threshold_to: row.to,
    rate: row.rate ?? 0,
  }));
}

/** The form of a commission rule, in the raw types of the inputs. */
export interface RuleFormValue {
  name: string;
  agent_profile_id: string | null;
  product_category_id: string | null;
  customer_id: string | null;
  zone_id: string | null;
  rate_type: 'percentage' | 'fixed';
  rate: number | null;
  fixed_amount: number | null;
  accrual_basis: AgcAccrualBasis | null;
  priority: number;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
}

export const DEFAULT_RULE_FORM: RuleFormValue = {
  name: '',
  agent_profile_id: null,
  product_category_id: null,
  customer_id: null,
  zone_id: null,
  rate_type: 'percentage',
  rate: null,
  fixed_amount: null,
  accrual_basis: null,
  priority: 100,
  valid_from: '',
  valid_to: '',
  is_active: true,
};

export function ruleFormOf(rule: AgcRule): RuleFormValue {
  return {
    name: rule.name,
    agent_profile_id: rule.agent_profile_id,
    product_category_id: rule.product_category_id,
    customer_id: rule.customer_id,
    zone_id: rule.zone_id,
    rate_type: rule.rate_type,
    rate: toNumber(rule.rate),
    fixed_amount: toNumber(rule.fixed_amount),
    accrual_basis: rule.accrual_basis,
    priority: rule.priority,
    valid_from: rule.valid_from ?? '',
    valid_to: rule.valid_to ?? '',
    is_active: rule.is_active,
  };
}

/**
 * Whether the rule can be sent: a name; a fixed amount for a fixed rule; a rate or valid tiers for a percentage rule;
 * a validity that does not end before it starts.
 */
export function isRuleFormValid(form: RuleFormValue, tiers: readonly TierRow[]): boolean {
  if (form.name.trim() === '' || form.priority < 1) {
    return false;
  }
  if (form.valid_from && form.valid_to && form.valid_to < form.valid_from) {
    return false;
  }
  if (form.rate_type === 'fixed') {
    return form.fixed_amount !== null && form.fixed_amount >= 0;
  }
  if (tiers.length > 0) {
    return tiersAreValid(tiers);
  }
  return form.rate !== null && inRange(form.rate, 0, 100);
}

/**
 * The request of the rule form. A fixed rule carries its amount (no tiers); a percentage rule carries the tiers when
 * there are some, or its rate.
 */
export function rulePayloadOf(form: RuleFormValue, tiers: readonly TierRow[]): AgcRulePayload {
  const fixed = form.rate_type === 'fixed';
  const progressive = !fixed && tiers.length > 0;

  return {
    name: form.name.trim(),
    agent_profile_id: form.agent_profile_id,
    product_category_id: form.product_category_id,
    customer_id: form.customer_id,
    zone_id: form.zone_id,
    rate_type: form.rate_type,
    rate: fixed ? 0 : (form.rate ?? 0),
    fixed_amount: fixed ? form.fixed_amount : null,
    accrual_basis: form.accrual_basis,
    priority: form.priority,
    valid_from: blankToNull(form.valid_from),
    valid_to: blankToNull(form.valid_to),
    is_active: form.is_active,
    tiers: progressive ? tierPayloadOf(tiers) : [],
  };
}

/** The label of a rule dimension that is left open ("any"), or the name it points to. */
export function dimensionName(
  id: string | null,
  names: ReadonlyMap<string, string>,
): string | null {
  return id === null ? null : (names.get(id) ?? id.slice(0, 8));
}

// --- Fiscal parameters ---

export function bracketRowsOf(payload: readonly AgcFiscalBracket[] | null | undefined): TierRow[] {
  return (payload ?? []).map((bracket) => ({
    from: null,
    to: toNumber(bracket.up_to),
    rate: toNumber(bracket.rate),
  }));
}

/**
 * FIRR brackets are progressive: the share of the yearly commission up to each ceiling accrues at its rate. Ceilings
 * must increase, only the last bracket may be open ended, and every rate is between 0 and 100.
 */
export function bracketsAreValid(rows: readonly TierRow[]): boolean {
  if (rows.length === 0) {
    return false;
  }
  let previous = 0;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (row.rate === null || !inRange(row.rate, 0, 100)) {
      return false;
    }
    if (row.to === null) {
      if (index !== rows.length - 1) {
        return false;
      }
    } else {
      if (row.to <= previous) {
        return false;
      }
      previous = row.to;
    }
  }
  return true;
}

export function bracketPayloadOf(rows: readonly TierRow[]): AgcFiscalBracket[] {
  return rows.map((row) => ({ up_to: row.to, rate: row.rate ?? 0 }));
}

/** Parameters whose value is a bracket list rather than a number. */
export function isBracketParameter(code: string): boolean {
  return code === 'firr_brackets';
}

/** Parameters that are percentages (a rate, or the share of the commission the withholding applies to). */
export function isPercentParameter(code: string): boolean {
  return code.endsWith('_rate') || code.startsWith('withholding_base');
}

/** Whether a number is acceptable for the parameter: not negative, and at most 100 for a percentage. */
export function isParameterValueValid(code: string, value: number | null): boolean {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return false;
  }
  return isPercentParameter(code) ? value <= 100 : true;
}

/**
 * The override of a parameter, for the same code, mandate and year as the row that is edited: a number, or the
 * brackets of the FIRR.
 */
export function fiscalOverrideOf(
  parameter: Pick<AgcFiscalParameter, 'code' | 'mandate_type' | 'year'>,
  value: number | null,
  rows: readonly TierRow[],
): AgcFiscalOverridePayload {
  const base = {
    code: parameter.code,
    mandate_type: parameter.mandate_type,
    year: parameter.year,
  };
  return isBracketParameter(parameter.code)
    ? { ...base, value: null, payload: bracketPayloadOf(rows) }
    : { ...base, value, payload: null };
}

export function isFiscalFormValid(
  parameter: Pick<AgcFiscalParameter, 'code'>,
  value: number | null,
  rows: readonly TierRow[],
): boolean {
  return isBracketParameter(parameter.code)
    ? bracketsAreValid(rows)
    : isParameterValueValid(parameter.code, value);
}

// --- Zones ---

/** The form of a zone, in the raw types of the inputs: the regions are one comma separated text. */
export interface ZoneFormValue {
  code: string;
  name: string;
  country: string;
  regions: string;
  is_active: boolean;
}

export const DEFAULT_ZONE_FORM: ZoneFormValue = {
  code: '',
  name: '',
  country: '',
  regions: '',
  is_active: true,
};

export function zoneFormOf(zone: AgcZone): ZoneFormValue {
  return {
    code: zone.code,
    name: zone.name,
    country: zone.country ?? '',
    regions: zone.regions.join(', '),
    is_active: zone.is_active,
  };
}

/** `MI, to ,TI` becomes `['MI', 'TO', 'TI']`: codes are trimmed, upper-cased and listed once. */
export function parseRegions(text: string): string[] {
  const codes = text
    .split(/[,;\s]+/)
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code !== '');
  return [...new Set(codes)];
}

export function isZoneFormValid(form: ZoneFormValue): boolean {
  const country = form.country.trim();
  return (
    form.code.trim() !== '' && form.name.trim() !== '' && (country === '' || country.length === 2)
  );
}

export function zonePayloadOf(form: ZoneFormValue): AgcZonePayload {
  const country = form.country.trim().toUpperCase();
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    country: country === '' ? null : country,
    regions: parseRegions(form.regions),
    is_active: form.is_active,
  };
}

/** Translation key of the name of a fiscal parameter code. */
export function fiscalCodeKey(code: string): string {
  return `agentCommissions.fiscal.${code}`;
}

// --- Statement summary (shared by the preview and the detail) ---

/** The figures of a statement, the same for a saved statement and for the preview of one. */
export interface StatementSummaryView {
  currency: string;
  lines_count: number | null;
  base_total: string;
  own_commission_total: string;
  override_commission_total: string;
  clawback_total: string;
  gross_commission: string;
  vat_amount: string;
  enasarco_base: string;
  enasarco_agent: string;
  enasarco_company: string;
  firr: string;
  withholding_base: string;
  withholding: string;
  net_payable: string;
  blocked_amount: string;
  massimale_reached: boolean;
}

export function summaryOfStatement(statement: AgcStatement): StatementSummaryView {
  return {
    currency: statement.currency,
    lines_count: statement.lines?.length ?? null,
    base_total: statement.base_total,
    own_commission_total: statement.own_commission_total,
    override_commission_total: statement.override_commission_total,
    clawback_total: statement.clawback_total,
    gross_commission: statement.gross_commission,
    vat_amount: statement.vat_amount,
    enasarco_base: statement.enasarco_base,
    enasarco_agent: statement.enasarco_agent,
    enasarco_company: statement.enasarco_company,
    firr: statement.firr_accrual,
    withholding_base: statement.withholding_base,
    withholding: statement.withholding_amount,
    net_payable: statement.net_payable,
    blocked_amount: statement.blocked_amount,
    massimale_reached: statement.massimale_reached,
  };
}

export function summaryOfPreview(preview: AgcStatementPreview): StatementSummaryView {
  return {
    currency: preview.currency,
    lines_count: preview.lines_count,
    base_total: preview.base_total,
    own_commission_total: preview.own_commission_total,
    override_commission_total: preview.override_commission_total,
    clawback_total: preview.clawback_total,
    gross_commission: preview.gross_commission,
    vat_amount: preview.fiscal.vat,
    enasarco_base: preview.fiscal.enasarco_base,
    enasarco_agent: preview.fiscal.enasarco_agent,
    enasarco_company: preview.fiscal.enasarco_company,
    firr: preview.fiscal.firr,
    withholding_base: preview.fiscal.withholding_base,
    withholding: preview.fiscal.withholding,
    net_payable: preview.net_payable,
    blocked_amount: preview.blocked_amount,
    massimale_reached: preview.fiscal.massimale_reached,
  };
}

// --- Statement periods ---

export interface PeriodBounds {
  start: string;
  end: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** First and last day of a month given as `YYYY-MM`, or null when the text is not a month. */
export function monthBounds(month: string): PeriodBounds | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const number = Number(match[2]);
  if (number < 1 || number > 12) {
    return null;
  }
  return {
    start: `${year}-${pad(number)}-01`,
    end: `${year}-${pad(number)}-${pad(lastDayOf(year, number))}`,
  };
}

export function quarterBounds(year: number, quarter: number): PeriodBounds | null {
  if (!Number.isInteger(year) || !Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    return null;
  }
  const firstMonth = (quarter - 1) * 3 + 1;
  const lastMonth = firstMonth + 2;
  return {
    start: `${year}-${pad(firstMonth)}-01`,
    end: `${year}-${pad(lastMonth)}-${pad(lastDayOf(year, lastMonth))}`,
  };
}

export interface PeriodInput {
  type: AgcPeriodType;
  month: string;
  year: number;
  quarter: number;
  from: string;
  to: string;
}

/**
 * The period a statement covers, from what the dialog holds: a calendar month, a quarter, or free dates. Null while the
 * input is incomplete or the end is before the start. A statement never spans two calendar years.
 */
export function periodOf(input: PeriodInput): PeriodBounds | null {
  let bounds: PeriodBounds | null;
  if (input.type === 'monthly') {
    bounds = monthBounds(input.month);
  } else if (input.type === 'quarterly') {
    bounds = quarterBounds(input.year, input.quarter);
  } else {
    bounds = input.from && input.to ? { start: input.from, end: input.to } : null;
  }
  if (bounds === null || bounds.end < bounds.start) {
    return null;
  }
  return bounds.start.slice(0, 4) === bounds.end.slice(0, 4) ? bounds : null;
}

/** `YYYY-MM-DD` of a local date. */
export function todayParam(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentQuarter(now: Date = new Date()): number {
  return Math.floor(now.getMonth() / 3) + 1;
}

export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

// --- Numbers ---

export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function inRange(value: number | null, min: number, max: number): boolean {
  return value !== null && Number.isFinite(value) && value >= min && value <= max;
}

export function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** `12.5000` shown as `12.5%`: trailing zeros of the decimal string dropped. Display only. */
export function formatRate(value: string | number | null | undefined): string {
  const parsed = toNumber(value);
  return parsed === null ? '' : `${Number(parsed.toFixed(4))}%`;
}

/** Share (0 to 100) of a base against a ceiling for a progress bar. Display only. */
export function progressPercent(base: string | null, ceiling: string | null): number {
  const value = toNumber(base);
  const top = toNumber(ceiling);
  if (value === null || top === null || top <= 0 || value <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((value / top) * 100));
}

/** Whether a decimal string is not zero (to show a line only when it matters). */
export function isNonZero(value: string | null | undefined): boolean {
  const parsed = toNumber(value);
  return parsed !== null && parsed !== 0;
}

/** The years of the year selectors: the current one and the four before it. */
export function selectableYears(now: Date = new Date()): number[] {
  const year = now.getFullYear();
  return [0, 1, 2, 3, 4].map((offset) => year - offset);
}

/** Name of a file the browser saves for a PDF statement. */
export function statementFileName(number: string): string {
  return `statement-${number}.pdf`;
}

export function cuFileName(year: number): string {
  return `cu-agents-${year}.csv`;
}

export function enasarcoFileName(year: number, quarter?: number | null): string {
  return `enasarco-${year}${quarter ? `-q${quarter}` : ''}.csv`;
}
