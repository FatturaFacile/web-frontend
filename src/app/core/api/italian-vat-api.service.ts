import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  AnnualVat,
  ApiResponse,
  CuCertification,
  CuValidation,
  F24Payment,
  F24PaymentPayload,
  F24Reconciliation,
  GoodsBalance,
  GoodsMovement,
  GoodsMovementPayload,
  ItalianVatEntry,
  ItalianVatPeriod,
  ItalianVatPrint,
  ItalianVatPrintVerification,
  ItalianVatProRataState,
  ItalianVatRegisterSummary,
  ItalianVatRegisterType,
  ItalianVatSection,
  LipeCommunication,
  PlafondAssessment,
  PlafondCheckPayload,
  PlafondMonitor,
  VentilationPreview,
  VentilationRequest,
} from '../models';

/** Italian VAT compliance endpoints (Mod 029): registers, ventilation, third-party goods, plafond, LIPE, annual VAT, CU and F24. */
@Service()
export class ItalianVatApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/italian-vat`;

  // --- Sections and registers ---

  getSections(registerType?: ItalianVatRegisterType): Observable<ApiResponse<ItalianVatSection[]>> {
    return this.http.get<ApiResponse<ItalianVatSection[]>>(`${this.base}/sections`, {
      params: toHttpParams({ register_type: registerType }),
    });
  }

  getRegister(
    sectionId: string,
    period: ItalianVatPeriod,
  ): Observable<ApiResponse<ItalianVatRegisterSummary>> {
    return this.http.get<ApiResponse<ItalianVatRegisterSummary>>(
      `${this.base}/registers/${sectionId}`,
      { params: toHttpParams({ ...period }) },
    );
  }

  /** Definitive print (stampa definitiva / bollatura virtuale) of the register up to `period_to`; locks its entries and period. */
  printRegister(
    sectionId: string,
    payload: { year: number; period_to: string },
  ): Observable<ApiResponse<ItalianVatPrint>> {
    return this.http.post<ApiResponse<ItalianVatPrint>>(
      `${this.base}/registers/${sectionId}/prints`,
      payload,
    );
  }

  getPrints(params?: {
    section_id?: string;
    year?: number;
  }): Observable<ApiResponse<ItalianVatPrint[]>> {
    return this.http.get<ApiResponse<ItalianVatPrint[]>>(`${this.base}/register-prints`, {
      params: toHttpParams(params ?? {}),
    });
  }

  verifyPrint(id: string): Observable<ApiResponse<ItalianVatPrintVerification>> {
    return this.http.get<ApiResponse<ItalianVatPrintVerification>>(
      `${this.base}/register-prints/${id}/verify`,
    );
  }

  downloadPrintPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/register-prints/${id}/pdf`, { responseType: 'blob' });
  }

  reverseEntry(
    id: string,
    payload: { entry_date: string; reason?: string | null },
  ): Observable<ApiResponse<ItalianVatEntry>> {
    return this.http.post<ApiResponse<ItalianVatEntry>>(
      `${this.base}/register-entries/${id}/reverse`,
      payload,
    );
  }

  getProRata(year: number): Observable<ApiResponse<ItalianVatProRataState>> {
    return this.http.get<ApiResponse<ItalianVatProRataState>>(`${this.base}/pro-rata/${year}`);
  }

  // --- Receipts ventilation ---

  previewVentilation(payload: VentilationRequest): Observable<ApiResponse<VentilationPreview>> {
    return this.http.post<ApiResponse<VentilationPreview>>(
      `${this.base}/receipts/ventilation/preview`,
      payload,
    );
  }

  registerVentilation(
    payload: VentilationRequest,
  ): Observable<ApiResponse<{ entries: ItalianVatEntry[] }>> {
    return this.http.post<ApiResponse<{ entries: ItalianVatEntry[] }>>(
      `${this.base}/receipts/ventilation`,
      payload,
    );
  }

  // --- Third-party goods ---

  getGoodsMovements(params?: {
    contact_id?: string;
    from?: string;
    to?: string;
  }): Observable<ApiResponse<GoodsMovement[]>> {
    return this.http.get<ApiResponse<GoodsMovement[]>>(`${this.base}/goods-movements`, {
      params: toHttpParams(params ?? {}),
    });
  }

  createGoodsMovement(payload: GoodsMovementPayload): Observable<ApiResponse<GoodsMovement>> {
    return this.http.post<ApiResponse<GoodsMovement>>(`${this.base}/goods-movements`, payload);
  }

  getGoodsBalances(params?: {
    contact_id?: string;
    as_of?: string;
  }): Observable<ApiResponse<GoodsBalance[]>> {
    return this.http.get<ApiResponse<GoodsBalance[]>>(`${this.base}/goods-balances`, {
      params: toHttpParams(params ?? {}),
    });
  }

  // --- Plafond ---

  getPlafondMonitor(year: number, asOf?: string): Observable<ApiResponse<PlafondMonitor>> {
    return this.http.get<ApiResponse<PlafondMonitor>>(`${this.base}/plafond/monitor`, {
      params: toHttpParams({ year, as_of: asOf }),
    });
  }

  checkPlafond(payload: PlafondCheckPayload): Observable<ApiResponse<PlafondAssessment>> {
    return this.http.post<ApiResponse<PlafondAssessment>>(`${this.base}/plafond/check`, payload);
  }

  revokeDeclaration(
    id: string,
    reason?: string | null,
  ): Observable<ApiResponse<{ id: string; revoked_at: string | null }>> {
    return this.http.post<ApiResponse<{ id: string; revoked_at: string | null }>>(
      `${this.base}/plafond/declarations/${id}/revoke`,
      { reason },
    );
  }

  // --- LIPE ---

  getLipeList(year?: number): Observable<ApiResponse<LipeCommunication[]>> {
    return this.http.get<ApiResponse<LipeCommunication[]>>(`${this.base}/lipe`, {
      params: toHttpParams({ year }),
    });
  }

  generateLipe(payload: {
    year: number;
    quarter: number;
  }): Observable<ApiResponse<LipeCommunication>> {
    return this.http.post<ApiResponse<LipeCommunication>>(`${this.base}/lipe`, payload);
  }

  downloadLipeXml(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/lipe/${id}/xml`, { responseType: 'blob' });
  }

  reconcileLipe(id: string): Observable<ApiResponse<LipeCommunication>> {
    return this.http.post<ApiResponse<LipeCommunication>>(`${this.base}/lipe/${id}/reconcile`, {});
  }

  signLipe(
    id: string,
    payload: { signature: string; certificate: string },
  ): Observable<ApiResponse<LipeCommunication>> {
    return this.http.post<ApiResponse<LipeCommunication>>(
      `${this.base}/lipe/${id}/signature`,
      payload,
    );
  }

  markLipeReady(id: string): Observable<ApiResponse<LipeCommunication>> {
    return this.http.post<ApiResponse<LipeCommunication>>(`${this.base}/lipe/${id}/ready`, {});
  }

  recordLipeTransmission(
    id: string,
    payload: { protocol: string; transmitted_at?: string | null },
  ): Observable<ApiResponse<LipeCommunication>> {
    return this.http.post<ApiResponse<LipeCommunication>>(
      `${this.base}/lipe/${id}/transmission`,
      payload,
    );
  }

  recordLipeRejection(id: string, reason: string): Observable<ApiResponse<LipeCommunication>> {
    return this.http.post<ApiResponse<LipeCommunication>>(`${this.base}/lipe/${id}/rejection`, {
      reason,
    });
  }

  // --- Annual VAT ---

  getAnnualVat(year: number): Observable<ApiResponse<AnnualVat>> {
    return this.http.get<ApiResponse<AnnualVat>>(`${this.base}/annual-vat/${year}`);
  }

  calculateAnnualVat(year: number): Observable<ApiResponse<AnnualVat>> {
    return this.http.post<ApiResponse<AnnualVat>>(`${this.base}/annual-vat/${year}/calculate`, {});
  }

  finalizeAnnualVat(year: number): Observable<ApiResponse<AnnualVat>> {
    return this.http.post<ApiResponse<AnnualVat>>(`${this.base}/annual-vat/${year}/finalize`, {});
  }

  // --- Certificazione Unica ---

  getCertifications(year: number): Observable<ApiResponse<CuCertification[]>> {
    return this.http.get<ApiResponse<CuCertification[]>>(`${this.base}/cu/${year}`);
  }

  buildCertifications(year: number): Observable<ApiResponse<CuCertification[]>> {
    return this.http.post<ApiResponse<CuCertification[]>>(`${this.base}/cu/${year}/build`, {});
  }

  issueCertifications(year: number): Observable<ApiResponse<CuCertification[]>> {
    return this.http.post<ApiResponse<CuCertification[]>>(`${this.base}/cu/${year}/issue`, {});
  }

  validateCertifications(year: number): Observable<ApiResponse<CuValidation>> {
    return this.http.get<ApiResponse<CuValidation>>(`${this.base}/cu/${year}/validation`);
  }

  /** Ministerial telematic file of the year. */
  downloadCuFile(year: number): Observable<Blob> {
    return this.http.get(`${this.base}/cu/${year}/file`, { responseType: 'blob' });
  }

  downloadCuPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/cu/certifications/${id}/pdf`, { responseType: 'blob' });
  }

  // --- F24 ---

  getF24(year: number): Observable<ApiResponse<F24Payment[]>> {
    return this.http.get<ApiResponse<F24Payment[]>>(`${this.base}/f24/${year}`);
  }

  syncF24(year: number): Observable<ApiResponse<F24Payment[]>> {
    return this.http.post<ApiResponse<F24Payment[]>>(`${this.base}/f24/${year}/sync`, {});
  }

  getF24Reconciliation(year: number): Observable<ApiResponse<F24Reconciliation>> {
    return this.http.get<ApiResponse<F24Reconciliation>>(`${this.base}/f24/${year}/reconciliation`);
  }

  payF24(id: string, payload: F24PaymentPayload): Observable<ApiResponse<F24Payment>> {
    return this.http.post<ApiResponse<F24Payment>>(
      `${this.base}/f24/payments/${id}/payments`,
      payload,
    );
  }
}
