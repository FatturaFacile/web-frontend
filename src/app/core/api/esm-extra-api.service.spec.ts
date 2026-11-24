import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EsmExtraApiService } from './esm-extra-api.service';

describe('EsmExtraApiService', () => {
  let service: EsmExtraApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EsmExtraApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EsmExtraApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('manages helpdesk routing rules', () => {
    service.getRoutingRules().subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/esm/helpdesk/routing-rules') && r.method === 'GET').flush({ data: [] });

    service.updateRoutingRule('r1', { name: 'x' }).subscribe();
    const patch = httpMock.expectOne((r) => r.url.endsWith('/esm/helpdesk/routing-rules/r1'));
    expect(patch.request.method).toBe('PATCH');
    patch.flush({ data: {} });

    service.deleteRoutingRule('r1').subscribe();
    const del = httpMock.expectOne((r) => r.url.endsWith('/esm/helpdesk/routing-rules/r1'));
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });

  it('manages knowledge base versions and mailbox polling', () => {
    service.restoreKbArticleVersion('a1', 3).subscribe();
    const restore = httpMock.expectOne((r) => r.url.endsWith('/esm/kb/articles/a1/versions/3/restore'));
    expect(restore.request.method).toBe('POST');
    restore.flush({ data: {} });

    service.pollMailbox('m1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/esm/helpdesk/mailboxes/m1/poll')).flush({ data: {} });

    service.getMailboxMessages('m1', { page: 2 }).subscribe();
    const messages = httpMock.expectOne((r) => r.url.endsWith('/esm/helpdesk/mailboxes/m1/messages'));
    expect(messages.request.params.get('page')).toBe('2');
    messages.flush({ data: [] });
  });

  it('drives ITSM incidents and changes', () => {
    service.resolveIncident('i1', { resolution: 'ok' }).subscribe();
    const resolve = httpMock.expectOne((r) => r.url.endsWith('/esm/incidents/i1/resolve'));
    expect(resolve.request.body).toEqual({ resolution: 'ok' });
    resolve.flush({ data: {} });

    service.approveChange('c1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/esm/changes/c1/approve')).flush({ data: {} });

    service.getProblems().subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/esm/problems')).flush({ data: [] });
  });

  it('runs work order transitions and reads service contracts', () => {
    service.workOrderAction('w1', 'record-visit', { hours: 2 }).subscribe();
    const visit = httpMock.expectOne((r) => r.url.endsWith('/esm/work-orders/w1/record-visit'));
    expect(visit.request.method).toBe('POST');
    visit.flush({ data: {} });

    service.getServiceContract('s1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/esm/service-contracts/s1')).flush({ data: {} });

    service.submitCsat({ score: 5 }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/esm/csat')).flush({ data: {} });
  });
});
