import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  AccountingTemplate,
  AccountingTemplatePreview,
  GeneralLedgerPrimaNotaApiService,
  GlJournalEntry,
  LEDGER_BOOK_CODES,
  LEDGER_TYPE_BY_BOOK,
  LedgerBookCode,
} from '@core';
import { GlLookupStore } from '../shared/gl-lookup.store';
import {
  accountLabel,
  autofillRemainder,
  computeTotals,
  emptyLine,
  fromCents,
  isBalanced,
  isLineEmpty,
  otherBooks,
  PrimaNotaIssue,
  PrimaNotaLine,
  searchAccounts,
  todayIso,
  toLinePayloads,
  validateLines,
} from './prima-nota.util';

export interface TemplateValues {
  amount: string;
  taxRate: string;
  /** Parameter key -> account code or id. */
  accounts: Record<string, string>;
  costCenterId: string | null;
}

export interface PrimaNotaState {
  postingDate: string;
  description: string;
  ledger: LedgerBookCode;
  propagateTo: LedgerBookCode[];
  lines: PrimaNotaLine[];
  nextKey: number;
  templates: AccountingTemplate[];
  templateId: string | null;
  templateValues: TemplateValues;
  hydrating: boolean;
  submitting: boolean;
  lastPosted: GlJournalEntry | null;
  error: unknown;
}

export type SubmitOutcome =
  | { ok: true; entry: GlJournalEntry }
  | { ok: false; reason: 'blocked' | 'error'; issues: PrimaNotaIssue[] };

const MIN_LINES = 2;

function initialLines(): PrimaNotaLine[] {
  return Array.from({ length: MIN_LINES }, (_, index) => emptyLine(index + 1));
}

function initialState(): PrimaNotaState {
  return {
    postingDate: todayIso(),
    description: '',
    ledger: '01',
    propagateTo: [],
    lines: initialLines(),
    nextKey: MIN_LINES + 1,
    templates: [],
    templateId: null,
    templateValues: { amount: '', taxRate: '', accounts: {}, costCenterId: null },
    hydrating: false,
    submitting: false,
    lastPosted: null,
    error: null,
  };
}

/** State of the Prima Nota fast-entry workbench: the lines, the live balance, the books and the template hydration. */
export const PrimaNotaStore = signalStore(
  withState<PrimaNotaState>(initialState()),
  withComputed((store, lookups = inject(GlLookupStore)) => {
    const totals = computed(() => computeTotals(store.lines()));
    const issues = computed(() => validateLines(store.description(), store.lines()));
    return {
      totals,
      issues,
      balanced: computed(() => isBalanced(totals())),
      /** Programmatic block: false whenever the entry is unbalanced or incomplete. */
      canSubmit: computed(() => issues().length === 0 && !store.submitting() && !store.hydrating()),
      differenceLabel: computed(() => fromCents(Math.abs(totals().differenceCents))),
      otherBooks: computed(() => otherBooks(store.ledger())),
      postableAccounts: computed(() =>
        lookups.accounts().filter((account) => account.is_active && account.allows_manual_posting),
      ),
      selectedTemplate: computed(
        () => store.templates().find((template) => template.id === store.templateId()) ?? null,
      ),
    };
  }),
  withMethods(
    (store, api = inject(GeneralLedgerPrimaNotaApiService), lookups = inject(GlLookupStore)) => {
      const resetLines = (): Pick<PrimaNotaState, 'lines' | 'nextKey'> => ({
        lines: initialLines(),
        nextKey: MIN_LINES + 1,
      });

      const accountOptions = (query: string) => searchAccounts(store.postableAccounts(), query);

      return {
        accountOptions,

        setPostingDate(postingDate: string): void {
          patchState(store, { postingDate });
        },

        setDescription(description: string): void {
          patchState(store, { description });
        },

        setLedger(ledger: LedgerBookCode): void {
          patchState(store, {
            ledger,
            propagateTo: store.propagateTo().filter((code) => code !== ledger),
          });
        },

        cycleLedger(): void {
          const index = LEDGER_BOOK_CODES.indexOf(store.ledger());
          const ledger = LEDGER_BOOK_CODES[(index + 1) % LEDGER_BOOK_CODES.length];
          patchState(store, {
            ledger,
            propagateTo: store.propagateTo().filter((code) => code !== ledger),
          });
        },

        togglePropagation(code: LedgerBookCode, enabled: boolean): void {
          if (code === store.ledger()) {
            return;
          }
          const current = store.propagateTo().filter((book) => book !== code);
          patchState(store, { propagateTo: enabled ? [...current, code] : current });
        },

        addLine(): number {
          const key = store.nextKey();
          patchState(store, { lines: [...store.lines(), emptyLine(key)], nextKey: key + 1 });
          return key;
        },

        removeLine(key: number): void {
          const remaining = store.lines().filter((line) => line.key !== key);
          if (remaining.length < MIN_LINES) {
            const nextKey = store.nextKey();
            remaining.push(emptyLine(nextKey));
            patchState(store, { lines: remaining, nextKey: nextKey + 1 });
            return;
          }
          patchState(store, { lines: remaining });
        },

        updateLine(key: number, changes: Partial<Omit<PrimaNotaLine, 'key'>>): void {
          patchState(store, {
            lines: store.lines().map((line) => (line.key === key ? { ...line, ...changes } : line)),
          });
        },

        /** Picks an account from the autocomplete (by id). */
        selectAccount(key: number, accountId: string): void {
          const account = lookups.accounts().find((candidate) => candidate.id === accountId);
          patchState(store, {
            lines: store
              .lines()
              .map((line) =>
                line.key === key
                  ? {
                      ...line,
                      accountId: account?.id ?? null,
                      accountQuery: account ? accountLabel(account) : line.accountQuery,
                    }
                  : line,
              ),
          });
        },

        /** Typed text: an exact, unique account code selects the account, anything else clears the selection. */
        setAccountQuery(key: number, query: string): void {
          const typed = query.trim();
          const exact = typed
            ? store.postableAccounts().filter((account) => account.account_code === typed)
            : [];
          const account = exact.length === 1 ? exact[0] : null;
          patchState(store, {
            lines: store
              .lines()
              .map((line) =>
                line.key === key
                  ? { ...line, accountQuery: query, accountId: account?.id ?? null }
                  : line,
              ),
          });
        },

        /** Autofill: puts the remainder on the given line (or the last empty one) so Dare equals Avere. */
        autofill(targetKey: number | null = null): void {
          const lines = autofillRemainder(store.lines(), targetKey, store.nextKey());
          patchState(store, {
            lines,
            nextKey: Math.max(store.nextKey(), ...lines.map((line) => line.key + 1)),
          });
        },

        reset(): void {
          const state = initialState();
          patchState(store, {
            description: '',
            postingDate: state.postingDate,
            propagateTo: [],
            templateId: null,
            templateValues: state.templateValues,
            error: null,
            ...resetLines(),
          });
        },

        async loadTemplates(): Promise<void> {
          try {
            const res = await firstValueFrom(api.getTemplates());
            patchState(store, { templates: res.data ?? [] });
          } catch (error) {
            patchState(store, { error });
          }
        },

        selectTemplate(templateId: string | null): void {
          patchState(store, {
            templateId,
            templateValues: { amount: '', taxRate: '', accounts: {}, costCenterId: null },
          });
        },

        setTemplateValue(changes: Partial<Omit<TemplateValues, 'accounts'>>): void {
          patchState(store, { templateValues: { ...store.templateValues(), ...changes } });
        },

        setTemplateAccount(parameterKey: string, account: string): void {
          patchState(store, {
            templateValues: {
              ...store.templateValues(),
              accounts: { ...store.templateValues().accounts, [parameterKey]: account },
            },
          });
        },

        /** Guided hydration: the preview endpoint turns amount, rate and accounts into balanced lines. */
        async hydrateFromTemplate(): Promise<AccountingTemplatePreview | null> {
          const template = store.selectedTemplate();
          if (!template) {
            return null;
          }
          const values = store.templateValues();
          patchState(store, { hydrating: true, error: null });
          try {
            const res = await firstValueFrom(
              api.previewTemplate(template.id, {
                amount: values.amount,
                tax_rate: values.taxRate === '' ? null : values.taxRate,
                accounts: values.accounts,
                cost_center_id: values.costCenterId,
              }),
            );
            const preview = res.data;
            let key = store.nextKey();
            const lines: PrimaNotaLine[] = preview.lines.map((line) => ({
              key: key++,
              accountId: line.account_id,
              accountQuery: accountLabel({
                account_code: line.account_code,
                name: line.account_name ?? '',
              }),
              description: line.description ?? '',
              debit:
                Number(line.debit_amount) > 0
                  ? fromCents(Math.round(Number(line.debit_amount) * 100))
                  : '',
              credit:
                Number(line.credit_amount) > 0
                  ? fromCents(Math.round(Number(line.credit_amount) * 100))
                  : '',
              costCenterId: line.cost_center_id,
              competenceStartDate: null,
              competenceEndDate: null,
            }));
            patchState(store, {
              hydrating: false,
              lines,
              nextKey: key,
              description: store.description().trim() ? store.description() : template.name,
              ledger: template.ledger_type
                ? (LEDGER_BOOK_CODES.find(
                    (code) => LEDGER_TYPE_BY_BOOK[code] === template.ledger_type,
                  ) ?? store.ledger())
                : store.ledger(),
            });
            return preview;
          } catch (error) {
            patchState(store, { hydrating: false, error });
            return null;
          }
        },

        /** Saves the entry as draft or posts it. Unbalanced or incomplete entries never reach the API. */
        async submit(status: 'draft' | 'posted'): Promise<SubmitOutcome> {
          const issues = store.issues();
          if (issues.length > 0 || store.submitting()) {
            return { ok: false, reason: 'blocked', issues };
          }
          patchState(store, { submitting: true, error: null });
          try {
            const res = await firstValueFrom(
              api.createJournal({
                posting_date: store.postingDate(),
                description: store.description().trim(),
                ledger_type: LEDGER_TYPE_BY_BOOK[store.ledger()],
                post_to_ledgers: store.propagateTo().length > 0 ? store.propagateTo() : undefined,
                status,
                lines: toLinePayloads(store.lines().filter((line) => !isLineEmpty(line))),
              }),
            );
            patchState(store, { submitting: false, lastPosted: res.data });
            return { ok: true, entry: res.data };
          } catch (error) {
            patchState(store, { submitting: false, error });
            return { ok: false, reason: 'error', issues: [] };
          }
        },
      };
    },
  ),
);
