import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import {
  SfArtifact,
  SfMeeting,
  SfPdfaKind,
  SfPdfaPayload,
  SfDecimal,
  SfDossier,
  SfDossierPayload,
  SfDossierSummary,
  SfIncomeStatementMethod,
  SfIndicatorStatus,
  SfIssue,
  SfIssueCategory,
  SfJurisdiction,
  SfLine,
  SfNarrativeSection,
  SfNotes,
  SfNotesTableName,
  SfProblem,
  SfRoundingMode,
  SfStandard,
  SfStandardLookup,
  SfStatus,
  SfTransitionTarget,
  SfValidationStatus,
  SfWhatIf,
  SF_ISSUE_CATEGORIES,
  SF_NOTES_TABLES,
  SF_STATUSES,
  SF_WHAT_IF_PARAMETERS,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`): finance roles write, auditors read. */
export const STATUTORY_FINANCIALS_MODULE = 'statutory_financials';

// --- Outcomes and errors ---

/** What a store write answers: the screens show the translated error and bind the field errors of a 422. */
export interface SfOutcome {
  ok: boolean;
  /** Translation key of the refusal (`statutoryFinancials.error.<code>`), null on success. */
  errorKey: string | null;
  /** The text the API sent (validation message or problem detail), for the cases the key does not cover. */
  detail: string | null;
  params: Record<string, string | number>;
  errors: Record<string, string[]>;
}

export const SF_OK: SfOutcome = { ok: true, errorKey: null, detail: null, params: {}, errors: {} };

export function errorKey(code: string | null | undefined): string {
  return `statutoryFinancials.error.${code ? code : 'generic'}`;
}

/** The problem details of a failed call. */
export function problemOf(error: unknown): SfProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as SfProblem) : null;
}

/** The outcome of a failed call: the `code` of the problem picks the key, a 422 brings the field errors. */
export function failureOf(error: unknown): SfOutcome {
  const problem = problemOf(error);
  const errors = problem?.errors ?? {};
  const first = Object.values(errors).flat()[0];
  return {
    ok: false,
    errorKey: errorKey(problem?.code),
    detail: first ?? problem?.detail ?? null,
    params: problem?.params ?? {},
    errors,
  };
}

// --- Standards and jurisdictions ---

export function jurisdictionOf(standard: SfStandard | null | undefined): SfJurisdiction {
  return standard !== null && standard !== undefined && standard.startsWith('CH_') ? 'CH' : 'IT';
}

export function isSwiss(standard: SfStandard | null | undefined): boolean {
  return jurisdictionOf(standard) === 'CH';
}

/** The income statement methods a standard allows, from the seeded lookup (both while the lookup is missing). */
export function allowedIncomeMethods(
  standard: SfStandardLookup | undefined,
): SfIncomeStatementMethod[] {
  return standard?.income_statement_methods?.length
    ? standard.income_statement_methods
    : ['total_cost', 'cost_of_sales'];
}

// --- Amounts (decimal strings, never floats) ---

const DECIMAL = /^-?\d+(\.\d+)?$/;

export function isDecimal(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && DECIMAL.test(value.trim());
}

interface Parts {
  negative: boolean;
  integer: bigint;
  fraction: string;
}

function partsOf(value: string): Parts | null {
  const text = value.trim();
  if (!DECIMAL.test(text)) {
    return null;
  }
  const negative = text.startsWith('-');
  const [integer = '0', fraction = ''] = (negative ? text.slice(1) : text).split('.');
  return { negative, integer: BigInt(integer), fraction };
}

/** Rounds a decimal string half away from zero to `scale` fraction digits, without floats. */
export function roundDecimal(
  value: string,
  scale: number,
): { negative: boolean; digits: string } | null {
  const parts = partsOf(value);
  if (parts === null) {
    return null;
  }
  const padded = parts.fraction.padEnd(scale + 1, '0');
  const kept = padded.slice(0, scale);
  const roundUp = Number(padded.charAt(scale)) >= 5;
  let scaled = BigInt(`${parts.integer}${kept}`);
  if (roundUp) {
    scaled += 1n;
  }
  const digits = scaled.toString().padStart(scale + 1, '0');
  return { negative: parts.negative && scaled !== 0n, digits };
}

const SEPARATORS: Record<SfJurisdiction, { thousands: string; decimal: string }> = {
  IT: { thousands: '.', decimal: ',' },
  CH: { thousands: "'", decimal: '.' },
};

/**
 * Formats a decimal string for a jurisdiction: IT `1.234,56`, CH `1'234.56`. `scale` is the number of fraction digits
 * (0 for a dossier rounded to whole euros or francs, 2 for exact cents). An empty or malformed value gives an empty text.
 */
export function formatAmount(
  value: SfDecimal | number | null | undefined,
  jurisdiction: SfJurisdiction,
  scale = 2,
): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const rounded = roundDecimal(String(value), scale);
  if (rounded === null) {
    return '';
  }
  const { thousands, decimal } = SEPARATORS[jurisdiction];
  const integer = scale > 0 ? rounded.digits.slice(0, -scale) : rounded.digits;
  const fraction = scale > 0 ? rounded.digits.slice(-scale) : '';
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  return `${rounded.negative ? '-' : ''}${grouped}${scale > 0 ? decimal + fraction : ''}`;
}

/** The sign of a decimal string: -1, 0 or 1. */
export function signOf(value: SfDecimal | null | undefined): -1 | 0 | 1 {
  const parts = value === null || value === undefined ? null : partsOf(value);
  if (parts === null || (parts.integer === 0n && /^0*$/.test(parts.fraction))) {
    return 0;
  }
  return parts.negative ? -1 : 1;
}

export function isZero(value: SfDecimal | null | undefined): boolean {
  return signOf(value) === 0;
}

export function scaleOfMode(mode: SfRoundingMode | null | undefined): 0 | 2 {
  return mode === 'IntegerUnits_Euro_Chf' ? 0 : 2;
}

export function percentText(value: SfDecimal | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const rounded = roundDecimal(String(value), 2);
  if (rounded === null) {
    return '';
  }
  const integer = rounded.digits.slice(0, -2);
  const fraction = rounded.digits.slice(-2);
  return `${rounded.negative ? '-' : ''}${integer}.${fraction}%`;
}

/** Text of an indicator value by its unit (a ratio keeps two decimals, an amount follows the jurisdiction). */
export function indicatorValueText(
  value: SfDecimal | null,
  unit: 'percent' | 'ratio' | 'amount',
  jurisdiction: SfJurisdiction,
): string {
  if (value === null) {
    return '';
  }
  if (unit === 'percent') {
    return percentText(value);
  }
  const text = formatAmount(value, jurisdiction, 2);
  return text;
}

/** A number for an input control from a decimal string (null when empty or malformed). */
export function toInputNumber(value: SfDecimal | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// --- Status, colours and lifecycle ---

const STATUS_COLORS: Record<SfStatus, string> = {
  draft: 'default',
  reclassified: 'processing',
  notes_populated: 'cyan',
  validated: 'green',
  locked: 'gold',
  filed: 'purple',
};

export function statusColor(status: SfStatus): string {
  return STATUS_COLORS[status] ?? 'default';
}

const VALIDATION_COLORS: Record<SfValidationStatus, string> = {
  not_run: 'default',
  valid: 'green',
  warnings: 'orange',
  invalid: 'red',
};

export function validationColor(status: SfValidationStatus | null | undefined): string {
  return status ? (VALIDATION_COLORS[status] ?? 'default') : 'default';
}

export function validationKey(status: SfValidationStatus | null | undefined): string {
  return status ?? 'not_run';
}

const INDICATOR_COLORS: Record<SfIndicatorStatus, string> = {
  ok: 'green',
  warning: 'orange',
  critical: 'red',
  'n/a': 'default',
};

export function indicatorColor(status: SfIndicatorStatus): string {
  return INDICATOR_COLORS[status] ?? 'default';
}

export function alertColor(level: 'ok' | 'warning' | 'critical'): 'success' | 'warning' | 'error' {
  return level === 'critical' ? 'error' : level === 'warning' ? 'warning' : 'success';
}

export function standardColor(standard: SfStandard): string {
  return isSwiss(standard) ? 'red' : 'blue';
}

/** Index of a status in the lifecycle (for the steps of the header). */
export function statusStepIndex(status: SfStatus): number {
  return Math.max(0, SF_STATUSES.indexOf(status));
}

/** A locked or filed dossier is read-only. */
export function isLocked(status: SfStatus | null | undefined): boolean {
  return status === 'locked' || status === 'filed';
}

export function isEditable(status: SfStatus | null | undefined): boolean {
  return status !== null && status !== undefined && !isLocked(status);
}

export function canDelete(status: SfStatus): boolean {
  return !isLocked(status);
}

export interface LifecycleAction {
  target: SfTransitionTarget;
  /** `lock`, `reopen` or `file`: the suffix of the translation keys. */
  name: 'lock' | 'reopen' | 'file';
  enabled: boolean;
  /** Translation key of the tooltip that explains a disabled action. */
  hintKey: string | null;
}

/** Lock only from `validated`, reopen and file only from `locked`; a disabled action carries its tooltip. */
export function lifecycleActions(status: SfStatus): LifecycleAction[] {
  return [
    {
      target: 'locked',
      name: 'lock',
      enabled: status === 'validated',
      hintKey: status === 'validated' ? null : 'statutoryFinancials.hint.lockRequiresValidated',
    },
    {
      target: 'draft',
      name: 'reopen',
      enabled: status === 'locked',
      hintKey: status === 'locked' ? null : 'statutoryFinancials.hint.reopenRequiresLocked',
    },
    {
      target: 'filed',
      name: 'file',
      enabled: status === 'locked',
      hintKey: status === 'locked' ? null : 'statutoryFinancials.hint.fileRequiresLocked',
    },
  ];
}

// --- Statement tree ---

export interface SfTreeNode {
  line: SfLine;
  depth: number;
  children: SfTreeNode[];
}

export interface SfTreeRow {
  line: SfLine;
  depth: number;
  hasChildren: boolean;
}

/**
 * Builds the tree of a statement from its flat lines: the parent is the line named by `parent_code`; without one
 * (or when it is unknown) the nearest previous line of a lower `level` is the parent.
 */
export function buildTree(lines: readonly SfLine[]): SfTreeNode[] {
  const nodes = new Map<string, SfTreeNode>();
  const roots: SfTreeNode[] = [];
  const stack: SfTreeNode[] = [];

  for (const line of lines) {
    const node: SfTreeNode = { line, depth: 0, children: [] };
    let parent: SfTreeNode | undefined = line.parent_code ? nodes.get(line.parent_code) : undefined;

    if (parent === undefined && !line.parent_code) {
      while (stack.length > 0 && (stack[stack.length - 1] as SfTreeNode).line.level >= line.level) {
        stack.pop();
      }
      parent = stack[stack.length - 1];
    }

    if (parent === undefined) {
      roots.push(node);
    } else {
      node.depth = parent.depth + 1;
      parent.children.push(node);
    }
    nodes.set(line.code, node);

    while (stack.length > 0 && (stack[stack.length - 1] as SfTreeNode).line.level >= line.level) {
      stack.pop();
    }
    stack.push(node);
  }

  return roots;
}

/** The rows to show, depth first; the children of a collapsed code are left out. */
export function flattenTree(
  roots: readonly SfTreeNode[],
  collapsed: ReadonlySet<string> = new Set<string>(),
): SfTreeRow[] {
  const rows: SfTreeRow[] = [];
  const visit = (node: SfTreeNode): void => {
    rows.push({ line: node.line, depth: node.depth, hasChildren: node.children.length > 0 });
    if (!collapsed.has(node.line.code)) {
      node.children.forEach(visit);
    }
  };
  roots.forEach(visit);
  return rows;
}

export function statementRows(
  lines: readonly SfLine[],
  collapsed: ReadonlySet<string> = new Set<string>(),
): SfTreeRow[] {
  return flattenTree(buildTree(lines), collapsed);
}

/** Lines that exist only to round the statement to whole units (reserve, rounding income and cost). */
export function roundingLines(lines: readonly SfLine[]): SfLine[] {
  return lines.filter((line) => line.is_rounding);
}

export function hasRounding(lines: readonly SfLine[]): boolean {
  return lines.some((line) => line.is_rounding);
}

/** A line bolds when it is a total or a subtotal. */
export function isStrong(line: SfLine): boolean {
  return line.is_total || line.side === 'subtotal';
}

// --- Reclassification, validation ---

export function sideKey(side: 'normal' | 'opposite'): string {
  return side === 'normal' ? 'bifront.asset_side' : 'bifront.liability_side';
}

export type GroupedIssues = { category: SfIssueCategory; issues: SfIssue[] }[];

/** Groups validation issues by category, in the order of the categories, leaving out the empty ones. */
export function groupIssues(issues: readonly SfIssue[]): GroupedIssues {
  return SF_ISSUE_CATEGORIES.map((category) => ({
    category,
    issues: issues.filter((issue) => issue.category === category),
  })).filter((group) => group.issues.length > 0);
}

export function shortSha(sha: string | null | undefined, length = 12): string {
  return (sha ?? '').slice(0, length);
}

export function sizeText(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isPdfa(artifact: SfArtifact): boolean {
  return artifact.kind !== 'xbrl_instance';
}

// --- What-if simulation ---

/** Drops the empty parameters and anything the API does not know, so a cleared control does not send null. */
export function cleanWhatIf(whatIf: SfWhatIf): SfWhatIf {
  const cleaned: Record<string, number> = {};
  for (const key of SF_WHAT_IF_PARAMETERS) {
    const value = whatIf[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      cleaned[key] = value;
    }
  }
  return cleaned as SfWhatIf;
}

export function isWhatIfEmpty(whatIf: SfWhatIf): boolean {
  return Object.keys(cleanWhatIf(whatIf)).length === 0;
}

// --- Wizard ---

export interface SfDossierDraft {
  title: string;
  fiscal_year_id: string | null;
  comparative_prior_year_id: string | null;
  accounting_standard: SfStandard | null;
  rounding_to_unit_mode: SfRoundingMode;
  income_statement_method: SfIncomeStatementMethod;
  cash_flow_method: 'indirect' | 'direct';
  cogs_personnel: number | null;
  cogs_other_opex: number | null;
  cogs_depr: number | null;
  share_capital: number | null;
  dividends: number | null;
  other_reserves: number | null;
  carried_forward: number | null;
  hidden_enabled: boolean;
  hidden_tax_rate_percent: number | null;
  hidden_reserves_created: number | null;
  hidden_reserves_released: number | null;
  hidden_items: { label: string; book_value: number | null; fer_value: number | null }[];
}

export function emptyDraft(): SfDossierDraft {
  return {
    title: '',
    fiscal_year_id: null,
    comparative_prior_year_id: null,
    accounting_standard: null,
    rounding_to_unit_mode: 'ExactCents',
    income_statement_method: 'total_cost',
    cash_flow_method: 'indirect',
    cogs_personnel: null,
    cogs_other_opex: null,
    cogs_depr: null,
    share_capital: null,
    dividends: null,
    other_reserves: null,
    carried_forward: null,
    hidden_enabled: false,
    hidden_tax_rate_percent: null,
    hidden_reserves_created: null,
    hidden_reserves_released: null,
    hidden_items: [],
  };
}

/** The draft of an existing dossier, for the settings form. */
export function draftFromDossier(dossier: SfDossier): SfDossierDraft {
  const cogs = dossier.options?.cogs_allocation ?? {};
  const hidden = dossier.hidden_reserves_config ?? null;
  return {
    title: dossier.title,
    fiscal_year_id: dossier.fiscal_year_id,
    comparative_prior_year_id: dossier.comparative_prior_year_id,
    accounting_standard: dossier.accounting_standard,
    rounding_to_unit_mode: dossier.rounding_to_unit_mode,
    income_statement_method: dossier.income_statement_method,
    cash_flow_method: dossier.cash_flow_method,
    cogs_personnel: cogs.personnel ?? null,
    cogs_other_opex: cogs.other_opex ?? null,
    cogs_depr: cogs.depr ?? null,
    share_capital: toInputNumber(dossier.share_capital),
    dividends: toInputNumber(dossier.profit_allocation_proposal?.dividends),
    other_reserves: toInputNumber(dossier.profit_allocation_proposal?.other_reserves),
    carried_forward: toInputNumber(dossier.profit_allocation_proposal?.carried_forward_out),
    hidden_enabled: hidden?.enabled ?? false,
    hidden_tax_rate_percent: toInputNumber(hidden?.tax_rate_percent),
    hidden_reserves_created: toInputNumber(hidden?.reserves_created),
    hidden_reserves_released: toInputNumber(hidden?.reserves_released),
    hidden_items: (hidden?.items ?? []).map((item) => ({
      label: item.label,
      book_value: toInputNumber(item.book_value),
      fer_value: toInputNumber(item.fer_value),
    })),
  };
}

export type WizardProblem =
  | 'fiscal_year_required'
  | 'comparative_same'
  | 'standard_required'
  | 'cogs_allocation_invalid'
  | 'hidden_item_invalid'
  | null;

/** Validation of a wizard step (0 years, 1 standard, 2 eligibility, 3 options), as the key of the problem. */
export function wizardProblem(step: number, draft: SfDossierDraft): WizardProblem {
  if (step === 0) {
    if (!draft.fiscal_year_id) {
      return 'fiscal_year_required';
    }
    if (
      draft.comparative_prior_year_id &&
      draft.comparative_prior_year_id === draft.fiscal_year_id
    ) {
      return 'comparative_same';
    }
  }
  if (step === 1) {
    if (!draft.accounting_standard) {
      return 'standard_required';
    }
    if (draft.income_statement_method === 'cost_of_sales') {
      const shares = [draft.cogs_personnel, draft.cogs_other_opex, draft.cogs_depr];
      if (shares.some((share) => share !== null && (share < 0 || share > 100))) {
        return 'cogs_allocation_invalid';
      }
    }
  }
  if (step === 3 && isSwiss(draft.accounting_standard) && draft.hidden_enabled) {
    const invalid = draft.hidden_items.some(
      (item) => item.label.trim() === '' || item.book_value === null || item.fer_value === null,
    );
    if (invalid) {
      return 'hidden_item_invalid';
    }
  }
  return null;
}

function numberOrUndefined(value: number | null): number | undefined {
  return value === null ? undefined : value;
}

/** The body of POST/PUT dossiers: only what the chosen standard and method use. */
export function buildDossierPayload(draft: SfDossierDraft): SfDossierPayload {
  const payload: SfDossierPayload = {};
  if (draft.fiscal_year_id) {
    payload.fiscal_year_id = draft.fiscal_year_id;
  }
  payload.comparative_prior_year_id = draft.comparative_prior_year_id || null;
  if (draft.title.trim() !== '') {
    payload.title = draft.title.trim();
  }
  if (draft.accounting_standard) {
    payload.accounting_standard = draft.accounting_standard;
  }
  payload.rounding_to_unit_mode = draft.rounding_to_unit_mode;
  payload.income_statement_method = draft.income_statement_method;
  payload.cash_flow_method = draft.cash_flow_method;

  if (draft.income_statement_method === 'cost_of_sales') {
    const cogs: Record<string, number> = {};
    const shares: [string, number | null][] = [
      ['personnel', draft.cogs_personnel],
      ['other_opex', draft.cogs_other_opex],
      ['depr', draft.cogs_depr],
    ];
    for (const [key, value] of shares) {
      if (value !== null) {
        cogs[key] = value;
      }
    }
    payload.options = { cogs_allocation: cogs };
  }

  payload.share_capital = draft.share_capital;
  payload.dividends = numberOrUndefined(draft.dividends);
  payload.other_reserves = numberOrUndefined(draft.other_reserves);
  payload.carried_forward = numberOrUndefined(draft.carried_forward);

  if (isSwiss(draft.accounting_standard)) {
    payload.hidden_reserves_config = {
      enabled: draft.hidden_enabled,
      tax_rate_percent: numberOrUndefined(draft.hidden_tax_rate_percent),
      reserves_created: numberOrUndefined(draft.hidden_reserves_created),
      reserves_released: numberOrUndefined(draft.hidden_reserves_released),
      items: draft.hidden_enabled
        ? draft.hidden_items.map((item) => ({
            label: item.label.trim(),
            book_value: String(item.book_value ?? 0),
            fer_value: String(item.fer_value ?? 0),
          }))
        : [],
    };
  }
  return payload;
}

// --- Notes (Nota Integrativa / Anhang) ---

export type NotesColumnType = 'text' | 'decimal' | 'select';

export interface NotesColumn {
  field: string;
  type: NotesColumnType;
  options?: readonly string[];
}

/** Columns of the row tables of the notes; every other table has its own layout (maturity). */
export const NOTES_TABLE_COLUMNS: Partial<Record<SfNotesTableName, readonly NotesColumn[]>> = {
  fixed_assets: [
    { field: 'category', type: 'text' },
    { field: 'opening_cost', type: 'decimal' },
    { field: 'additions', type: 'decimal' },
    { field: 'disposals_cost', type: 'decimal' },
    { field: 'revaluations', type: 'decimal' },
    { field: 'impairments', type: 'decimal' },
    { field: 'closing_cost', type: 'decimal' },
    { field: 'opening_accumulated', type: 'decimal' },
    { field: 'depreciation', type: 'decimal' },
    { field: 'disposals_accumulated', type: 'decimal' },
    { field: 'closing_accumulated', type: 'decimal' },
    { field: 'net_book_value', type: 'decimal' },
  ],
  equity: [
    { field: 'label', type: 'text' },
    { field: 'opening', type: 'decimal' },
    { field: 'movements', type: 'decimal' },
    { field: 'result_for_year', type: 'decimal' },
    { field: 'allocation_of_prior_result', type: 'decimal' },
    { field: 'closing', type: 'decimal' },
  ],
  compensation: [
    { field: 'role', type: 'select', options: ['directors', 'auditors'] },
    { field: 'fees', type: 'decimal' },
    { field: 'advances', type: 'decimal' },
    { field: 'guarantees', type: 'decimal' },
  ],
  leases: [
    { field: 'number', type: 'text' },
    { field: 'title', type: 'text' },
    { field: 'lessor', type: 'text' },
    { field: 'asset_class', type: 'text' },
    { field: 'within_1y', type: 'decimal' },
    { field: 'between_1y_5y', type: 'decimal' },
    { field: 'beyond_5y', type: 'decimal' },
    { field: 'total_commitment', type: 'decimal' },
    { field: 'closing_liability', type: 'decimal' },
    { field: 'interest_year', type: 'decimal' },
    { field: 'depreciation_year', type: 'decimal' },
    { field: 'redemption_value', type: 'decimal' },
  ],
  off_balance: [
    { field: 'type', type: 'text' },
    { field: 'description', type: 'text' },
    { field: 'amount', type: 'decimal' },
  ],
  workforce: [
    { field: 'category', type: 'text' },
    { field: 'average_headcount', type: 'decimal' },
    { field: 'average_fte', type: 'decimal' },
  ],
  related_parties: [
    { field: 'party', type: 'text' },
    { field: 'relationship', type: 'text' },
    { field: 'amount', type: 'decimal' },
    { field: 'description', type: 'text' },
  ],
  taxes: [
    { field: 'kind', type: 'select', options: ['current', 'deferred'] },
    { field: 'amount', type: 'decimal' },
  ],
};

/** Tables whose rows the user may add and remove (the others come from the subledgers and keep their rows). */
export const NOTES_ADDABLE_TABLES: readonly SfNotesTableName[] = [
  'off_balance',
  'related_parties',
  'workforce',
  'taxes',
  'compensation',
  'leases',
];

export const MATURITY_BUCKETS = [
  'within_1y',
  'between_1y_5y',
  'beyond_5y',
  'total',
  'secured',
] as const;
export type MaturityBucket = (typeof MATURITY_BUCKETS)[number];
export const MATURITY_GROUPS = ['receivables', 'payables'] as const;
export type MaturityGroup = (typeof MATURITY_GROUPS)[number];

/** The sources (modules) that feed each table, shown next to the table when the API names them. */
export const NOTES_TABLE_SOURCES: Partial<Record<SfNotesTableName, string>> = {
  fixed_assets: 'Mod 019',
  maturity: 'Mod 017',
  leases: 'Mod 147',
  workforce: 'Mod 072',
};

/** The tables to show for a standard, in the order of the lookup, keeping only those the notes know. */
export function visibleNotesTables(standard: SfStandardLookup | undefined): SfNotesTableName[] {
  const listed = standard?.notes?.tables;
  if (!listed) {
    return [...SF_NOTES_TABLES];
  }
  return listed.filter((name): name is SfNotesTableName =>
    (SF_NOTES_TABLES as readonly string[]).includes(name),
  );
}

/** The narrative sections to show: those listed by the standard, in that order, with the stored text. */
export function visibleNarrativeSections(
  standard: SfStandardLookup | undefined,
  sections: readonly SfNarrativeSection[],
): SfNarrativeSection[] {
  const listed = standard?.notes?.sections;
  if (!listed) {
    return [...sections];
  }
  return listed
    .map((key) => sections.find((section) => section.key === key))
    .filter((section): section is SfNarrativeSection => section !== undefined);
}

/** `key => value` of a row, keeping the other fields: used to edit a cell without mutating the notes. */
export function updateRow<T extends object>(
  rows: readonly T[],
  index: number,
  field: string,
  value: string,
): T[] {
  return rows.map((row, position) => (position === index ? { ...row, [field]: value } : row));
}

export function removeRow<T>(rows: readonly T[], index: number): T[] {
  return rows.filter((_, position) => position !== index);
}

/** An empty row of a table, with every column empty (decimals as "0"). */
export function emptyNotesRow(table: SfNotesTableName): Record<string, string> {
  const row: Record<string, string> = {};
  for (const column of NOTES_TABLE_COLUMNS[table] ?? []) {
    row[column.field] =
      column.type === 'decimal' ? '0' : column.type === 'select' ? (column.options?.[0] ?? '') : '';
  }
  return row;
}

/** Whether a row holds only valid decimals in its decimal columns (the Save button is blocked otherwise). */
export function rowsAreValid(table: SfNotesTableName, rows: readonly object[]): boolean {
  const decimals = (NOTES_TABLE_COLUMNS[table] ?? []).filter((column) => column.type === 'decimal');
  return rows.every((row) =>
    decimals.every((column) => {
      const value = (row as Record<string, unknown>)[column.field];
      return typeof value === 'string' || typeof value === 'number'
        ? isDecimal(String(value))
        : false;
    }),
  );
}

/** The tables of a notes object by name, to edit a copy. */
export function tableOf(
  notes: SfNotes | null,
  name: SfNotesTableName,
): Record<string, unknown> | null {
  const table = notes?.quantitative_tables?.[name];
  return table ? (table as unknown as Record<string, unknown>) : null;
}

export function sourceOf(notes: SfNotes | null, name: SfNotesTableName): string | null {
  return notes?.sources?.[name] ?? null;
}

/** Whether a table was rebuilt from the balance sheet because its subledger had no data. */
export function isFallback(table: { fallback?: boolean } | null | undefined): boolean {
  return table?.fallback === true;
}

// --- Dossier rows ---

export function fiscalYearText(dossier: SfDossierSummary): string {
  return dossier.fiscal_year?.year_code ?? '';
}

// --- Routing, labels and dates ---

/** The dossier id of the route or of the nearest parent that has one. */
export function routeDossierId(route: ActivatedRoute): string | null {
  let current: ActivatedRoute | null = route;
  while (current !== null) {
    const id = current.snapshot.paramMap.get('id');
    if (id) {
      return id;
    }
    current = current.parent;
  }
  return null;
}

/** The workspace tab a url shows (the segment after the dossier id), the statements when there is none. */
export function tabOfUrl(url: string): string {
  const path = url.split(/[?#]/)[0] ?? '';
  const segments = path.split('/').filter((segment) => segment !== '');
  const base = segments.indexOf('statutory-financials');
  return segments[base + 2] ?? 'statements';
}

/** Title of a seeded label (`report.balance_sheet`, `rounding.reserve_label`…), empty when the API sent none. */
export function labelTitle(
  labels: Record<string, { title: string; body: string }> | null | undefined,
  key: string,
): string {
  return labels?.[key]?.title ?? '';
}

export function labelBody(
  labels: Record<string, { title: string; body: string }> | null | undefined,
  key: string,
): string {
  return labels?.[key]?.body ?? '';
}

/** `yyyy-MM-dd` of a date in the local time zone (the API takes a calendar date, not an instant). */
export function toIsoDate(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface MinutesDraft {
  board: boolean;
  shareholders: boolean;
  meeting_date: Date | null;
  meeting_place: string;
  chair: string;
  secretary: string;
  attendees: string[];
}

export function emptyMinutesDraft(): MinutesDraft {
  return {
    board: true,
    shareholders: false,
    meeting_date: null,
    meeting_place: '',
    chair: '',
    secretary: '',
    attendees: [],
  };
}

/** The body of POST pdfa for the minutes wizard: the chosen kinds and only the meeting fields that were filled in. */
export function buildMinutesPayload(draft: MinutesDraft): SfPdfaPayload {
  const kinds: SfPdfaKind[] = [];
  if (draft.board) {
    kinds.push('board_minutes');
  }
  if (draft.shareholders) {
    kinds.push('shareholders_minutes');
  }
  const meeting: SfMeeting = {};
  const date = toIsoDate(draft.meeting_date);
  if (date) {
    meeting.meeting_date = date;
  }
  if (draft.meeting_place.trim() !== '') {
    meeting.meeting_place = draft.meeting_place.trim();
  }
  if (draft.chair.trim() !== '') {
    meeting.chair = draft.chair.trim();
  }
  if (draft.secretary.trim() !== '') {
    meeting.secretary = draft.secretary.trim();
  }
  const attendees = draft.attendees.map((name) => name.trim()).filter((name) => name !== '');
  if (attendees.length > 0) {
    meeting.attendees = attendees;
  }
  return Object.keys(meeting).length > 0 ? { kinds, meeting } : { kinds };
}

/** A minutes draft is valid when at least one kind is chosen and a meeting date is set. */
export function minutesProblem(
  step: number,
  draft: MinutesDraft,
): 'kind_required' | 'date_required' | null {
  if (step === 0 && !draft.board && !draft.shareholders) {
    return 'kind_required';
  }
  if (step === 1 && toIsoDate(draft.meeting_date) === null) {
    return 'date_required';
  }
  return null;
}
