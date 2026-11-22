import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ArCreditLimit,
  ArCreditLimitPayload,
  ArCreditLimitUpdate,
  ArCreditPosition,
  ArDso,
  ArOverride,
  ArOverridePayload,
  ArProvision,
  ArProvisionRates,
  ArRisk,
  ReceivablesApiService,
} from '@core';
import {
  AR_OK,
  arFailure,
  ArOutcome,
  apiErrorMessage,
  utilizationStatus,
  utilizationValue,
} from './receivables.util';

export interface CreditPositionState {
  customerId: string | null;
  credit: ArCreditPosition | null;
  risk: ArRisk | null;
  /** Limit history, newest first. */
  limits: ArCreditLimit[];
  provision: ArProvision | null;
  dso: ArDso | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: CreditPositionState = {
  customerId: null,
  credit: null,
  risk: null,
  limits: [],
  provision: null,
  dso: null,
  loading: false,
  saving: false,
  error: null,
};

/** Credit position of one customer: limit, exposure, risk, blocks and overrides, limit history, provision rates. */
export const CreditPositionStore = signalStore(
  withState(initialState),
  withComputed(({ credit, limits }) => ({
    limit: computed(() => credit()?.limit ?? null),
    exposure: computed(() => credit()?.exposure ?? null),
    utilization: computed(() => utilizationValue(credit()?.utilization_percent)),
    utilizationStatus: computed(() => utilizationStatus(utilizationValue(credit()?.utilization_percent))),
    /** Overrides in force (the API lists the active ones; revoked ones are dropped to be safe). */
    activeOverrides: computed<ArOverride[]>(() =>
      (credit()?.overrides ?? []).filter((override) => override.revoked_at === null),
    ),
    /** Why the customer is blocked or warned: the breaches of the credit decision. */
    breaches: computed(() => credit()?.decision.breaches ?? []),
    isBlocked: computed(() => credit()?.is_blocked ?? false),
    isCreditHold: computed(() => credit()?.is_credit_hold ?? false),
    outcome: computed(() => credit()?.decision.outcome ?? 'ok'),
    /** Limits other than the one in force. */
    history: computed(() => {
      const current = credit()?.limit?.id;
      return limits().filter((row) => row.id !== current);
    }),
    hasData: computed(() => credit() !== null),
  })),
  withMethods((store, api = inject(ReceivablesApiService)) => {
    let sequence = 0;

    const loadCore = async (customerId: string): Promise<void> => {
      const [credit, risk, limits] = await Promise.all([
        firstValueFrom(api.getCredit(customerId)),
        firstValueFrom(api.getRisk(customerId)),
        firstValueFrom(api.getCreditLimits(customerId)),
      ]);
      patchState(store, { credit: credit.data, risk: risk.data, limits: limits.data });
    };

    /** The provision and the DSO are side figures: when they fail the rest of the page stays usable. */
    const loadSide = async (customerId: string): Promise<void> => {
      const [provision, dso] = await Promise.allSettled([
        firstValueFrom(api.getProvision(customerId)),
        firstValueFrom(api.getDso(customerId)),
      ]);
      patchState(store, {
        provision: provision.status === 'fulfilled' ? provision.value.data : null,
        dso: dso.status === 'fulfilled' ? dso.value.data : null,
      });
    };

    const run = async (work: () => Promise<void>): Promise<ArOutcome> => {
      patchState(store, { saving: true });
      try {
        await work();
        patchState(store, { saving: false });
        return AR_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return arFailure(error);
      }
    };

    const reloadCore = async (): Promise<void> => {
      const customerId = store.customerId();
      if (customerId) {
        await loadCore(customerId);
      }
    };

    return {
      async load(customerId: string): Promise<void> {
        const ticket = ++sequence;
        patchState(store, { ...initialState, customerId, loading: true });
        try {
          await loadCore(customerId);
          if (ticket !== sequence) {
            return;
          }
          await loadSide(customerId);
          if (ticket === sequence) {
            patchState(store, { loading: false });
          }
        } catch (error) {
          if (ticket === sequence) {
            patchState(store, { loading: false, error: apiErrorMessage(error) ?? 'AR.LOAD_ERROR' });
          }
        }
      },

      /** Creates a limit (no id) or updates the given one. */
      saveLimit: (
        id: string | null,
        payload: ArCreditLimitPayload | ArCreditLimitUpdate,
      ): Promise<ArOutcome> =>
        run(async () => {
          if (id) {
            await firstValueFrom(api.updateCreditLimit(id, payload));
          } else {
            await firstValueFrom(api.createCreditLimit(payload as ArCreditLimitPayload));
          }
          await reloadCore();
        }),

      deleteLimit: (id: string): Promise<ArOutcome> =>
        run(async () => {
          await firstValueFrom(api.deleteCreditLimit(id));
          await reloadCore();
        }),

      grantOverride: (payload: ArOverridePayload): Promise<ArOutcome> =>
        run(async () => {
          const customerId = store.customerId();
          if (customerId) {
            await firstValueFrom(api.grantOverride(customerId, payload));
          }
          await reloadCore();
        }),

      revokeOverride: (id: string, reason?: string): Promise<ArOutcome> =>
        run(async () => {
          await firstValueFrom(api.revokeOverride(id, reason));
          await reloadCore();
        }),

      /** Saves the tenant rates of the provision (percent by bucket key) and re-reads the provision. */
      saveProvisionRates: (rates: ArProvisionRates): Promise<ArOutcome> =>
        run(async () => {
          await firstValueFrom(api.saveProvisionRates(rates));
          const customerId = store.customerId();
          if (customerId) {
            const provision = await firstValueFrom(api.getProvision(customerId));
            patchState(store, { provision: provision.data });
          }
        }),
    };
  }),
);
