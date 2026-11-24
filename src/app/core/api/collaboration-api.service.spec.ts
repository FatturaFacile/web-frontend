import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CollaborationApiService } from './collaboration-api.service';

describe('CollaborationApiService', () => {
  let service: CollaborationApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CollaborationApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(CollaborationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('searches with the text, the record types as an array and the limit', () => {
    service.search({ q: 'acme', types: ['contact', 'invoice'], limit: 3 }).subscribe();

    const request = httpMock.expectOne((r) => r.url.endsWith('/collaboration/search'));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('q')).toBe('acme');
    expect(request.request.params.getAll('types[]')).toEqual(['contact', 'invoice']);
    expect(request.request.params.get('limit')).toBe('3');
    request.flush({ data: [] });
  });

  it('skips the optional search parameters when they are not given', () => {
    service.search({ q: 'acme' }).subscribe();

    const request = httpMock.expectOne((r) => r.url.endsWith('/collaboration/search'));
    expect(request.request.params.has('types[]')).toBe(false);
    expect(request.request.params.has('limit')).toBe(false);
    request.flush({ data: [] });
  });

  it('posts a comment with the API field names to the record of its type', () => {
    const payload = { body: 'Please check', mentions: ['user-1'] };

    service.createComment('contact', 'rec-1', payload).subscribe();

    const request = httpMock.expectOne((r) => r.url.endsWith('/collaboration/records/contact/rec-1/comments'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ data: {} });
  });

  it('edits and deletes a comment by its own id', () => {
    service.updateComment('c1', { body: 'Edited' }).subscribe();
    const put = httpMock.expectOne((r) => r.url.endsWith('/collaboration/comments/c1'));
    expect(put.request.method).toBe('PUT');
    put.flush({ data: {} });

    service.deleteComment('c1').subscribe();
    const del = httpMock.expectOne((r) => r.url.endsWith('/collaboration/comments/c1'));
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });

  it('attaches a tag by name and detaches it by id', () => {
    service.attachTag('invoice', 'rec-2', { name: 'VIP' }).subscribe();
    const post = httpMock.expectOne((r) => r.url.endsWith('/collaboration/records/invoice/rec-2/tags'));
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ name: 'VIP' });
    post.flush({ data: [] });

    service.detachTag('invoice', 'rec-2', 'tag-1').subscribe();
    const del = httpMock.expectOne((r) => r.url.endsWith('/collaboration/records/invoice/rec-2/tags/tag-1'));
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });

  it('lists the tags, the records of a tag, the activity and the mentionable users', () => {
    service.getTags('vi').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/collaboration/tags') && r.params.get('q') === 'vi').flush({ data: [] });

    service.getTagRecords('tag-1', 'contact').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/collaboration/tags/tag-1/records') && r.params.get('type') === 'contact').flush({ data: [] });

    service.getActivity('project', 'rec-3').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/collaboration/records/project/rec-3/activity')).flush({ data: [] });

    service.getMentionableUsers('ma').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/collaboration/mentionable-users') && r.params.get('q') === 'ma').flush({ data: [] });
  });
});
