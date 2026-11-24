import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '@env';
import {
  CustomerLifecycleSummary,
  CustomerTimelineEvent,
  TimelineType,
} from '../models/customer-lifecycle.model';

interface AccountRow {
  id: string;
}

interface AccountListBody { data?: AccountRow[] | { data?: AccountRow[] } }

export type QuickActionType = 'meeting' | 'follow_up';

/** Cross-module customer lifecycle: the 360 summary and timeline of the CRM account behind a contact. */
@Service()
export class CustomerLifecycleApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/crm`;

  /** Resolves the CRM account of a contact (party master); `null` when the contact has no account. */
  accountIdForContact(contactId: string): Observable<string | null> {
    return this.http
      .get<AccountListBody>(`${this.url}/accounts`, {
        params: new HttpParams().set('contact_id', contactId),
      })
      .pipe(
        map((body) => {
          const data = body.data;
          const rows = Array.isArray(data) ? data : (data?.data ?? []);
          return rows[0]?.id ?? null;
        }),
      );
  }

  summary(accountId: string): Observable<CustomerLifecycleSummary> {
    return this.http
      .get<{ data: CustomerLifecycleSummary }>(`${this.url}/customers/${accountId}/360`)
      .pipe(map((body) => body.data));
  }

  timeline(
    accountId: string,
    types: readonly TimelineType[] = [],
    limit = 50,
  ): Observable<CustomerTimelineEvent[]> {
    let params = new HttpParams().set('limit', limit);
    for (const type of types) {
      params = params.append('types[]', type);
    }
    return this.http
      .get<{ data: CustomerTimelineEvent[] }>(`${this.url}/customers/${accountId}/timeline`, {
        params,
      })
      .pipe(map((body) => body.data));
  }

  /** Logs a visit (meeting) or a follow-up as a CRM activity on the account. */
  createActivity(
    accountId: string,
    type: QuickActionType,
    subject: string,
    dueDate: string | null,
  ): Observable<void> {
    return this.http
      .post(`${this.url}/activities`, {
        type,
        subject,
        due_date: dueDate,
        related_type: 'account',
        related_id: accountId,
      })
      .pipe(map(() => undefined));
  }
}
