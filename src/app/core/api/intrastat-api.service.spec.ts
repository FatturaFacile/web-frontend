import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  IntrastatDeclaration,
  IntrastatDeclarationLine,
  IntrastatDeclarationRequest,
  IntrastatExportRequest,
  IntrastatGenerateRequest,
  IntrastatLineRequest,
  IntrastatPeriodicityThresholds,
  IntrastatProductProfile,
  IntrastatSubmitRequest,
  IntrastatValidationResponse,
} from '../models';
import { IntrastatApiService } from './intrastat-api.service';

describe('IntrastatApiService', () => {
  let service: IntrastatApiService;
  let httpMock: HttpTestingController;

  const mockDeclaration: IntrastatDeclaration = {
    id: 'dec-1',
    flow: 'sales',
    model: 'INTRA-1',
    year: 2026,
    periodicity: 'M',
    period: 3,
    reference_number: 1,
    content_code: 0,
    special_case_code: 0,
    includes_statistical_data: true,
    has_annual_flows_above_20_million: false,
    status: 'draft',
    sections: [{ section: 1, count: 5, total_eur: 15000 }],
    lines: [],
    created_at: '2026-03-31T10:00:00Z',
    updated_at: '2026-03-31T10:00:00Z',
  };

  const mockLine: IntrastatDeclarationLine = {
    id: 'line-1',
    line_number: 1,
    section: 1,
    partner_country_code: 'DE',
    partner_vat_number: '123456789',
    amount_eur: 3000,
    cn8_code: '84212100',
    net_mass_kg: 150,
  };

  const mockPeriodicity: IntrastatPeriodicityThresholds = {
    year: 2026,
    advised_periodicity: 'M',
    sales_goods_amount: 150000,
    sales_services_amount: 40000,
    purchases_goods_amount: 250000,
    purchases_services_amount: 100000,
  };

  const mockProfile: IntrastatProductProfile = {
    product_id: 'prod-1',
    product_name: 'Filtro Industriale',
    cn8_code: '84212100',
    cpa_code: '282912',
    origin_country_code: 'IT',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [IntrastatApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(IntrastatApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should list and show declarations', () => {
    service.getDeclarations({ flow: 'sales', year: 2026 }).subscribe((res) => {
      expect(res.data).toEqual([mockDeclaration]);
    });
    const req1 = httpMock.expectOne(
      (r) =>
        r.url.endsWith('/intrastat/declarations') &&
        r.params.get('flow') === 'sales' &&
        r.params.get('year') === '2026',
    );
    expect(req1.request.method).toBe('GET');
    req1.flush({ data: [mockDeclaration] });

    service.getDeclaration('dec-1').subscribe((res) => {
      expect(res.data.id).toBe('dec-1');
    });
    const req2 = httpMock.expectOne((r) => r.url.endsWith('/intrastat/declarations/dec-1'));
    expect(req2.request.method).toBe('GET');
    req2.flush({ data: mockDeclaration });
  });

  it('should create, generate, update, and delete declarations', () => {
    const createReq: IntrastatDeclarationRequest = {
      flow: 'sales',
      year: 2026,
      periodicity: 'M',
      period: 4,
    };
    service.createDeclaration(createReq).subscribe((res) => {
      expect(res.data.id).toBe('dec-1');
    });
    const req1 = httpMock.expectOne((r) => r.url.endsWith('/intrastat/declarations'));
    expect(req1.request.method).toBe('POST');
    req1.flush({ data: mockDeclaration });

    const genReq: IntrastatGenerateRequest = {
      flow: 'sales',
      year: 2026,
      periodicity: 'M',
      period: 4,
      unclassified_as: 'goods',
    };
    service.generateDeclaration(genReq).subscribe((res) => {
      expect(res.data.id).toBe('dec-1');
    });
    const req2 = httpMock.expectOne((r) => r.url.endsWith('/intrastat/declarations/generate'));
    expect(req2.request.method).toBe('POST');
    req2.flush({ data: mockDeclaration });

    service.updateDeclaration('dec-1', { notes: 'Updated notes' }).subscribe((res) => {
      expect(res.data.notes).toBe('Updated notes');
    });
    const req3 = httpMock.expectOne((r) => r.url.endsWith('/intrastat/declarations/dec-1'));
    expect(req3.request.method).toBe('PUT');
    req3.flush({ data: { ...mockDeclaration, notes: 'Updated notes' } });

    service.deleteDeclaration('dec-1').subscribe((res) => {
      expect(res.message).toBe('Deleted');
    });
    const req4 = httpMock.expectOne((r) => r.url.endsWith('/intrastat/declarations/dec-1'));
    expect(req4.request.method).toBe('DELETE');
    req4.flush({ message: 'Deleted' });
  });

  it('should validate, submit, add/delete lines and export telematic file', () => {
    const valResp: IntrastatValidationResponse = { is_valid: true, problems: [] };
    service.validateDeclaration('dec-1').subscribe((res) => {
      expect(res.data.is_valid).toBe(true);
    });
    const req1 = httpMock.expectOne((r) => r.url.endsWith('/intrastat/declarations/dec-1/validate'));
    expect(req1.request.method).toBe('POST');
    req1.flush({ data: valResp });

    const submitReq: IntrastatSubmitRequest = { protocol_number: 'PROT-DOGANE-2026-999' };
    service.submitDeclaration('dec-1', submitReq).subscribe((res) => {
      expect(res.data.status).toBe('submitted');
    });
    const req2 = httpMock.expectOne((r) => r.url.endsWith('/intrastat/declarations/dec-1/submit'));
    expect(req2.request.method).toBe('POST');
    req2.flush({ data: { ...mockDeclaration, status: 'submitted', protocol_number: 'PROT-DOGANE-2026-999' } });

    const lineReq: IntrastatLineRequest = {
      section: 1,
      partner_country_code: 'DE',
      amount_eur: 3000,
    };
    service.addLine('dec-1', lineReq).subscribe((res) => {
      expect(res.data.id).toBe('line-1');
    });
    const req3 = httpMock.expectOne((r) => r.url.endsWith('/intrastat/declarations/dec-1/lines'));
    expect(req3.request.method).toBe('POST');
    req3.flush({ data: mockLine });

    service.deleteLine('dec-1', 'line-1').subscribe((res) => {
      expect(res.message).toBe('Deleted');
    });
    const req4 = httpMock.expectOne((r) => r.url.endsWith('/intrastat/declarations/dec-1/lines/line-1'));
    expect(req4.request.method).toBe('DELETE');
    req4.flush({ message: 'Deleted' });

    const expReq: IntrastatExportRequest = { declaration_ids: ['dec-1'], channel: 'entratel', customs_section_code: '123456' };
    service.exportDeclaration(expReq).subscribe((res) => {
      expect(res.file_name).toBe('ZENT1112.I01');
      expect(res.content).toBe('SC_RAW_CONTENT');
    });
    const req5 = httpMock.expectOne((r) => r.url.endsWith('/intrastat/exports'));
    expect(req5.request.method).toBe('POST');
    expect(req5.request.body).toEqual(expReq);
    req5.flush('SC_RAW_CONTENT', { headers: { 'Content-Disposition': 'attachment; filename="ZENT1112.I01"' } });
  });

  it('should get periodicity and manage product profiles', () => {
    service.getPeriodicity(2026).subscribe((res) => {
      expect(res.data.advised_periodicity).toBe('M');
    });
    const req1 = httpMock.expectOne((r) => r.url.endsWith('/intrastat/periodicity') && r.params.get('year') === '2026');
    expect(req1.request.method).toBe('GET');
    req1.flush({ data: mockPeriodicity });

    service.getProductProfiles().subscribe((res) => {
      expect(res.data).toEqual([mockProfile]);
    });
    const req2 = httpMock.expectOne((r) => r.url.endsWith('/intrastat/product-profiles'));
    expect(req2.request.method).toBe('GET');
    req2.flush({ data: [mockProfile] });

    service.setProductProfile('prod-1', { cn8_code: '84212100' }).subscribe((res) => {
      expect(res.data.cn8_code).toBe('84212100');
    });
    const req3 = httpMock.expectOne((r) => r.url.endsWith('/intrastat/product-profiles/prod-1'));
    expect(req3.request.method).toBe('PUT');
    req3.flush({ data: mockProfile });
  });
});
