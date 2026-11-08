import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { TicketApiService } from './ticket-api.service';
import {
  AssignTicketRequest,
  ChangeTicketStatusRequest,
  ResolveTicketRequest,
  StoreTicketMessageRequest,
  StoreTicketRequest,
  UpdateHelpdeskTicketRequest,
} from '../models';

describe('TicketApiService', () => {
  let service: TicketApiService;
  let httpTesting: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/esm/tickets`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TicketApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TicketApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('fetches tickets with query params', () => {
    service
      .getTickets({ status: 'open', priority: 'high', page: 2, per_page: 15, q: 'server' })
      .subscribe((res) => {
        expect(res.data.length).toBe(1);
        expect(res.meta.total).toBe(1);
      });

    const req = httpTesting.expectOne(
      (r) =>
        r.url === baseUrl &&
        r.params.get('status') === 'open' &&
        r.params.get('priority') === 'high' &&
        r.params.get('page') === '2' &&
        r.params.get('per_page') === '15' &&
        r.params.get('q') === 'server',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [{ id: 'tk-1', title: 'Server Down' }], meta: { current_page: 2, total: 1 } });
  });

  it('fetches a single ticket by id', () => {
    service.getTicket('tk-1').subscribe((res) => {
      expect(res.data.id).toBe('tk-1');
    });

    const req = httpTesting.expectOne(`${baseUrl}/tk-1`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'Ticket retrieved', data: { id: 'tk-1', title: 'Server Down' } });
  });

  it('creates a new ticket', () => {
    const payload: StoreTicketRequest = {
      title: 'New issue',
      priority: 'critical',
      channel: 'email',
    };

    service.createTicket(payload).subscribe((res) => {
      expect(res.data.id).toBe('tk-2');
    });

    const req = httpTesting.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({
      success: true,
      message: 'Ticket created successfully',
      data: { id: 'tk-2', title: 'New issue' },
    });
  });

  it('updates a ticket', () => {
    const payload: UpdateHelpdeskTicketRequest = {
      subject: 'Updated subject',
      priority: 'low',
    };

    service.updateTicket('tk-1', payload).subscribe((res) => {
      expect(res.data.subject).toBe('Updated subject');
    });

    const req = httpTesting.expectOne(`${baseUrl}/tk-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    req.flush({
      success: true,
      message: 'Ticket updated',
      data: { id: 'tk-1', subject: 'Updated subject' },
    });
  });

  it('changes ticket status', () => {
    const payload: ChangeTicketStatusRequest = {
      status: 'pending_customer',
      note: 'Waiting for log files',
    };

    service.changeTicketStatus('tk-1', payload).subscribe((res) => {
      expect(res.data.status).toBe('pending_customer');
    });

    const req = httpTesting.expectOne(`${baseUrl}/tk-1/status`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({
      success: true,
      message: 'Status updated',
      data: { id: 'tk-1', status: 'pending_customer' },
    });
  });

  it('assigns ticket to user/team', () => {
    const payload: AssignTicketRequest = {
      assigned_to_id: 'usr-123',
      service_team_id: 'team-456',
    };

    service.assignTicket('tk-1', payload).subscribe((res) => {
      expect(res.data.assigned_to_id).toBe('usr-123');
    });

    const req = httpTesting.expectOne(`${baseUrl}/tk-1/assign`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({
      success: true,
      message: 'Ticket assigned successfully',
      data: { id: 'tk-1', assigned_to_id: 'usr-123' },
    });
  });

  it('resolves a ticket', () => {
    const payload: ResolveTicketRequest = {
      resolution_notes: 'Replaced router cable',
      root_cause: 'Hardware failure',
    };

    service.resolveTicket('tk-1', payload).subscribe((res) => {
      expect(res.data.status).toBe('resolved');
    });

    const req = httpTesting.expectOne(`${baseUrl}/tk-1/resolve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({
      success: true,
      message: 'Ticket resolved',
      data: { id: 'tk-1', status: 'resolved' },
    });
  });

  it('closes a ticket', () => {
    service.closeTicket('tk-1').subscribe((res) => {
      expect(res.data.status).toBe('closed');
    });

    const req = httpTesting.expectOne(`${baseUrl}/tk-1/close`);
    expect(req.request.method).toBe('POST');
    req.flush({
      success: true,
      message: 'Ticket closed successfully',
      data: { id: 'tk-1', status: 'closed' },
    });
  });

  it('reopens a ticket', () => {
    service.reopenTicket('tk-1').subscribe((res) => {
      expect(res.data.status).toBe('open');
    });

    const req = httpTesting.expectOne(`${baseUrl}/tk-1/reopen`);
    expect(req.request.method).toBe('POST');
    req.flush({
      success: true,
      message: 'Ticket reopened',
      data: { id: 'tk-1', status: 'open' },
    });
  });

  it('fetches ticket messages', () => {
    service.getTicketMessages('tk-1').subscribe((res) => {
      expect(res.data.length).toBe(2);
      expect(res.meta.unread).toBe(1);
    });

    const req = httpTesting.expectOne(`${baseUrl}/tk-1/messages`);
    expect(req.request.method).toBe('GET');
    req.flush({
      data: [
        { id: 'msg-1', body: 'First message', visibility: 'public' },
        { id: 'msg-2', body: 'Internal note', visibility: 'internal' },
      ],
      meta: { unread: 1 },
    });
  });

  it('posts a ticket message with FormData', () => {
    const payload: StoreTicketMessageRequest = {
      body: 'Here is an update',
      visibility: 'internal',
      status: 'open',
    };

    service.addTicketMessage('tk-1', payload).subscribe((res) => {
      expect(res.data.id).toBe('msg-3');
    });

    const req = httpTesting.expectOne(`${baseUrl}/tk-1/messages`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({
      success: true,
      message: 'Message added',
      data: { id: 'msg-3', body: 'Here is an update' },
    });
  });

  it('fetches ticket activities', () => {
    service.getTicketActivities('tk-1').subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].type).toBe('status_change');
    });

    const req = httpTesting.expectOne(`${baseUrl}/tk-1/activities`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      message: 'Activities retrieved',
      data: [{ id: 'act-1', type: 'status_change', from_value: 'new', to_value: 'open' }],
    });
  });
});
