import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CreateProductPayload,
  PaginatedResponse,
  ProductFilterParams,
  ProductItem,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class InventoryApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/inventory/products`;

  getProducts(filters?: ProductFilterParams): Observable<PaginatedResponse<ProductItem>> {
    return this.http.get<PaginatedResponse<ProductItem>>(this.url, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  getProduct(id: string): Observable<ApiResponse<ProductItem>> {
    return this.http.get<ApiResponse<ProductItem>>(`${this.url}/${id}`);
  }

  createProduct(payload: CreateProductPayload): Observable<ApiResponse<ProductItem>> {
    return this.http.post<ApiResponse<ProductItem>>(this.url, payload);
  }

  updateProduct(id: string, payload: Partial<CreateProductPayload>): Observable<ApiResponse<ProductItem>> {
    return this.http.put<ApiResponse<ProductItem>>(`${this.url}/${id}`, payload);
  }

  deleteProduct(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.url}/${id}`);
  }
}
