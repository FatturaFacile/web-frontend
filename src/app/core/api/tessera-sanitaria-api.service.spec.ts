import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  TesseraSanitariaExpense,
  TesseraSanitariaExpenseRequest,
  TesseraSanitariaSettings,
  TesseraSanitariaSettingsRequest,
  TesseraSanitariaSummary,
} from '../models';
import { TesseraSanitariaApiService } from './tessera-sanitaria-api.service';

describe('TesseraSanitariaApiService', () => {
  let service: TesseraSanitariaApiService;
  let httpMock: HttpTestingController;

  const mockSettings: TesseraSanitariaSettings = {
    is_enabled: true,
    subject_type: 'professional',
    owner_fiscal_code: 'RSSMRA80A01H501Z',
    region_code: '030',
    asl_code: '201',
    ssa_code: '999999',
  };

  const mockExpense: TesseraSanitariaExpense = {
    id: 'exp-1',
    document_type: 'invoice',
    document_id: 'inv-100',
    document_number: 'FATT-2026-001',
    expense_type: 'SV',
    payment_date: '2026-03-15',
    amount: 120.0,
    patient_fiscal_code: 'VRDLGI85C10H501K',
    patient_opposition: false,
    payment_traceable: true,
    transmission_status: 'pending',
  };

  const mockSummary: TesseraSanitariaSummary = {
    year: 2026,
    total_expenses: 45,
    total_amount: 5400.0,
    total_traceable_amount: 5100.0,
    total_opposed: 2,
    total_transmitted: 0,
    total_pending: 43,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TesseraSanitariaApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(TesseraSanitariaApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should retrieve and update settings', () => {
    service.getSettings().subscribe((res) => {
      expect(res.data).toEqual(mockSettings);
    });
    const req1 = httpMock.expectOne((r) => r.url.endsWith('/tessera-sanitaria/settings'));
    expect(req1.request.method).toBe('GET');
    req1.flush({ data: mockSettings });

    const updateReq: TesseraSanitariaSettingsRequest = {
      is_enabled: true,
      subject_type: 'structure',
      ssa_code: '888888',
    };
    service.updateSettings(updateReq).subscribe((res) => {
      expect(res.data.subject_type).toBe('structure');
    });
    const req2 = httpMock.expectOne((r) => r.url.endsWith('/tessera-sanitaria/settings'));
    expect(req2.request.method).toBe('PUT');
    req2.flush({ data: { ...mockSettings, subject_type: 'structure', ssa_code: '888888' } });
  });

  it('should list and retrieve health expenses', () => {
    service.getExpenses({ year: 2026 }).subscribe((res) => {
      expect(res.data).toEqual([mockExpense]);
    });
    const req1 = httpMock.expectOne((r) => r.url.endsWith('/tessera-sanitaria/expenses') && r.params.get('year') === '2026');
    expect(req1.request.method).toBe('GET');
    req1.flush({ data: [mockExpense] });

    service.getExpense('exp-1').subscribe((res) => {
      expect(res.data.id).toBe('exp-1');
    });
    const req2 = httpMock.expectOne((r) => r.url.endsWith('/tessera-sanitaria/expenses/exp-1'));
    expect(req2.request.method).toBe('GET');
    req2.flush({ data: mockExpense });
  });

  it('should flag an expense and remove flag', () => {
    const payload: TesseraSanitariaExpenseRequest = {
      document_type: 'invoice',
      document_id: 'inv-100',
      expense_type: 'SP',
      payment_date: '2026-03-20',
      amount: 150.0,
      patient_opposition: false,
      payment_traceable: true,
    };

    service.flagExpense(payload).subscribe((res) => {
      expect(res.data.id).toBe('exp-1');
    });
    const req1 = httpMock.expectOne((r) => r.url.endsWith('/tessera-sanitaria/expenses'));
    expect(req1.request.method).toBe('POST');
    req1.flush({ data: mockExpense });

    service.removeExpenseFlag('exp-1').subscribe((res) => {
      expect(res.message).toBe('Removed');
    });
    const req2 = httpMock.expectOne((r) => r.url.endsWith('/tessera-sanitaria/expenses/exp-1'));
    expect(req2.request.method).toBe('DELETE');
    req2.flush({ message: 'Removed' });
  });

  it('should get annual summary and export expenses', () => {
    service.getSummary(2026).subscribe((res) => {
      expect(res.data).toEqual(mockSummary);
    });
    const req1 = httpMock.expectOne((r) => r.url.endsWith('/tessera-sanitaria/summary') && r.params.get('year') === '2026');
    expect(req1.request.method).toBe('GET');
    req1.flush({ data: mockSummary });

    service.exportExpenses(2026, 'csv').subscribe((res) => {
      expect(res.data).toBeDefined();
    });
    const req2 = httpMock.expectOne((r) => r.url.endsWith('/tessera-sanitaria/export') && r.params.get('format') === 'csv');
    expect(req2.request.method).toBe('GET');
    req2.flush({ data: 'csv_data_content' });
  });
});
