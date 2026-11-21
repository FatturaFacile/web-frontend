import {
  BomComponentChange,
  BomDiffResult,
  BomExplosionLine,
  BomImportRow,
} from '@core';

/** Parses a decimal string (dot or comma) into a number; anything else is 0. */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value.trim().replace(/\s/g, '').replace(',', '.'));

  return Number.isFinite(parsed) ? parsed : 0;
}

/** Rounds to 4 decimals (the precision of BOM quantities) and drops the float noise. */
export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

export interface BomTreeNode {
  key: string;
  line: BomExplosionLine;
  children: BomTreeNode[];
}

/** Stable key of a line: its path, or code and position when the path is missing. */
export function lineKey(line: BomExplosionLine, index: number): string {
  const path = Array.isArray(line.path) ? line.path.join('>') : line.path;

  return path ? `${path}#${index}` : `${line.item_code}#${index}`;
}

/**
 * Builds the tree from the flat, depth-first list of an explosion: the parent of a line is the closest preceding line of
 * the level above.
 */
export function buildTree(lines: BomExplosionLine[]): BomTreeNode[] {
  if (lines.length === 0) {
    return [];
  }
  const base = Math.min(...lines.map((line) => line.level));
  const roots: BomTreeNode[] = [];
  const stack: BomTreeNode[] = [];

  lines.forEach((line, index) => {
    const node: BomTreeNode = { key: lineKey(line, index), line, children: [] };
    const depth = Math.max(0, line.level - base);
    stack.length = Math.min(stack.length, depth);
    const parent = stack[depth - 1];

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    stack[depth] = node;
  });

  return roots;
}

export interface BomEditableValues {
  net_quantity: number;
  scrap_percentage: number;
  yield_percentage: number;
  fixed_waste_quantity: number;
}

/**
 * Preview of the quantity to supply once scrap, yield and fixed waste are applied: (net + net x scrap%) / yield% + fixed.
 * It only drives the live cost preview while editing; the figures of record are the ones of the next explosion.
 */
export function previewEffectiveQuantity(values: BomEditableValues): number {
  const yieldFactor = values.yield_percentage > 0 ? values.yield_percentage / 100 : 1;
  const gross = values.net_quantity * (1 + values.scrap_percentage / 100);

  return round4(gross / yieldFactor + values.fixed_waste_quantity);
}

/** Cost of one line (effective quantity x unit cost), a rolled-up assembly takes the sum of its children. */
export function rollupCost(
  node: BomTreeNode,
  effectiveOf: (node: BomTreeNode) => number = (n) => toNumber(n.line.effective_quantity),
): number {
  if (node.children.length > 0) {
    return round4(node.children.reduce((sum, child) => sum + rollupCost(child, effectiveOf), 0));
  }

  return round4(effectiveOf(node) * toNumber(node.line.unit_cost));
}

/** Depth-first list of the visible rows: a node's children show only when it is expanded. */
export function flattenVisible(nodes: BomTreeNode[], expanded: ReadonlySet<string>): BomTreeNode[] {
  const out: BomTreeNode[] = [];
  const walk = (list: BomTreeNode[]): void => {
    for (const node of list) {
      out.push(node);
      if (node.children.length > 0 && expanded.has(node.key)) {
        walk(node.children);
      }
    }
  };
  walk(nodes);

  return out;
}

/** Keys of every node that has children. */
export function expandableKeys(nodes: BomTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.children.length > 0 ? [node.key, ...expandableKeys(node.children)] : [],
  );
}

export interface SequencedItem {
  key: string;
  sequence: number;
}

/** Moves an item to a new position and renumbers the sequences 10, 20, 30... Returns the same order for bad indexes. */
export function reorderSequences<T extends { key: string }>(items: T[], from: number, to: number): (T & { sequence: number })[] {
  const copy = [...items];
  if (from >= 0 && from < copy.length && to >= 0 && to < copy.length && from !== to) {
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
  }

  return copy.map((item, index) => ({ ...item, sequence: (index + 1) * 10 }));
}

export interface BomLineEdit {
  quantity_per?: string;
  scrap_percentage?: string;
  yield_percentage?: string;
  fixed_scrap_quantity?: string;
  sequence?: number;
}

/** Turns the pending inline edits into the `update` changes of an engineering change. */
export function editsToChanges(
  edits: ReadonlyMap<string, { itemId: string; edit: BomLineEdit }>,
): BomComponentChange[] {
  return [...edits.values()]
    .filter(({ edit }) => Object.keys(edit).length > 0)
    .map(({ itemId, edit }) => ({ action: 'update' as const, component_item_id: itemId, ...edit }));
}

// --- CSV / spreadsheet import ---

/** Picks the delimiter that splits the header line into the most cells. */
export function detectDelimiter(text: string): string {
  const header = text.split(/\r?\n/, 1)[0] ?? '';
  const candidates = [';', ',', '\t', '|'];
  let best = ',';
  let bestCount = 0;

  for (const candidate of candidates) {
    const count = header.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

/** RFC 4180 CSV parser: quoted cells, doubled quotes, newlines inside quotes. Blank lines are dropped. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  const endCell = (): void => {
    row.push(cell);
    cell = '';
  };
  const endRow = (): void => {
    endCell();
    if (row.some((value) => value.trim() !== '')) {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      endCell();
    } else if (char === '\n') {
      endRow();
    } else if (char !== '\r') {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    endRow();
  }

  return rows;
}

export type BomImportField = keyof BomImportRow;

export const BOM_IMPORT_FIELDS: readonly BomImportField[] = [
  'item_code',
  'quantity_per',
  'uom',
  'scrap_percentage',
  'yield_percentage',
  'fixed_scrap_quantity',
  'operation_sequence',
  'notes',
];

export const BOM_IMPORT_REQUIRED: readonly BomImportField[] = ['item_code', 'quantity_per'];

const HEADER_SYNONYMS: Record<BomImportField, string[]> = {
  item_code: ['itemcode', 'item', 'code', 'codice', 'componente', 'component', 'sku', 'articolo', 'artikel', 'article'],
  quantity_per: ['quantityper', 'quantity', 'qty', 'quantita', 'qta', 'menge', 'quantite', 'quantitaper'],
  uom: ['uom', 'um', 'unit', 'unita', 'einheit', 'unite', 'unitofmeasure'],
  scrap_percentage: ['scrappercentage', 'scrap', 'scarto', 'ausschuss', 'rebut', 'scartopercentuale'],
  yield_percentage: ['yieldpercentage', 'yield', 'resa', 'ausbeute', 'rendement'],
  fixed_scrap_quantity: ['fixedscrapquantity', 'fixedscrap', 'fixedwaste', 'scartofisso', 'fixausschuss', 'rebutfixe'],
  operation_sequence: ['operationsequence', 'operation', 'operazione', 'arbeitsgang', 'operationseq', 'fase'],
  notes: ['notes', 'note', 'notizen', 'bemerkung', 'remarks', 'commento'],
};

const normalizeHeader = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Maps the file's columns to the importer fields by header name; the result is the column index per field (or null). */
export function autoMapColumns(headers: string[]): Record<BomImportField, number | null> {
  const normalized = headers.map(normalizeHeader);
  const taken = new Set<number>();
  const mapping = {} as Record<BomImportField, number | null>;

  for (const field of BOM_IMPORT_FIELDS) {
    const wanted = [normalizeHeader(field), ...HEADER_SYNONYMS[field]];
    const index = normalized.findIndex((header, i) => !taken.has(i) && wanted.includes(header));
    mapping[field] = index === -1 ? null : index;
    if (index !== -1) {
      taken.add(index);
    }
  }

  return mapping;
}

/** The required fields that have no column. */
export function missingRequired(mapping: Record<BomImportField, number | null>): BomImportField[] {
  return BOM_IMPORT_REQUIRED.filter((field) => mapping[field] === null);
}

const NUMERIC_FIELDS: readonly BomImportField[] = [
  'quantity_per',
  'scrap_percentage',
  'yield_percentage',
  'fixed_scrap_quantity',
];

/** Normalises a number written with a decimal comma or thousands separators: "1.234,5" and "1,5" become "1234.5" and "1.5". */
export function normalizeDecimal(value: string): string {
  const trimmed = value.trim().replace(/\s/g, '');
  if (trimmed.includes(',') && trimmed.includes('.')) {
    return trimmed.lastIndexOf(',') > trimmed.lastIndexOf('.')
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed.replace(/,/g, '');
  }

  return trimmed.replace(',', '.');
}

/** Builds the rows of the import payload from the matrix (without the header row) and the column mapping. Empty rows are skipped. */
export function mapRows(matrix: string[][], mapping: Record<BomImportField, number | null>): BomImportRow[] {
  const rows: BomImportRow[] = [];

  for (const cells of matrix) {
    const row: Record<string, string> = {};
    for (const field of BOM_IMPORT_FIELDS) {
      const index = mapping[field];
      const raw = index === null ? '' : (cells[index] ?? '').trim();
      if (raw !== '') {
        row[field] = NUMERIC_FIELDS.includes(field) ? normalizeDecimal(raw) : raw;
      }
    }
    if (Object.keys(row).length > 0) {
      rows.push({ item_code: '', quantity_per: '', ...row });
    }
  }

  return rows;
}

// --- Diff ---

export interface DiffRow {
  kind: 'added' | 'removed' | 'modified';
  code: string;
  field: string | null;
  from: string | null;
  to: string | null;
}

const display = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

/** Flat rows of a BOM diff for the viewer: one row per added or removed line, one per changed field of a modified line. */
export function diffRows(diff: BomDiffResult | null | undefined): DiffRow[] {
  if (!diff) {
    return [];
  }
  const code = (entry: { item_code?: string; component_item_id?: string }): string =>
    entry.item_code ?? entry.component_item_id ?? '';
  const rows: DiffRow[] = [];

  for (const entry of diff.added ?? []) {
    rows.push({ kind: 'added', code: code(entry), field: null, from: null, to: display(entry['quantity_per']) });
  }
  for (const entry of diff.removed ?? []) {
    rows.push({ kind: 'removed', code: code(entry), field: null, from: display(entry['quantity_per']), to: null });
  }
  for (const entry of diff.modified ?? []) {
    for (const [field, change] of Object.entries(entry.changes ?? {})) {
      rows.push({ kind: 'modified', code: code(entry), field, from: display(change.from), to: display(change.to) });
    }
  }

  return rows;
}
