import { computed, inject } from '@angular/core';
import { InvoiceMatchingApiService } from '@data-access/procurement/invoice-matching-api.service';
import {
  InvoiceMatchToleranceRule,
  TOLERANCE_PRECEDENCE,
  ToleranceRulePayload,
} from '@domain/procurement/invoice-matching.models';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom, Observable } from 'rxjs';
import { extractApiErrorMessage } from '../requisitions/pr-status.helpers';
import { MatchingOutcome } from './invoice-matching.store';

export interface ToleranceRulesState {
  rules: InvoiceMatchToleranceRule[];
  loading: boolean;
  busy: boolean;
  failed: boolean;
  error: string | null;
}

const initialState: ToleranceRulesState = {
  rules: [],
  loading: false,
  busy: false,
  failed: false,
  error: null,
};

/** Rules sorted the way the engine applies them: most specific scope first, then the higher priority. */
export function sortByPrecedence(rules: InvoiceMatchToleranceRule[]): InvoiceMatchToleranceRule[] {
  return [...rules].sort(
    (a, b) =>
      TOLERANCE_PRECEDENCE.indexOf(a.scope) - TOLERANCE_PRECEDENCE.indexOf(b.scope) ||
      b.priority - a.priority,
  );
}

/** Signal store of the tolerance rules management page. */
export const ToleranceRulesStore = signalStore(
  withState(initialState),
  withComputed(({ rules }) => ({
    ordered: computed(() => sortByPrecedence(rules())),
  })),
  withMethods((store, api = inject(InvoiceMatchingApiService)) => {
    const mutate = async <T>(
      call: Observable<T>,
      onSuccess: (result: T) => void,
    ): Promise<MatchingOutcome<T>> => {
      patchState(store, { busy: true });
      try {
        const result = await firstValueFrom(call);
        onSuccess(result);
        patchState(store, { busy: false });
        return { ok: true, forbidden: false, message: null, result };
      } catch (error) {
        patchState(store, { busy: false });
        return {
          ok: false,
          forbidden: false,
          message: extractApiErrorMessage(error) || null,
          result: null,
        };
      }
    };

    return {
      async load(): Promise<void> {
        patchState(store, { loading: true, failed: false, error: null });
        try {
          patchState(store, { rules: await firstValueFrom(api.listRules()), loading: false });
        } catch (error) {
          patchState(store, {
            loading: false,
            failed: true,
            error: extractApiErrorMessage(error) || null,
          });
        }
      },

      create(payload: ToleranceRulePayload): Promise<MatchingOutcome<InvoiceMatchToleranceRule>> {
        return mutate(api.createRule(payload), (rule) =>
          patchState(store, { rules: [...store.rules(), rule] }),
        );
      },

      update(
        id: string,
        payload: ToleranceRulePayload,
      ): Promise<MatchingOutcome<InvoiceMatchToleranceRule>> {
        return mutate(api.updateRule(id, payload), (rule) =>
          patchState(store, { rules: store.rules().map((row) => (row.id === id ? rule : row)) }),
        );
      },

      remove(id: string): Promise<MatchingOutcome<void>> {
        return mutate(api.deleteRule(id), () =>
          patchState(store, { rules: store.rules().filter((row) => row.id !== id) }),
        );
      },
    };
  }),
);
