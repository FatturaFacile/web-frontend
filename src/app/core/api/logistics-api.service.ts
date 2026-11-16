import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, PaginatedResponse } from '../models/api.models';
import {
  ConsignmentLedgerWarehouse,
  ConsumptionPayload,
  ConsumptionReport,
  DeliveryNoteFilterParams,
  DeliveryNoteFromOrdersPayload,
  DeliveryNotePayload,
  DeliveryNotePdfOptions,
  DeliveryNoteResource,
  DiscrepancyResolution,
  InventoryValuation,
  LookupPartner,
  LookupProduct,
  LookupWarehouse,
  OpenOrder,
  ReceiveLinePayload,
  StockTransferFilterParams,
  StockTransferPayload,
  StockTransferResource,
  TransferDiscrepancy,
  UnbilledGroup,
} from '../models/logistics.model';

@Service()
export class LogisticsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/logistics`;

  // ---- Delivery notes (DDT)
  listDeliveryNotes(
    filters: DeliveryNoteFilterParams,
  ): Observable<PaginatedResponse<DeliveryNoteResource>> {
    return this.http.get<PaginatedResponse<DeliveryNoteResource>>(`${this.base}/delivery-notes`, {
      params: toHttpParams(filters),
    });
  }

  getDeliveryNote(id: string): Observable<ApiResponse<DeliveryNoteResource>> {
    return this.http.get<ApiResponse<DeliveryNoteResource>>(`${this.base}/delivery-notes/${id}`);
  }

  createDeliveryNote(payload: DeliveryNotePayload): Observable<ApiResponse<DeliveryNoteResource>> {
    return this.http.post<ApiResponse<DeliveryNoteResource>>(
      `${this.base}/delivery-notes`,
      payload,
    );
  }

  createDeliveryNoteFromOrders(
    payload: DeliveryNoteFromOrdersPayload,
  ): Observable<ApiResponse<DeliveryNoteResource>> {
    return this.http.post<ApiResponse<DeliveryNoteResource>>(
      `${this.base}/delivery-notes/from-orders`,
      payload,
    );
  }

  updateDeliveryNote(
    id: string,
    payload: Partial<DeliveryNotePayload>,
  ): Observable<ApiResponse<DeliveryNoteResource>> {
    return this.http.put<ApiResponse<DeliveryNoteResource>>(
      `${this.base}/delivery-notes/${id}`,
      payload,
    );
  }

  deleteDeliveryNote(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/delivery-notes/${id}`);
  }

  issue(id: string): Observable<ApiResponse<DeliveryNoteResource>> {
    return this.http.post<ApiResponse<DeliveryNoteResource>>(
      `${this.base}/delivery-notes/${id}/issue`,
      {},
    );
  }

  dispatch(id: string): Observable<ApiResponse<DeliveryNoteResource>> {
    return this.http.post<ApiResponse<DeliveryNoteResource>>(
      `${this.base}/delivery-notes/${id}/dispatch`,
      {},
    );
  }

  deliver(
    id: string,
    recipientSignatureName?: string,
  ): Observable<ApiResponse<DeliveryNoteResource>> {
    return this.http.post<ApiResponse<DeliveryNoteResource>>(
      `${this.base}/delivery-notes/${id}/deliver`,
      {
        recipient_signature_name: recipientSignatureName ?? null,
      },
    );
  }

  cancel(id: string): Observable<ApiResponse<DeliveryNoteResource>> {
    return this.http.post<ApiResponse<DeliveryNoteResource>>(
      `${this.base}/delivery-notes/${id}/cancel`,
      {},
    );
  }

  downloadPdf(id: string, options: DeliveryNotePdfOptions = {}): Observable<Blob> {
    return this.http.get(`${this.base}/delivery-notes/${id}/pdf`, {
      params: toHttpParams({
        hide_prices: options.hide_prices ? 1 : undefined,
        lang: options.lang,
      }),
      responseType: 'blob',
    });
  }

  unbilled(): Observable<ApiResponse<UnbilledGroup[]>> {
    return this.http.get<ApiResponse<UnbilledGroup[]>>(`${this.base}/delivery-notes/unbilled`);
  }

  deferredInvoice(
    deliveryNoteIds: string[],
    enforceSameMonth = true,
  ): Observable<ApiResponse<{ id: string; invoice_number: string }>> {
    return this.http.post<ApiResponse<{ id: string; invoice_number: string }>>(
      `${this.base}/delivery-notes/deferred-invoice`,
      {
        delivery_note_ids: deliveryNoteIds,
        enforce_same_month: enforceSameMonth,
      },
    );
  }

  runDeferredInvoicing(
    upTo?: string,
  ): Observable<ApiResponse<{ id: string; invoice_number: string }[]>> {
    return this.http.post<ApiResponse<{ id: string; invoice_number: string }[]>>(
      `${this.base}/delivery-notes/deferred-invoicing/run`,
      upTo ? { up_to: upTo } : {},
    );
  }

  // ---- Lookups
  warehouses(warehouseType?: string): Observable<ApiResponse<LookupWarehouse[]>> {
    return this.http.get<ApiResponse<LookupWarehouse[]>>(`${this.base}/lookups/warehouses`, {
      params: toHttpParams({ warehouse_type: warehouseType }),
    });
  }

  products(search?: string): Observable<ApiResponse<LookupProduct[]>> {
    return this.http.get<ApiResponse<LookupProduct[]>>(`${this.base}/lookups/products`, {
      params: toHttpParams({ search }),
    });
  }

  partners(search?: string): Observable<ApiResponse<LookupPartner[]>> {
    return this.http.get<ApiResponse<LookupPartner[]>>(`${this.base}/lookups/partners`, {
      params: toHttpParams({ search }),
    });
  }

  openOrders(contactId?: string): Observable<ApiResponse<OpenOrder[]>> {
    return this.http.get<ApiResponse<OpenOrder[]>>(`${this.base}/lookups/open-orders`, {
      params: toHttpParams({ contact_id: contactId }),
    });
  }

  // ---- Transfers
  listTransfers(
    filters: StockTransferFilterParams,
  ): Observable<PaginatedResponse<StockTransferResource>> {
    return this.http.get<PaginatedResponse<StockTransferResource>>(`${this.base}/transfers`, {
      params: toHttpParams(filters),
    });
  }

  getTransfer(id: string): Observable<ApiResponse<StockTransferResource>> {
    return this.http.get<ApiResponse<StockTransferResource>>(`${this.base}/transfers/${id}`);
  }

  createTransfer(payload: StockTransferPayload): Observable<ApiResponse<StockTransferResource>> {
    return this.http.post<ApiResponse<StockTransferResource>>(`${this.base}/transfers`, payload);
  }

  shipTransfer(
    id: string,
    delivery: Record<string, unknown> = {},
  ): Observable<ApiResponse<StockTransferResource>> {
    return this.http.post<ApiResponse<StockTransferResource>>(
      `${this.base}/transfers/${id}/ship`,
      delivery,
    );
  }

  receiveTransfer(
    id: string,
    lines: ReceiveLinePayload[],
  ): Observable<ApiResponse<StockTransferResource>> {
    return this.http.post<ApiResponse<StockTransferResource>>(
      `${this.base}/transfers/${id}/receive`,
      { lines },
    );
  }

  cancelTransfer(id: string): Observable<ApiResponse<StockTransferResource>> {
    return this.http.post<ApiResponse<StockTransferResource>>(
      `${this.base}/transfers/${id}/cancel`,
      {},
    );
  }

  listDiscrepancies(status?: string): Observable<PaginatedResponse<TransferDiscrepancy>> {
    return this.http.get<PaginatedResponse<TransferDiscrepancy>>(
      `${this.base}/transfer-discrepancies`,
      {
        params: toHttpParams({ status }),
      },
    );
  }

  resolveDiscrepancy(
    id: string,
    resolution: DiscrepancyResolution,
  ): Observable<ApiResponse<TransferDiscrepancy>> {
    return this.http.post<ApiResponse<TransferDiscrepancy>>(
      `${this.base}/transfer-discrepancies/${id}/resolve`,
      { resolution },
    );
  }

  // ---- Consignment / subcontracting
  consignmentLedger(
    filters: { warehouse_id?: string; partner_id?: string; from?: string; to?: string } = {},
  ): Observable<ApiResponse<ConsignmentLedgerWarehouse[]>> {
    return this.http.get<ApiResponse<ConsignmentLedgerWarehouse[]>>(
      `${this.base}/consignment/ledger`,
      { params: toHttpParams(filters) },
    );
  }

  inventoryValuation(): Observable<ApiResponse<InventoryValuation>> {
    return this.http.get<ApiResponse<InventoryValuation>>(`${this.base}/consignment/valuation`);
  }

  declareConsumption(payload: ConsumptionPayload): Observable<ApiResponse<ConsumptionReport>> {
    return this.http.post<ApiResponse<ConsumptionReport>>(
      `${this.base}/consignment/consumption-reports`,
      payload,
    );
  }
}
