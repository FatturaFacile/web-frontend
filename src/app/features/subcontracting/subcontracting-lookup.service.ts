import { inject, Service } from '@angular/core';
import { ResourceApiService } from '@core/api/resource-api.service';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';

export interface SctOption {
  value: string;
  label: string;
}

export type SctLookupName =
  | 'suppliers'
  | 'customers'
  | 'products'
  | 'warehouses'
  | 'boms'
  | 'productionOrders';

interface LookupDefinition {
  path: string;
  labelKeys: readonly string[];
  filters?: Record<string, unknown>;
}

const LOOKUPS: Record<SctLookupName, LookupDefinition> = {
  suppliers: {
    path: '/procurement/suppliers',
    labelKeys: ['supplier_code', 'company_name'],
    filters: { per_page: 200 },
  },
  customers: {
    path: '/crm/contacts',
    labelKeys: ['company_name', 'first_name', 'last_name'],
    filters: { per_page: 200 },
  },
  products: { path: '/inventory/products', labelKeys: ['sku', 'name'], filters: { per_page: 200 } },
  warehouses: { path: '/inventory/warehouses', labelKeys: ['code', 'name'] },
  boms: { path: '/manufacturing/boms', labelKeys: ['bom_number', 'name'], filters: { per_page: 200 } },
  productionOrders: {
    path: '/manufacturing/production-orders',
    labelKeys: ['order_number'],
    filters: { per_page: 200 },
  },
};

/** Cached option lists of the pickers of the order wizard (partners, products, warehouses, BOMs, production orders). */
@Service()
export class SubcontractingLookupService {
  private readonly api = inject(ResourceApiService);
  private readonly cache = new Map<SctLookupName, Observable<SctOption[]>>();

  options(name: SctLookupName): Observable<SctOption[]> {
    const cached = this.cache.get(name);
    if (cached) {
      return cached;
    }
    const definition = LOOKUPS[name];
    const request = this.api.list(definition.path, definition.filters).pipe(
      map((result) =>
        result.rows
          .filter((row) => typeof row['id'] === 'string')
          .map((row) => ({
            value: row['id'] as string,
            label:
              definition.labelKeys
                .map((key) => row[key])
                .filter((part) => typeof part === 'string' && part !== '')
                .join(' · ') || (row['id'] as string),
          })),
      ),
      catchError(() => of([] as SctOption[])),
      shareReplay(1),
    );
    this.cache.set(name, request);
    return request;
  }
}
