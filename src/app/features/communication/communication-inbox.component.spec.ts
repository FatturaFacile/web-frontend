import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { CommunicationApiService, CommunicationConversation, TranslateService } from '@core';
import { CommunicationInboxComponent } from './communication-inbox.component';

describe('CommunicationInboxComponent', () => {
  let component: CommunicationInboxComponent;
  let fixture: ComponentFixture<CommunicationInboxComponent>;

  const conversation: CommunicationConversation = {
    id: 'conv-1',
    channel: 'email',
    counterparty_address: 'client@example.com',
    counterparty_name: 'Client',
    contact_id: null,
    subject: 'Question',
    status: 'open',
    assigned_to: null,
    assigned_at: null,
    unread_count: 2,
    last_message_at: '2026-11-09T10:00:00Z',
    resolved_at: null,
    created_at: '2026-11-09T09:00:00Z',
    messages: [
      { id: 'm-1', conversation_id: 'conv-1', direction: 'inbound', channel: 'email', sender_address: 'client@example.com', sender_user_id: null, body: 'Hello', delivery_log_id: null, delivery_status: null, occurred_at: '2026-11-09T10:00:00Z' },
    ],
  };

  const apiSpy = {
    getConversations: vi.fn(),
    getConversation: vi.fn(),
    markConversationRead: vi.fn(),
    replyToConversation: vi.fn(),
    changeConversationStatus: vi.fn(),
    receiveInboundMessage: vi.fn(),
    getAssignees: vi.fn(),
    assignConversation: vi.fn(),
  };
  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiSpy.getConversations.mockReturnValue(of({ data: [conversation] }));
    apiSpy.getConversation.mockReturnValue(of({ data: conversation }));
    apiSpy.markConversationRead.mockReturnValue(of({ data: { ...conversation, unread_count: 0 } }));
    apiSpy.replyToConversation.mockReturnValue(of({ data: conversation.messages?.[0] }));
    apiSpy.changeConversationStatus.mockReturnValue(of({ data: { ...conversation, status: 'resolved' } }));
    apiSpy.receiveInboundMessage.mockReturnValue(of({ data: conversation.messages?.[0] }));
    apiSpy.getAssignees.mockReturnValue(of({ data: [{ id: 'user-1', name: 'Agent One' }] }));
    apiSpy.assignConversation.mockReturnValue(of({ data: { ...conversation, assigned_to: 'user-1' } }));

    await TestBed.configureTestingModule({
      imports: [CommunicationInboxComponent],
      providers: [
        { provide: CommunicationApiService, useValue: apiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunicationInboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the conversations on init', () => {
    expect(apiSpy.getConversations).toHaveBeenCalledWith({ per_page: 100 });
    expect(component.conversations()).toHaveLength(1);
  });

  it('filters by status', () => {
    component.setStatusFilter('resolved');

    expect(apiSpy.getConversations).toHaveBeenLastCalledWith({ per_page: 100, status: 'resolved' });
  });

  it('opens a conversation, marks it as read and reloads the list', () => {
    component.open(conversation);

    expect(component.detail()?.id).toBe('conv-1');
    expect(component.detailVisible()).toBe(true);
    expect(apiSpy.markConversationRead).toHaveBeenCalledWith('conv-1');
  });

  it('sends a trimmed reply and ignores an empty one', () => {
    component.open(conversation);
    component.replyText.set('   ');
    component.reply();
    expect(apiSpy.replyToConversation).not.toHaveBeenCalled();

    component.replyText.set(' We answer ');
    component.reply();
    expect(apiSpy.replyToConversation).toHaveBeenCalledWith('conv-1', 'We answer');
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('changes the status of the open conversation', () => {
    component.open(conversation);
    component.changeStatus('resolved');

    expect(apiSpy.changeConversationStatus).toHaveBeenCalledWith('conv-1', 'resolved');
    expect(component.detail()?.status).toBe('resolved');
    expect(component.detail()?.messages).toHaveLength(1);
  });

  it('records an inbound message with the API payload shape', () => {
    component.openInbound();
    component.inboundForm.patchValue({ address: ' client@example.com ', name: '', body: 'Hi there' });
    component.saveInbound();

    expect(apiSpy.receiveInboundMessage).toHaveBeenCalledWith({
      channel: 'email',
      address: 'client@example.com',
      name: null,
      subject: null,
      body: 'Hi there',
    });
    expect(component.inboundVisible()).toBe(false);
  });

  it('does not submit an invalid inbound form and shows API errors', () => {
    component.openInbound();
    component.saveInbound();
    expect(apiSpy.receiveInboundMessage).not.toHaveBeenCalled();

    apiSpy.replyToConversation.mockReturnValue(throwError(() => new Error('boom')));
    component.open(conversation);
    component.replyText.set('x');
    component.reply();
    expect(messageSpy.error).toHaveBeenCalledWith('COMMUNICATION.ACTION_ERROR');
  });

  it('loads the assignees, shows the assigned name and assigns or unassigns the open conversation', () => {
    expect(component.assigneeName('user-1')).toBe('Agent One');
    expect(component.assigneeName(null)).toBe('');

    component.open(conversation);
    component.assign('user-1');
    expect(apiSpy.assignConversation).toHaveBeenCalledWith('conv-1', 'user-1');
    expect(component.detail()?.assigned_to).toBe('user-1');
    expect(component.detail()?.messages).toHaveLength(1);

    component.assign(null);
    expect(apiSpy.assignConversation).toHaveBeenLastCalledWith('conv-1', null);
  });

  it('filters by assignee', () => {
    component.setAssigneeFilter('none');
    expect(apiSpy.getConversations).toHaveBeenLastCalledWith({ per_page: 100, assigned_to: 'none' });
  });
});
