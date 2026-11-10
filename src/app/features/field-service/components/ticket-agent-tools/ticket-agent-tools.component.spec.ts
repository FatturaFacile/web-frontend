import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../../icons-provider';
import { HelpdeskApiService, I18nService, SettingsApiService, TicketApiService } from '@core';
import { TicketAgentToolsComponent } from './ticket-agent-tools.component';

interface Harness {
  macroId: { set(value: string | null): void };
  applyMacro(): void;
  cannedId: { set(value: string | null): void };
  renderCanned(): void;
  useRendered(): void;
  watcherUserId: { set(value: string | null): void };
  addWatcher(): void;
  mergeTargetId: { set(value: string | null): void };
  merge(): void;
  splitSubject: { set(value: string): void };
  toggleMessage(id: string, checked: boolean): void;
  canSplit(): boolean;
  split(): void;
  strategy: { set(value: 'round_robin' | 'least_loaded'): void };
  autoAssign(): void;
}

describe('TicketAgentToolsComponent', () => {
  let fixture: ComponentFixture<TicketAgentToolsComponent>;
  let harness: Harness;

  const tickets = {
    applyMacro: vi.fn(),
    renderCannedResponse: vi.fn(),
    getWatchers: vi.fn(),
    addWatcher: vi.fn(),
    removeWatcher: vi.fn(),
    autoAssignTicket: vi.fn(),
    mergeTicket: vi.fn(),
    splitTicket: vi.fn(),
    getKnowledgeLinks: vi.fn(),
    linkKnowledgeArticle: vi.fn(),
    unlinkKnowledgeArticle: vi.fn(),
    getTickets: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };
  const modal = { confirm: vi.fn((options: { nzOnOk: () => void }) => options.nzOnOk()) };

  beforeEach(async () => {
    vi.clearAllMocks();
    tickets.getWatchers.mockReturnValue(of({ data: [] }));
    tickets.getKnowledgeLinks.mockReturnValue(of({ data: [] }));
    tickets.applyMacro.mockReturnValue(of({ data: { id: 't1' } }));
    tickets.renderCannedResponse.mockReturnValue(of({ data: { body: 'Hello Anna' } }));
    tickets.addWatcher.mockReturnValue(of({ data: {} }));
    tickets.autoAssignTicket.mockReturnValue(of({ data: { id: 't1' } }));
    tickets.mergeTicket.mockReturnValue(of({ data: { id: 't1' } }));
    tickets.splitTicket.mockReturnValue(of({ data: { id: 't2' } }));

    await TestBed.overrideProvider(NzModalService, { useValue: modal })
      .configureTestingModule({
      imports: [TicketAgentToolsComponent],
      providers: [
        provideNzIcons(icons),
        { provide: TicketApiService, useValue: tickets },
        {
          provide: HelpdeskApiService,
          useValue: {
            getMacros: () => of({ data: [{ id: 'm1', name: 'Close' }] }),
            getCannedResponses: () => of({ data: [{ id: 'c1', title: 'Greeting' }] }),
            getKnowledgeArticles: () => of({ data: [] }),
          },
        },
        { provide: SettingsApiService, useValue: { getTenantUsers: () => of({ data: [{ id: 'u1', name: 'Tech' }] }) } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: NzMessageService, useValue: message },
        { provide: NzModalService, useValue: modal },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketAgentToolsComponent);
    fixture.componentRef.setInput('ticket', { id: 't1' });
    fixture.componentRef.setInput('messages', [{ id: 'm-1', author_name: 'Anna', author_type: 'contact', body: 'Help' }]);
    harness = fixture.componentInstance as unknown as Harness;
    fixture.detectChanges();
  });

  it('applies a macro and tells the drawer to reload', () => {
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    harness.macroId.set('m1');
    harness.applyMacro();

    expect(tickets.applyMacro).toHaveBeenCalledWith('t1', 'm1');
    expect(changed).toHaveBeenCalled();
  });

  it('renders a canned response and hands the text to the reply form', () => {
    const insert = vi.fn();
    fixture.componentInstance.insertReply.subscribe(insert);
    harness.cannedId.set('c1');
    harness.renderCanned();
    harness.useRendered();

    expect(tickets.renderCannedResponse).toHaveBeenCalledWith('t1', 'c1');
    expect(insert).toHaveBeenCalledWith('Hello Anna');
  });

  it('adds a watcher and reloads the list', () => {
    harness.watcherUserId.set('u1');
    harness.addWatcher();

    expect(tickets.addWatcher).toHaveBeenCalledWith('t1', 'u1');
    expect(tickets.getWatchers).toHaveBeenCalledTimes(2);
  });

  it('auto-assigns with the chosen strategy and without a team when blank', () => {
    harness.strategy.set('least_loaded');
    harness.autoAssign();
    expect(tickets.autoAssignTicket).toHaveBeenCalledWith('t1', { strategy: 'least_loaded', team_id: null });
  });

  it('merges only after confirmation', () => {
    harness.mergeTargetId.set('t9');
    harness.merge();
    expect(modal.confirm).toHaveBeenCalled();
    expect(tickets.mergeTicket).toHaveBeenCalledWith('t1', { target_ticket_id: 't9' });
  });

  it('splits the selected messages into a new ticket', () => {
    expect(harness.canSplit()).toBe(false);
    harness.splitSubject.set('Second topic');
    harness.toggleMessage('m-1', true);
    expect(harness.canSplit()).toBe(true);

    harness.split();

    expect(tickets.splitTicket).toHaveBeenCalledWith('t1', { subject: 'Second topic', message_ids: ['m-1'] });
    expect(harness.canSplit()).toBe(false);
  });
});
