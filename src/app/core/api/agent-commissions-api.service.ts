import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  AgcAgentFilters,
  AgcAgentPayload,
  AgcAgentProfile,
  AgcEnasarcoOverview,
  AgcEnvelope,
  AgcFiscalOverridePayload,
  AgcFiscalParameter,
  AgcGeneratePayload,
  AgcLedgerEntry,
  AgcLedgerFilters,
  AgcLedgerPage,
  AgcLookups,
  AgcPage,
  AgcPayPayload,
  AgcRepresentative,
  AgcResolveParams,
  AgcResolveResult,
  AgcRule,
  AgcRulePayload,
  AgcSendPayload,
  AgcStatement,
  AgcStatementFilters,
  AgcStatementPreview,
  AgcSyncPayload,
  AgcSyncResult,
  AgcZone,
  AgcZonePayload,
} from '../models';

type Envelope<T> = Observable<AgcEnvelope<T>>;

/** Endpoints of the sales commission and agent management module (Mod 041). */
@Service()
export class AgentCommissionsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/agent-commissions`;

  // --- Lookups ---

  getLookups(): Envelope<AgcLookups> {
    return this.http.get<AgcEnvelope<AgcLookups>>(`${this.base}/lookups`);
  }

  // --- Agents ---

  getAvailableRepresentatives(): Envelope<AgcRepresentative[]> {
    return this.http.get<AgcEnvelope<AgcRepresentative[]>>(
      `${this.base}/representatives/available`,
    );
  }

  listAgents(filters: AgcAgentFilters = {}): Envelope<AgcAgentProfile[]> {
    return this.http.get<AgcEnvelope<AgcAgentProfile[]>>(`${this.base}/agents`, {
      params: toHttpParams(filters),
    });
  }

  getAgent(id: string): Envelope<AgcAgentProfile> {
    return this.http.get<AgcEnvelope<AgcAgentProfile>>(`${this.base}/agents/${id}`);
  }

  createAgent(payload: AgcAgentPayload): Envelope<AgcAgentProfile> {
    return this.http.post<AgcEnvelope<AgcAgentProfile>>(`${this.base}/agents`, payload);
  }

  updateAgent(id: string, payload: AgcAgentPayload): Envelope<AgcAgentProfile> {
    return this.http.put<AgcEnvelope<AgcAgentProfile>>(`${this.base}/agents/${id}`, payload);
  }

  deleteAgent(id: string): Envelope<null> {
    return this.http.delete<AgcEnvelope<null>>(`${this.base}/agents/${id}`);
  }

  // --- Zones ---

  listZones(): Envelope<AgcZone[]> {
    return this.http.get<AgcEnvelope<AgcZone[]>>(`${this.base}/zones`);
  }

  createZone(payload: AgcZonePayload): Envelope<AgcZone> {
    return this.http.post<AgcEnvelope<AgcZone>>(`${this.base}/zones`, payload);
  }

  updateZone(id: string, payload: AgcZonePayload): Envelope<AgcZone> {
    return this.http.put<AgcEnvelope<AgcZone>>(`${this.base}/zones/${id}`, payload);
  }

  deleteZone(id: string): Envelope<null> {
    return this.http.delete<AgcEnvelope<null>>(`${this.base}/zones/${id}`);
  }

  // --- Rules ---

  listRules(agentProfileId?: string): Envelope<AgcRule[]> {
    return this.http.get<AgcEnvelope<AgcRule[]>>(`${this.base}/rules`, {
      params: toHttpParams({ agent_profile_id: agentProfileId }),
    });
  }

  createRule(payload: AgcRulePayload): Envelope<AgcRule> {
    return this.http.post<AgcEnvelope<AgcRule>>(`${this.base}/rules`, payload);
  }

  updateRule(id: string, payload: AgcRulePayload): Envelope<AgcRule> {
    return this.http.put<AgcEnvelope<AgcRule>>(`${this.base}/rules/${id}`, payload);
  }

  deleteRule(id: string): Envelope<null> {
    return this.http.delete<AgcEnvelope<null>>(`${this.base}/rules/${id}`);
  }

  /** The precedence simulator: which rule would win for an agent, a customer and a product line on a date. */
  resolveRule(params: AgcResolveParams): Envelope<AgcResolveResult> {
    return this.http.get<AgcEnvelope<AgcResolveResult>>(`${this.base}/rules/resolve`, {
      params: toHttpParams(params),
    });
  }

  // --- Fiscal parameters ---

  listFiscalParameters(): Envelope<AgcFiscalParameter[]> {
    return this.http.get<AgcEnvelope<AgcFiscalParameter[]>>(`${this.base}/fiscal-parameters`);
  }

  saveFiscalOverride(payload: AgcFiscalOverridePayload): Envelope<AgcFiscalParameter> {
    return this.http.put<AgcEnvelope<AgcFiscalParameter>>(
      `${this.base}/fiscal-parameters`,
      payload,
    );
  }

  deleteFiscalOverride(id: string): Envelope<null> {
    return this.http.delete<AgcEnvelope<null>>(`${this.base}/fiscal-parameters/${id}`);
  }

  // --- Ledger ---

  listLedger(filters: AgcLedgerFilters = {}): Observable<AgcLedgerPage> {
    return this.http.get<AgcLedgerPage>(`${this.base}/ledger`, { params: toHttpParams(filters) });
  }

  getLedgerEntry(id: string): Envelope<AgcLedgerEntry> {
    return this.http.get<AgcEnvelope<AgcLedgerEntry>>(`${this.base}/ledger/${id}`);
  }

  /** Accrues the invoices of a period and re-reads the collections of the open commissions. */
  sync(payload: AgcSyncPayload = {}): Envelope<AgcSyncResult> {
    return this.http.post<AgcEnvelope<AgcSyncResult>>(`${this.base}/sync`, payload);
  }

  // --- Enasarco and FIRR ---

  getEnasarcoOverview(year?: number, agentProfileId?: string): Observable<AgcEnasarcoOverview> {
    return this.http.get<AgcEnasarcoOverview>(`${this.base}/enasarco/overview`, {
      params: toHttpParams({ year, agent_profile_id: agentProfileId }),
    });
  }

  // --- Statements ---

  listStatements(filters: AgcStatementFilters = {}): Observable<AgcPage<AgcStatement>> {
    return this.http.get<AgcPage<AgcStatement>>(`${this.base}/statements`, {
      params: toHttpParams(filters),
    });
  }

  previewStatement(payload: AgcGeneratePayload): Envelope<AgcStatementPreview> {
    return this.http.post<AgcEnvelope<AgcStatementPreview>>(
      `${this.base}/statements/preview`,
      payload,
    );
  }

  generateStatement(payload: AgcGeneratePayload): Envelope<AgcStatement> {
    return this.http.post<AgcEnvelope<AgcStatement>>(`${this.base}/statements`, payload);
  }

  getStatement(id: string): Envelope<AgcStatement> {
    return this.http.get<AgcEnvelope<AgcStatement>>(`${this.base}/statements/${id}`);
  }

  downloadStatementPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/statements/${id}/pdf`, { responseType: 'blob' });
  }

  approveStatement(id: string): Envelope<AgcStatement> {
    return this.http.post<AgcEnvelope<AgcStatement>>(`${this.base}/statements/${id}/approve`, {});
  }

  voidStatement(id: string): Envelope<AgcStatement> {
    return this.http.post<AgcEnvelope<AgcStatement>>(`${this.base}/statements/${id}/void`, {});
  }

  /** Prepares the commission invoice / self-billing data of an approved statement (nothing is transmitted). */
  prepareSelfBilling(id: string, date?: string | null): Envelope<AgcStatement> {
    return this.http.post<AgcEnvelope<AgcStatement>>(
      `${this.base}/statements/${id}/self-billing`,
      date ? { date } : {},
    );
  }

  payStatement(id: string, payload: AgcPayPayload = {}): Envelope<AgcStatement> {
    return this.http.post<AgcEnvelope<AgcStatement>>(`${this.base}/statements/${id}/pay`, payload);
  }

  sendStatement(id: string, payload: AgcSendPayload = {}): Envelope<AgcStatement> {
    return this.http.post<AgcEnvelope<AgcStatement>>(`${this.base}/statements/${id}/send`, payload);
  }

  // --- Compliance exports (CSV) ---

  exportCu(year: number): Observable<Blob> {
    return this.http.get(`${this.base}/exports/cu`, {
      params: toHttpParams({ year }),
      responseType: 'blob',
    });
  }

  exportEnasarco(year: number, quarter?: number | null): Observable<Blob> {
    return this.http.get(`${this.base}/exports/enasarco`, {
      params: toHttpParams({ year, quarter }),
      responseType: 'blob',
    });
  }
}
