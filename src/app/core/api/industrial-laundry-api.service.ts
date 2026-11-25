import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  IlrBatchPayload,
  IlrBillingPayload,
  IlrBillingPreview,
  IlrBillingRun,
  IlrCertifyPayload,
  IlrDormantFilters,
  IlrDormantGarment,
  IlrEnvelope,
  IlrGarment,
  IlrGarmentFilters,
  IlrLockerGroup,
  IlrLockerPayload,
  IlrLookups,
  IlrPage,
  IlrParContractRef,
  IlrParStockFilters,
  IlrParStockRow,
  IlrPpeAlert,
  IlrPpeDecisionPayload,
  IlrRollCage,
  IlrScanFilters,
  IlrScanPayload,
  IlrScanSession,
  IlrWashBatch,
} from '../models';

type Envelope<T> = Observable<IlrEnvelope<T>>;

/** Endpoints of the industrial laundry module (Mod 177). */
@Service()
export class IndustrialLaundryApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/industrial-laundry`;

  getLookups(): Envelope<IlrLookups> {
    return this.http.get<IlrEnvelope<IlrLookups>>(`${this.base}/lookups`);
  }

  // --- Monitors ---

  getParStock(filters: IlrParStockFilters = {}): Envelope<IlrParStockRow[]> {
    return this.http.get<IlrEnvelope<IlrParStockRow[]>>(`${this.base}/par-stock`, {
      params: toHttpParams(filters),
    });
  }

  getDormant(filters: IlrDormantFilters = {}): Envelope<IlrDormantGarment[]> {
    return this.http.get<IlrEnvelope<IlrDormantGarment[]>>(`${this.base}/dormant-garments`, {
      params: toHttpParams(filters),
    });
  }

  getPpeAlerts(customerId?: string, limitReachedOnly = false): Envelope<IlrPpeAlert[]> {
    return this.http.get<IlrEnvelope<IlrPpeAlert[]>>(`${this.base}/ppe-alerts`, {
      params: toHttpParams({ customer_id: customerId, limit_reached_only: limitReachedOnly ? 1 : undefined }),
    });
  }

  decidePpe(garmentId: string, payload: IlrPpeDecisionPayload): Envelope<IlrGarment> {
    return this.http.post<IlrEnvelope<IlrGarment>>(`${this.base}/garments/${garmentId}/ppe-decision`, payload);
  }

  getLockers(customerId?: string, search?: string): Envelope<IlrLockerGroup[]> {
    return this.http.get<IlrEnvelope<IlrLockerGroup[]>>(`${this.base}/lockers`, {
      params: toHttpParams({ customer_id: customerId, q: search }),
    });
  }

  assignLocker(garmentId: string, payload: IlrLockerPayload): Envelope<IlrGarment> {
    return this.http.post<IlrEnvelope<IlrGarment>>(`${this.base}/garments/${garmentId}/locker`, payload);
  }

  // --- Garments, cages and scans ---

  listGarments(filters: IlrGarmentFilters = {}): Observable<IlrPage<IlrGarment>> {
    return this.http.get<IlrPage<IlrGarment>>(`${this.base}/garments`, { params: toHttpParams(filters) });
  }

  listRollCages(barcode?: string): Observable<IlrPage<IlrRollCage>> {
    return this.http.get<IlrPage<IlrRollCage>>(`${this.base}/roll-cages`, {
      params: toHttpParams({ barcode, per_page: 100 }),
    });
  }

  listScans(filters: IlrScanFilters = {}): Observable<IlrPage<IlrScanSession>> {
    return this.http.get<IlrPage<IlrScanSession>>(`${this.base}/scans`, { params: toHttpParams(filters) });
  }

  submitScan(payload: IlrScanPayload): Envelope<IlrScanSession> {
    return this.http.post<IlrEnvelope<IlrScanSession>>(`${this.base}/scans`, payload);
  }

  // --- RABC wash batches ---

  listWashBatches(status?: string): Observable<IlrPage<IlrWashBatch>> {
    return this.http.get<IlrPage<IlrWashBatch>>(`${this.base}/wash-batches`, {
      params: toHttpParams({ status, per_page: 50 }),
    });
  }

  createWashBatch(payload: IlrBatchPayload): Envelope<IlrWashBatch> {
    return this.http.post<IlrEnvelope<IlrWashBatch>>(`${this.base}/wash-batches`, payload);
  }

  certifyWashBatch(id: string, payload: IlrCertifyPayload): Envelope<IlrWashBatch> {
    return this.http.post<IlrEnvelope<IlrWashBatch>>(`${this.base}/wash-batches/${id}/certify`, payload);
  }

  // --- Billing ---

  listParContracts(): Observable<IlrPage<IlrParContractRef>> {
    return this.http.get<IlrPage<IlrParContractRef>>(`${this.base}/par-contracts`, {
      params: toHttpParams({ active: 1, per_page: 100 }),
    });
  }

  previewBilling(payload: IlrBillingPayload): Envelope<IlrBillingPreview> {
    return this.http.post<IlrEnvelope<IlrBillingPreview>>(`${this.base}/billing-previews`, payload);
  }

  calculateBilling(payload: IlrBillingPayload): Envelope<IlrBillingRun> {
    return this.http.post<IlrEnvelope<IlrBillingRun>>(`${this.base}/billing-runs`, payload);
  }

  listBillingRuns(customerId?: string): Observable<IlrPage<IlrBillingRun>> {
    return this.http.get<IlrPage<IlrBillingRun>>(`${this.base}/billing-runs`, {
      params: toHttpParams({ customer_id: customerId, per_page: 50 }),
    });
  }

  invoiceBillingRun(id: string): Envelope<IlrBillingRun> {
    return this.http.post<IlrEnvelope<IlrBillingRun>>(`${this.base}/billing-runs/${id}/invoice`, {});
  }
}
