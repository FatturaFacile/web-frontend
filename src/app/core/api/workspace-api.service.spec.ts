import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { WorkspaceApiService } from './workspace-api.service';
import {
  AuthorizeWorkspaceRequest,
  WorkspaceCallbackRequest,
  WorkspaceConnectionResource,
  WorkspaceItemResource,
} from '../models';

describe('WorkspaceApiService', () => {
  let service: WorkspaceApiService;
  let httpTesting: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/workspace`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        WorkspaceApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(WorkspaceApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should list own workspace connections', () => {
    const mockConnections = {
      data: [
        {
          id: 'conn-1',
          provider: 'google',
          scopes: ['calendar', 'mail'],
          consent_given_at: '2026-11-01T10:00:00Z',
          last_synced_at: '2026-11-09T08:00:00Z',
        } as WorkspaceConnectionResource,
      ],
    };

    service.getConnections().subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].provider).toBe('google');
    });

    const req = httpTesting.expectOne(`${baseUrl}/connections`);
    expect(req.request.method).toBe('GET');
    req.flush(mockConnections);
  });

  it('should start connection authorization flow', () => {
    const payload: AuthorizeWorkspaceRequest = {
      consent: true,
      scopes: ['calendar', 'mail'],
    };
    const mockResponse = {
      data: {
        authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth?...',
      },
    };

    service.authorize('google', payload).subscribe((res) => {
      expect(res.data.authorization_url).toContain('https://accounts.google.com');
    });

    const req = httpTesting.expectOne(`${baseUrl}/connections/google/authorize`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResponse);
  });

  it('should complete connection via callback code and state', () => {
    const payload: WorkspaceCallbackRequest = {
      code: 'auth-code-123',
      state: 'state-nonce-456',
    };

    service.callback('microsoft', payload).subscribe();

    const req = httpTesting.expectOne(`${baseUrl}/connections/microsoft/callback`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ success: true });
  });

  it('should sync connection and return synced items count', () => {
    service.sync('conn-1').subscribe((res) => {
      expect(res.data.items).toBe(42);
    });

    const req = httpTesting.expectOne(`${baseUrl}/connections/conn-1/sync`);
    expect(req.request.method).toBe('POST');
    req.flush({ data: { items: 42 } });
  });

  it('should revoke connection and list synced items', () => {
    service.revoke('conn-1').subscribe();

    const req1 = httpTesting.expectOne(`${baseUrl}/connections/conn-1`);
    expect(req1.request.method).toBe('DELETE');
    req1.flush({ success: true });

    const mockItems = {
      data: [
        {
          id: 'item-1',
          kind: 'calendar_event',
          subject: 'Meeting with Mario',
          counterpart: 'mario@example.com',
          starts_at: '2026-11-10T09:00:00Z',
          ends_at: '2026-11-10T10:00:00Z',
        } as WorkspaceItemResource,
      ],
    };

    service.getItems({ kind: 'calendar_event' }).subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].kind).toBe('calendar_event');
    });

    const req2 = httpTesting.expectOne((r) => r.url === `${baseUrl}/items` && r.params.get('kind') === 'calendar_event');
    expect(req2.request.method).toBe('GET');
    req2.flush(mockItems);
  });
});
