import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  PaymentTerm,
  PaymentTermPayload,
  PaymentTermSchedule,
  PaymentTermScheduleParams,
  ProductBrand,
  ProductCategory,
  ProductCategoryPayload,
  UnitOfMeasure,
  UnitOfMeasurePayload,
} from '../models';

/** Catalog master data under `/catalog/*`: payment terms, brands, categories and units of measure. */
@Service()
export class CatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/catalog`;

  // Payment terms
  getPaymentTerms(): Observable<ApiResponse<PaymentTerm[]>> {
    return this.http.get<ApiResponse<PaymentTerm[]>>(`${this.base}/payment-terms`);
  }

  getPaymentTerm(id: string): Observable<ApiResponse<PaymentTerm>> {
    return this.http.get<ApiResponse<PaymentTerm>>(`${this.base}/payment-terms/${id}`);
  }

  getPaymentTermSchedule(
    id: string,
    params: PaymentTermScheduleParams,
  ): Observable<ApiResponse<PaymentTermSchedule>> {
    return this.http.get<ApiResponse<PaymentTermSchedule>>(`${this.base}/payment-terms/${id}/schedule`, {
      params: toHttpParams(params),
    });
  }

  createPaymentTerm(payload: PaymentTermPayload): Observable<ApiResponse<PaymentTerm>> {
    return this.http.post<ApiResponse<PaymentTerm>>(`${this.base}/payment-terms`, payload);
  }

  updatePaymentTerm(id: string, payload: PaymentTermPayload): Observable<ApiResponse<PaymentTerm>> {
    return this.http.put<ApiResponse<PaymentTerm>>(`${this.base}/payment-terms/${id}`, payload);
  }

  deletePaymentTerm(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/payment-terms/${id}`);
  }

  // Brands
  getBrands(): Observable<ApiResponse<ProductBrand[]>> {
    return this.http.get<ApiResponse<ProductBrand[]>>(`${this.base}/brands`);
  }

  getBrand(id: string): Observable<ApiResponse<ProductBrand>> {
    return this.http.get<ApiResponse<ProductBrand>>(`${this.base}/brands/${id}`);
  }

  createBrand(name: string): Observable<ApiResponse<ProductBrand>> {
    return this.http.post<ApiResponse<ProductBrand>>(`${this.base}/brands`, { name });
  }

  updateBrand(id: string, name: string): Observable<ApiResponse<ProductBrand>> {
    return this.http.put<ApiResponse<ProductBrand>>(`${this.base}/brands/${id}`, { name });
  }

  deleteBrand(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/brands/${id}`);
  }

  // Categories
  getCategories(): Observable<ApiResponse<ProductCategory[]>> {
    return this.http.get<ApiResponse<ProductCategory[]>>(`${this.base}/categories`);
  }

  getCategory(id: string): Observable<ApiResponse<ProductCategory>> {
    return this.http.get<ApiResponse<ProductCategory>>(`${this.base}/categories/${id}`);
  }

  createCategory(payload: ProductCategoryPayload): Observable<ApiResponse<ProductCategory>> {
    return this.http.post<ApiResponse<ProductCategory>>(`${this.base}/categories`, payload);
  }

  updateCategory(id: string, payload: ProductCategoryPayload): Observable<ApiResponse<ProductCategory>> {
    return this.http.put<ApiResponse<ProductCategory>>(`${this.base}/categories/${id}`, payload);
  }

  deleteCategory(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/categories/${id}`);
  }

  // Units of measure
  getUnits(): Observable<ApiResponse<UnitOfMeasure[]>> {
    return this.http.get<ApiResponse<UnitOfMeasure[]>>(`${this.base}/units`);
  }

  getUnit(id: string): Observable<ApiResponse<UnitOfMeasure>> {
    return this.http.get<ApiResponse<UnitOfMeasure>>(`${this.base}/units/${id}`);
  }

  createUnit(payload: UnitOfMeasurePayload): Observable<ApiResponse<UnitOfMeasure>> {
    return this.http.post<ApiResponse<UnitOfMeasure>>(`${this.base}/units`, payload);
  }

  updateUnit(id: string, payload: UnitOfMeasurePayload): Observable<ApiResponse<UnitOfMeasure>> {
    return this.http.put<ApiResponse<UnitOfMeasure>>(`${this.base}/units/${id}`, payload);
  }

  deleteUnit(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/units/${id}`);
  }
}
