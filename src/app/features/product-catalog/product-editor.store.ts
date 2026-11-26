import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  PcAttribute,
  PcConversion,
  PcExplodedLine,
  PcKitLinePayload,
  PcLookups,
  PcMatrixPreview,
  PcMatrixRequest,
  PcMatrixResult,
  PcPackagingPayload,
  PcProduct,
  PcProductDetail,
  PcProductPayload,
  ProductCatalogApiService,
} from '@core';
import { cleanPayload, failureOf, PC_OK, PcOutcome } from './product-catalog.util';

export interface ProductEditorState {
  product: PcProductDetail | null;
  lookups: PcLookups | null;
  attributes: PcAttribute[];
  preview: PcMatrixPreview | null;
  generated: PcMatrixResult | null;
  explosion: PcExplodedLine[] | null;
  conversion: PcConversion | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** One product being edited: its detail, the lookups and attributes, and the matrix, kit, unit and classification writes. */
export const ProductEditorStore = signalStore(
  withState<ProductEditorState>({
    product: null,
    lookups: null,
    attributes: [],
    preview: null,
    generated: null,
    explosion: null,
    conversion: null,
    loading: false,
    saving: false,
    error: null,
  }),
  withComputed(({ product, lookups }) => ({
    isKit: computed(() => product()?.kit_type != null),
    isVariant: computed(() => product()?.is_variant === true),
    canHaveVariants: computed(() => {
      const current = product();
      return current !== null && !current.is_variant && current.kit_type === null;
    }),
    units: computed(() => lookups()?.units ?? []),
    vatCodesIt: computed(() =>
      (lookups()?.vat_codes ?? []).filter((code) => code.country === 'IT'),
    ),
    vatCodesCh: computed(() =>
      (lookups()?.vat_codes ?? []).filter((code) => code.country === 'CH'),
    ),
  })),
  withMethods((store, api = inject(ProductCatalogApiService)) => {
    const write = async <T>(
      call: () => Promise<T>,
      after: (result: T) => void,
    ): Promise<PcOutcome> => {
      patchState(store, { saving: true });
      try {
        after(await call());
        patchState(store, { saving: false });
        return PC_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    const reopen = async (id: string): Promise<void> => {
      const response = await firstValueFrom(api.getProduct(id));
      patchState(store, { product: response.data });
    };

    return {
      /** Loads the lookups and the attributes; when an id is given, the product too. */
      async open(id: string | null): Promise<void> {
        patchState(store, {
          loading: true,
          error: null,
          product: null,
          preview: null,
          generated: null,
          explosion: null,
          conversion: null,
        });
        try {
          const [lookups, attributes] = await Promise.all([
            firstValueFrom(api.getLookups()),
            firstValueFrom(api.listAttributes()),
          ]);
          patchState(store, { lookups: lookups.data, attributes: attributes.data });
          if (id !== null) {
            await reopen(id);
          }
          patchState(store, { loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },

      /** Creates the product (and opens it) or saves the changes of the open one. */
      async save(payload: PcProductPayload): Promise<PcOutcome> {
        const current = store.product();
        const body = cleanPayload(payload);
        let id: string | null = current?.id ?? null;
        const outcome = await write(
          () =>
            current === null
              ? firstValueFrom(api.createProduct(body))
              : firstValueFrom(api.updateProduct(current.id, body)),
          (response) => {
            id = response.data.id;
          },
        );
        if (outcome.ok && id !== null) {
          // The detail is reloaded so the variants, kit lines and units follow the saved product.
          await reopen(id);
        }
        return outcome;
      },

      /** A chosen value changed, so the preview on screen no longer matches the matrix. */
      clearPreview(): void {
        patchState(store, { preview: null, generated: null });
      },

      /** Products to pick as kit components: the catalog without the kit itself, matched by SKU, name or barcode. */
      async searchProducts(q: string): Promise<PcProduct[]> {
        try {
          const response = await firstValueFrom(
            api.listProducts({ q, kind: 'all', per_page: 20, page: 1 }),
          );
          return response.data.filter((product) => product.id !== store.product()?.id);
        } catch {
          return [];
        }
      },

      async previewMatrix(request: PcMatrixRequest): Promise<PcOutcome> {
        const current = store.product();
        if (current === null) {
          return failureOf(null);
        }
        return write(
          () => firstValueFrom(api.previewMatrix(current.id, request)),
          (response) => patchState(store, { preview: response.data }),
        );
      },

      async generateMatrix(request: PcMatrixRequest): Promise<PcOutcome> {
        const current = store.product();
        if (current === null) {
          return failureOf(null);
        }
        return write(
          () => firstValueFrom(api.generateMatrix(current.id, request)),
          (response) => patchState(store, { generated: response.data, preview: null }),
        ).then(async (outcome) => {
          if (outcome.ok) {
            await reopen(current.id);
          }
          return outcome;
        });
      },

      async repriceVariants(): Promise<PcOutcome> {
        const current = store.product();
        if (current === null) {
          return failureOf(null);
        }
        return write(
          () => firstValueFrom(api.repriceVariants(current.id)),
          () => undefined,
        ).then(async (outcome) => {
          if (outcome.ok) {
            await reopen(current.id);
          }
          return outcome;
        });
      },

      async saveVariant(id: string, payload: PcProductPayload): Promise<PcOutcome> {
        const current = store.product();
        return write(
          () => firstValueFrom(api.updateProduct(id, cleanPayload(payload))),
          () => undefined,
        ).then(async (outcome) => {
          if (outcome.ok && current !== null) {
            await reopen(current.id);
          }
          return outcome;
        });
      },

      async saveKit(lines: PcKitLinePayload[]): Promise<PcOutcome> {
        const current = store.product();
        if (current === null) {
          return failureOf(null);
        }
        return write(
          () => firstValueFrom(api.saveKitComponents(current.id, lines)),
          (response) => patchState(store, { product: response.data }),
        );
      },

      async explode(quantity: string, includeOptional: boolean): Promise<PcOutcome> {
        const current = store.product();
        if (current === null) {
          return failureOf(null);
        }
        return write(
          () => firstValueFrom(api.explodeProduct(current.id, quantity, includeOptional)),
          (response) => patchState(store, { explosion: response.data }),
        );
      },

      async savePackagings(payload: PcPackagingPayload): Promise<PcOutcome> {
        const current = store.product();
        if (current === null) {
          return failureOf(null);
        }
        return write(
          () => firstValueFrom(api.savePackagings(current.id, payload)),
          (response) => patchState(store, { product: response.data, conversion: null }),
        );
      },

      async convert(quantity: string, unit: string): Promise<PcOutcome> {
        const current = store.product();
        if (current === null) {
          return failureOf(null);
        }
        return write(
          () => firstValueFrom(api.convert(current.id, quantity, unit)),
          (response) => patchState(store, { conversion: response.data }),
        );
      },
    };
  }),
);
