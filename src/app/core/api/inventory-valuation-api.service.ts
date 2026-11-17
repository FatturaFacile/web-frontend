import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import {
  CostLayer,
  CostLayerFilterParams,
  DownloadedFile,
  GoodsReceiptFilterParams,
  GoodsReceiptSummary,
  InventoryBook,
  InventoryBookExport,
  InventoryBookExportFilterParams,
  InventoryBookParams,
  InventoryDataEnvelope,
  InventoryItemOption,
  InventoryListEnvelope,
  InventoryWarehouseOption,
  LandedCostDocument,
  LandedCostFilterParams,
  LandedCostPayload,
  LandedCostPreview,
  PaginatedResponse,
  ReverseLandedCostPayload,
  UpdateCategoryValuationPayload,
  UpdateItemValuationPayload,
  ValuationCategory,
  ValuationConfigFilterParams,
  ValuationConfigRow,
  ValuationItem,
  ValuationSnapshotPayload,
  ValuationSummary,
  ValuationSummaryParams,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

const ENVELOPE_KEYS = new Set(['data', 'success', 'message', 'links', 'meta']);

/**
 * Returns the payload of a single-resource response whether the API wraps it
 * in `{ data }` (optionally with `success`/`message`) or returns it bare.
 * Extra top-level keys next to `data` (e.g. a JsonResource `additional`
 * such as `revaluation`) are merged into the returned payload.
 */
export function unwrapInventoryData<T>(res: T | InventoryDataEnvelope<T>): T {
  if (res === null || typeof res !== 'object' || Array.isArray(res) || !('data' in res) || 'id' in res) {
    return res as T;
  }
  const { data } = res as InventoryDataEnvelope<T>;
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }
  const extras = Object.fromEntries(
    Object.entries(res as unknown as Record<string, unknown>).filter(([key]) => !ENVELOPE_KEYS.has(key)),
  );
  return { ...extras, ...data } as T;
}

/**
 * Normalises a list response (`{ data, links?, meta? }`, a bare array, or the
 * `{ success, message, data, meta }` envelope) into a `PaginatedResponse`, so
 * that `ListFacade` can consume endpoints that are not paginated server-side.
 */
export function toInventoryPage<T>(res: InventoryListEnvelope<T> | T[] | null | undefined): PaginatedResponse<T> {
  const data = Array.isArray(res) ? res : (res?.data ?? []);
  const meta = Array.isArray(res) ? undefined : res?.meta;
  const total = typeof meta?.total === 'number' ? meta.total : data.length;
  const perPage = typeof meta?.per_page === 'number' ? meta.per_page : Math.max(data.length, 1);
  return {
    success: Array.isArray(res) ? true : (res?.success ?? true),
    message: Array.isArray(res) ? '' : (res?.message ?? ''),
    data,
    meta: {
      current_page: typeof meta?.current_page === 'number' ? meta.current_page : 1,
      last_page: typeof meta?.last_page === 'number' ? meta.last_page : 1,
      per_page: perPage,
      from: typeof meta?.from === 'number' ? meta.from : null,
      to: typeof meta?.to === 'number' ? meta.to : null,
      total,
    },
  };
}

/** Extracts the filename from a `Content-Disposition` header, if any. */
export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) {
    return fallback;
  }
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // fall through to the plain filename parameter
    }
  }
  const plain = /filename\s*=\s*("?)([^";]+)\1/i.exec(header);
  return plain?.[2]?.trim() || fallback;
}

/**
 * Inventory valuation (FatturaFacile#144): valuation config, cost layers,
 * landed cost documents and the year-end inventory book.
 */
@Service()
export class InventoryValuationApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/inventory`;

  // --- Valuation configuration ---

  getValuationConfig(filters?: ValuationConfigFilterParams): Observable<ValuationConfigRow[]> {
    return this.http
      .get<InventoryListEnvelope<ValuationConfigRow> | ValuationConfigRow[]>(`${this.base}/valuation/config`, {
        params: filters ? toHttpParams(filters) : undefined,
      })
      .pipe(map((res) => toInventoryPage(res).data));
  }

  updateCategoryValuation(id: string, payload: UpdateCategoryValuationPayload): Observable<ValuationCategory> {
    return this.http
      .put<ValuationCategory | InventoryDataEnvelope<ValuationCategory>>(
        `${this.base}/valuation/categories/${id}`,
        payload,
      )
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  updateItemValuation(id: string, payload: UpdateItemValuationPayload): Observable<ValuationItem> {
    return this.http
      .put<ValuationItem | InventoryDataEnvelope<ValuationItem>>(`${this.base}/valuation/items/${id}`, payload)
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  getValuationSummary(params?: ValuationSummaryParams): Observable<ValuationSummary> {
    return this.http
      .get<ValuationSummary | InventoryDataEnvelope<ValuationSummary>>(`${this.base}/valuation/summary`, {
        params: params ? toHttpParams(params) : undefined,
      })
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  captureValuationSnapshot(payload: ValuationSnapshotPayload): Observable<unknown> {
    return this.http.post<unknown>(`${this.base}/valuation/snapshot`, payload);
  }

  // --- Cost layers ---

  getCostLayers(filters?: CostLayerFilterParams): Observable<PaginatedResponse<CostLayer>> {
    return this.http
      .get<InventoryListEnvelope<CostLayer>>(`${this.base}/valuation/cost-layers`, {
        params: filters ? toHttpParams(filters) : undefined,
      })
      .pipe(map((res) => toInventoryPage(res)));
  }

  // --- Landed cost documents ---

  listLandedCosts(filters?: LandedCostFilterParams): Observable<PaginatedResponse<LandedCostDocument>> {
    return this.http
      .get<InventoryListEnvelope<LandedCostDocument>>(`${this.base}/landed-costs`, {
        params: filters ? toHttpParams(filters) : undefined,
      })
      .pipe(map((res) => toInventoryPage(res)));
  }

  getLandedCost(id: string): Observable<LandedCostDocument> {
    return this.http
      .get<LandedCostDocument | InventoryDataEnvelope<LandedCostDocument>>(`${this.base}/landed-costs/${id}`)
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  createLandedCost(payload: LandedCostPayload): Observable<LandedCostDocument> {
    return this.http
      .post<LandedCostDocument | InventoryDataEnvelope<LandedCostDocument>>(`${this.base}/landed-costs`, payload)
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  previewLandedCost(payload: LandedCostPayload): Observable<LandedCostPreview> {
    return this.http
      .post<LandedCostPreview | InventoryDataEnvelope<LandedCostPreview>>(
        `${this.base}/landed-costs/preview`,
        payload,
      )
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  applyLandedCost(id: string): Observable<LandedCostDocument> {
    return this.http
      .post<LandedCostDocument | InventoryDataEnvelope<LandedCostDocument>>(
        `${this.base}/landed-costs/${id}/apply`,
        {},
      )
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  reverseLandedCost(id: string, payload: ReverseLandedCostPayload): Observable<LandedCostDocument> {
    return this.http
      .post<LandedCostDocument | InventoryDataEnvelope<LandedCostDocument>>(
        `${this.base}/landed-costs/${id}/reverse`,
        payload,
      )
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  // --- Inventory book ---

  getBook(params: InventoryBookParams): Observable<InventoryBook> {
    return this.http
      .get<InventoryBook | InventoryDataEnvelope<InventoryBook>>(`${this.base}/book`, {
        params: toHttpParams({ ...params, format: 'json' }),
      })
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  downloadBookCsv(params: InventoryBookParams): Observable<DownloadedFile> {
    return this.http
      .get(`${this.base}/book`, {
        params: toHttpParams({ ...params, format: 'csv' }),
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(map((res) => this.toDownloadedFile(res, `inventory-book-${params.year}.csv`)));
  }

  createBookExport(year: number): Observable<InventoryBookExport> {
    return this.http
      .post<InventoryBookExport | InventoryDataEnvelope<InventoryBookExport>>(`${this.base}/book/exports`, { year })
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  listBookExports(filters?: InventoryBookExportFilterParams): Observable<PaginatedResponse<InventoryBookExport>> {
    return this.http
      .get<InventoryListEnvelope<InventoryBookExport>>(`${this.base}/book/exports`, {
        params: filters ? toHttpParams(filters) : undefined,
      })
      .pipe(map((res) => toInventoryPage(res)));
  }

  downloadBookExport(item: Pick<InventoryBookExport, 'id' | 'year'>): Observable<DownloadedFile> {
    return this.http
      .get(`${this.base}/book/exports/${item.id}/download`, {
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(map((res) => this.toDownloadedFile(res, `inventory-book-${item.year}.csv`)));
  }

  // --- Lookups used by the valuation pages ---

  /** Goods receipts (Procurement) selectable as landed-cost allocation targets. */
  listGoodsReceipts(filters?: GoodsReceiptFilterParams): Observable<PaginatedResponse<GoodsReceiptSummary>> {
    return this.http
      .get<InventoryListEnvelope<GoodsReceiptSummary>>(`${environment.apiBaseUrl}/procurement/goods-receipts`, {
        params: filters ? toHttpParams(filters) : undefined,
      })
      .pipe(map((res) => toInventoryPage(res)));
  }

  listWarehouses(): Observable<InventoryWarehouseOption[]> {
    return this.http
      .get<InventoryListEnvelope<InventoryWarehouseOption>>(`${this.base}/warehouses`, {
        params: toHttpParams({ per_page: 100 }),
      })
      .pipe(map((res) => toInventoryPage(res).data));
  }

  searchItems(search?: string): Observable<InventoryItemOption[]> {
    return this.http
      .get<InventoryListEnvelope<InventoryItemOption>>(`${this.base}/items`, {
        params: toHttpParams({ per_page: 50, search }),
      })
      .pipe(map((res) => toInventoryPage(res).data));
  }

  private toDownloadedFile(res: HttpResponse<Blob>, fallback: string): DownloadedFile {
    return {
      blob: res.body ?? new Blob([]),
      filename: filenameFromDisposition(res.headers.get('Content-Disposition'), fallback),
    };
  }
}
