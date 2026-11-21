import { computed, inject, Service, signal } from '@angular/core';
import {
  BomImplosion,
  BomImplosionParent,
  BomMassReplacePayload,
  BomMassReplaceResult,
  ManufacturingApiService,
} from '@core';
import { finalize, Observable, tap } from 'rxjs';

export interface MassReplaceInput {
  substituteItemId: string;
  reason: string;
  effectiveFrom: string | null;
}

/**
 * State of the where-used impact analyzer: the upward tree of the parents of an item and the mass replace of that item with a
 * substitute. A replace can only be run after a dry run of the very same inputs: changing any input invalidates the dry run.
 */
@Service()
export class WhereUsedStore {
  private readonly api = inject(ManufacturingApiService);

  readonly itemId = signal<string | null>(null);
  readonly implosion = signal<BomImplosion | null>(null);
  readonly loading = signal(false);
  readonly dryRun = signal<BomMassReplaceResult | null>(null);
  readonly result = signal<BomMassReplaceResult | null>(null);
  readonly replacing = signal(false);
  private readonly dryRunInput = signal<string | null>(null);
  private readonly currentInput = signal<MassReplaceInput>({ substituteItemId: '', reason: '', effectiveFrom: null });

  readonly parents = computed<BomImplosionParent[]>(() => this.implosion()?.parents ?? []);
  readonly topLevel = computed(() => this.parents().filter((parent) => parent.is_top_level));
  readonly maxLevel = computed(() => Math.max(0, ...this.parents().map((parent) => parent.level)));
  /** `true` when the dry run on screen was made with the inputs now in the form. */
  readonly dryRunCurrent = computed(
    () => this.dryRun() !== null && this.dryRunInput() === this.key(this.currentInput()),
  );
  readonly canRun = computed(() => this.dryRunCurrent() && (this.dryRun()?.replaced.length ?? 0) > 0 && !this.replacing());

  search(itemId: string, date?: string): Observable<unknown> {
    this.itemId.set(itemId);
    this.dryRun.set(null);
    this.result.set(null);
    this.loading.set(true);

    return this.api.getItemImplosion(itemId, date).pipe(
      tap((res) => this.implosion.set(res.data)),
      finalize(() => this.loading.set(false)),
    );
  }

  /** Keeps the store informed of the form so a stale dry run is recognised. */
  setInput(input: MassReplaceInput): void {
    this.currentInput.set(input);
  }

  runDry(input: MassReplaceInput): Observable<unknown> {
    this.setInput(input);
    this.replacing.set(true);
    this.result.set(null);

    return this.api.massReplaceComponent(this.payload(input, true)).pipe(
      tap((res) => {
        this.dryRun.set(res.data);
        this.dryRunInput.set(this.key(input));
      }),
      finalize(() => this.replacing.set(false)),
    );
  }

  run(input: MassReplaceInput): Observable<unknown> {
    this.setInput(input);
    this.replacing.set(true);

    return this.api.massReplaceComponent(this.payload(input, false)).pipe(
      tap((res) => {
        this.result.set(res.data);
        this.dryRun.set(null);
        this.dryRunInput.set(null);
      }),
      finalize(() => this.replacing.set(false)),
    );
  }

  private payload(input: MassReplaceInput, dryRun: boolean): BomMassReplacePayload {
    const obsolete = this.itemId();
    if (obsolete === null) {
      throw new Error('No item selected');
    }

    return {
      obsolete_item_id: obsolete,
      substitute_item_id: input.substituteItemId,
      reason: input.reason,
      effective_from: input.effectiveFrom,
      dry_run: dryRun,
    };
  }

  private key(input: MassReplaceInput): string {
    return JSON.stringify([this.itemId(), input.substituteItemId, input.reason, input.effectiveFrom]);
  }
}
