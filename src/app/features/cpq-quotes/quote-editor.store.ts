import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { CpqQuotesApiService } from './cpq-quotes-api.service';
import {
  EDITABLE_STATUSES,
  EditorHeader,
  EditorLine,
  EditorSection,
  IssueResult,
  NEW_REVISION_STATUSES,
  QuoteDetail,
  QuoteLineType,
  QuoteStatus,
} from './cpq-quotes.models';
import {
  defaultHeader,
  emptyLine,
  emptySection,
  fromDetail,
  moveLine,
  moveSection,
  priceQuote,
  toPayload,
} from './cpq-quotes.utils';

/**
 * State of the quote editor. Every keystroke updates a signal and the totals, section subtotals and margin are computed
 * signals, so they follow the typing; saving sends the whole structure and the server prices it again (it stays the authority).
 */
@Injectable()
export class QuoteEditorStore {
  private readonly api = inject(CpqQuotesApiService);

  readonly quote = signal<QuoteDetail | null>(null);
  readonly header = signal<EditorHeader>(defaultHeader());
  readonly sections = signal<EditorSection[]>([]);
  readonly lines = signal<EditorLine[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly dirty = signal(false);
  readonly error = signal<string | null>(null);
  readonly issued = signal<IssueResult | null>(null);

  readonly status = computed<QuoteStatus>(() => this.quote()?.status ?? 'draft');
  readonly editable = computed(() => EDITABLE_STATUSES.includes(this.status()));
  readonly canRevise = computed(() => NEW_REVISION_STATUSES.includes(this.status()));
  readonly canConvert = computed(() => this.status() === 'accepted');
  readonly totals = computed(() => priceQuote(this.sections(), this.lines(), this.header()));
  readonly belowMarginGuardrail = computed(() => {
    const threshold = this.header().min_margin_percent;
    const percent = this.totals().marginPercent;
    return threshold !== null && percent !== null && percent < threshold;
  });

  linesOf(sectionKey: string | null): EditorLine[] {
    return this.lines().filter((l) => l.sectionKey === sectionKey);
  }

  load(id: string): void {
    this.loading.set(true);
    this.api.get(id).subscribe({
      next: (res) => {
        this.apply(res.data);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => this.fail(e, true),
    });
  }

  startNew(): void {
    this.quote.set(null);
    this.header.set(defaultHeader());
    const section = emptySection();
    this.sections.set([section]);
    this.lines.set([]);
    this.dirty.set(false);
  }

  patchHeader(patch: Partial<EditorHeader>): void {
    this.header.update((h) => ({ ...h, ...patch }));
    this.touch();
  }

  addSection(title = ''): string {
    const section = emptySection(title);
    this.sections.update((s) => [...s, section]);
    this.touch();
    return section.key;
  }

  patchSection(key: string, patch: Partial<EditorSection>): void {
    this.sections.update((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    this.touch();
  }

  removeSection(key: string): void {
    this.sections.update((all) => all.filter((s) => s.key !== key));
    this.lines.update((all) => all.filter((l) => l.sectionKey !== key));
    this.touch();
  }

  addLine(type: QuoteLineType, sectionKey: string | null): void {
    this.lines.update((all) => [...all, emptyLine(type, sectionKey)]);
    this.touch();
  }

  patchLine(key: string, patch: Partial<EditorLine>): void {
    this.lines.update((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    this.touch();
  }

  /** Picks the line of an alternative group that is offered by default (the others of the group are turned off). */
  chooseDefaultAlternative(key: string): void {
    const group = this.lines().find((l) => l.key === key)?.alternative_group ?? null;
    this.lines.update((all) =>
      all.map((l) =>
        l.selection_mode === 'alternative_group' && l.alternative_group === group
          ? { ...l, is_default_selected: l.key === key }
          : l,
      ),
    );
    this.touch();
  }

  removeLine(key: string): void {
    this.lines.update((all) => all.filter((l) => l.key !== key));
    this.touch();
  }

  dropLine(key: string, toSection: string | null, toIndex: number): void {
    this.lines.update((all) => moveLine(all, key, toSection, toIndex));
    this.touch();
  }

  dropSection(from: number, to: number): void {
    this.sections.update((all) => moveSection(all, from, to));
    this.touch();
  }

  /** Creates the quote on the first save, updates the draft afterwards; the server answer replaces the editor state. */
  save(onSaved?: (quote: QuoteDetail) => void): void {
    if (!this.editable()) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const payload = toPayload(this.header(), this.sections(), this.lines());
    const current = this.quote();
    const request =
      current === null ? this.api.create(payload) : this.api.update(current.id, payload);

    request.subscribe({
      next: (res) => {
        this.apply(res.data);
        this.saving.set(false);
        onSaved?.(res.data);
      },
      error: (e: HttpErrorResponse) => this.fail(e),
    });
  }

  issue(options: { use_pin?: boolean; approve?: boolean } = {}): void {
    const current = this.quote();
    if (current === null || this.dirty()) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const call = options.approve
      ? this.api.approveAndIssue(current.id, { use_pin: options.use_pin })
      : this.api.issue(current.id, { use_pin: options.use_pin });
    call.subscribe({
      next: (res) => {
        this.issued.set(res.data);
        this.saving.set(false);
        this.load(current.id);
      },
      error: (e: HttpErrorResponse) => this.fail(e),
    });
  }

  createRevision(onCreated: (quote: QuoteDetail) => void): void {
    const current = this.quote();
    if (current === null) {
      return;
    }
    this.saving.set(true);
    this.api.createRevision(current.id).subscribe({
      next: (res) => {
        this.saving.set(false);
        onCreated(res.data);
      },
      error: (e: HttpErrorResponse) => this.fail(e),
    });
  }

  convert(
    target: 'order' | 'invoice',
    downPaymentPercent: number | undefined,
    onDone: () => void,
  ): void {
    const current = this.quote();
    if (current === null) {
      return;
    }
    this.saving.set(true);
    const call: Observable<unknown> =
      target === 'order'
        ? this.api.convertToOrder(current.id)
        : this.api.convertToInvoice(current.id, downPaymentPercent);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.load(current.id);
        onDone();
      },
      error: (e: HttpErrorResponse) => this.fail(e),
    });
  }

  private apply(quote: QuoteDetail): void {
    const state = fromDetail(quote);
    this.quote.set(quote);
    this.header.set(state.header);
    this.sections.set(state.sections);
    this.lines.set(state.lines);
    this.dirty.set(false);
  }

  private touch(): void {
    if (this.editable()) {
      this.dirty.set(true);
    }
  }

  private fail(error: HttpErrorResponse, stopLoading = false): void {
    this.saving.set(false);
    if (stopLoading) {
      this.loading.set(false);
    }
    const detail = (error.error as { detail?: string } | null)?.detail;
    this.error.set(detail ?? 'error');
  }
}
