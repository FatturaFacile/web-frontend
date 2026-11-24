import {
  CatalogProduct,
  CampaignStatus,
  EmailBlock,
  EmailBlockType,
  JourneyConditionType,
  JourneyStep,
  JourneyStepType,
  MarketingLocalizedText,
  MARKETING_LOCALES,
  MarketingBlueprint,
  MarketingLocale,
  MarketingProblem,
  RfmLabelCode,
  RoiState,
  SegmentCriteria,
} from '@core';

const FALLBACK_LOCALES: readonly MarketingLocale[] = ['it', 'en', 'de', 'fr'];

/** The text of a language; a missing language falls back to Italian, English, German, French. */
export function localized(
  text: MarketingLocalizedText | string | null | undefined,
  locale: MarketingLocale,
): string {
  if (typeof text === 'string') {
    return text;
  }
  if (!text) {
    return '';
  }
  for (const candidate of [locale, ...FALLBACK_LOCALES]) {
    const value = text[candidate];
    if (typeof value === 'string' && value !== '') {
      return value;
    }
  }
  return '';
}

/** A field of a seeded blueprint (`name`, `description`...) in the language of the user. */
export function blueprintText(
  blueprint: MarketingBlueprint,
  field: string,
  locale: MarketingLocale,
): string {
  for (const candidate of [locale, ...FALLBACK_LOCALES]) {
    const value = blueprint.texts[candidate]?.[field];
    if (typeof value === 'string' && value !== '') {
      return value;
    }
  }
  return '';
}

/** Only the languages the platform supports; anything else is Italian. */
export function asMarketingLocale(value: string | null | undefined): MarketingLocale {
  const code = (value ?? '').slice(0, 2).toLowerCase();
  return (MARKETING_LOCALES as readonly string[]).includes(code) ? (code as MarketingLocale) : 'it';
}

// --- ROI ---

export interface RoiDisplay {
  /** `value` is shown as a percentage; `none` shows the seeded "no cost" text, never a division by zero. */
  kind: 'value' | 'none' | 'loss';
  value: number | null;
}

export function roiDisplay(percentage: number | null, state: RoiState): RoiDisplay {
  if (state === 'no_cost' || percentage === null) {
    return { kind: 'none', value: null };
  }
  return { kind: percentage < 0 ? 'loss' : 'value', value: percentage };
}

export function rate(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

// --- Segments and the RFM matrix ---

export const RFM_COLORS: Readonly<Record<RfmLabelCode, string>> = {
  champions: '#389e0d',
  loyal: '#73d13d',
  promising: '#36cfc9',
  new_customers: '#40a9ff',
  at_risk: '#faad14',
  hibernating: '#d48806',
  lost: '#cf1322',
};

/** Background of a heat-map cell: the more contacts, the stronger the colour. */
export function heatColor(count: number, max: number): string {
  if (count <= 0 || max <= 0) {
    return 'transparent';
  }
  const alpha = Math.max(0.12, Math.min(1, count / max));
  return `rgba(22, 119, 255, ${alpha.toFixed(2)})`;
}

/** Whether the colour behind a cell is dark enough to need light text. */
export function heatNeedsLightText(count: number, max: number): boolean {
  return max > 0 && count / max > 0.55;
}

/** The 5 x 5 R x F grid: the cell of a score is always present, so the matrix keeps its shape. */
export function matrixGrid(
  cells: { r: number; f: number; count: number }[],
): { r: number; f: number; count: number }[][] {
  const lookup = new Map(cells.map((cell) => [`${cell.r}:${cell.f}`, cell.count]));
  const rows: { r: number; f: number; count: number }[][] = [];
  for (let r = 5; r >= 1; r--) {
    const row: { r: number; f: number; count: number }[] = [];
    for (let f = 1; f <= 5; f++) {
      row.push({ r, f, count: lookup.get(`${r}:${f}`) ?? 0 });
    }
    rows.push(row);
  }
  return rows;
}

/** Drops the empty filters, so the API receives only what the user set. */
export function cleanCriteria(criteria: SegmentCriteria): SegmentCriteria {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(criteria)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      const inner = Object.fromEntries(
        Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== ''),
      );
      if (Object.keys(inner).length === 0) {
        continue;
      }
      cleaned[key] = inner;
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned as SegmentCriteria;
}

/** Splits "TI, ZH" or "ti;zh" into the upper-case codes of cantons or provinces. */
export function parseRegions(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((part) => part.trim().toUpperCase())
        .filter((part) => part !== ''),
    ),
  ];
}

// --- E-mail designer ---

let blockSequence = 0;

export function newBlockId(): string {
  blockSequence += 1;
  return `b${Date.now().toString(36)}${blockSequence}`;
}

/** A new block with empty texts in every language. */
export function newBlock(type: EmailBlockType): EmailBlock {
  const empty = (): MarketingLocalizedText => ({ it: '', de: '', fr: '', en: '' });
  const props: Record<string, unknown> = {};
  switch (type) {
    case 'heading':
    case 'text':
      props['text'] = empty();
      break;
    case 'image':
      props['src'] = '';
      props['alt'] = empty();
      break;
    case 'button':
      props['label'] = empty();
      props['href'] = '';
      break;
    case 'spacer':
      props['height'] = '20px';
      break;
    case 'product':
      props['name'] = empty();
      props['description'] = empty();
      props['cta_label'] = empty();
      props['price'] = null;
      props['currency'] = '';
      props['image_url'] = '';
      props['url'] = '';
      props['product_id'] = null;
      break;
    case 'html':
      props['html'] = '';
      break;
    default:
      break;
  }
  return { id: newBlockId(), type, props };
}

/** The block "Drag Product from ERP Catalog": name, description, price and image come from the product. */
export function productBlockFromCatalog(
  product: CatalogProduct,
  locale: MarketingLocale,
  current?: EmailBlock,
): EmailBlock {
  const block = current ?? newBlock('product');
  const name: MarketingLocalizedText = { ...(block.props['name'] as MarketingLocalizedText) };
  const description: MarketingLocalizedText = { ...(block.props['description'] as MarketingLocalizedText) };
  // The catalog holds one language: it fills the language on screen and every language still empty.
  for (const language of MARKETING_LOCALES) {
    if (language === locale || !name[language]) {
      name[language] = product.name;
    }
    if ((language === locale || !description[language]) && product.description) {
      description[language] = product.description;
    }
  }
  return {
    ...block,
    props: {
      ...block.props,
      name,
      description,
      price: product.price,
      currency: product.currency,
      image_url: product.image_url ?? '',
      product_id: product.id,
    },
  };
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) {
    return [...items];
  }
  const copy = [...items];
  const [item] = copy.splice(from, 1);
  const target = Math.max(0, Math.min(copy.length, to));
  copy.splice(target, 0, item);
  return copy;
}

export function insertItem<T>(items: readonly T[], item: T, index: number): T[] {
  const copy = [...items];
  copy.splice(Math.max(0, Math.min(copy.length, index)), 0, item);
  return copy;
}

export function removeItem<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

/** Sets a text of one language on a block without touching the other languages. */
export function setBlockText(
  block: EmailBlock,
  prop: string,
  locale: MarketingLocale,
  value: string,
): EmailBlock {
  const current = (block.props[prop] as MarketingLocalizedText | undefined) ?? {};
  return { ...block, props: { ...block.props, [prop]: { ...current, [locale]: value } } };
}

export function setBlockProp(block: EmailBlock, prop: string, value: unknown): EmailBlock {
  return { ...block, props: { ...block.props, [prop]: value } };
}

/** Languages in which a block still has an empty text (so the designer can warn before sending). */
export function missingLocales(blocks: readonly EmailBlock[]): MarketingLocale[] {
  const missing = new Set<MarketingLocale>();
  for (const block of blocks) {
    for (const value of Object.values(block.props)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const locale of MARKETING_LOCALES) {
          const text = (value as MarketingLocalizedText)[locale];
          if (typeof text === 'string' && text.trim() === '') {
            missing.add(locale);
          }
        }
      }
    }
  }
  return MARKETING_LOCALES.filter((locale) => missing.has(locale));
}

/** The variants of an A/B test must add up to 100 %. */
export function splitIsValid(variants: readonly { percent: number }[]): boolean {
  return variants.length === 0 || variants.reduce((sum, v) => sum + v.percent, 0) === 100;
}

// --- Journey builder ---

export const CONDITION_STEP_TYPES: readonly JourneyConditionType[] = [
  'opened',
  'not_opened',
  'clicked',
  'ordered',
  'not_ordered',
  'clicked_not_ordered',
];

export function uniqueStepKey(type: JourneyStepType, steps: readonly JourneyStep[]): string {
  const taken = new Set(steps.map((step) => step.step_key));
  let n = 1;
  while (taken.has(`${type}_${n}`)) {
    n += 1;
  }
  return `${type}_${n}`;
}

export function newStep(
  type: JourneyStepType,
  steps: readonly JourneyStep[],
  position?: { x: number; y: number },
): JourneyStep {
  const config: Record<string, unknown> =
    type === 'wait'
      ? { days: 3 }
      : type === 'condition'
        ? { type: 'clicked_not_ordered' }
        : type === 'crm_task'
          ? { task_type: 'call', due_in_days: 2, priority: 'normal', subject: {} }
          : type === 'send_whatsapp' || type === 'send_sms'
            ? { message: {} }
            : {};
  return {
    step_key: uniqueStepKey(type, steps),
    type,
    config,
    next_step_key: null,
    true_step_key: null,
    false_step_key: null,
    is_entry: steps.length === 0,
    pos_x: position?.x ?? 40,
    pos_y: position?.y ?? 40 + steps.length * 120,
  };
}

export interface JourneyEdge {
  from: string;
  to: string;
  kind: 'next' | 'true' | 'false';
}

export function edgesOf(steps: readonly JourneyStep[]): JourneyEdge[] {
  const edges: JourneyEdge[] = [];
  for (const step of steps) {
    if (step.next_step_key) {
      edges.push({ from: step.step_key, to: step.next_step_key, kind: 'next' });
    }
    if (step.true_step_key) {
      edges.push({ from: step.step_key, to: step.true_step_key, kind: 'true' });
    }
    if (step.false_step_key) {
      edges.push({ from: step.step_key, to: step.false_step_key, kind: 'false' });
    }
  }
  return edges;
}

/** Removes a step and every edge that pointed at it; the entry moves to the first step left. */
export function removeStep(steps: readonly JourneyStep[], key: string): JourneyStep[] {
  const rest = steps
    .filter((step) => step.step_key !== key)
    .map((step) => ({
      ...step,
      next_step_key: step.next_step_key === key ? null : step.next_step_key,
      true_step_key: step.true_step_key === key ? null : step.true_step_key,
      false_step_key: step.false_step_key === key ? null : step.false_step_key,
    }));
  if (rest.length > 0 && !rest.some((step) => step.is_entry)) {
    rest[0] = { ...rest[0], is_entry: true };
  }
  return rest;
}

export function setEntry(steps: readonly JourneyStep[], key: string): JourneyStep[] {
  return steps.map((step) => ({ ...step, is_entry: step.step_key === key }));
}

export type JourneyEdgeKind = 'next' | 'true' | 'false';

/** Points one outgoing edge of a step at another step (or clears it with null). */
export function connect(
  steps: readonly JourneyStep[],
  from: string,
  kind: JourneyEdgeKind,
  to: string | null,
): JourneyStep[] {
  return steps.map((step) => {
    if (step.step_key !== from || (to !== null && to === from)) {
      return step;
    }
    return {
      ...step,
      next_step_key: kind === 'next' ? to : step.next_step_key,
      true_step_key: kind === 'true' ? to : step.true_step_key,
      false_step_key: kind === 'false' ? to : step.false_step_key,
    };
  });
}

/** The outgoing edges a step type offers: a condition has two branches, an end none. */
export function edgeKindsOf(type: JourneyStepType): JourneyEdgeKind[] {
  if (type === 'condition') {
    return ['true', 'false'];
  }
  return type === 'end' ? [] : ['next'];
}

export type JourneyIssue =
  | 'no_steps'
  | 'entry_missing'
  | 'unknown_step'
  | 'condition_branches'
  | 'unreachable'
  | 'dead_end'
  | 'send_without_channel';

/** Offline check of the journey before it is sent; the API repeats the rules that protect the data. */
export function journeyIssues(steps: readonly JourneyStep[]): { issue: JourneyIssue; step?: string }[] {
  if (steps.length === 0) {
    return [{ issue: 'no_steps' }];
  }
  const issues: { issue: JourneyIssue; step?: string }[] = [];
  const keys = new Set(steps.map((step) => step.step_key));
  if (steps.filter((step) => step.is_entry).length !== 1) {
    issues.push({ issue: 'entry_missing' });
  }
  for (const step of steps) {
    for (const edge of [step.next_step_key, step.true_step_key, step.false_step_key]) {
      if (edge && !keys.has(edge)) {
        issues.push({ issue: 'unknown_step', step: step.step_key });
      }
    }
    if (step.type === 'condition' && (!step.true_step_key || !step.false_step_key)) {
      issues.push({ issue: 'condition_branches', step: step.step_key });
    }
    if (step.type !== 'end' && step.type !== 'condition' && !step.next_step_key) {
      // A step without a follower simply ends the journey: allowed, but worth showing on the canvas.
      issues.push({ issue: 'dead_end', step: step.step_key });
    }
  }
  const entry = steps.find((step) => step.is_entry);
  if (entry) {
    const reached = new Set<string>();
    const queue = [entry.step_key];
    const byKey = new Map(steps.map((step) => [step.step_key, step]));
    while (queue.length > 0) {
      const key = queue.shift() as string;
      if (reached.has(key)) {
        continue;
      }
      reached.add(key);
      const step = byKey.get(key);
      for (const next of [step?.next_step_key, step?.true_step_key, step?.false_step_key]) {
        if (next) {
          queue.push(next);
        }
      }
    }
    for (const step of steps) {
      if (!reached.has(step.step_key)) {
        issues.push({ issue: 'unreachable', step: step.step_key });
      }
    }
  }
  return issues;
}

/** Issues that make the API refuse the journey (dead ends and unreachable steps are only hints). */
export function blockingJourneyIssues(steps: readonly JourneyStep[]): JourneyIssue[] {
  const blocking: JourneyIssue[] = ['no_steps', 'entry_missing', 'unknown_step', 'condition_branches'];
  return journeyIssues(steps)
    .map((entry) => entry.issue)
    .filter((issue) => blocking.includes(issue));
}

export function stepIcon(type: JourneyStepType): string {
  switch (type) {
    case 'send_email':
      return 'fa-solid fa-envelope';
    case 'send_whatsapp':
      return 'fa-brands fa-whatsapp';
    case 'send_sms':
      return 'fa-solid fa-comment-sms';
    case 'wait':
      return 'fa-solid fa-hourglass-half';
    case 'condition':
      return 'fa-solid fa-code-branch';
    case 'crm_task':
      return 'fa-solid fa-phone';
    default:
      return 'fa-solid fa-flag-checkered';
  }
}

// --- Misc ---

export const EDITABLE_STATUSES: readonly CampaignStatus[] = ['draft', 'scheduled', 'paused'];

/** What the user can do with a campaign in its current status. */
export function allowedActions(status: CampaignStatus): ('activate' | 'schedule' | 'pause' | 'archive')[] {
  switch (status) {
    case 'draft':
      return ['schedule', 'activate', 'archive'];
    case 'scheduled':
      return ['activate', 'pause', 'archive'];
    case 'active':
      return ['pause', 'archive'];
    case 'paused':
      return ['activate', 'archive'];
    case 'completed':
      return ['archive'];
    default:
      return [];
  }
}

/** The code of an RFC 7807 problem answered by the API (a seeded text exists for every code). */
export function problemOf(error: unknown): MarketingProblem | null {
  const body = (error as { error?: unknown } | null)?.error;
  if (body && typeof body === 'object' && 'code' in body && typeof (body as MarketingProblem).code === 'string') {
    return body as MarketingProblem;
  }
  return null;
}

/** Validation messages of a 422 answer, flattened. */
export function validationMessages(error: unknown): string[] {
  const errors = (error as { error?: { errors?: Record<string, string[]> } } | null)?.error?.errors;
  return errors ? Object.values(errors).flat() : [];
}

const REASON_CODES: ReadonlySet<string> = new Set([
  'suppressed',
  'sender_not_identified',
  'unsubscribed',
  'channel_opt_out',
  'no_consent',
  'credit_blocked',
  'contact_unavailable',
  'no_address',
  'assigned',
  'unassigned',
]);

/** Key of the seeded text of a step-log detail, or null when the detail is plain data (a duration, an id). */
export function auditReasonKey(reason: string | null): string | null {
  return reason !== null && REASON_CODES.has(reason) ? `marketing.reason.${reason}` : null;
}
