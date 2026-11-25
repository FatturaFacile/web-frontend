import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  IlrArticleType,
  IlrCustomerRef,
  IlrGarment,
  IlrLockerGroup,
  IlrLockerPayload,
  IndustrialLaundryApiService,
} from '@core';
import { failureOf, ILR_OK, IlrOutcome } from './industrial-laundry.util';

export interface LockersState {
  groups: IlrLockerGroup[];
  candidates: IlrGarment[];
  customers: IlrCustomerRef[];
  nominalTypes: IlrArticleType[];
  customerId: string | null;
  search: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** Garment -> employee -> locker of the workwear customers. */
export const LockersStore = signalStore(
  withState<LockersState>({
    groups: [],
    candidates: [],
    customers: [],
    nominalTypes: ['personal_workwear_uniform', 'ppe_safety_garment'],
    customerId: null,
    search: '',
    loading: false,
    saving: false,
    error: null,
  }),
  withComputed(({ customers }) => ({
    customerName: computed(
      () =>
        (id: string): string =>
          customers().find((customer) => customer.id === id)?.name ?? '',
    ),
  })),
  withMethods((store, api = inject(IndustrialLaundryApiService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const [groups, garments] = await Promise.all([
          firstValueFrom(api.getLockers(store.customerId() ?? undefined, store.search() || undefined)),
          firstValueFrom(api.listGarments({ customer_id: store.customerId() ?? undefined, per_page: 100 })),
        ]);
        const nominal = store.nominalTypes();
        patchState(store, {
          groups: groups.data,
          candidates: garments.data.filter(
            (garment) =>
              nominal.includes(garment.article_type) &&
              garment.current_lifecycle_state !== 'condemned_rag' &&
              garment.assigned_wearer_employee_name === null,
          ),
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const write = async (call: () => Promise<unknown>): Promise<IlrOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        await load();
        return ILR_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      async init(): Promise<void> {
        const lookups = await firstValueFrom(api.getLookups()).catch(() => null);
        patchState(store, {
          customers: lookups?.data.customers ?? [],
          nominalTypes: lookups?.data.nominal_article_types ?? store.nominalTypes(),
        });
        await load();
      },
      setFilters(patch: { customerId?: string | null; search?: string }): Promise<void> {
        patchState(store, {
          customerId: patch.customerId === undefined ? store.customerId() : patch.customerId,
          search: patch.search ?? store.search(),
        });
        return load();
      },
      assign(garmentId: string, payload: IlrLockerPayload): Promise<IlrOutcome> {
        return write(() => firstValueFrom(api.assignLocker(garmentId, payload)));
      },
      release(garmentId: string): Promise<IlrOutcome> {
        return write(() =>
          firstValueFrom(api.assignLocker(garmentId, { employee_name: null, locker_code: null })),
        );
      },
    };
  }),
);
