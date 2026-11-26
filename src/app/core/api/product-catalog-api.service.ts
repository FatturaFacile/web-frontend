import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  PcAttribute,
  PcAttributePayload,
  PcConversion,
  PcCustomsCode,
  PcEnvelope,
  PcExplosion,
  PcImportMode,
  PcImportReport,
  PcImportSchema,
  PcKitLinePayload,
  PcLookups,
  PcMatrixPreview,
  PcMatrixRequest,
  PcMatrixResult,
  PcPackagingPayload,
  PcPage,
  PcProduct,
  PcProductDetail,
  PcProductFilters,
  PcProductPayload,
} from '../models';

type Envelope<T> = Observable<PcEnvelope<T>>;

/** Endpoints of the product catalog (Mod 052): products, attributes, variant matrices, kits, units and bulk exchange. */
@Service()
export class ProductCatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/catalog`;

  getLookups(): Envelope<PcLookups> {
    return this.http.get<PcEnvelope<PcLookups>>(`${this.base}/lookups`);
  }

  searchCustomsCodes(q: string): Envelope<PcCustomsCode[]> {
    return this.http.get<PcEnvelope<PcCustomsCode[]>>(`${this.base}/customs-codes`, {
      params: toHttpParams({ q }),
    });
  }

  // --- Products ---

  listProducts(filters: PcProductFilters = {}): Observable<PcPage<PcProduct>> {
    return this.http.get<PcPage<PcProduct>>(`${this.base}/products`, {
      params: toHttpParams(filters),
    });
  }

  getProduct(id: string): Envelope<PcProductDetail> {
    return this.http.get<PcEnvelope<PcProductDetail>>(`${this.base}/products/${id}`);
  }

  createProduct(payload: PcProductPayload): Envelope<PcProduct> {
    return this.http.post<PcEnvelope<PcProduct>>(`${this.base}/products`, payload);
  }

  updateProduct(id: string, payload: PcProductPayload): Envelope<PcProduct> {
    return this.http.put<PcEnvelope<PcProduct>>(`${this.base}/products/${id}`, payload);
  }

  deleteProduct(id: string): Envelope<null> {
    return this.http.delete<PcEnvelope<null>>(`${this.base}/products/${id}`);
  }

  // --- Attributes ---

  listAttributes(): Envelope<PcAttribute[]> {
    return this.http.get<PcEnvelope<PcAttribute[]>>(`${this.base}/attributes`);
  }

  createAttribute(payload: PcAttributePayload): Envelope<PcAttribute> {
    return this.http.post<PcEnvelope<PcAttribute>>(`${this.base}/attributes`, payload);
  }

  updateAttribute(id: string, payload: Partial<PcAttributePayload>): Envelope<PcAttribute> {
    return this.http.put<PcEnvelope<PcAttribute>>(`${this.base}/attributes/${id}`, payload);
  }

  deleteAttribute(id: string): Envelope<null> {
    return this.http.delete<PcEnvelope<null>>(`${this.base}/attributes/${id}`);
  }

  // --- Variant matrix ---

  previewMatrix(productId: string, request: PcMatrixRequest): Envelope<PcMatrixPreview> {
    return this.http.post<PcEnvelope<PcMatrixPreview>>(
      `${this.base}/products/${productId}/matrix/preview`,
      request,
    );
  }

  generateMatrix(productId: string, request: PcMatrixRequest): Envelope<PcMatrixResult> {
    return this.http.post<PcEnvelope<PcMatrixResult>>(
      `${this.base}/products/${productId}/matrix/generate`,
      request,
    );
  }

  repriceVariants(productId: string): Envelope<{ repriced: number }> {
    return this.http.post<PcEnvelope<{ repriced: number }>>(
      `${this.base}/products/${productId}/matrix/reprice`,
      {},
    );
  }

  // --- Kits ---

  saveKitComponents(productId: string, components: PcKitLinePayload[]): Envelope<PcProductDetail> {
    return this.http.put<PcEnvelope<PcProductDetail>>(
      `${this.base}/products/${productId}/kit-components`,
      { components },
    );
  }

  explodeProduct(
    productId: string,
    quantity: string,
    includeOptional = false,
  ): Envelope<PcExplosion['warehouse']> {
    return this.http.get<PcEnvelope<PcExplosion['warehouse']>>(
      `${this.base}/products/${productId}/explosion`,
      { params: toHttpParams({ quantity, include_optional: includeOptional ? 1 : 0 }) },
    );
  }

  explodeLines(
    lines: { product_id: string; quantity: string; include_optional?: boolean }[],
  ): Envelope<PcExplosion> {
    return this.http.post<PcEnvelope<PcExplosion>>(`${this.base}/kits/explode`, { lines });
  }

  // --- Units of measure ---

  savePackagings(productId: string, payload: PcPackagingPayload): Envelope<PcProductDetail> {
    return this.http.put<PcEnvelope<PcProductDetail>>(
      `${this.base}/products/${productId}/packagings`,
      payload,
    );
  }

  convert(productId: string, quantity: string, unit: string): Envelope<PcConversion> {
    return this.http.post<PcEnvelope<PcConversion>>(`${this.base}/products/${productId}/convert`, {
      quantity,
      unit,
    });
  }

  // --- Bulk exchange ---

  getImportSchema(): Envelope<PcImportSchema> {
    return this.http.get<PcEnvelope<PcImportSchema>>(`${this.base}/import/schema`);
  }

  importFile(file: File, mode: PcImportMode): Envelope<PcImportReport> {
    const body = new FormData();
    body.append('file', file);
    body.append('mode', mode);
    return this.http.post<PcEnvelope<PcImportReport>>(`${this.base}/import`, body);
  }

  exportCatalog(format: 'csv' | 'xlsx'): Observable<Blob> {
    return this.http.get(`${this.base}/export`, {
      params: toHttpParams({ format }),
      responseType: 'blob',
    });
  }

  downloadTemplate(format: 'csv' | 'xlsx'): Observable<Blob> {
    return this.http.get(`${this.base}/import/template`, {
      params: toHttpParams({ format }),
      responseType: 'blob',
    });
  }
}
