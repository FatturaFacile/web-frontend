import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { ProfessionalsApiService } from './professionals-api.service';
import { CreateTimeLogPayload, LegalCase } from '../models';

describe('ProfessionalsApiService', () => {
  let service: ProfessionalsApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/professionals`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProfessionalsApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ProfessionalsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches legal cases, time logs, and fee notes', () => {
    const mockCase: LegalCase = {
      id: 'case-1',
      case_number: 'PRATICA-2026-001',
      client_id: 'cli-1',
      title: 'Consulenza Societaria Straordinaria',
      status: 'open',
      aml_kyc_completed: true,
    };

    service.getCases({ page: 2, sort_by: 'title' } as never).subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].case_number).toBe('PRATICA-2026-001');
    });

    const cReq = httpMock.expectOne((r) => r.url === `${base}/cases`);
    expect(cReq.request.method).toBe('GET');
    expect(cReq.request.params.get('page')).toBe('2');
    expect(cReq.request.params.get('sort_by')).toBe('title');
    cReq.flush({ data: [mockCase] });

    service.getTimeLogs().subscribe((res) => {
      expect(res.data.length).toBe(1);
    });

    const tReq = httpMock.expectOne(`${base}/time-logs`);
    expect(tReq.request.method).toBe('GET');
    tReq.flush({
      data: [
        {
          id: 'tl-1',
          legal_case_id: 'case-1',
          date: '2026-04-10',
          duration_minutes: 120,
          hourly_rate: 250,
          description: 'Redazione parere legale',
        },
      ],
    });

    service.getFeeNotes().subscribe((res) => {
      expect(res.data.length).toBe(1);
    });

    const fReq = httpMock.expectOne(`${base}/fee-notes`);
    expect(fReq.request.method).toBe('GET');
    fReq.flush({
      data: [
        {
          id: 'fn-1',
          note_number: 'PAR-2026-01',
          legal_case_id: 'case-1',
          total_amount: 3000,
          status: 'issued',
        },
      ],
    });
  });

  it('logs time on a legal case', () => {
    const payload: CreateTimeLogPayload = {
      legal_case_id: 'case-1',
      date: '2026-04-12',
      duration_minutes: 90,
      hourly_rate: 250,
      description: 'Partecipazione ad udienza preliminare',
    };

    service.logTime(payload).subscribe((res) => {
      expect(res.data.id).toBe('tl-new');
    });

    const postReq = httpMock.expectOne(`${base}/time-logs`);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual(payload);
    postReq.flush({ data: { id: 'tl-new', ...payload } });
  });
});
