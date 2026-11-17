import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { HANDLED_ERROR_STATUSES } from '../interceptors/error.interceptor';
import {
  AddExtensionPayload,
  CancelRmaPayload,
  CompleteRepairPayload,
  CreatePassportPayload,
  DiagnosisPayload,
  EquipmentPassport,
  EsmEnvelope,
  EsmPaginated,
  IssueLoanerPayload,
  IssueRmaPayload,
  Loaner,
  LoanerListFilters,
  NotePayload,
  PassportGenealogy,
  PassportListFilters,
  PatchVendorClaimPayload,
  ReceiveRmaPayload,
  ReturnLoanerPayload,
  ReturnRmaPayload,
  RmaBoard,
  RmaBoardFilters,
  RmaIssueResult,
  RmaLabel,
  RmaListFilters,
  RmaOrder,
  RmaWithEstimateLink,
  SerialLookupResult,
  UpdatePassportPayload,
  VendorClaim,
  VendorClaimListFilters,
  VendorClaimTransitionPayload,
} from '../models';

/** 404/409 of these endpoints carry a `code` the warranty/RMA pages translate themselves. */
const handled404And409 = () => new HttpContext().set(HANDLED_ERROR_STATUSES, [404, 409]);
const handled409 = () => new HttpContext().set(HANDLED_ERROR_STATUSES, [409]);

/** Warranty lookup, equipment passports, RMA depot repair, loaners and vendor claims (`/esm`). */
@Service()
export class WarrantyRmaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/esm`;

  // --- Equipment passports ---

  listPassports(filters: PassportListFilters = {}): Observable<EsmPaginated<EquipmentPassport>> {
    return this.http.get<EsmPaginated<EquipmentPassport>>(`${this.base}/equipment-passports`, {
      params: toHttpParams(filters),
    });
  }

  createPassport(payload: CreatePassportPayload): Observable<EsmEnvelope<EquipmentPassport>> {
    return this.http.post<EsmEnvelope<EquipmentPassport>>(
      `${this.base}/equipment-passports`,
      payload,
    );
  }

  getPassport(id: string): Observable<EsmEnvelope<EquipmentPassport>> {
    return this.http.get<EsmEnvelope<EquipmentPassport>>(`${this.base}/equipment-passports/${id}`);
  }

  updatePassport(
    id: string,
    payload: UpdatePassportPayload,
  ): Observable<EsmEnvelope<EquipmentPassport>> {
    return this.http.put<EsmEnvelope<EquipmentPassport>>(
      `${this.base}/equipment-passports/${id}`,
      payload,
    );
  }

  addExtension(
    id: string,
    payload: AddExtensionPayload,
  ): Observable<EsmEnvelope<EquipmentPassport>> {
    return this.http.post<EsmEnvelope<EquipmentPassport>>(
      `${this.base}/equipment-passports/${id}/extensions`,
      payload,
    );
  }

  getGenealogy(id: string): Observable<EsmEnvelope<PassportGenealogy>> {
    return this.http.get<EsmEnvelope<PassportGenealogy>>(
      `${this.base}/equipment-passports/${id}/genealogy`,
    );
  }

  lookupSerial(
    serialNumber: string,
    productId?: string | null,
  ): Observable<EsmEnvelope<SerialLookupResult>> {
    return this.http.get<EsmEnvelope<SerialLookupResult>>(
      `${this.base}/equipment-passports/lookup`,
      {
        params: toHttpParams({ serial_number: serialNumber, product_id: productId }),
        context: handled404And409(),
      },
    );
  }

  // --- RMA orders ---

  listRmas(filters: RmaListFilters = {}): Observable<EsmPaginated<RmaOrder>> {
    return this.http.get<EsmPaginated<RmaOrder>>(`${this.base}/rma-orders`, {
      params: toHttpParams(filters),
    });
  }

  issueRma(payload: IssueRmaPayload): Observable<EsmEnvelope<RmaIssueResult>> {
    return this.http.post<EsmEnvelope<RmaIssueResult>>(`${this.base}/rma-orders`, payload, {
      context: handled404And409(),
    });
  }

  getRma(id: string): Observable<EsmEnvelope<RmaOrder>> {
    return this.http.get<EsmEnvelope<RmaOrder>>(`${this.base}/rma-orders/${id}`);
  }

  getLabel(id: string): Observable<EsmEnvelope<RmaLabel>> {
    return this.http.get<EsmEnvelope<RmaLabel>>(`${this.base}/rma-orders/${id}/label`);
  }

  regenerateTrackingToken(id: string): Observable<EsmEnvelope<RmaLabel>> {
    return this.http.post<EsmEnvelope<RmaLabel>>(
      `${this.base}/rma-orders/${id}/tracking-token`,
      {},
    );
  }

  getBoard(filters: RmaBoardFilters = {}): Observable<EsmEnvelope<RmaBoard>> {
    return this.http.get<EsmEnvelope<RmaBoard>>(`${this.base}/rma-orders/board`, {
      params: toHttpParams(filters),
    });
  }

  receive(id: string, payload: ReceiveRmaPayload): Observable<EsmEnvelope<RmaOrder>> {
    return this.transition(id, 'receive', payload);
  }

  diagnose(id: string, payload: DiagnosisPayload): Observable<EsmEnvelope<RmaWithEstimateLink>> {
    return this.transition(id, 'diagnosis', payload);
  }

  approveEstimate(id: string, payload: NotePayload = {}): Observable<EsmEnvelope<RmaOrder>> {
    return this.transition(id, 'estimate/approve', payload);
  }

  declineEstimate(id: string, payload: NotePayload = {}): Observable<EsmEnvelope<RmaOrder>> {
    return this.transition(id, 'estimate/decline', payload);
  }

  resendEstimate(id: string): Observable<EsmEnvelope<RmaWithEstimateLink>> {
    return this.transition(id, 'estimate/resend', {});
  }

  partsReceived(id: string): Observable<EsmEnvelope<RmaOrder>> {
    return this.transition(id, 'parts-received', {});
  }

  completeRepair(id: string, payload: CompleteRepairPayload): Observable<EsmEnvelope<RmaOrder>> {
    return this.transition(id, 'complete-repair', payload);
  }

  returnToCustomer(id: string, payload: ReturnRmaPayload): Observable<EsmEnvelope<RmaOrder>> {
    return this.transition(id, 'return', payload);
  }

  close(id: string): Observable<EsmEnvelope<RmaOrder>> {
    return this.transition(id, 'close', {});
  }

  cancel(id: string, payload: CancelRmaPayload): Observable<EsmEnvelope<RmaOrder>> {
    return this.transition(id, 'cancel', payload);
  }

  // --- Loaners ---

  listLoaners(filters: LoanerListFilters = {}): Observable<EsmPaginated<Loaner>> {
    return this.http.get<EsmPaginated<Loaner>>(`${this.base}/loaners`, {
      params: toHttpParams(filters),
    });
  }

  issueLoaner(rmaId: string, payload: IssueLoanerPayload): Observable<EsmEnvelope<Loaner>> {
    return this.http.post<EsmEnvelope<Loaner>>(
      `${this.base}/rma-orders/${rmaId}/loaners`,
      payload,
      {
        context: handled409(),
      },
    );
  }

  returnLoaner(id: string, payload: ReturnLoanerPayload = {}): Observable<EsmEnvelope<Loaner>> {
    return this.http.post<EsmEnvelope<Loaner>>(`${this.base}/loaners/${id}/return`, payload, {
      context: handled409(),
    });
  }

  markLoanerLost(id: string): Observable<EsmEnvelope<Loaner>> {
    return this.http.post<EsmEnvelope<Loaner>>(
      `${this.base}/loaners/${id}/mark-lost`,
      {},
      {
        context: handled409(),
      },
    );
  }

  // --- Vendor claims ---

  listVendorClaims(filters: VendorClaimListFilters = {}): Observable<EsmPaginated<VendorClaim>> {
    return this.http.get<EsmPaginated<VendorClaim>>(`${this.base}/vendor-claims`, {
      params: toHttpParams(filters),
    });
  }

  getVendorClaim(id: string): Observable<EsmEnvelope<VendorClaim>> {
    return this.http.get<EsmEnvelope<VendorClaim>>(`${this.base}/vendor-claims/${id}`);
  }

  patchVendorClaim(
    id: string,
    payload: PatchVendorClaimPayload,
  ): Observable<EsmEnvelope<VendorClaim>> {
    return this.http.patch<EsmEnvelope<VendorClaim>>(`${this.base}/vendor-claims/${id}`, payload);
  }

  transitionVendorClaim(
    id: string,
    payload: VendorClaimTransitionPayload,
  ): Observable<EsmEnvelope<VendorClaim>> {
    return this.http.post<EsmEnvelope<VendorClaim>>(
      `${this.base}/vendor-claims/${id}/transition`,
      payload,
      {
        context: handled409(),
      },
    );
  }

  private transition<T = RmaOrder>(
    id: string,
    action: string,
    payload: object,
  ): Observable<EsmEnvelope<T>> {
    return this.http.post<EsmEnvelope<T>>(`${this.base}/rma-orders/${id}/${action}`, payload, {
      context: handled409(),
    });
  }
}
