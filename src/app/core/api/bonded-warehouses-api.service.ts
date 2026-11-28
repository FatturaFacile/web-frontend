import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  BwAeoAudit,
  BwAeoDashboard,
  BwAuditFilters,
  BwAuthorization,
  BwAuthorizationPayload,
  BwCguLedgerEntry,
  BwDischargePayload,
  BwDischargePlan,
  BwEnvelope,
  BwExportDataset,
  BwExportFormat,
  BwExtractionPreview,
  BwInboundMrnPayload,
  BwMrnLot,
  BwMrnLotFilters,
  BwOverview,
  BwPlafondRow,
  BwReconciliationPayload,
  BwReconciliationResult,
  BwVatExtractionPayload,
  BwVatFilters,
  BwVatInboundPayload,
  BwVatRegisterEntry,
} from '../models';

type Envelope<T> = Observable<BwEnvelope<T>>;

/** Endpoints of the bonded warehouse module (Mod 353): authorizations, MRN ledger, CGU, IVA warehouse register and AEO. */
@Service()
export class BondedWarehousesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/bonded-warehouses`;

  getOverview(): Envelope<BwOverview> {
    return this.http.get<BwEnvelope<BwOverview>>(`${this.base}/dashboard`);
  }

  listAuthorizations(
    filters: {
      regime_type?: string | null;
      is_active?: boolean | null;
      search?: string;
      per_page?: number;
    } = {},
  ): Envelope<BwAuthorization[]> {
    return this.http.get<BwEnvelope<BwAuthorization[]>>(`${this.base}/authorizations`, {
      params: toHttpParams({ ...filters }),
    });
  }

  saveAuthorization(
    payload: BwAuthorizationPayload,
    id: string | null = null,
  ): Envelope<BwAuthorization> {
    return id === null
      ? this.http.post<BwEnvelope<BwAuthorization>>(`${this.base}/authorizations`, payload)
      : this.http.put<BwEnvelope<BwAuthorization>>(`${this.base}/authorizations/${id}`, payload);
  }

  deleteAuthorization(id: string): Envelope<null> {
    return this.http.delete<BwEnvelope<null>>(`${this.base}/authorizations/${id}`);
  }

  listMrnLots(filters: BwMrnLotFilters = {}): Envelope<BwMrnLot[]> {
    return this.http.get<BwEnvelope<BwMrnLot[]>>(`${this.base}/mrn-lots`, {
      params: toHttpParams({ ...filters }),
    });
  }

  getMrnLot(id: string): Envelope<BwMrnLot> {
    return this.http.get<BwEnvelope<BwMrnLot>>(`${this.base}/mrn-lots/${id}`);
  }

  registerInboundMrn(payload: BwInboundMrnPayload): Envelope<BwMrnLot> {
    return this.http.post<BwEnvelope<BwMrnLot>>(`${this.base}/mrn-lots`, payload);
  }

  simulateDischarge(payload: BwDischargePayload): Envelope<BwDischargePlan> {
    return this.http.post<BwEnvelope<BwDischargePlan>>(
      `${this.base}/mrn-lots/discharge/simulate`,
      payload,
    );
  }

  executeDischarge(payload: BwDischargePayload): Envelope<BwDischargePlan> {
    return this.http.post<BwEnvelope<BwDischargePlan>>(`${this.base}/mrn-lots/discharge`, payload);
  }

  getPlafond(): Envelope<BwPlafondRow[]> {
    return this.http.get<BwEnvelope<BwPlafondRow[]>>(`${this.base}/cgu/plafond`);
  }

  listCguLedger(
    filters: {
      authorization_id?: string | null;
      direction?: string | null;
      page?: number;
      per_page?: number;
    } = {},
  ): Envelope<BwCguLedgerEntry[]> {
    return this.http.get<BwEnvelope<BwCguLedgerEntry[]>>(`${this.base}/cgu/ledger`, {
      params: toHttpParams({ ...filters }),
    });
  }

  listVatRegister(filters: BwVatFilters = {}): Envelope<BwVatRegisterEntry[]> {
    return this.http.get<BwEnvelope<BwVatRegisterEntry[]>>(`${this.base}/vat-register`, {
      params: toHttpParams({ ...filters }),
    });
  }

  registerVatInbound(payload: BwVatInboundPayload): Envelope<BwVatRegisterEntry> {
    return this.http.post<BwEnvelope<BwVatRegisterEntry>>(
      `${this.base}/vat-register/inbound`,
      payload,
    );
  }

  previewVatExtraction(payload: BwVatExtractionPayload): Envelope<BwExtractionPreview> {
    return this.http.post<BwEnvelope<BwExtractionPreview>>(
      `${this.base}/vat-register/extraction/preview`,
      payload,
    );
  }

  executeVatExtraction(payload: BwVatExtractionPayload): Envelope<BwVatRegisterEntry> {
    return this.http.post<BwEnvelope<BwVatRegisterEntry>>(
      `${this.base}/vat-register/extraction`,
      payload,
    );
  }

  getAeoDashboard(): Envelope<BwAeoDashboard> {
    return this.http.get<BwEnvelope<BwAeoDashboard>>(`${this.base}/aeo/dashboard`);
  }

  listAeoAudits(filters: BwAuditFilters = {}): Envelope<BwAeoAudit[]> {
    return this.http.get<BwEnvelope<BwAeoAudit[]>>(`${this.base}/aeo/audits`, {
      params: toHttpParams({ ...filters }),
    });
  }

  runReconciliation(payload: BwReconciliationPayload): Envelope<BwReconciliationResult> {
    return this.http.post<BwEnvelope<BwReconciliationResult>>(
      `${this.base}/aeo/reconciliation`,
      payload,
    );
  }

  /** The file of a register (CSV or PDF) with the filters of the list. */
  exportDataset(
    dataset: BwExportDataset,
    format: BwExportFormat,
    filters: object = {},
  ): Observable<Blob> {
    return this.http.get(`${this.base}/exports/${dataset}.${format}`, {
      params: toHttpParams({ ...filters }),
      responseType: 'blob',
    });
  }
}
