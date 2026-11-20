import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { AuthStore } from '@core/auth/auth.store';
import { CopilotApiService } from './copilot-api.service';
import { CopilotApiError, CopilotConversation, CopilotMessage, CopilotStreamEvent } from './copilot.models';
import { CopilotStore, errorKeyForStatus } from './copilot.store';

const stored = (over: Partial<CopilotMessage> = {}): CopilotMessage => ({
  id: 'm2',
  conversation_id: 'c1',
  role: 'assistant',
  content_markdown: 'Hello world',
  citations: [],
  visualization: null,
  proposed_action: null,
  action_status: null,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

describe('CopilotStore', () => {
  const conversation: CopilotConversation = { id: 'c1', title: 'Q' };
  let api: {
    listConversations: ReturnType<typeof vi.fn>;
    createConversation: ReturnType<typeof vi.fn>;
    getConversation: ReturnType<typeof vi.fn>;
    deleteConversation: ReturnType<typeof vi.fn>;
    confirmAction: ReturnType<typeof vi.fn>;
    rejectAction: ReturnType<typeof vi.fn>;
    streamMessage: ReturnType<typeof vi.fn>;
  };
  let store: CopilotStore;
  let streamed: CopilotStreamEvent[];

  beforeEach(() => {
    streamed = [];
    api = {
      listConversations: vi.fn().mockResolvedValue([conversation]),
      createConversation: vi.fn().mockResolvedValue(conversation),
      getConversation: vi.fn().mockResolvedValue({ ...conversation, messages: [stored({ role: 'user', id: 'm1', content_markdown: 'Hi' }), stored()] }),
      deleteConversation: vi.fn().mockResolvedValue(undefined),
      confirmAction: vi.fn(),
      rejectAction: vi.fn(),
      streamMessage: vi.fn().mockImplementation(async function* () {
        for (const event of streamed) {
          yield event;
        }
      }),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: CopilotApiService, useValue: api }, { provide: AuthStore, useValue: { activeRole: () => 'sales', activeLocale: () => 'de' } }],
    });
    store = TestBed.inject(CopilotStore);
  });

  it('creates a conversation, streams tokens and reloads the stored message on completion', async () => {
    streamed = [
      { event: 'tool.call', data: { tool: 'query' } },
      { event: 'token', data: { text: 'Hello ' } },
      { event: 'token', data: { text: 'world' } },
      { event: 'message.completed', data: { message_id: 'm2', conversation_id: 'c1' } },
    ];

    await store.send('Hi');

    expect(api.createConversation).toHaveBeenCalledWith(expect.objectContaining({ locale: 'de' }));
    expect(api.streamMessage.mock.calls[0][1]).toMatchObject({ prompt: 'Hi', locale: 'de', context: { route: expect.any(String), entity_type: null, entity_id: null } });
    expect(api.getConversation).toHaveBeenCalledWith('c1');
    expect(store.messages().map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(store.isStreaming()).toBe(false);
    expect(store.activeTool()).toBeNull();
  });

  it('applies visualization and action events to the streaming message', async () => {
    const seen: CopilotMessage[][] = [];
    api.getConversation.mockImplementation(() => {
      seen.push(store.messages());

      return Promise.resolve({ ...conversation, messages: [] });
    });
    const action = { tool: 't', module: 'm', status: 'pending', summary: 's', arguments: {}, details: {}, editable_fields: [] };
    streamed = [
      { event: 'visualization', data: { type: 'kpi_card', title: 'T', columns: [], rows: [], metric: 'x', value: 1 } },
      { event: 'action.proposed', data: action },
      { event: 'message.completed', data: { message_id: 'm2', conversation_id: 'c1' } },
    ];

    await store.send('Hi');

    const live = seen[0].find((m) => m.role === 'assistant');
    expect(live?.visualization?.type).toBe('kpi_card');
    expect(live?.proposed_action?.summary).toBe('s');
  });

  it('exposes pending actions and locks the card while confirming', async () => {
    store.messages.set([stored({ proposed_action: { tool: 't', module: 'm', status: 'pending', summary: 's', arguments: {}, details: {}, editable_fields: [] }, action_status: 'pending' })]);
    expect(store.pendingActions().length).toBe(1);

    let release: (m: CopilotMessage) => void = () => undefined;
    api.confirmAction.mockReturnValue(new Promise<CopilotMessage>((resolve) => (release = resolve)));

    const first = store.confirmAction('m2', { 'items.0.quantity': 3 });
    void store.confirmAction('m2', {});
    expect(store.busyActionIds().has('m2')).toBe(true);
    expect(api.confirmAction).toHaveBeenCalledTimes(1);
    expect(api.confirmAction).toHaveBeenCalledWith('m2', { 'items.0.quantity': 3 });

    release(stored({ action_status: 'executed', proposed_action: { tool: 't', module: 'm', status: 'executed', summary: 's', arguments: {}, details: {}, editable_fields: [], result: { label: 'Done', route: '/x' } } }));
    await first;

    expect(store.busyActionIds().size).toBe(0);
    expect(store.pendingActions().length).toBe(0);
    expect(store.messages()[0].proposed_action?.result?.label).toBe('Done');
  });

  it('maps API failures to localized error keys', async () => {
    api.confirmAction.mockRejectedValue(new CopilotApiError(429, 'slow down'));
    store.messages.set([stored({ proposed_action: { tool: 't', module: 'm', status: 'pending', summary: 's', arguments: {}, details: {}, editable_fields: [] } })]);

    await store.confirmAction('m2', {});

    expect(store.errorKey()).toBe('COPILOT.ERROR.RATE_LIMIT');
    expect([403, 404, 409, 422, 429, 502, 500].map(errorKeyForStatus)).toEqual([
      'COPILOT.ERROR.FORBIDDEN',
      'COPILOT.ERROR.NOT_FOUND',
      'COPILOT.ERROR.CONFLICT',
      'COPILOT.ERROR.INVALID',
      'COPILOT.ERROR.RATE_LIMIT',
      'COPILOT.ERROR.PROVIDER',
      'COPILOT.ERROR.GENERIC',
    ]);
  });

  it('reports a refused stream and resets streaming state', async () => {
    api.streamMessage.mockImplementation(() => {
      return (async function* () {
        throw new CopilotApiError(403, 'no');
      })();
    });

    await store.send('Hi');

    expect(store.errorKey()).toBe('COPILOT.ERROR.FORBIDDEN');
    expect(store.isStreaming()).toBe(false);
  });
});
