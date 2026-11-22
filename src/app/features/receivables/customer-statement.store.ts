import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ArStatement,
  ArStatementLocale,
  ArStatementSendResult,
  ReceivablesApiService,
} from '@core';
import {
  AR_OK,
  arFailure,
  ArOutcome,
  apiErrorMessage,
  defaultStatementPeriod,
  statementFileName,
} from './receivables.util';

export type StatementFormat = 'pdf' | 'xlsx';

export interface CustomerStatementState {
  customerId: string | null;
  from: string;
  to: string;
  currency: string | null;
  statement: ArStatement | null;
  loading: boolean;
  /** The format being downloaded. */
  downloading: StatementFormat | null;
  sending: boolean;
  error: string | null;
}

const period = defaultStatementPeriod();

const initialState: CustomerStatementState = {
  customerId: null,
  from: period.from,
  to: period.to,
  currency: null,
  statement: null,
  loading: false,
  downloading: null,
  sending: false,
  error: null,
};

export interface StatementDownload extends ArOutcome {
  blob: Blob | null;
  filename: string;
}

/** The customer statement (Estratto Conto): preview of a period, file downloads and the send by e-mail. */
export const CustomerStatementStore = signalStore(
  withState(initialState),
  withComputed(({ statement, from, to }) => ({
    openItems: computed(() => statement()?.open_items ?? []),
    movements: computed(() => statement()?.movements ?? []),
    overdueItems: computed(() => (statement()?.open_items ?? []).filter((row) => row.is_overdue)),
    periodIsValid: computed(() => from() !== '' && to() !== '' && from() <= to()),
    /** The e-mail of the customer, the default recipient. */
    customerEmail: computed(() => statement()?.customer.email ?? null),
  })),
  withMethods((store, api = inject(ReceivablesApiService)) => {
    let sequence = 0;
    const query = () => ({
      from: store.from(),
      to: store.to(),
      ...(store.currency() ? { currency: store.currency() as string } : {}),
    });

    const load = async (): Promise<void> => {
      const customerId = store.customerId();
      if (!customerId || !store.periodIsValid()) {
        return;
      }
      const ticket = ++sequence;
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getStatement(customerId, query()));
        if (ticket === sequence) {
          patchState(store, { statement: response.data, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: apiErrorMessage(error) ?? 'AR.LOAD_ERROR' });
        }
      }
    };

    return {
      /** Opens the statement of a customer on the current period (or the given one). */
      open(customerId: string, from?: string, to?: string): Promise<void> {
        const changed = customerId !== store.customerId();
        patchState(store, {
          customerId,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(changed ? { statement: null, currency: null } : {}),
        });
        return load();
      },
      setPeriod(from: string, to: string): Promise<void> {
        patchState(store, { from, to });
        return load();
      },
      setCurrency(currency: string | null): Promise<void> {
        patchState(store, { currency });
        return load();
      },
      refresh: load,

      /** Fetches the statement file of the period; the screen hands the blob to the browser. */
      async download(format: StatementFormat): Promise<StatementDownload> {
        const customerId = store.customerId();
        const name = store.statement()?.customer.name ?? '';
        const filename = statementFileName(name, store.from(), store.to(), format);
        if (!customerId) {
          return { ok: false, message: null, errors: {}, blob: null, filename };
        }
        patchState(store, { downloading: format });
        try {
          const blob = await firstValueFrom(
            format === 'pdf'
              ? api.downloadStatementPdf(customerId, query())
              : api.downloadStatementXlsx(customerId, query()),
          );
          patchState(store, { downloading: null });
          return { ...AR_OK, blob, filename };
        } catch (error) {
          patchState(store, { downloading: null });
          return { ...arFailure(error), blob: null, filename };
        }
      },

      /** Queues the statement e-mail; without a recipient the API uses the e-mail of the customer. */
      async send(
        recipient: string | null,
        locale: ArStatementLocale,
      ): Promise<ArOutcome & { result: ArStatementSendResult | null }> {
        const customerId = store.customerId();
        if (!customerId) {
          return { ok: false, message: null, errors: {}, result: null };
        }
        patchState(store, { sending: true });
        try {
          const response = await firstValueFrom(
            api.sendStatement(customerId, {
              from: store.from(),
              to: store.to(),
              locale,
              ...(recipient && recipient.trim() ? { recipient: recipient.trim() } : {}),
            }),
          );
          patchState(store, { sending: false });
          return { ...AR_OK, result: response.data };
        } catch (error) {
          patchState(store, { sending: false });
          return { ...arFailure(error), result: null };
        }
      },
    };
  }),
);
