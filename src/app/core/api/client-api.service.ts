import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import {
  ConsentLedger,
  ConsentPayload,
  ConsentRecord,
  ContactAddressPayload,
  ContactAddressRecord,
  ContactHierarchy,
  ContactPersonPayload,
  ContactPersonRecord,
  InteractionPage,
  InteractionPayload,
  InteractionRecord,
} from '../models/customer-360.model';
import {
  ApiResponse,
  ContactFilterParams,
  ContactPayload,
  ContactResource,
  LaravelPaginationMeta,
  PaginatedResponse,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

type PaginatorBody = LaravelPaginationMeta & { data: ContactResource[] };

@Service()
export class ClientApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/crm/contacts`;

  /** The API wraps the Laravel paginator in `data`; a plain array with optional `meta` is accepted too. */
  list(filters: ContactFilterParams): Observable<PaginatedResponse<ContactResource>> {
    return this.http
      .get<ApiResponse<ContactResource[] | PaginatorBody> & Partial<Pick<PaginatedResponse<ContactResource>, 'meta'>>>(
        this.url,
        { params: toHttpParams(filters) },
      )
      .pipe(
        map((res) => {
          const body = res.data;
          const items = Array.isArray(body) ? body : body.data;
          const meta: LaravelPaginationMeta =
            res.meta ??
            (Array.isArray(body)
              ? {
                  current_page: filters.page ?? 1,
                  from: null,
                  to: null,
                  last_page: 1,
                  per_page: items.length,
                  total: items.length,
                }
              : {
                  current_page: body.current_page,
                  from: body.from,
                  to: body.to,
                  last_page: body.last_page,
                  per_page: body.per_page,
                  total: body.total,
                });
          return { ...res, data: items, meta };
        }),
      );
  }

  get(id: string): Observable<ApiResponse<ContactResource>> {
    return this.http.get<ApiResponse<ContactResource>>(`${this.url}/${id}`);
  }

  create(payload: ContactPayload): Observable<ApiResponse<ContactResource>> {
    return this.http.post<ApiResponse<ContactResource>>(this.url, payload);
  }

  update(id: string, payload: Partial<ContactPayload>): Observable<ApiResponse<ContactResource>> {
    return this.http.put<ApiResponse<ContactResource>>(`${this.url}/${id}`, payload);
  }

  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}`);
  }

  addresses(id: string): Observable<ApiResponse<ContactAddressRecord[]>> {
    return this.http.get<ApiResponse<ContactAddressRecord[]>>(`${this.url}/${id}/addresses`);
  }

  createAddress(id: string, payload: ContactAddressPayload): Observable<ApiResponse<ContactAddressRecord>> {
    return this.http.post<ApiResponse<ContactAddressRecord>>(`${this.url}/${id}/addresses`, payload);
  }

  /** Makes the address the default one of its type; the API demotes the previous default of that type. */
  setDefaultAddress(id: string, addressId: string): Observable<ApiResponse<ContactAddressRecord>> {
    return this.http.post<ApiResponse<ContactAddressRecord>>(
      `${this.url}/${id}/addresses/${addressId}/default`,
      {},
    );
  }

  deleteAddress(id: string, addressId: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}/addresses/${addressId}`);
  }

  persons(id: string): Observable<ApiResponse<ContactPersonRecord[]>> {
    return this.http.get<ApiResponse<ContactPersonRecord[]>>(`${this.url}/${id}/persons`);
  }

  createPerson(id: string, payload: ContactPersonPayload): Observable<ApiResponse<ContactPersonRecord>> {
    return this.http.post<ApiResponse<ContactPersonRecord>>(`${this.url}/${id}/persons`, payload);
  }

  updatePerson(
    id: string,
    personId: string,
    payload: ContactPersonPayload,
  ): Observable<ApiResponse<ContactPersonRecord>> {
    return this.http.put<ApiResponse<ContactPersonRecord>>(`${this.url}/${id}/persons/${personId}`, payload);
  }

  deletePerson(id: string, personId: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}/persons/${personId}`);
  }

  hierarchy(id: string): Observable<ApiResponse<ContactHierarchy>> {
    return this.http.get<ApiResponse<ContactHierarchy>>(`${this.url}/${id}/hierarchy`);
  }

  /** GDPR / nLPD consent ledger of a contact: the effective state per channel and purpose, and the history. */
  consents(contactId: string): Observable<ConsentLedger> {
    return this.http.get<ConsentLedger>(`${environment.apiBaseUrl}/crm/consents`, {
      params: { contact_id: contactId },
    });
  }

  /** Consent records are append-only: a change is a new grant or withdrawal. */
  recordConsent(payload: ConsentPayload): Observable<ConsentRecord> {
    return this.http.post<ConsentRecord>(`${environment.apiBaseUrl}/crm/consents`, payload);
  }

  interactions(id: string, page = 1, perPage = 25): Observable<InteractionPage> {
    return this.http.get<InteractionPage>(`${this.url}/${id}/interactions`, {
      params: { page, per_page: perPage },
    });
  }

  createInteraction(id: string, payload: InteractionPayload): Observable<{ data: InteractionRecord }> {
    return this.http.post<{ data: InteractionRecord }>(`${this.url}/${id}/interactions`, payload);
  }

  lookupFiscal(payload: {
    country: string;
    vat_number?: string;
    uid_number?: string;
  }): Observable<
    ApiResponse<{
      valid_format: boolean;
      registry_verified: boolean;
      source: string;
      data: {
        country?: string;
        vat_number?: string;
        uid_number?: string;
        company_name?: string;
        address?: {
          street?: string;
          postal_code?: string;
          city?: string;
          state_canton?: string;
          country?: string;
        };
      };
      warnings: string[];
    }>
  > {
    return this.http.post<
      ApiResponse<{
        valid_format: boolean;
        registry_verified: boolean;
        source: string;
        data: {
          country?: string;
          vat_number?: string;
          uid_number?: string;
          company_name?: string;
          address?: {
            street?: string;
            postal_code?: string;
            city?: string;
            state_canton?: string;
            country?: string;
          };
        };
        warnings: string[];
      }>
    >(`${environment.apiBaseUrl}/crm/fiscal/lookup`, payload);
  }
}
