import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  CommunicationApiService,
  CommunicationChannelResource,
  CommunicationDeliveryLog,
  CommunicationPreviewResponse,
  CommunicationTemplateResource,
  TranslateService,
} from '@core';
import { CommunicationComponent } from './communication.component';

describe('CommunicationComponent', () => {
  let component: CommunicationComponent;
  let fixture: ComponentFixture<CommunicationComponent>;

  const mockDeliveries: CommunicationDeliveryLog[] = [
    {
      id: 'del-1',
      message_type: 'document',
      channel: 'email',
      driver: 'smtp',
      recipient: 'cliente@example.com',
      status: 'sent',
      provider_reference: 'msg-abc-123',
      created_at: '2026-11-09T10:00:00Z',
    },
    {
      id: 'del-2',
      message_type: 'message',
      channel: 'whatsapp',
      driver: 'twilio',
      recipient: '+393339999999',
      status: 'failed',
      error: 'Recipient number not registered on WhatsApp',
      created_at: '2026-11-09T10:05:00Z',
    },
  ];

  const mockChannels: CommunicationChannelResource[] = [
    {
      channel: 'email',
      driver: 'smtp',
      is_enabled: true,
      settings: {
        host: 'smtp.sendgrid.net',
        port: 587,
        from_address: 'fatture@example.com',
      },
    },
    {
      channel: 'whatsapp',
      driver: 'twilio',
      is_enabled: false,
      settings: {},
    },
  ];

  const mockTemplates: CommunicationTemplateResource[] = [
    {
      id: 'tmpl-1',
      code: 'invoice.send',
      channel: 'email',
      locale: 'it_IT',
      subject: 'Fattura {{number}}',
      body: 'Gentile {{name}}, in allegato la fattura.',
      is_active: true,
    },
  ];

  const mockPreview: CommunicationPreviewResponse = {
    channel: 'email',
    locale: 'it_IT',
    subject: 'Fattura INV-2026-0042',
    body: 'Gentile Mario Rossi, in allegato la fattura.',
    variables: { name: 'Mario Rossi', number: 'INV-2026-0042' },
  };

  const page = <T>(data: T[]) => ({
    success: true,
    message: 'ok',
    data,
    meta: { current_page: 1, last_page: 1, per_page: 10, total: data.length, from: 1, to: data.length },
  });

  const apiSpy = {
    getDeliveries: vi.fn().mockImplementation((query: Record<string, unknown>) =>
      of(query['grid_values'] ? { data: [{ value: 'sent', count: 1 }, { value: 'failed', count: 1 }] } : page(mockDeliveries)),
    ),
    getDelivery: vi.fn().mockReturnValue(of({ data: mockDeliveries[0] })),
    getChannels: vi.fn().mockReturnValue(of({ data: mockChannels })),
    updateChannel: vi.fn().mockReturnValue(of({ data: mockChannels[0] })),
    testChannel: vi.fn().mockReturnValue(of({ success: true, message: 'Delivered' })),
    getTemplates: vi.fn().mockImplementation(() => of(page(mockTemplates))),
    getTemplate: vi.fn().mockReturnValue(of({ data: mockTemplates[0] })),
    createTemplate: vi.fn().mockReturnValue(of({ data: mockTemplates[0] })),
    updateTemplate: vi.fn().mockReturnValue(of({ data: mockTemplates[0] })),
    deleteTemplate: vi.fn().mockReturnValue(of({ message: 'Deleted' })),
    previewTemplate: vi.fn().mockReturnValue(of({ data: mockPreview })),
    sendDocument: vi.fn().mockReturnValue(of({ data: mockDeliveries[0] })),
    sendMessage: vi.fn().mockReturnValue(of({ data: mockDeliveries[0] })),
  };

  const messageSpy = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };

  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    translate: vi.fn().mockImplementation((key: string) => key),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [CommunicationComponent],
      providers: [
        { provide: CommunicationApiService, useValue: apiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunicationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  it('should initialize and load deliveries, channels, and templates', () => {
    expect(component).toBeTruthy();
    expect(apiSpy.getDeliveries).toHaveBeenCalled();
    expect(apiSpy.getChannels).toHaveBeenCalled();
    expect(apiSpy.getTemplates).toHaveBeenCalled();
    expect(component.deliveries.items().length).toBe(2);
    expect(component.channels().length).toBe(2);
    expect(component.templates.items().length).toBe(1);
    expect(component.totalSent()).toBe(1);
    expect(component.totalFailed()).toBe(1);
    expect(component.activeChannelsCount()).toBe(1);
  });

  it('should filter deliveries by channel and status on the server', async () => {
    component.filterChannel.set('email');
    component.filterStatus.set('sent');
    component.loadDeliveries();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(apiSpy.getDeliveries).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'email', status: 'sent', page: 1 }),
    );
  });

  it('should open and close delivery drawer', () => {
    component.openDeliveryDrawer(mockDeliveries[0]);
    expect(component.selectedDelivery()).toBe(mockDeliveries[0]);
    expect(component.drawerVisible()).toBe(true);

    component.closeDeliveryDrawer();
    expect(component.drawerVisible()).toBe(false);
    expect(component.selectedDelivery()).toBeNull();
  });

  it('should open channel config modal and save updated configuration', () => {
    component.openChannelConfigModal(mockChannels[0]);
    expect(component.configModalVisible()).toBe(true);
    expect(component.selectedChannel()).toBe(mockChannels[0]);

    component.channelConfigForm.patchValue({
      host: 'smtp.mailgun.org',
      port: '465',
      username: 'postmaster',
    });

    component.saveChannelConfig();
    expect(apiSpy.updateChannel).toHaveBeenCalledWith(
      'email',
      expect.objectContaining({
        driver: 'smtp',
        is_enabled: true,
        credentials: expect.objectContaining({
          host: 'smtp.mailgun.org',
          port: 465,
        }),
      }),
    );
    expect(messageSpy.success).toHaveBeenCalledWith('COMMUNICATION.CHANNEL_UPDATED');
    expect(component.configModalVisible()).toBe(false);
  });

  it('should open and test channel connectivity', () => {
    component.openTestChannelModal(mockChannels[0]);
    expect(component.testModalVisible()).toBe(true);
    expect(component.selectedChannel()).toBe(mockChannels[0]);

    component.runChannelTest();
    expect(apiSpy.testChannel).toHaveBeenCalledWith('email', {
      recipient: 'test@example.com',
    });
    expect(messageSpy.success).toHaveBeenCalledWith('COMMUNICATION.TEST_SUCCESS');
    expect(component.testModalVisible()).toBe(false);
  });

  it('should open create modal and save new template', () => {
    component.openCreateTemplateModal();
    expect(component.templateModalVisible()).toBe(true);
    expect(component.selectedTemplate()).toBeNull();

    component.templateForm.patchValue({
      code: 'quote.alert',
      channel: 'telegram',
      locale: 'it_IT',
      subject: 'Nuovo preventivo',
      body: 'Preventivo disponibile per la firma',
      is_active: true,
    });

    component.saveTemplate();
    expect(apiSpy.createTemplate).toHaveBeenCalledWith({
      code: 'quote.alert',
      channel: 'telegram',
      locale: 'it_IT',
      subject: 'Nuovo preventivo',
      body: 'Preventivo disponibile per la firma',
      is_active: true,
    });
    expect(messageSpy.success).toHaveBeenCalledWith('COMMUNICATION.TEMPLATE_SAVED');
    expect(component.templateModalVisible()).toBe(false);
  });

  it('should open edit modal and update existing template', () => {
    component.openEditTemplateModal(mockTemplates[0]);
    expect(component.selectedTemplate()).toBe(mockTemplates[0]);
    expect(component.templateModalVisible()).toBe(true);

    component.templateForm.patchValue({
      subject: 'Fattura Aggiornata',
    });

    component.saveTemplate();
    expect(apiSpy.updateTemplate).toHaveBeenCalledWith(
      'tmpl-1',
      expect.objectContaining({
        subject: 'Fattura Aggiornata',
      }),
    );
    expect(messageSpy.success).toHaveBeenCalledWith('COMMUNICATION.TEMPLATE_SAVED');
  });

  it('should delete a template', () => {
    component.deleteTemplate('tmpl-1');
    expect(apiSpy.deleteTemplate).toHaveBeenCalledWith('tmpl-1');
    expect(messageSpy.success).toHaveBeenCalledWith('COMMUNICATION.TEMPLATE_DELETED');
  });

  it('should open preview modal and run template preview', () => {
    component.openPreviewModal(mockTemplates[0]);
    expect(component.previewModalVisible()).toBe(true);
    expect(apiSpy.previewTemplate).toHaveBeenCalledWith('tmpl-1', {
      variables: {
        name: 'Mario Rossi',
        number: 'INV-2026-0042',
      },
    });
    expect(component.previewContent()).toEqual(mockPreview);
  });

  it('should send quick communication in message mode', () => {
    component.quickSendForm.patchValue({
      mode: 'message',
      channel: 'whatsapp',
      recipient: '+39333111222',
      template_code: 'reminder.appointment',
    });

    component.sendQuickCommunication();
    expect(apiSpy.sendMessage).toHaveBeenCalledWith({
      channel: 'whatsapp',
      recipient: '+39333111222',
      template_code: 'reminder.appointment',
    });
    expect(messageSpy.success).toHaveBeenCalledWith('COMMUNICATION.MESSAGE_SENT');
    expect(component.selectedTabIndex()).toBe(0);
  });

  it('should send quick communication in document mode', () => {
    component.quickSendForm.patchValue({
      mode: 'document',
      channel: 'email',
      recipient: 'admin@corp.com',
      document_type: 'invoice',
      document_id: 'inv-12345',
      message: 'Ecco la fattura.',
    });

    component.sendQuickCommunication();
    expect(apiSpy.sendDocument).toHaveBeenCalledWith({
      channel: 'email',
      recipient: 'admin@corp.com',
      document_type: 'invoice',
      document_id: 'inv-12345',
      message: 'Ecco la fattura.',
    });
    expect(messageSpy.success).toHaveBeenCalledWith('COMMUNICATION.DOCUMENT_SENT');
    expect(component.selectedTabIndex()).toBe(0);
  });

  it('should return correct badge colors and status colors', () => {
    expect(component.getChannelBadgeColor('email')).toBe('blue');
    expect(component.getChannelBadgeColor('whatsapp')).toBe('green');
    expect(component.getChannelBadgeColor('telegram')).toBe('cyan');
    expect(component.getChannelBadgeColor('sms')).toBe('orange');
    expect(component.getChannelBadgeColor('other')).toBe('default');

    expect(component.getDeliveryStatusColor('sent')).toBe('success');
    expect(component.getDeliveryStatusColor('simulated')).toBe('warning');
    expect(component.getDeliveryStatusColor('failed')).toBe('error');
    expect(component.getDeliveryStatusColor('pending')).toBe('default');
  });

  it('should handle API errors gracefully during operations', () => {
    apiSpy.updateChannel.mockReturnValueOnce(throwError(() => new Error('Error')));
    component.openChannelConfigModal(mockChannels[0]);
    component.saveChannelConfig();
    expect(messageSpy.error).toHaveBeenCalledWith('COMMUNICATION.ACTION_ERROR');

    apiSpy.testChannel.mockReturnValueOnce(throwError(() => new Error('Failed')));
    component.openTestChannelModal(mockChannels[0]);
    component.runChannelTest();
    expect(messageSpy.error).toHaveBeenCalledWith('COMMUNICATION.TEST_FAILED');
  });

  it('does not call the API when the quick send and template forms are submitted empty', () => {
    component.sendQuickCommunication();
    expect(apiSpy.sendMessage).not.toHaveBeenCalled();
    expect(component.quickSendForm.controls.recipient.touched).toBe(true);

    component.quickSendForm.patchValue({ mode: 'document', channel: 'email', recipient: '' });
    component.sendQuickCommunication();
    expect(apiSpy.sendDocument).not.toHaveBeenCalled();
    expect(component.quickSendForm.controls.document_id.hasError('required')).toBe(true);
    expect(component.quickSendForm.controls.recipient.hasError('required')).toBe(false);

    component.quickSendForm.patchValue({ mode: 'message', channel: 'sms', recipient: 'not-a-phone', template_code: 'a.b' });
    expect(component.quickSendForm.controls.recipient.hasError('recipientFormat')).toBe(true);

    component.openCreateTemplateModal();
    component.saveTemplate();
    expect(apiSpy.createTemplate).not.toHaveBeenCalled();
    expect(component.templateForm.controls.subject.hasError('required')).toBe(true);
    component.templateForm.patchValue({ channel: 'sms' });
    expect(component.templateForm.controls.subject.hasError('required')).toBe(false);
  });
});
