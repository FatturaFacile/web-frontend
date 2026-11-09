import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CommunicationChannelResource,
  CommunicationDeliveryLog,
  CommunicationSaveTemplateRequest,
  CommunicationSendDocumentRequest,
  CommunicationSendMessageRequest,
  CommunicationTemplateResource,
} from '../models';
import { CommunicationApiService } from './communication-api.service';

describe('CommunicationApiService', () => {
  let service: CommunicationApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CommunicationApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CommunicationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should list and inspect deliveries', () => {
    const mockDeliveries: CommunicationDeliveryLog[] = [
      {
        id: 'del-1',
        message_type: 'document',
        channel: 'email',
        recipient: 'client@example.com',
        status: 'sent',
        created_at: '2026-11-01T10:00:00Z',
      },
    ];

    service.getDeliveries({ channel: 'email', status: 'sent', per_page: 50 }).subscribe((res) => {
      expect(res.data).toEqual(mockDeliveries);
    });

    const req = httpMock.expectOne(
      (r) =>
        r.url.endsWith('/communication/deliveries') &&
        r.params.get('channel') === 'email' &&
        r.params.get('status') === 'sent' &&
        r.params.get('per_page') === '50',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockDeliveries });

    service.getDelivery('del-1').subscribe((res) => {
      expect(res.data.id).toBe('del-1');
    });
    const singleReq = httpMock.expectOne((r) => r.url.endsWith('/communication/deliveries/del-1'));
    expect(singleReq.request.method).toBe('GET');
    singleReq.flush({ data: mockDeliveries[0] });
  });

  it('should send documents and template messages', () => {
    const docPayload: CommunicationSendDocumentRequest = {
      document_type: 'invoice',
      document_id: 'inv-123',
      channel: 'email',
      recipient: 'billing@client.com',
    };

    service.sendDocument(docPayload).subscribe((res) => {
      expect(res.data.id).toBe('del-new');
    });
    const docReq = httpMock.expectOne((r) => r.url.endsWith('/communication/documents/send'));
    expect(docReq.request.method).toBe('POST');
    expect(docReq.request.body).toEqual(docPayload);
    docReq.flush({ data: { id: 'del-new', ...docPayload, status: 'sent' } });

    const msgPayload: CommunicationSendMessageRequest = {
      channel: 'whatsapp',
      recipient: '+393331234567',
      template_code: 'order.confirmation',
      variables: { number: 'ORD-55' },
    };
    service.sendMessage(msgPayload).subscribe((res) => {
      expect(res.data.id).toBe('del-msg');
    });
    const msgReq = httpMock.expectOne((r) => r.url.endsWith('/communication/messages/send'));
    expect(msgReq.request.method).toBe('POST');
    expect(msgReq.request.body).toEqual(msgPayload);
    msgReq.flush({ data: { id: 'del-msg', ...msgPayload, status: 'sent' } });
  });

  it('should manage channels and test connectivity', () => {
    const mockChannels: CommunicationChannelResource[] = [
      {
        id: 'ch-1',
        channel: 'email',
        driver: 'smtp',
        is_enabled: true,
        has_credentials: true,
      },
    ];

    service.getChannels().subscribe((res) => {
      expect(res.data).toEqual(mockChannels);
    });
    const chReq = httpMock.expectOne((r) => r.url.endsWith('/communication/channels'));
    expect(chReq.request.method).toBe('GET');
    chReq.flush({ data: mockChannels });

    service.updateChannel('email', { driver: 'smtp', is_enabled: true }).subscribe((res) => {
      expect(res.data.is_enabled).toBe(true);
    });
    const updReq = httpMock.expectOne((r) => r.url.endsWith('/communication/channels/email'));
    expect(updReq.request.method).toBe('PUT');
    updReq.flush({ data: { ...mockChannels[0], is_enabled: true } });

    service.testChannel('email', { recipient: 'test@company.com' }).subscribe((res) => {
      expect(res.data.success).toBe(true);
    });
    const testReq = httpMock.expectOne((r) => r.url.endsWith('/communication/channels/email/test'));
    expect(testReq.request.method).toBe('POST');
    testReq.flush({ data: { success: true } });
  });

  it('should manage templates and preview', () => {
    const mockTemplates: CommunicationTemplateResource[] = [
      {
        id: 'tpl-1',
        code: 'payment.reminder',
        channel: 'email',
        locale: 'it_IT',
        subject: 'Promemoria pagamento fattura {{ number }}',
        body: 'Gentile cliente, la fattura {{ number }} risulta in attesa.',
        is_active: true,
      },
    ];

    service.getTemplates({ channel: 'email', locale: 'it_IT' }).subscribe((res) => {
      expect(res.data).toEqual(mockTemplates);
    });
    const tplReq = httpMock.expectOne(
      (r) =>
        r.url.endsWith('/communication/templates') &&
        r.params.get('channel') === 'email' &&
        r.params.get('locale') === 'it_IT',
    );
    expect(tplReq.request.method).toBe('GET');
    tplReq.flush({ data: mockTemplates });

    const createPayload: CommunicationSaveTemplateRequest = {
      code: 'welcome.message',
      channel: 'email',
      locale: 'it_IT',
      subject: 'Benvenuto in Fattura Facile',
      body: 'Ciao {{ name }}, il tuo account è attivo.',
      is_active: true,
    };
    service.createTemplate(createPayload).subscribe((res) => {
      expect(res.data.id).toBe('tpl-new');
    });
    const createReq = httpMock.expectOne((r) => r.url.endsWith('/communication/templates'));
    expect(createReq.request.method).toBe('POST');
    createReq.flush({ data: { id: 'tpl-new', ...createPayload } });

    service.previewTemplate('tpl-1', { variables: { number: 'INV-2026-99' } }).subscribe((res) => {
      expect(res.data.subject).toContain('INV-2026-99');
    });
    const prevReq = httpMock.expectOne((r) => r.url.endsWith('/communication/templates/tpl-1/preview'));
    expect(prevReq.request.method).toBe('POST');
    prevReq.flush({
      data: {
        subject: 'Promemoria pagamento fattura INV-2026-99',
        body: 'Gentile cliente, la fattura INV-2026-99 risulta in attesa.',
      },
    });

    service.deleteTemplate('tpl-1').subscribe((res) => {
      expect(res.data.id).toBe('tpl-1');
    });
    const delReq = httpMock.expectOne((r) => r.url.endsWith('/communication/templates/tpl-1'));
    expect(delReq.request.method).toBe('DELETE');
    delReq.flush({ data: { id: 'tpl-1' } });
  });
});
