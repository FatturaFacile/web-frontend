import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../../../core/http/laravel-http.utils';
import {
  BillingContract,
  BillingContractPayload,
  ContractStatus,
  Envelope,
  InvoiceDraft,
  Paginated,
  RetainerEntry,
  RetainerState,
  RetainerTopUpPayload,
  RetentionBalance,
  RetentionReleasePayload,
  SalCertificate,
  SalPayload,
  TimeAndMaterialsPreview,
  UnbilledSummary,
  WipRun,
  WipRunPayload,
  WipRunResult,
} from './project-billing.models';

/** HTTP access to the project billing endpoints of the projects API (Mod 081). */
@Service()
export class ProjectBillingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/projects`;

  contract(projectId: string): Observable<Envelope<BillingContract | null>> {
    return this.http.get<Envelope<BillingContract | null>>(
      `${this.base}/${projectId}/billing-contract`,
    );
  }

  saveContract(
    projectId: string,
    payload: BillingContractPayload,
  ): Observable<Envelope<BillingContract>> {
    return this.http.put<Envelope<BillingContract>>(
      `${this.base}/${projectId}/billing-contract`,
      payload,
    );
  }

  changeContractStatus(
    projectId: string,
    status: ContractStatus,
    expectedVersion: number | null,
  ): Observable<Envelope<BillingContract>> {
    return this.http.post<Envelope<BillingContract>>(
      `${this.base}/${projectId}/billing-contract/status`,
      {
        billing_status: status,
        expected_version: expectedVersion,
      },
    );
  }

  unbilledSummary(projectId: string): Observable<Envelope<UnbilledSummary>> {
    return this.http.get<Envelope<UnbilledSummary>>(
      `${this.base}/${projectId}/billing/unbilled-summary`,
    );
  }

  timeAndMaterialsPreview(
    projectId: string,
    upToDate: string,
  ): Observable<Envelope<TimeAndMaterialsPreview>> {
    return this.http.get<Envelope<TimeAndMaterialsPreview>>(
      `${this.base}/${projectId}/billing/contract/time-and-materials`,
      {
        params: toHttpParams({ up_to_date: upToDate }),
      },
    );
  }

  draftTimeAndMaterials(
    projectId: string,
    upToDate: string,
    taxRate: number,
  ): Observable<Envelope<InvoiceDraft>> {
    return this.http.post<Envelope<InvoiceDraft>>(
      `${this.base}/${projectId}/billing/contract/time-and-materials`,
      {
        up_to_date: upToDate,
        tax_rate: taxRate,
      },
    );
  }

  billMilestone(
    projectId: string,
    milestoneId: string,
    taxRate: number,
  ): Observable<Envelope<InvoiceDraft>> {
    return this.http.post<Envelope<InvoiceDraft>>(
      `${this.base}/${projectId}/billing/contract/milestones/${milestoneId}`,
      { tax_rate: taxRate },
    );
  }

  salCertificates(projectId: string): Observable<Envelope<SalCertificate[]>> {
    return this.http.get<Envelope<SalCertificate[]>>(`${this.base}/${projectId}/sal-certificates`);
  }

  createSal(projectId: string, payload: SalPayload): Observable<Envelope<SalCertificate>> {
    return this.http.post<Envelope<SalCertificate>>(
      `${this.base}/${projectId}/sal-certificates`,
      payload,
    );
  }

  submitSal(projectId: string, salId: string): Observable<Envelope<SalCertificate>> {
    return this.http.post<Envelope<SalCertificate>>(
      `${this.base}/${projectId}/sal-certificates/${salId}/submit`,
      {},
    );
  }

  approveAndInvoiceSal(
    projectId: string,
    salId: string,
    taxRate: number,
    approvedBy: string | null,
  ): Observable<Envelope<SalCertificate>> {
    return this.http.post<Envelope<SalCertificate>>(
      `${this.base}/${projectId}/sal-certificates/${salId}/approve-and-invoice`,
      {
        tax_rate: taxRate,
        approved_by: approvedBy,
      },
    );
  }

  cancelSal(
    projectId: string,
    salId: string,
    reason: string | null,
  ): Observable<Envelope<SalCertificate>> {
    return this.http.post<Envelope<SalCertificate>>(
      `${this.base}/${projectId}/sal-certificates/${salId}/cancel`,
      { reason },
    );
  }

  retention(projectId: string): Observable<Envelope<RetentionBalance>> {
    return this.http.get<Envelope<RetentionBalance>>(`${this.base}/${projectId}/retention`);
  }

  releaseRetention(
    projectId: string,
    payload: RetentionReleasePayload,
  ): Observable<Envelope<unknown>> {
    return this.http.post<Envelope<unknown>>(
      `${this.base}/${projectId}/retention/release`,
      payload,
    );
  }

  retainer(projectId: string): Observable<Envelope<RetainerState>> {
    return this.http.get<Envelope<RetainerState>>(`${this.base}/${projectId}/retainer`);
  }

  topUpRetainer(
    projectId: string,
    payload: RetainerTopUpPayload,
  ): Observable<Envelope<RetainerEntry>> {
    return this.http.post<Envelope<RetainerEntry>>(
      `${this.base}/${projectId}/retainer/top-up`,
      payload,
    );
  }

  consumeRetainer(
    projectId: string,
    upToDate: string,
  ): Observable<
    Envelope<{ consumed_hours: string; consumed_amount: string; timesheet_ids: string[] }>
  > {
    return this.http.post<
      Envelope<{ consumed_hours: string; consumed_amount: string; timesheet_ids: string[] }>
    >(`${this.base}/${projectId}/retainer/consume`, { up_to_date: upToDate });
  }

  wipRuns(
    filters: { periodEndDate?: string; projectId?: string; page?: number } = {},
  ): Observable<Paginated<WipRun>> {
    return this.http.get<Paginated<WipRun>>(`${this.base}/wip-valuations`, {
      params: toHttpParams({
        period_end_date: filters.periodEndDate,
        project_id: filters.projectId,
        page: filters.page,
      }),
    });
  }

  /** Values every open project at the period end, or only `project_id` when given. */
  runWip(payload: WipRunPayload): Observable<Envelope<WipRunResult>> {
    return this.http.post<Envelope<WipRunResult>>(`${this.base}/wip-valuations`, payload);
  }
}
