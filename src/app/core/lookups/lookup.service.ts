import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';
import { I18nService } from '../i18n/i18n.service';
import { LookupApiResponse, LookupItemDto, SaveLookupTranslationPayload } from './lookup.types';

@Injectable({
  providedIn: 'root',
})
export class LookupService {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);

  private readonly apiUrl = `${environment.apiBaseUrl}/lookups`;

  // In-memory cache keyed by composite string: "{category}_{tenantId}_{locale}"
  private readonly lookupsCache = signal<Record<string, LookupItemDto[]>>({});

  /**
   * Retrieves the list of lookup items for a specific category.
   * Leverages the active language from I18nService and the current tenant ID.
   */
  async getLookup(categoryCode: string, forceRefresh = false): Promise<LookupItemDto[]> {
    const locale = this.i18n.currentLanguage();
    const tenantId = this.i18n.currentTenantId();
    const cacheKey = `${categoryCode}_${tenantId}_${locale}`;

    if (!forceRefresh && this.lookupsCache()[cacheKey]) {
      return this.lookupsCache()[cacheKey];
    }

    const params = new HttpParams()
      .set('locale', locale)
      .set('tenant_id', tenantId);

    const headers = new HttpHeaders({
      'X-Tenant-ID': tenantId,
    });

    try {
      const response = await firstValueFrom(
        this.http.get<LookupApiResponse>(`${this.apiUrl}/${categoryCode}`, { params, headers })
      );

      const items = response.data ?? [];

      this.lookupsCache.update((cache) => ({
        ...cache,
        [cacheKey]: items,
      }));

      return items;
    } catch (error) {
      console.error(`Failed to load lookup items for category: ${categoryCode}`, error);
      return [];
    }
  }

  /**
   * Retrieves the translated label for a given item code within a category.
   */
  async getLabel(categoryCode: string, itemCode: string): Promise<string> {
    const items = await this.getLookup(categoryCode);
    const item = items.find((i) => i.code === itemCode);
    return item?.label ?? itemCode;
  }

  /**
   * Persists or updates a custom translation for the current tenant.
   */
  async saveTranslation(payload: SaveLookupTranslationPayload, categoryCode?: string): Promise<void> {
    const tenantId = this.i18n.currentTenantId();
    const headers = new HttpHeaders({
      'X-Tenant-ID': tenantId,
    });

    await firstValueFrom(
      this.http.post(
        `${this.apiUrl}/translations`,
        {
          ...payload,
          tenant_id: tenantId,
        },
        { headers }
      )
    );

    // Invalidate local cache to trigger immediate reload of updated data
    if (categoryCode) {
      this.invalidateCategory(categoryCode);
    } else {
      this.lookupsCache.set({});
    }
  }

  /**
   * Clears the cached entries associated with a specific category code.
   */
  invalidateCategory(categoryCode: string): void {
    const prefix = `${categoryCode}_`;
    this.lookupsCache.update((cache) => {
      const updatedCache = { ...cache };
      for (const key of Object.keys(updatedCache)) {
        if (key.startsWith(prefix)) {
          delete updatedCache[key];
        }
      }
      return updatedCache;
    });
  }

  /**
   * Flushes the entire in-memory lookup cache.
   */
  clearAllCache(): void {
    this.lookupsCache.set({});
  }
}
