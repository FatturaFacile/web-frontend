import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { firstValueFrom } from 'rxjs';
import { getXsrfCookie } from '@core/auth/csrf.utils';
import { USER_ID_STORAGE_KEY } from '@core/auth/auth.store';
import {
  CopilotApiError,
  CopilotConversation,
  CopilotEnvelope,
  CopilotLocale,
  CopilotMessage,
  CopilotStreamEvent,
} from './copilot.models';
import { readSseStream } from './sse-reader';

export interface CopilotPromptContext {
  route: string;
  entity_type: string | null;
  entity_id: string | null;
}

export interface CreateConversationPayload {
  title?: string;
  locale?: CopilotLocale;
  context_route?: string;
  context_entity_type?: string | null;
  context_entity_id?: string | null;
}

/**
 * REST client of the Copilot API. Plain calls go through HttpClient (and its interceptors); the streamed answer uses
 * `fetch` because HttpClient cannot expose a `ReadableStream`, so it adds the session, tenant, CSRF and language
 * headers the interceptors would add.
 */
@Service()
export class CopilotApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/copilot`;

  async listConversations(): Promise<CopilotConversation[]> {
    const res = await firstValueFrom(this.http.get<CopilotEnvelope<CopilotConversation[]>>(`${this.baseUrl}/conversations`));

    return res.data ?? [];
  }

  async createConversation(payload: CreateConversationPayload): Promise<CopilotConversation> {
    const res = await firstValueFrom(this.http.post<CopilotEnvelope<CopilotConversation>>(`${this.baseUrl}/conversations`, payload));

    return res.data;
  }

  async getConversation(id: string): Promise<CopilotConversation> {
    const res = await firstValueFrom(this.http.get<CopilotEnvelope<CopilotConversation>>(`${this.baseUrl}/conversations/${id}`));

    return res.data;
  }

  async deleteConversation(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/conversations/${id}`));
  }

  async confirmAction(messageId: string, overrides: Record<string, unknown>): Promise<CopilotMessage> {
    const res = await firstValueFrom(
      this.http.post<CopilotEnvelope<CopilotMessage>>(`${this.baseUrl}/actions/${messageId}/confirm`, Object.keys(overrides).length ? { overrides } : {}),
    );

    return res.data;
  }

  async rejectAction(messageId: string, reason?: string): Promise<CopilotMessage> {
    const res = await firstValueFrom(
      this.http.post<CopilotEnvelope<CopilotMessage>>(`${this.baseUrl}/actions/${messageId}/reject`, reason ? { reason } : {}),
    );

    return res.data;
  }

  /** Sends a prompt and yields the streamed events; throws `CopilotApiError` with the HTTP status when refused. */
  async *streamMessage(
    conversationId: string,
    body: { prompt: string; locale?: CopilotLocale; context?: CopilotPromptContext },
    signal?: AbortSignal,
  ): AsyncGenerator<CopilotStreamEvent> {
    const response = await fetch(`${this.baseUrl}/conversations/${conversationId}/messages`, {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: this.streamHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      throw new CopilotApiError(response.status, await this.errorMessage(response));
    }

    for await (const frame of readSseStream(response.body)) {
      yield { event: frame.event, data: frame.data } as CopilotStreamEvent;
    }
  }

  private streamHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'X-Requested-With': 'XMLHttpRequest',
    };
    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    const tenant = storage?.getItem('ff_active_tenant_id') || storage?.getItem('tenant_id') || storage?.getItem('ff_tenant_id');
    const lang = storage?.getItem('lang') || storage?.getItem('ff_lang');
    const user = storage?.getItem(USER_ID_STORAGE_KEY);
    const xsrf = getXsrfCookie('XSRF-TOKEN');

    if (tenant) headers['X-Tenant-Id'] = tenant;
    if (lang) headers['X-Language-Code'] = lang;
    if (user) headers['X-User-Id'] = user;
    if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;

    return headers;
  }

  private async errorMessage(response: Response): Promise<string> {
    try {
      const json = (await response.json()) as { message?: string };

      return json.message ?? response.statusText;
    } catch {
      return response.statusText;
    }
  }
}
