import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { HelpdeskApiService } from './helpdesk-api.service';

describe('HelpdeskApiService', () => {
  let service: HelpdeskApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/esm`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HelpdeskApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HelpdeskApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('lists canned responses and macros', () => {
    service.getCannedResponses().subscribe((res) => expect(res.data[0].title).toBe('Hi'));
    const canned = httpTesting.expectOne(`${base}/helpdesk/canned-responses`);
    expect(canned.request.method).toBe('GET');
    canned.flush({ data: [{ id: '1', title: 'Hi' }] });

    service.getMacros().subscribe((res) => expect(res.data[0].name).toBe('Close'));
    httpTesting.expectOne(`${base}/helpdesk/macros`).flush({ data: [{ id: '2', name: 'Close' }] });
  });

  it('searches knowledge base articles with filters', () => {
    service.getKnowledgeArticles({ q: 'vpn', is_published: true, page: 2 }).subscribe((res) => {
      expect(res.data.length).toBe(1);
    });
    const req = httpTesting.expectOne(
      (r) =>
        r.url === `${base}/kb/articles` &&
        r.params.get('q') === 'vpn' &&
        r.params.get('is_published') === 'true' &&
        r.params.get('page') === '2',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [{ id: 'a' }] });
  });

  it('lists notifications, optionally unread only, and marks one read', () => {
    service.getNotifications().subscribe((res) => expect(res.meta.unread).toBe(1));
    const all = httpTesting.expectOne(`${base}/helpdesk/notifications`);
    expect(all.request.params.has('unread')).toBe(false);
    all.flush({ data: [], meta: { unread: 1 } });

    service.getNotifications(true).subscribe();
    const unread = httpTesting.expectOne((r) => r.url === `${base}/helpdesk/notifications` && r.params.get('unread') === 'true');
    unread.flush({ data: [], meta: { unread: 0 } });

    service.markNotificationRead('n1').subscribe((res) => expect(res.data.id).toBe('n1'));
    const read = httpTesting.expectOne(`${base}/helpdesk/notifications/n1/read`);
    expect(read.request.method).toBe('POST');
    read.flush({ data: { id: 'n1' } });
  });
});
