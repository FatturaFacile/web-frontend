import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { ConstructionApiService } from './construction-api.service';
import {
  ConstructionProgressBillingPayload,
  ConstructionSite,
} from '../models';

describe('ConstructionApiService', () => {
  let service: ConstructionApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/construction`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConstructionApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ConstructionApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches construction sites and SAL progress billings', () => {
    const mockSite: ConstructionSite = {
      id: 'site-1',
      code: 'CANTIERE-001',
      client: 'Immobiliare Ticino SA',
      location: 'Lugano',
      regime: 'CH',
      sal: 'SAL 2',
      norm: 'SIA 118',
      vatRegime: 'IVA 8.1%',
    };

    service.getSites().subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].code).toBe('CANTIERE-001');
    });

    const sReq = httpMock.expectOne(`${base}/sites`);
    expect(sReq.request.method).toBe('GET');
    sReq.flush({ data: [mockSite] });

    service.getProgressBillings().subscribe((res) => {
      expect(res.data.length).toBe(1);
    });

    const salReq = httpMock.expectOne(`${base}/sal`);
    expect(salReq.request.method).toBe('GET');
    salReq.flush({
      data: [
        {
          id: 'sal-1',
          construction_site_id: 'site-1',
          sal_number: 'SAL-1',
          progress_percentage: 25,
          certified_amount: 50000,
          status: 'approved',
        },
      ],
    });
  });

  it('creates progress billing (SAL)', () => {
    const payload: ConstructionProgressBillingPayload = {
      construction_site_id: 'site-1',
      sal_number: 'SAL-2',
      progress_percentage: 50,
      certified_amount: 100000,
      notes: 'Completamento getto fondamenta e piano terra',
    };

    service.createProgressBilling(payload).subscribe((res) => {
      expect(res.data.id).toBe('sal-2');
    });

    const postReq = httpMock.expectOne(`${base}/sal`);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual(payload);
    postReq.flush({ data: { id: 'sal-2', status: 'draft', ...payload } });
  });
});
