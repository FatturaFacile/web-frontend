import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { TicketApiService } from './ticket-api.service';

describe('TicketApiService helpdesk operations', () => {
  let service: TicketApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/esm/tickets`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TicketApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TicketApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('applies one action to many tickets', () => {
    const payload = { ticket_ids: ['a', 'b'], action: 'priority' as const, priority: 'high' as const };
    service.bulkUpdate(payload).subscribe((res) => {
      expect(res.meta.succeeded).toBe(1);
      expect(res.data[1].ok).toBe(false);
    });
    const req = httpTesting.expectOne(`${base}/bulk`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({
      data: [
        { ticket_id: 'a', ok: true, error: null },
        { ticket_id: 'b', ok: false, error: 'locked' },
      ],
      meta: { succeeded: 1, failed: 1 },
    });
  });

  it('merges a ticket into a target', () => {
    service.mergeTicket('t1', { target_ticket_id: 't2' }).subscribe((res) => expect(res.data.id).toBe('t1'));
    const req = httpTesting.expectOne(`${base}/t1/merge`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ target_ticket_id: 't2' });
    req.flush({ data: { id: 't1' } });
  });

  it('splits messages into a new ticket', () => {
    service.splitTicket('t1', { subject: 'New', message_ids: ['m1'] }).subscribe((res) => expect(res.data.id).toBe('t3'));
    const req = httpTesting.expectOne(`${base}/t1/split`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ subject: 'New', message_ids: ['m1'] });
    req.flush({ data: { id: 't3' } });
  });

  it('auto-assigns with a strategy', () => {
    service.autoAssignTicket('t1', { strategy: 'least_loaded', team_id: 'team' }).subscribe();
    const req = httpTesting.expectOne(`${base}/t1/auto-assign`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ strategy: 'least_loaded', team_id: 'team' });
    req.flush({ data: { id: 't1' } });
  });

  it('lists, adds and removes watchers', () => {
    service.getWatchers('t1').subscribe((res) => expect(res.data.length).toBe(1));
    httpTesting.expectOne(`${base}/t1/watchers`).flush({ data: [{ id: 'w', ticket_id: 't1', user_id: 'u' }] });

    service.addWatcher('t1', 'u2').subscribe();
    const add = httpTesting.expectOne(`${base}/t1/watchers`);
    expect(add.request.method).toBe('POST');
    expect(add.request.body).toEqual({ user_id: 'u2' });
    add.flush({ data: { id: 'w2' } });

    service.removeWatcher('t1', 'u2').subscribe();
    const del = httpTesting.expectOne(`${base}/t1/watchers/u2`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });

  it('marks the thread as read', () => {
    service.markRead('t1').subscribe((res) => expect(res.data.unread).toBe(0));
    const req = httpTesting.expectOne(`${base}/t1/read`);
    expect(req.request.method).toBe('POST');
    req.flush({ data: { last_read_at: '2026-01-01T00:00:00Z', unread: 0 } });
  });

  it('downloads an attachment as a blob', () => {
    service.downloadAttachment('t1', 'a1').subscribe((blob) => expect(blob.size).toBe(3));
    const req = httpTesting.expectOne(`${base}/t1/attachments/a1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['abc']));
  });

  it('renders a canned response and applies a macro', () => {
    service.renderCannedResponse('t1', 'c1').subscribe((res) => expect(res.data.body).toBe('Hello'));
    const render = httpTesting.expectOne(`${base}/t1/canned-responses/c1/render`);
    expect(render.request.method).toBe('POST');
    render.flush({ data: { body: 'Hello' } });

    service.applyMacro('t1', 'm1').subscribe();
    const apply = httpTesting.expectOne(`${base}/t1/macros/m1/apply`);
    expect(apply.request.method).toBe('POST');
    apply.flush({ data: { id: 't1' } });
  });

  it('manages the knowledge links of a ticket', () => {
    service.getKnowledgeLinks('t1').subscribe((res) => expect(res.data.length).toBe(0));
    httpTesting.expectOne(`${base}/t1/knowledge-links`).flush({ data: [] });

    service.linkKnowledgeArticle('t1', 'art').subscribe();
    const link = httpTesting.expectOne(`${base}/t1/knowledge-links`);
    expect(link.request.method).toBe('POST');
    expect(link.request.body).toEqual({ article_id: 'art' });
    link.flush({ data: { id: 'art' } });

    service.unlinkKnowledgeArticle('t1', 'art').subscribe();
    const unlink = httpTesting.expectOne(`${base}/t1/knowledge-links/art`);
    expect(unlink.request.method).toBe('DELETE');
    unlink.flush(null);
  });
});
