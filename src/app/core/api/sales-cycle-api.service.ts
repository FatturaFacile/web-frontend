import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  BackorderLine,
  CoreDeliveryNote,
  CoreOrder,
  CoreOrderPayload,
  CoreQuote,
  CoreQuotePayload,
  DeliveryNoteFromDocumentPayload,
  DiscountPolicy,
  DiscountPolicyPayload,
  OrderAvailability,
  PaginatedResponse,
  PriceLookupParams,
  PriceLookupResult,
  QuoteRevisionPayload,
  QuoteSignaturePayload,
  SalesKpis,
  SalesListFilterParams,
  SalesOrderLineFilterParams,
  SalesReturn,
  SalesReturnPayload,
  SalesReturnReceivePayload,
} from '../models';

/** Sales cycle on the core `/sales/*` endpoints: quotes, orders, delivery notes, returns and pricing. */
@Service()
export class SalesCycleApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/sales`;

  // Quotes
  getQuotes(params?: SalesListFilterParams): Observable<PaginatedResponse<CoreQuote>> {
    return this.http.get<PaginatedResponse<CoreQuote>>(`${this.base}/quotes`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getQuote(id: string): Observable<ApiResponse<CoreQuote>> {
    return this.http.get<ApiResponse<CoreQuote>>(`${this.base}/quotes/${id}`);
  }

  createQuote(payload: CoreQuotePayload): Observable<ApiResponse<CoreQuote>> {
    return this.http.post<ApiResponse<CoreQuote>>(`${this.base}/quotes`, payload);
  }

  updateQuote(id: string, payload: CoreQuotePayload): Observable<ApiResponse<CoreQuote>> {
    return this.http.put<ApiResponse<CoreQuote>>(`${this.base}/quotes/${id}`, payload);
  }

  deleteQuote(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/quotes/${id}`);
  }

  convertQuoteToOrder(id: string): Observable<ApiResponse<CoreOrder>> {
    return this.http.post<ApiResponse<CoreOrder>>(`${this.base}/quotes/${id}/convert-to-order`, {});
  }

  invoiceQuote(id: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/quotes/${id}/invoice`, {});
  }

  createDeliveryNoteFromQuote(
    id: string,
    payload: DeliveryNoteFromDocumentPayload = {},
  ): Observable<ApiResponse<CoreDeliveryNote>> {
    return this.http.post<ApiResponse<CoreDeliveryNote>>(`${this.base}/quotes/${id}/delivery-note`, payload);
  }

  signQuote(id: string, payload: QuoteSignaturePayload): Observable<ApiResponse<CoreQuote>> {
    return this.http.post<ApiResponse<CoreQuote>>(`${this.base}/quotes/${id}/signature`, payload);
  }

  expireQuotes(): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/quotes/expire`, {});
  }

  reviseQuote(id: string, payload: QuoteRevisionPayload = {}): Observable<ApiResponse<CoreQuote>> {
    return this.http.post<ApiResponse<CoreQuote>>(`${this.base}/quotes/${id}/revise`, payload);
  }

  // Orders
  getOrders(params?: SalesListFilterParams): Observable<PaginatedResponse<CoreOrder>> {
    return this.http.get<PaginatedResponse<CoreOrder>>(`${this.base}/orders`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getOrder(id: string): Observable<ApiResponse<CoreOrder>> {
    return this.http.get<ApiResponse<CoreOrder>>(`${this.base}/orders/${id}`);
  }

  createOrder(payload: CoreOrderPayload): Observable<ApiResponse<CoreOrder>> {
    return this.http.post<ApiResponse<CoreOrder>>(`${this.base}/orders`, payload);
  }

  updateOrder(id: string, payload: CoreOrderPayload): Observable<ApiResponse<CoreOrder>> {
    return this.http.put<ApiResponse<CoreOrder>>(`${this.base}/orders/${id}`, payload);
  }

  deleteOrder(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/orders/${id}`);
  }

  confirmOrder(id: string): Observable<ApiResponse<CoreOrder>> {
    return this.http.post<ApiResponse<CoreOrder>>(`${this.base}/orders/${id}/confirm`, {});
  }

  cancelOrder(id: string, reason: string): Observable<ApiResponse<CoreOrder>> {
    return this.http.post<ApiResponse<CoreOrder>>(`${this.base}/orders/${id}/cancel`, { reason });
  }

  getOrderAvailability(id: string, warehouseId?: string): Observable<ApiResponse<OrderAvailability>> {
    return this.http.get<ApiResponse<OrderAvailability>>(`${this.base}/orders/${id}/availability`, {
      params: warehouseId ? toHttpParams({ warehouse_id: warehouseId }) : undefined,
    });
  }

  reserveOrder(id: string, warehouseId?: string): Observable<ApiResponse<CoreOrder>> {
    return this.http.post<ApiResponse<CoreOrder>>(
      `${this.base}/orders/${id}/reserve`,
      warehouseId ? { warehouse_id: warehouseId } : {},
    );
  }

  createDeliveryNoteFromOrder(
    id: string,
    payload: DeliveryNoteFromDocumentPayload = {},
  ): Observable<ApiResponse<CoreDeliveryNote>> {
    return this.http.post<ApiResponse<CoreDeliveryNote>>(`${this.base}/orders/${id}/delivery-notes`, payload);
  }

  invoiceOrder(id: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/orders/${id}/invoice`, {});
  }

  createOrderDepositInvoice(id: string, percentage: number | string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/orders/${id}/deposit-invoice`, { percentage });
  }

  getBackorders(params?: {
    contact_id?: string | null;
    product_id?: string | null;
    per_page?: number | null;
  }): Observable<PaginatedResponse<BackorderLine>> {
    return this.http.get<PaginatedResponse<BackorderLine>>(`${this.base}/backorders`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getOrderLines(params?: SalesOrderLineFilterParams): Observable<PaginatedResponse<BackorderLine>> {
    return this.http.get<PaginatedResponse<BackorderLine>>(`${this.base}/order-lines`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getKpis(params: { from: string; to: string }): Observable<ApiResponse<SalesKpis>> {
    return this.http.get<ApiResponse<SalesKpis>>(`${this.base}/kpis`, { params: toHttpParams(params) });
  }

  // Delivery notes
  getDeliveryNotes(params?: SalesListFilterParams): Observable<PaginatedResponse<CoreDeliveryNote>> {
    return this.http.get<PaginatedResponse<CoreDeliveryNote>>(`${this.base}/delivery-notes`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getDeliveryNote(id: string): Observable<ApiResponse<CoreDeliveryNote>> {
    return this.http.get<ApiResponse<CoreDeliveryNote>>(`${this.base}/delivery-notes/${id}`);
  }

  deleteDeliveryNote(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/delivery-notes/${id}`);
  }

  invoiceDeliveryNote(id: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/delivery-notes/${id}/invoice`, {});
  }

  // Returns
  getReturns(params?: SalesListFilterParams): Observable<PaginatedResponse<SalesReturn>> {
    return this.http.get<PaginatedResponse<SalesReturn>>(`${this.base}/returns`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getReturn(id: string): Observable<ApiResponse<SalesReturn>> {
    return this.http.get<ApiResponse<SalesReturn>>(`${this.base}/returns/${id}`);
  }

  createReturn(payload: SalesReturnPayload): Observable<ApiResponse<SalesReturn>> {
    return this.http.post<ApiResponse<SalesReturn>>(`${this.base}/returns`, payload);
  }

  approveReturn(id: string): Observable<ApiResponse<SalesReturn>> {
    return this.http.post<ApiResponse<SalesReturn>>(`${this.base}/returns/${id}/approve`, {});
  }

  rejectReturn(id: string, reason: string): Observable<ApiResponse<SalesReturn>> {
    return this.http.post<ApiResponse<SalesReturn>>(`${this.base}/returns/${id}/reject`, { reason });
  }

  cancelReturn(id: string): Observable<ApiResponse<SalesReturn>> {
    return this.http.post<ApiResponse<SalesReturn>>(`${this.base}/returns/${id}/cancel`, {});
  }

  receiveReturn(id: string, payload: SalesReturnReceivePayload = {}): Observable<ApiResponse<SalesReturn>> {
    return this.http.post<ApiResponse<SalesReturn>>(`${this.base}/returns/${id}/receive`, payload);
  }

  creditReturn(id: string): Observable<ApiResponse<SalesReturn>> {
    return this.http.post<ApiResponse<SalesReturn>>(`${this.base}/returns/${id}/credit-note`, {});
  }

  // Pricing
  getPrice(params: PriceLookupParams): Observable<ApiResponse<PriceLookupResult>> {
    return this.http.get<ApiResponse<PriceLookupResult>>(`${this.base}/pricing/price`, {
      params: toHttpParams(params),
    });
  }

  getDiscountPolicies(): Observable<ApiResponse<DiscountPolicy[]>> {
    return this.http.get<ApiResponse<DiscountPolicy[]>>(`${this.base}/discount-policies`);
  }

  getDiscountPolicy(id: string): Observable<ApiResponse<DiscountPolicy>> {
    return this.http.get<ApiResponse<DiscountPolicy>>(`${this.base}/discount-policies/${id}`);
  }

  createDiscountPolicy(payload: DiscountPolicyPayload): Observable<ApiResponse<DiscountPolicy>> {
    return this.http.post<ApiResponse<DiscountPolicy>>(`${this.base}/discount-policies`, payload);
  }

  updateDiscountPolicy(id: string, payload: DiscountPolicyPayload): Observable<ApiResponse<DiscountPolicy>> {
    return this.http.put<ApiResponse<DiscountPolicy>>(`${this.base}/discount-policies/${id}`, payload);
  }

  deleteDiscountPolicy(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/discount-policies/${id}`);
  }
}
