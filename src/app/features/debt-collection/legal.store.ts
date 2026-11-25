import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  DcDossier,
  DcEnforcementOffice,
  DcLocale,
  DcNotice,
  DcProposalItem,
  DebtCollectionApiService,
} from '@core';
import { downloadBlob } from '@shared';
import { DC_OK, DcOutcome, failureOf, todayIso } from './debt-collection.util';

export interface LegalState {
  customerId: string | null;
  /** Open overdue items of the customer, the candidates of a dossier or a messa in mora. */
  items: DcProposalItem[];
  selected: string[];
  loadingItems: boolean;
  dossiers: DcDossier[];
  offices: DcEnforcementOffice[];
  /** Messa in mora notices (IT) with their PEC receipts. */
  messe: DcNotice[];
  loading: boolean;
  saving: boolean;
  busyId: string | null;
  error: string | null;
}

const initialState: LegalState = {
  customerId: null,
  items: [],
  selected: [],
  loadingItems: false,
  dossiers: [],
  offices: [],
  messe: [],
  loading: false,
  saving: false,
  busyId: null,
  error: null,
};

/** Legal escalation: Betreibung dossiers (CH) and the messa in mora by PEC (IT, D.Lgs. 231/2002). */
export const LegalStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(DebtCollectionApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const [dossiers, offices, messe] = await Promise.all([
          firstValueFrom(api.listDossiers()),
          firstValueFrom(api.listEnforcementOffices()),
          firstValueFrom(api.listNotices({ kind: 'messa_in_mora' })),
        ]);
        patchState(store, {
          dossiers: dossiers.data,
          offices: offices.data,
          messe: messe.data,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
      }
    };

    const run = async (id: string | null, work: () => Promise<void>): Promise<DcOutcome> => {
      patchState(store, { busyId: id });
      try {
        await work();
        patchState(store, { busyId: null });
        return DC_OK;
      } catch (error) {
        patchState(store, { busyId: null });
        return failureOf(error);
      }
    };

    return {
      load,
      async selectCustomer(customerId: string | null): Promise<void> {
        patchState(store, { customerId, items: [], selected: [] });
        if (!customerId) {
          return;
        }
        patchState(store, { loadingItems: true });
        try {
          const response = await firstValueFrom(
            api.listProposals({ customer_id: customerId, as_of: todayIso(), include_excluded: 0 }),
          );
          patchState(store, { items: response.data.items, loadingItems: false });
        } catch (error) {
          patchState(store, { loadingItems: false, error: (await failureOf(error)).errorKey });
        }
      },
      toggleItem(id: string, checked: boolean): void {
        const without = store.selected().filter((value) => value !== id);
        patchState(store, { selected: checked ? [...without, id] : without });
      },
      async createDossier(officeId: string | null, locale: DcLocale | null): Promise<DcOutcome> {
        patchState(store, { saving: true });
        try {
          await firstValueFrom(
            api.createDossier({
              customer_id: store.customerId() ?? '',
              receivable_item_ids: store.selected(),
              ...(officeId ? { office_id: officeId } : {}),
              ...(locale ? { locale } : {}),
            }),
          );
          patchState(store, { saving: false, selected: [] });
          await load();
          return DC_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      downloadDossierPdf(dossier: DcDossier): Promise<DcOutcome> {
        return run(dossier.id, async () =>
          downloadBlob(
            await firstValueFrom(api.downloadDossierPdf(dossier.id)),
            `${dossier.number}.pdf`,
          ),
        );
      },
      downloadDossierBundle(dossier: DcDossier): Promise<DcOutcome> {
        return run(dossier.id, async () =>
          downloadBlob(
            await firstValueFrom(api.downloadDossierBundle(dossier.id)),
            `${dossier.number}.zip`,
          ),
        );
      },
      async submitDossier(id: string): Promise<DcOutcome> {
        const outcome = await run(id, async () => {
          await firstValueFrom(api.submitDossier(id));
        });
        if (outcome.ok) {
          await load();
        }
        return outcome;
      },
      async createMessaInMora(sendPec: boolean, locale: DcLocale | null): Promise<DcOutcome> {
        patchState(store, { saving: true });
        try {
          await firstValueFrom(
            api.createMessaInMora({
              customer_id: store.customerId() ?? '',
              receivable_item_ids: store.selected(),
              send_pec: sendPec,
              ...(locale ? { locale } : {}),
            }),
          );
          patchState(store, { saving: false, selected: [] });
          await load();
          return DC_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
    };
  }),
);
