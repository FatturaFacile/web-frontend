import { inject, Service } from '@angular/core';
import { ResourceApiService, ResourceRow } from '@core';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { ResourceLookupName } from './resource-panel.types';
import { getByPath } from './resource-panel.utils';

export interface ResourceOption {
  value: string;
  label: string;
}

interface LookupDefinition {
  /** `{dep}` is replaced with the value of the field the lookup depends on. */
  path: string;
  labelKeys: readonly string[];
  filters?: Record<string, unknown>;
}

const LOOKUPS: Record<ResourceLookupName, LookupDefinition> = {
  warehouses: { path: '/inventory/warehouses', labelKeys: ['code', 'name'] },
  stockItems: { path: '/inventory/items', labelKeys: ['sku', 'name'], filters: { per_page: 200 } },
  suppliers: { path: '/procurement/suppliers', labelKeys: ['supplier_code', 'company_name'], filters: { per_page: 200 } },
  mfgItems: { path: '/manufacturing/items', labelKeys: ['item_code', 'name'], filters: { per_page: 200 } },
  bins: { path: '/inventory/warehouses/{dep}/bins', labelKeys: ['zone_code', 'code'] },
  zones: { path: '/inventory/warehouses/{dep}/zones', labelKeys: ['code', 'name'] },
  constructionSites: { path: '/construction/sites', labelKeys: ['code', 'name'], filters: { per_page: 200 } },
  hospitalityRooms: { path: '/hospitality/rooms', labelKeys: ['name'] },
};

/** Cached remote option lists for the select fields of the resource forms. */
@Service()
export class ResourceLookupService {
  private readonly api = inject(ResourceApiService);
  private readonly cache = new Map<string, Observable<ResourceOption[]>>();

  options(name: ResourceLookupName, dependency?: string): Observable<ResourceOption[]> {
    const definition = LOOKUPS[name];
    if (definition.path.includes('{dep}') && !dependency) {
      return of([]);
    }
    const path = definition.path.replace('{dep}', encodeURIComponent(dependency ?? ''));
    const cached = this.cache.get(path);
    if (cached) {
      return cached;
    }
    const request = this.api.list(path, definition.filters).pipe(
      map((result) => result.rows.map((row) => toOption(row, definition.labelKeys))),
      catchError(() => of([] as ResourceOption[])),
      shareReplay(1),
    );
    this.cache.set(path, request);
    return request;
  }

  /** Drops the cached lists (after a create/update that changes them). */
  clear(): void {
    this.cache.clear();
  }
}

function toOption(row: ResourceRow, labelKeys: readonly string[]): ResourceOption {
  const label = labelKeys
    .map((key) => getByPath(row, key))
    .filter((part) => part !== undefined && part !== null && part !== '')
    .join(' - ');
  const id = String(row['id'] ?? '');
  return { value: id, label: label || id };
}
