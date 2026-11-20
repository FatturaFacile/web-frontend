import { computed, DestroyRef, effect, inject, Service, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { AuthStore } from '@core/auth/auth.store';
import { CopilotApiService } from './copilot-api.service';
import { contextFromUrl, starterPromptKeys } from './copilot-context';
import {
  CopilotApiError,
  CopilotContext,
  CopilotConversation,
  CopilotLocale,
  CopilotMessage,
  CopilotStreamEvent,
} from './copilot.models';

/** Translation key of the localized message for an API failure status. */
export function errorKeyForStatus(status: number): string {
  switch (status) {
    case 403:
      return 'COPILOT.ERROR.FORBIDDEN';
    case 404:
      return 'COPILOT.ERROR.NOT_FOUND';
    case 409:
      return 'COPILOT.ERROR.CONFLICT';
    case 422:
      return 'COPILOT.ERROR.INVALID';
    case 429:
      return 'COPILOT.ERROR.RATE_LIMIT';
    case 502:
      return 'COPILOT.ERROR.PROVIDER';
    default:
      return 'COPILOT.ERROR.GENERIC';
  }
}

const SUPPORTED: readonly CopilotLocale[] = ['it', 'de', 'fr', 'en'];

/** State of the Enterprise Copilot: drawer visibility, conversations, streamed answer, action cards and page context. */
@Service()
export class CopilotStore {
  private readonly api = inject(CopilotApiService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);

  readonly isOpen = signal(false);
  readonly conversations = signal<CopilotConversation[]>([]);
  readonly activeConversationId = signal<string | null>(null);
  readonly messages = signal<CopilotMessage[]>([]);
  readonly isStreaming = signal(false);
  /** Name of the tool the model is currently calling, while streaming. */
  readonly activeTool = signal<string | null>(null);
  /** Translation key of the last error, or null. */
  readonly errorKey = signal<string | null>(null);
  /** Ids of the messages whose action is being confirmed or rejected. */
  readonly busyActionIds = signal<ReadonlySet<string>>(new Set());

  /** Route and entity derived from the router. */
  private readonly routeContext = signal<CopilotContext>(contextFromUrl(this.router.url));
  /** Entity context published by a page; wins over the derived one for its route. */
  private readonly pageContext = signal<CopilotContext | null>(null);

  readonly context = computed<CopilotContext>(() => {
    const route = this.routeContext();
    const page = this.pageContext();

    return page && page.route === route.route ? { ...route, ...page } : route;
  });

  readonly contextLabel = computed(() => {
    const ctx = this.context();
    if (ctx.label) return ctx.label;
    if (ctx.entity_type && ctx.entity_id) return `${ctx.entity_type} #${ctx.entity_id}`;

    return null;
  });

  readonly activeConversation = computed(() => this.conversations().find((c) => c.id === this.activeConversationId()) ?? null);

  readonly pendingActions = computed(() =>
    this.messages().filter((m) => m.proposed_action !== null && (m.action_status ?? m.proposed_action.status) === 'pending'),
  );

  readonly starterPromptKeys = computed(() => starterPromptKeys(this.context().route, this.auth.activeRole()));

  readonly locale = computed<CopilotLocale>(() => {
    const lang = this.auth.activeLocale();

    return (SUPPORTED as readonly string[]).includes(lang) ? (lang as CopilotLocale) : 'en';
  });

  private abort: AbortController | null = null;

  constructor() {
    const sub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.routeContext.set(contextFromUrl(event.urlAfterRedirects));
      }
    });
    inject(DestroyRef).onDestroy(() => {
      sub.unsubscribe();
      this.abort?.abort();
    });

    // Refresh the history whenever the drawer opens.
    effect(() => {
      if (this.isOpen()) {
        void this.loadConversations();
      }
    });
  }

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update((v) => !v);
  }

  /** A page publishes the label (customer name, invoice number) of the entity it shows. */
  setPageContext(context: CopilotContext | null): void {
    this.pageContext.set(context);
  }

  async loadConversations(): Promise<void> {
    try {
      this.conversations.set(await this.api.listConversations());
    } catch (error) {
      this.fail(error);
    }
  }

  newConversation(): void {
    this.abort?.abort();
    this.activeConversationId.set(null);
    this.messages.set([]);
    this.errorKey.set(null);
  }

  async selectConversation(id: string): Promise<void> {
    this.errorKey.set(null);
    this.activeConversationId.set(id);
    try {
      const conversation = await this.api.getConversation(id);
      this.messages.set(conversation.messages ?? []);
    } catch (error) {
      this.fail(error);
    }
  }

  async deleteConversation(id: string): Promise<void> {
    try {
      await this.api.deleteConversation(id);
      this.conversations.update((list) => list.filter((c) => c.id !== id));
      if (this.activeConversationId() === id) {
        this.newConversation();
      }
    } catch (error) {
      this.fail(error);
    }
  }

  cancelStreaming(): void {
    this.abort?.abort();
  }

  /** Sends a prompt with the current context and applies the streamed events to the message list. */
  async send(prompt: string): Promise<void> {
    const text = prompt.trim();
    if (text === '' || this.isStreaming()) return;

    this.errorKey.set(null);
    this.isStreaming.set(true);
    const abort = new AbortController();
    this.abort = abort;
    const ctx = this.context();
    const requestContext = { route: ctx.route, entity_type: ctx.entity_type, entity_id: ctx.entity_id };
    const now = new Date().toISOString();
    const assistantId = `pending-${Date.now()}`;

    try {
      let conversationId = this.activeConversationId();
      if (conversationId === null) {
        const created = await this.api.createConversation({
          title: text.slice(0, 80),
          locale: this.locale(),
          context_route: ctx.route,
          context_entity_type: ctx.entity_type,
          context_entity_id: ctx.entity_id,
        });
        conversationId = created.id;
        this.activeConversationId.set(created.id);
        this.conversations.update((list) => [created, ...list]);
      }
      const id = conversationId;

      this.messages.update((list) => [
        ...list,
        this.blank(`user-${Date.now()}`, id, 'user', text, now),
        { ...this.blank(assistantId, id, 'assistant', '', now), streaming: true },
      ]);

      let completed = false;
      for await (const event of this.api.streamMessage(
        id,
        { prompt: text, locale: this.locale(), context: requestContext },
        abort.signal,
      )) {
        completed = this.apply(event, assistantId) || completed;
      }

      if (completed) {
        await this.selectConversation(id);
        void this.loadConversations();
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        this.fail(error);
      }
    } finally {
      this.messages.update((list) => list.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)));
      this.isStreaming.set(false);
      this.activeTool.set(null);
    }
  }

  /** Applies one streamed event; returns true when it completed the message. */
  apply(event: CopilotStreamEvent, assistantId: string): boolean {
    const patch = (fn: (m: CopilotMessage) => CopilotMessage): void =>
      this.messages.update((list) => list.map((m) => (m.id === assistantId ? fn(m) : m)));

    switch (event.event) {
      case 'token':
        patch((m) => ({ ...m, content_markdown: m.content_markdown + event.data.text }));
        break;
      case 'tool.call':
        this.activeTool.set(typeof event.data['tool'] === 'string' ? event.data['tool'] : null);
        break;
      case 'tool.result':
        this.activeTool.set(null);
        break;
      case 'visualization':
        patch((m) => ({ ...m, visualization: event.data }));
        break;
      case 'action.proposed':
        patch((m) => ({ ...m, proposed_action: event.data, action_status: 'pending' }));
        break;
      case 'error':
        this.errorKey.set('COPILOT.ERROR.PROVIDER');
        break;
      case 'message.completed':
        return true;
      default:
        break;
    }

    return false;
  }

  async confirmAction(messageId: string, overrides: Record<string, unknown>): Promise<void> {
    await this.runAction(messageId, () => this.api.confirmAction(messageId, overrides));
  }

  async rejectAction(messageId: string, reason?: string): Promise<void> {
    await this.runAction(messageId, () => this.api.rejectAction(messageId, reason));
  }

  private async runAction(messageId: string, call: () => Promise<CopilotMessage>): Promise<void> {
    if (this.busyActionIds().has(messageId)) return;

    this.busyActionIds.update((s) => new Set(s).add(messageId));
    this.errorKey.set(null);
    try {
      const updated = await call();
      if (updated?.proposed_action) {
        this.messages.update((list) => list.map((m) => (m.id === messageId ? { ...m, ...updated } : m)));
      } else if (this.activeConversationId()) {
        await this.selectConversation(this.activeConversationId() as string);
      }
    } catch (error) {
      this.fail(error);
    } finally {
      this.busyActionIds.update((s) => {
        const next = new Set(s);
        next.delete(messageId);

        return next;
      });
    }
  }

  private blank(id: string, conversationId: string, role: 'user' | 'assistant', content: string, createdAt: string): CopilotMessage {
    return {
      id,
      conversation_id: conversationId,
      role,
      content_markdown: content,
      citations: [],
      visualization: null,
      proposed_action: null,
      action_status: null,
      created_at: createdAt,
    };
  }

  private fail(error: unknown): void {
    const status = error instanceof CopilotApiError ? error.status : ((error as { status?: number })?.status ?? 0);
    this.errorKey.set(errorKeyForStatus(status));
  }
}
