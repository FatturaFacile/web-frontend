import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ClientApiService } from './client-api.service';
import { ContactPayload } from '../models';

describe('ClientApiService', () => {
  let service: ClientApiService;
  let httpTesting: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/crm/contacts`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ClientApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ClientApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('lists contacts with query filters and defensive pagination fallback', () => {
    service.list({ page: 1, type: 'client', search: 'Mario' }).subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.meta.total).toBe(1);
    });

    const req = httpTesting.expectOne(
      (r) =>
        r.url === baseUrl &&
        r.params.get('page') === '1' &&
        r.params.get('type') === 'client' &&
        r.params.get('search') === 'Mario',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'OK', data: [{ id: 'c-1', display_name: 'Mario Rossi' }] });
  });

  it('unwraps the Laravel paginator that the API returns inside data', () => {
    service.list({ page: 2 }).subscribe((res) => {
      expect(res.data).toEqual([{ id: 'c-1', display_name: 'Mario Rossi' }]);
      expect(res.meta).toEqual({ current_page: 2, from: 26, to: 26, last_page: 2, per_page: 25, total: 26 });
    });

    httpTesting.expectOne((r) => r.url === baseUrl).flush({
      success: true,
      message: 'OK',
      data: {
        current_page: 2,
        data: [{ id: 'c-1', display_name: 'Mario Rossi' }],
        from: 26,
        to: 26,
        last_page: 2,
        per_page: 25,
        total: 26,
      },
    });
  });

  it('gets a single contact by id', () => {
    service.get('c-1').subscribe((res) => {
      expect(res.data.id).toBe('c-1');
    });

    const req = httpTesting.expectOne(`${baseUrl}/c-1`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'OK', data: { id: 'c-1', display_name: 'Mario Rossi' } });
  });

  it('creates a new contact', () => {
    const payload = {
      type: 'client',
      company_name: 'Rossi Ltd',
      country: 'CH',
    } as ContactPayload;

    service.create(payload).subscribe((res) => {
      expect(res.data.id).toBe('c-2');
    });

    const req = httpTesting.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ success: true, message: 'Created', data: { id: 'c-2', ...payload } });
  });

  it('updates a contact', () => {
    service.update('c-1', { company_name: 'Rossi Updated' }).subscribe((res) => {
      expect(res.data.company_name).toBe('Rossi Updated');
    });

    const req = httpTesting.expectOne(`${baseUrl}/c-1`);
    expect(req.request.method).toBe('PUT');
    req.flush({ success: true, message: 'Updated', data: { id: 'c-1', company_name: 'Rossi Updated' } });
  });

  it('deletes a contact', () => {
    service.delete('c-1').subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const req = httpTesting.expectOne(`${baseUrl}/c-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, message: 'Deleted', data: null });
  });
});
