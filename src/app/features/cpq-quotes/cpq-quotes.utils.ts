import {
  EditorHeader,
  EditorLine,
  EditorSection,
  EditorTotals,
  QuoteDetail,
  QuoteLineType,
} from './cpq-quotes.models';

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function newKey(): string {
  return globalThis.crypto.randomUUID();
}

export function isPriced(type: QuoteLineType): boolean {
  return type !== 'text_note' && type !== 'subtotal';
}

/** Which lines count: mandatory always; optional by default flag; one line per alternative group (default-flagged, else the first). */
export function includedLines(lines: readonly EditorLine[]): Set<string> {
  const included = new Set<string>();
  const groups = new Map<string, EditorLine[]>();

  for (const line of lines) {
    if (line.selection_mode === 'mandatory') {
      included.add(line.key);
    } else if (line.selection_mode === 'optional') {
      if (line.is_default_selected) {
        included.add(line.key);
      }
    } else {
      const group = line.alternative_group ?? 'default';
      groups.set(group, [...(groups.get(group) ?? []), line]);
    }
  }

  for (const group of groups.values()) {
    included.add((group.find((l) => l.is_default_selected) ?? group[0]).key);
  }

  return included;
}

function unitPrice(line: EditorLine): number {
  let unit = line.unit_price;
  let best = -1;
  for (const tier of line.tier_prices ?? []) {
    if (line.quantity >= tier.min_qty && tier.min_qty > best) {
      best = tier.min_qty;
      unit = tier.unit_price;
    }
  }
  return unit;
}

/**
 * Preview of the pricing the server will compute (same cascade: tier price, line percentage then fixed discount, section
 * percentage, header percentage; per-line rounding; VAT per rate; Swiss 0.05 cash rounding of the payable total).
 */
export function priceQuote(
  sections: readonly EditorSection[],
  lines: readonly EditorLine[],
  header: Pick<EditorHeader, 'header_discount_percent' | 'jurisdiction' | 'currency'>,
): EditorTotals {
  const included = includedLines(lines);
  const sectionDiscount = new Map(sections.map((s) => [s.key, s.discount_percent]));
  const netByRate = new Map<number, number>();
  const lineNet: Record<string, number> = {};
  const runningSubtotal: Record<string, number> = {};
  const sectionSubtotals: Record<string, number> = {};
  const running = new Map<string, number>();
  let cost = 0;

  for (const line of lines) {
    const sectionKey = line.sectionKey ?? '';
    if (line.line_type === 'subtotal') {
      runningSubtotal[line.key] = round(running.get(sectionKey) ?? 0, 2);
      continue;
    }
    if (!isPriced(line.line_type) || !included.has(line.key)) {
      lineNet[line.key] = 0;
      continue;
    }

    const listTotal = line.quantity * unitPrice(line);
    const afterLine = Math.max(
      0,
      listTotal - (listTotal * line.discount_percent) / 100 - line.discount_fixed,
    );
    const afterSection = afterLine * (1 - (sectionDiscount.get(sectionKey) ?? 0) / 100);
    const net = round(afterSection * (1 - header.header_discount_percent / 100), 2);

    lineNet[line.key] = net;
    netByRate.set(line.tax_rate, round((netByRate.get(line.tax_rate) ?? 0) + net, 2));
    sectionSubtotals[sectionKey] = round((sectionSubtotals[sectionKey] ?? 0) + net, 2);
    running.set(sectionKey, round((running.get(sectionKey) ?? 0) + net, 2));
    cost += line.quantity * line.unit_cost;
  }

  const taxBreakdown = [...netByRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, net]) => ({ rate, net, tax: round((net * rate) / 100, 2) }));
  const net = round(
    taxBreakdown.reduce((sum, r) => sum + r.net, 0),
    2,
  );
  const tax = round(
    taxBreakdown.reduce((sum, r) => sum + r.tax, 0),
    2,
  );
  const gross = round(net + tax, 2);
  const swiss = header.jurisdiction === 'CH' && header.currency === 'CHF';
  const payable = swiss ? round(Math.round(gross / 0.05) * 0.05, 2) : gross;
  const totalCost = round(cost, 2);
  const margin = round(net - totalCost, 2);

  return {
    net,
    tax,
    gross,
    rounding: round(payable - gross, 2),
    payable,
    cost: totalCost,
    margin,
    marginPercent: net === 0 ? null : round((margin / net) * 100, 2),
    sectionSubtotals,
    lineNet,
    runningSubtotal,
    taxBreakdown,
  };
}

/**
 * Moves a line (also into another section) to `toIndex` among the lines of the target section. The lines live in one flat
 * array, so the position is translated to the flat order.
 */
export function moveLine(
  lines: readonly EditorLine[],
  key: string,
  toSection: string | null,
  toIndex: number,
): EditorLine[] {
  const moving = lines.find((l) => l.key === key);
  if (moving === undefined) {
    return [...lines];
  }

  const rest = lines.filter((l) => l.key !== key);
  const target = rest.filter((l) => l.sectionKey === toSection);
  const moved: EditorLine = { ...moving, sectionKey: toSection };
  const clamped = Math.max(0, Math.min(toIndex, target.length));

  let insertAt = rest.length;
  if (clamped < target.length) {
    insertAt = rest.indexOf(target[clamped]);
  } else if (target.length > 0) {
    insertAt = rest.indexOf(target[target.length - 1]) + 1;
  }

  return [...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)];
}

export function moveSection(
  sections: readonly EditorSection[],
  from: number,
  to: number,
): EditorSection[] {
  const next = [...sections];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) {
    next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  }
  return next;
}

export function emptyLine(type: QuoteLineType, sectionKey: string | null): EditorLine {
  return {
    key: newKey(),
    id: null,
    sectionKey,
    line_type: type,
    selection_mode: 'mandatory',
    alternative_group: null,
    is_default_selected: true,
    product_id: null,
    sku: null,
    description: '',
    uom: null,
    quantity: 1,
    unit_price: 0,
    unit_cost: 0,
    discount_percent: 0,
    discount_fixed: 0,
    tax_rate: 0,
    tier_prices: null,
  };
}

export function emptySection(title = ''): EditorSection {
  return {
    key: newKey(),
    id: null,
    title,
    description: '',
    discount_percent: 0,
    page_break_before: false,
  };
}

export function defaultHeader(): EditorHeader {
  return {
    customer_name: '',
    customer_email: '',
    contact_id: null,
    currency: 'EUR',
    jurisdiction: 'IT',
    locale: 'it-IT',
    valid_until: null,
    payment_terms: '',
    incoterms: '',
    cover_letter: '',
    terms_and_conditions: '',
    header_discount_percent: 0,
    min_margin_percent: null,
    signature_level: 'ses_otp',
    auto_convert: false,
  };
}

/** Server revision -> editor state (decimals arrive as strings). */
export function fromDetail(quote: QuoteDetail): {
  header: EditorHeader;
  sections: EditorSection[];
  lines: EditorLine[];
} {
  const sections: EditorSection[] = quote.sections.map((s) => ({
    key: s.id,
    id: s.id,
    title: s.title,
    description: s.description ?? '',
    discount_percent: Number(s.discount_percent),
    page_break_before: s.page_break_before,
  }));
  const lines: EditorLine[] = quote.lines.map((l) => ({
    key: l.id,
    id: l.id,
    sectionKey: l.section_id,
    line_type: l.line_type,
    selection_mode: l.selection_mode,
    alternative_group: l.alternative_group,
    is_default_selected: l.is_default_selected,
    product_id: null,
    sku: l.sku,
    description: l.description,
    uom: l.uom,
    quantity: Number(l.quantity),
    unit_price: Number(l.unit_price),
    unit_cost: Number(l.unit_cost),
    discount_percent: Number(l.discount_percent),
    discount_fixed: Number(l.discount_fixed),
    tax_rate: Number(l.tax_rate),
    tier_prices:
      l.tier_prices?.map((t) => ({
        min_qty: Number(t.min_qty),
        unit_price: Number(t.unit_price),
      })) ?? null,
  }));

  return {
    header: {
      customer_name: quote.customer_name ?? '',
      customer_email: quote.customer_email ?? '',
      contact_id: quote.contact_id,
      currency: quote.currency,
      jurisdiction: quote.jurisdiction,
      locale: quote.locale,
      valid_until: quote.valid_until,
      payment_terms: quote.payment_terms ?? '',
      incoterms: quote.incoterms ?? '',
      cover_letter: quote.cover_letter ?? '',
      terms_and_conditions: quote.terms_and_conditions ?? '',
      header_discount_percent: Number(quote.header_discount_percent),
      min_margin_percent:
        quote.min_margin_percent === null ? null : Number(quote.min_margin_percent),
      signature_level: quote.signature_level,
      auto_convert: quote.auto_convert,
    },
    sections,
    lines,
  };
}

/** Editor state -> API payload. Ids are sent back so a revision keeps the lineage of its sections and lines. */
export function toPayload(
  header: EditorHeader,
  sections: readonly EditorSection[],
  lines: readonly EditorLine[],
): Record<string, unknown> {
  const blank = (value: string): string | null => (value.trim() === '' ? null : value);

  return {
    customer_name: header.customer_name,
    customer_email: blank(header.customer_email),
    contact_id: header.contact_id,
    currency: header.currency,
    jurisdiction: header.jurisdiction,
    locale: header.locale,
    valid_until: header.valid_until,
    payment_terms: blank(header.payment_terms),
    incoterms: blank(header.incoterms),
    cover_letter: blank(header.cover_letter),
    terms_and_conditions: blank(header.terms_and_conditions),
    header_discount_percent: header.header_discount_percent,
    min_margin_percent: header.min_margin_percent,
    signature_level: header.signature_level,
    auto_convert: header.auto_convert,
    ...(header.auto_convert ? { auto_convert_target: 'sales_order' } : {}),
    sections: sections.map((s) => ({
      key: s.key,
      ...(s.id === null ? {} : { id: s.id }),
      title: s.title,
      description: blank(s.description),
      discount_percent: s.discount_percent,
      page_break_before: s.page_break_before,
    })),
    lines: lines.map((l) => ({
      ...(l.id === null ? {} : { id: l.id }),
      section_key: l.sectionKey,
      line_type: l.line_type,
      selection_mode: l.selection_mode,
      alternative_group: l.selection_mode === 'alternative_group' ? l.alternative_group : null,
      is_default_selected: l.is_default_selected,
      product_id: l.product_id,
      sku: l.sku,
      description: l.description,
      uom: l.uom,
      quantity: l.quantity,
      unit_price: l.unit_price,
      unit_cost: l.unit_cost,
      discount_percent: l.discount_percent,
      discount_fixed: l.discount_fixed,
      tier_prices: l.tier_prices,
      tax_rate: l.tax_rate,
    })),
  };
}
