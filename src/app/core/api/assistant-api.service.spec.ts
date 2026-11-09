import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { AssistantApiService } from './assistant-api.service';
import {
  AskAssistantRequest,
  AssistantAnswer,
  AssistantCatalogueEntry,
  AssistantLogResource,
} from '../models';

describe('AssistantApiService', () => {
  let service: AssistantApiService;
  let httpTesting: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/assistant`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AssistantApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AssistantApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should send natural language question to ask endpoint', () => {
    const payload: AskAssistantRequest = { question: 'What is our Q3 revenue?' };
    const mockResponse = {
      data: {
        outcome: 'answered' as const,
        query: 'revenue_by_quarter',
        description: 'Total revenue for Q3',
        parameters: { quarter: 3 },
        rows: [{ revenue: 154200 }],
      } as AssistantAnswer,
    };

    service.ask(payload).subscribe((res) => {
      expect(res.data.outcome).toBe('answered');
      expect(res.data.rows?.length).toBe(1);
    });

    const req = httpTesting.expectOne(`${baseUrl}/ask`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResponse);
  });

  it('should retrieve assistant catalogue', () => {
    const mockCatalogue = {
      data: [
        { key: 'top_customers', description: 'Show top 5 customers by sales' },
        { key: 'inventory_shortage', description: 'Show items below minimum reorder level' },
      ] as AssistantCatalogueEntry[],
    };

    service.getCatalogue().subscribe((res) => {
      expect(res.data.length).toBe(2);
      expect(res.data[0].key).toBe('top_customers');
    });

    const req = httpTesting.expectOne(`${baseUrl}/catalogue`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCatalogue);
  });

  it('should retrieve logs with query parameters', () => {
    const mockLogs = {
      data: [
        {
          id: 'log-1',
          user_id: 'usr-1',
          question: 'Which invoices are overdue?',
          resolver: 'catalogue',
          outcome: 'answered',
          row_count: 5,
          created_at: '2026-11-09T10:00:00Z',
        },
      ] as AssistantLogResource[],
    };

    service.getLogs({ outcome: 'answered', per_page: 15 }).subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].id).toBe('log-1');
    });

    const req = httpTesting.expectOne((r) => r.url === `${baseUrl}/logs` && r.params.get('outcome') === 'answered');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('per_page')).toBe('15');
    req.flush(mockLogs);
  });
});
