import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { handleErrorsLocally } from '../http/error-handling.context';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  PortalBranding,
  PortalCheckout,
  PortalCheckoutMethod,
  PortalDashboard,
  PortalDeliveryNote,
  PortalEnvelope,
  PortalInvoice,
  PortalOrder,
  PortalPaymentStatus,
  PortalQuote,
  PortalQuoteApprovalPayload,
  PortalTicket,
  PortalTicketPayload,
  PortalVerifyPayload,
  PortalVerifyResult,
} from '../models/portal-area.models';

/**
 * The portal screens render every error themselves (no global toast, no redirect to the staff `/login`): the
 * session interceptor handles 401 by sending the customer back to `/portal/login`.
 */
const PORTAL_ERRORS = () => handleErrorsLocally(0, 401, 403, 404, 410, 422, 429, 500, 503);

/** Self-service customer portal (`{apiBaseUrl}/portal`). Everything but branding and sign-in needs the bearer session. */
@Service()
export class PortalAreaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/portal`;

  getBranding(slug: string | null): Observable<PortalEnvelope<PortalBranding>> {
    return this.http.get<PortalEnvelope<PortalBranding>>(`${this.base}/branding`, {
      params: toHttpParams({ slug }),
      context: PORTAL_ERRORS(),
    });
  }

  requestLink(email: string, slug: string | null): Observable<PortalEnvelope<null>> {
    return this.http.post<PortalEnvelope<null>>(
      `${this.base}/auth/request-link`,
      { email },
      { params: toHttpParams({ slug }), context: PORTAL_ERRORS() },
    );
  }

  verify(payload: PortalVerifyPayload): Observable<PortalEnvelope<PortalVerifyResult>> {
    return this.http.post<PortalEnvelope<PortalVerifyResult>>(`${this.base}/auth/verify`, payload, {
      context: PORTAL_ERRORS(),
    });
  }

  logout(): Observable<PortalEnvelope<null>> {
    return this.http.post<PortalEnvelope<null>>(
      `${this.base}/auth/logout`,
      {},
      { context: PORTAL_ERRORS() },
    );
  }

  dashboard(): Observable<PortalEnvelope<PortalDashboard>> {
    return this.http.get<PortalEnvelope<PortalDashboard>>(`${this.base}/me`, {
      context: PORTAL_ERRORS(),
    });
  }

  invoices(paymentStatus?: PortalPaymentStatus): Observable<PortalEnvelope<PortalInvoice[]>> {
    return this.http.get<PortalEnvelope<PortalInvoice[]>>(`${this.base}/invoices`, {
      params: toHttpParams({ payment_status: paymentStatus }),
      context: PORTAL_ERRORS(),
    });
  }

  quotes(): Observable<PortalEnvelope<PortalQuote[]>> {
    return this.http.get<PortalEnvelope<PortalQuote[]>>(`${this.base}/quotes`, {
      context: PORTAL_ERRORS(),
    });
  }

  orders(): Observable<PortalEnvelope<PortalOrder[]>> {
    return this.http.get<PortalEnvelope<PortalOrder[]>>(`${this.base}/orders`, {
      context: PORTAL_ERRORS(),
    });
  }

  deliveryNotes(): Observable<PortalEnvelope<PortalDeliveryNote[]>> {
    return this.http.get<PortalEnvelope<PortalDeliveryNote[]>>(`${this.base}/delivery-notes`, {
      context: PORTAL_ERRORS(),
    });
  }

  approveQuote(
    id: string,
    payload: PortalQuoteApprovalPayload,
  ): Observable<PortalEnvelope<PortalQuote>> {
    return this.http.post<PortalEnvelope<PortalQuote>>(
      `${this.base}/quotes/${id}/approve`,
      payload,
      {
        context: PORTAL_ERRORS(),
      },
    );
  }

  rejectQuote(id: string, reason?: string): Observable<PortalEnvelope<PortalQuote>> {
    return this.http.post<PortalEnvelope<PortalQuote>>(
      `${this.base}/quotes/${id}/reject`,
      { reason },
      { context: PORTAL_ERRORS() },
    );
  }

  /** Files are fetched with the bearer header (an `<a href>` could not carry it), then saved from a blob. */
  download(
    kind: 'invoices' | 'quotes' | 'delivery-notes',
    id: string,
    format: 'pdf' | 'xml',
  ): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.base}/${kind}/${id}/${format}`, {
      observe: 'response',
      responseType: 'blob',
      context: PORTAL_ERRORS(),
    });
  }

  /** `paymentMethod` is the backend value (card, twint, sepa, paypal, qr); omitted, the gateway offers its default page. */
  checkout(
    invoiceId: string,
    paymentMethod?: PortalCheckoutMethod,
  ): Observable<PortalEnvelope<PortalCheckout>> {
    return this.http.post<PortalEnvelope<PortalCheckout>>(
      `${this.base}/invoices/${invoiceId}/checkout`,
      paymentMethod ? { payment_method: paymentMethod } : {},
      { context: PORTAL_ERRORS() },
    );
  }

  tickets(): Observable<PortalEnvelope<PortalTicket[]>> {
    return this.http.get<PortalEnvelope<PortalTicket[]>>(`${this.base}/tickets`, {
      context: PORTAL_ERRORS(),
    });
  }

  createTicket(payload: PortalTicketPayload): Observable<PortalEnvelope<PortalTicket>> {
    const form = new FormData();
    form.append('kind', payload.kind);
    form.append('subject', payload.subject);
    form.append('description', payload.description);
    for (const key of ['invoice_id', 'order_id', 'ddt_id'] as const) {
      const value = payload[key];
      if (value) {
        form.append(key, value);
      }
    }
    for (const file of payload.attachments ?? []) {
      form.append('attachments[]', file, file.name);
    }
    return this.http.post<PortalEnvelope<PortalTicket>>(`${this.base}/tickets`, form, {
      context: PORTAL_ERRORS(),
    });
  }
}
