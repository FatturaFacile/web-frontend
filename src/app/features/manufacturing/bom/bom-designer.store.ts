import { computed, inject, Service, signal } from '@angular/core';
import { BomExplosion, BomPreferentialOrigin, BomRevisionResult, ManufacturingApiService } from '@core';
import { finalize, Observable, tap } from 'rxjs';
import {
  BomEditableValues,
  BomLineEdit,
  BomTreeNode,
  buildTree,
  editsToChanges,
  expandableKeys,
  flattenVisible,
  previewEffectiveQuantity,
  reorderSequences,
  rollupCost,
  toNumber,
} from './bom.utils';

export type BomEditableField = 'quantity_per' | 'scrap_percentage' | 'yield_percentage' | 'fixed_scrap_quantity';

interface PendingEdit {
  itemId: string;
  edit: BomLineEdit;
}

/**
 * State of the BOM tree designer: the explosion of one BOM as a tree, the nodes that are expanded, the inline edits that are
 * not saved yet and the EUR.1 result. Edits only live here until `saveRevision` sends them as an engineering change, so the
 * active BOM is never changed in place. Every action returns its observable, already wired to the signals.
 */
@Service()
export class BomDesignerStore {
  private readonly api = inject(ManufacturingApiService);

  readonly bomId = signal<string | null>(null);
  readonly quantity = signal(1);
  readonly explosion = signal<BomExplosion | null>(null);
  readonly expanded = signal<ReadonlySet<string>>(new Set());
  readonly pending = signal<ReadonlyMap<string, PendingEdit>>(new Map());
  /** Sequence order chosen by the user for the direct components, as node keys. */
  readonly order = signal<string[] | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly origin = signal<BomPreferentialOrigin | null>(null);
  readonly originLoading = signal(false);

  readonly tree = computed<BomTreeNode[]>(() => buildTree(this.explosion()?.lines ?? []));
  readonly rows = computed(() => this.orderedVisible());
  readonly hasPending = computed(() => this.pending().size > 0 || this.order() !== null);
  readonly leadTimeDays = computed(() => this.explosion()?.total_lead_time_days ?? 0);
  readonly totalCost = computed(() =>
    this.tree().reduce((sum, node) => sum + this.costOf(node), 0),
  );

  /** Effective quantity of a line, with the pending edit of that line applied (the one inline editing shows). */
  effectiveOf(node: BomTreeNode): number {
    const edit = this.pending().get(node.key)?.edit;
    if (node.children.length > 0 || !edit || edit.sequence !== undefined && Object.keys(edit).length === 1) {
      return toNumber(node.line.effective_quantity);
    }

    return previewEffectiveQuantity(this.valuesOf(node));
  }

  /** Cost of a node: leaves use the live preview of their edits, assemblies the sum of their children. */
  costOf(node: BomTreeNode): number {
    return rollupCost(node, (n) => this.effectiveOf(n));
  }

  valuesOf(node: BomTreeNode): BomEditableValues {
    const edit = this.pending().get(node.key)?.edit ?? {};
    const line = node.line;
    const netBase = toNumber(line.net_quantity);
    // Without edits the figures of the API are authoritative: derive the percentages that explain them.
    const scrap = edit.scrap_percentage !== undefined
      ? toNumber(edit.scrap_percentage)
      : netBase > 0 ? (toNumber(line.variable_waste_quantity) / netBase) * 100 : 0;

    return {
      net_quantity: edit.quantity_per !== undefined ? toNumber(edit.quantity_per) * this.quantity() : netBase,
      scrap_percentage: scrap,
      yield_percentage: edit.yield_percentage !== undefined ? toNumber(edit.yield_percentage) : 100,
      fixed_waste_quantity:
        edit.fixed_scrap_quantity !== undefined ? toNumber(edit.fixed_scrap_quantity) : toNumber(line.fixed_waste_quantity),
    };
  }

  load(bomId: string, quantity = this.quantity(), date?: string): Observable<unknown> {
    this.bomId.set(bomId);
    this.quantity.set(quantity);
    this.loading.set(true);

    return this.api
      .getBomExplosion(bomId, { quantity, date, multi_level: true, flatten_phantoms: false })
      .pipe(
        tap((res) => {
          this.explosion.set(res.data);
          this.pending.set(new Map());
          this.order.set(null);
          this.expanded.set(new Set(expandableKeys(buildTree(res.data.lines))));
        }),
        finalize(() => this.loading.set(false)),
      );
  }

  toggle(key: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }

      return next;
    });
  }

  expandAll(): void {
    this.expanded.set(new Set(expandableKeys(this.tree())));
  }

  collapseAll(): void {
    this.expanded.set(new Set());
  }

  /** Only the direct components (the first level) can be edited: they are the lines of this BOM. */
  isEditable(node: BomTreeNode): boolean {
    const base = Math.min(...(this.explosion()?.lines.map((line) => line.level) ?? [0]));

    return node.line.level === base && !!(node.line.item_id ?? node.line.component_id);
  }

  edit(node: BomTreeNode, field: BomEditableField, value: string): void {
    const itemId = node.line.item_id ?? node.line.component_id;
    if (!itemId) {
      return;
    }
    this.pending.update((current) => {
      const next = new Map(current);
      const existing = next.get(node.key)?.edit ?? {};
      next.set(node.key, { itemId, edit: { ...existing, [field]: value.trim() } });

      return next;
    });
  }

  discardEdits(): void {
    this.pending.set(new Map());
    this.order.set(null);
  }

  /** Moves a direct component up (-1) or down (+1) among its siblings. */
  move(node: BomTreeNode, offset: -1 | 1): void {
    const roots = this.orderedRoots();
    const from = roots.findIndex((root) => root.key === node.key);
    if (from === -1) {
      return;
    }
    const to = from + offset;
    if (to < 0 || to >= roots.length) {
      return;
    }
    const reordered = reorderSequences(roots, from, to);
    this.order.set(reordered.map((item) => item.key));
    for (const item of reordered) {
      this.setSequence(item, item.sequence);
    }
  }

  /** Sends the pending edits as an engineering change on top of the BOM. */
  saveRevision(reason: string): Observable<BomRevisionResult> {
    const bomId = this.bomId();
    if (bomId === null) {
      throw new Error('No BOM loaded');
    }
    this.saving.set(true);

    return this.api
      .createBomRevision({ source_bom_id: bomId, reason, components: editsToChanges(this.pending()) })
      .pipe(
        tap(() => {
          this.pending.set(new Map());
          this.order.set(null);
        }),
        finalize(() => this.saving.set(false)),
      );
  }

  loadOrigin(thresholdPercentage?: number): Observable<unknown> {
    const bomId = this.bomId();
    if (bomId === null) {
      throw new Error('No BOM loaded');
    }
    this.originLoading.set(true);

    return this.api.getBomPreferentialOrigin(bomId, thresholdPercentage).pipe(
      tap((res) => this.origin.set(res.data)),
      finalize(() => this.originLoading.set(false)),
    );
  }

  private orderedRoots(): BomTreeNode[] {
    const roots = this.tree();
    const order = this.order();
    if (order === null) {
      return roots;
    }
    const byKey = new Map(roots.map((root) => [root.key, root]));

    return order.flatMap((key) => byKey.get(key) ?? []);
  }

  private orderedVisible(): BomTreeNode[] {
    const roots = this.orderedRoots();

    return flattenVisible(roots, this.expanded());
  }

  private setSequence(item: { key: string }, sequence: number): void {
    const node = this.tree().find((root) => root.key === item.key);
    const itemId = node?.line.item_id ?? node?.line.component_id;
    if (!node || !itemId) {
      return;
    }
    this.pending.update((current) => {
      const next = new Map(current);
      const existing = next.get(node.key)?.edit ?? {};
      next.set(node.key, { itemId, edit: { ...existing, sequence } });

      return next;
    });
  }
}
